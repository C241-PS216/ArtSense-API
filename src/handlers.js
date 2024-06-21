const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs-node');
const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS);

const nanoid = async () => {
  const { nanoid } = await import('nanoid');
  return nanoid();
};

const registerHandler = (firestore) => async (request, h) => {
  try {
    const { username, password } = request.payload;
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const userId = await nanoid();

    const userRef = firestore.collection('users').doc(userId);
    await userRef.set({ id: userId, username, password: hashedPassword });

    return h.response({ userId, username }).code(201);
  } catch (error) {
    console.error('Error registering user:', error);
    return h.response({ error: 'Failed to register user' }).code(500);
  }
};

const loginHandler = (firestore) => async (request, h) => {
  try {
    const { username, password } = request.payload;

    console.log('Received login request for username:', username);
    console.log('JWT_SECRET:', JWT_SECRET); // Log the JWT secret

    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      console.error('No user found with the username:', username);
      return h.response({ error: 'Invalid username or password' }).code(401);
    }

    const user = snapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.error('Invalid password for username:', username);
      return h.response({ error: 'Invalid username or password' }).code(401);
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });

    // Store token in Firestore in the "tokens" collection
    const tokenRef = firestore.collection('tokens').doc(username);
    await tokenRef.set({ token });

    // Set token as a cookie
    return h
      .response({ 
        message: 'Login successful',
        userid: user.id,
        username: user.username,
        token: token,
      })
      .state('token', token, {
        isHttpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .code(200);
  } catch (error) {
    console.error('Error logging in:', error.message);
    return h.response({ error: 'Failed to login' }).code(500);
  }
};

const getArtist = (firestore) => async (request, h) => {
  const { artistName } = request.params;

  const collection = firestore.collection('artists');
  const querySnapshot = await collection.where('nama', '==', artistName).get();

  if (querySnapshot.empty) {
    return h.response({ error: 'Artist not found' }).code(404);
  }

  const artistData = querySnapshot.docs[0].data();

  return h.response(artistData).code(200);
};

const getHistory = (firestore) => async () => {
  try {
    const historyCollection = firestore.collection('history');
    const snapshot = await historyCollection.get();

    if (snapshot.empty) {
      return [];
    }

    const data = [];
    snapshot.forEach((doc) => {
      data.push({
        id: doc.id,
        history: doc.data(),
      });
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to fetch prediction history: ${error.message}`);
  }
};

const insertHistory = (firestore) => async (data) => {
  try {
    const historyRef = firestore.collection('history').doc();
    await historyRef.set(data);
    return { success: true, data };
  } catch (error) {
    console.error('Error inserting history:', error);
    return { success: false, error: 'Failed to insert history' };
  }
};

const inferImage = async (storage, firestore, imageUrl) => {
  try {
    console.log('Downloading model files...');
    const modelBucket = storage.bucket('model_artsense');
    const modelJsonFile = modelBucket.file('model_architecture.json');
    const modelWeightsFiles = [
      modelBucket.file('model_layer_0_weights.bin'),
      modelBucket.file('model_layer_2_weights.bin'),
      modelBucket.file('model_layer_4_weights.bin')
    ];
    
    const modelJsonFilePath = '/tmp/model_architecture.json';
    const modelWeightsFilePaths = [
      '/tmp/model_layer_0_weights.bin',
      '/tmp/model_layer_2_weights.bin',
      '/tmp/model_layer_4_weights.bin'
    ];

    // Download the model JSON file
    await modelJsonFile.download({ destination: modelJsonFilePath });
    console.log('Model JSON file downloaded to', modelJsonFilePath);

    // Download the model weights files
    await Promise.all(modelWeightsFiles.map((file, index) => file.download({ destination: modelWeightsFilePaths[index] })));
    console.log('Model weights files downloaded to', modelWeightsFilePaths);

    // Check if the files exist and have content
    if (!fs.existsSync(modelJsonFilePath) || fs.statSync(modelJsonFilePath).size === 0) {
      throw new Error('Model JSON file is missing or empty');
    }

    for (const weightsFilePath of modelWeightsFilePaths) {
      if (!fs.existsSync(weightsFilePath) || fs.statSync(weightsFilePath).size === 0) {
        throw new Error('One or more model weights files are missing or empty');
      }
    }

    console.log('Loading TensorFlow model...');
    const model = await tf.loadLayersModel(`file://${modelJsonFilePath}`);
    console.log('Model loaded successfully');

    // Fetch the image from the URL and preprocess it
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data, 'binary');
    const image = await sharp(imageBuffer).resize({ width: 224, height: 224 }).toBuffer();
    const tensor = tf.node.decodeImage(image).expandDims(0).toFloat().div(tf.scalar(255.0));

    // Make a prediction
    const prediction = model.predict(tensor);
    const predictedIndex = prediction.argMax(-1).dataSync()[0];

    // Fetch artist names from Firestore
    const artistSnapshot = await firestore.collection('artists').get();
    const artistNames = artistSnapshot.docs.map(doc => doc.data().nama);
    const artistName = artistNames[predictedIndex];

    // Fetch artist data
    const artistDoc = artistSnapshot.docs.find(doc => doc.data().nama === artistName);
    let artistData;
    if (artistDoc) {
      artistData = artistDoc.data();
    } else {
      artistData = {
        nama: artistName,
        message: `We haven’t found the artist’s social media. The artist is: ${artistName}`,
      };
    }

    return artistData;
  } catch (error) {
    console.error('Error in image inference:', error);
    throw new Error('Failed to infer image');
  }
};



const uploadHandler = (storage, firestore) => async (request, h) => {
  try {
    console.log('Upload handler is running');

    const { file } = request.payload;
    console.log('File payload:', file);

    if (!file || typeof file.pipe !== 'function') {
      throw new Error('Invalid file upload. File is missing or not a stream.');
    }

    const originalFilename = file.hapi.filename;
    const fileExtension = originalFilename.split('.').pop();
    const filename = `${await nanoid()}.${fileExtension}`; // Generate a unique filename with extension

    const bucket = storage.bucket('image-store-as');
    const fileUpload = bucket.file(filename);
    const stream = file; // Directly use the file stream

    await new Promise((resolve, reject) => {
      stream
        .pipe(fileUpload.createWriteStream({
          metadata: {
            contentType: file.hapi.headers['content-type'], // Set the content type
          },
        }))
        .on('error', (err) => {
          console.error('Stream error:', err);
          reject(err);
        })
        .on('finish', resolve);
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log('File uploaded successfully. Public URL:', publicUrl);

    const artistData = await inferImage(storage, firestore, publicUrl);

    // Insert history into Firestore
    const historyData = {
      gambar: publicUrl,
      result: artistData.nama,
      timestamp: new Date(),
    };

    const historyResult = await insertHistory(firestore)(historyData);
    if (!historyResult.success) {
      throw new Error(historyResult.error);
    }

    return h
      .response({
        url: publicUrl,
        history: historyResult.data,
        artist: artistData,
      })
      .code(200);
  } catch (error) {
    console.error('Error uploading file:', error);
    return h.response({ error: 'Failed to upload file' }).code(500);
  }
};


const getProfile = (firestore) => async (request, h) => {
  const { userid } = request.params;
  const usersRef = firestore.collection('users');
  const snapshot = await usersRef.where('id', '==', userid).get();
  const user = snapshot.docs[0].data();
  return h.response({ 
    message: 'You are authenticated',
    id: user.id,
    username: user.username
  }).code(200);
};

module.exports = {
  registerHandler,
  loginHandler,
  getArtist,
  getHistory,
  insertHistory,
  uploadHandler,
  inferImage,
  getProfile,
};
