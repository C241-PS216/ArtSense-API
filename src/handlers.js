const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs-node');
const { Storage } = require('@google-cloud/storage');

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS);

const nanoid = async () => {
  const { nanoid } = await import('nanoid');
  return nanoid();
};

const registerHandler = (firestore) => async (request, h) => {
  try {
    console.log("1");
    const { username, password } = request.payload;
    console.log("2");
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    console.log('3');
    const userId = await nanoid();
        console.log('4');

    const userRef = firestore.collection('users').doc(userId);
        console.log('5');

    await userRef.set({ username, password: hashedPassword });
    console.log('6');

    return h.response({ userId, username }).code(201);
    
  } catch (error) {
    console.error('Error registering user:', error);
    return h.response({ error: 'Failed to register user' }).code(500);
  }
};

const loginHandler = (firestore) => async (request, h) => {
  try {
    const { username, password } = request.payload;

    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      return h.response({ error: 'Invalid username or password' }).code(401);
    }

    const user = snapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return h.response({ error: 'Invalid username or password' }).code(401);
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });

    // Store token in Firestore
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ token });

    // Set token as a cookie
    return h
      .response({ message: 'Login successful' })
      .state('token', token, {
        isHttpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .code(200);
  } catch (error) {
    console.error('Error logging in:', error);
    return h.response({ error: 'Failed to login' }).code(500);
  }
};

const getArtist = (firestore) => async (request, h) => {
  const { artistName } = request.params;

  const collection = firestore.collection('Artists');
  const querySnapshot = await collection.where('name', '==', artistName).get();

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

const inferImage = async (storage, imageUrl) => {
  try {
    const modelBucket = storage.bucket('model-artsense');
    const modelFile = modelBucket.file('model.h5');
    const modelFilePath = `/tmp/model.h5`;

    await modelFile.download({ destination: modelFilePath });

    const model = await tf.loadLayersModel(`file://${modelFilePath}`);

    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data, 'binary');

    const image = await sharp(imageBuffer).resize({ width: 224, height: 224 }).toBuffer();
    const tensor = tf.node.decodeImage(image).expandDims(0).toFloat().div(tf.scalar(255.0));

    const prediction = model.predict(tensor);
    const predictedIndex = prediction.argMax(-1).dataSync()[0];
    const artistNames = ['shigure ui', 'Artist2', 'Artist3', 'Artist4'];

    return artistNames[predictedIndex];
  } catch (error) {
    console.error('Error in image inference:', error);
    throw new Error('Failed to infer image');
  }
};

const uploadHandler = (storage, firestore) => async (request, h) => {
  try {
    const { file } = request.payload;
    const { createReadStream, filename } = file;

    const bucket = storage.bucket('image-store-as');
    const fileUpload = bucket.file(filename);
    const stream = createReadStream();

    await new Promise((resolve, reject) => {
      stream.pipe(fileUpload.createWriteStream())
        .on('error', reject)
        .on('finish', resolve);
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    const historyData = {
      imageUrl: publicUrl,
      timestamp: new Date(),
    };

    const historyResult = await insertHistory(firestore)(historyData);
    if (!historyResult.success) {
      throw new Error(historyResult.error);
    }

    const predictionResult = await inferImage(storage, publicUrl);
    historyResult.data.prediction = predictionResult;

    return h.response({ url: publicUrl, history: historyResult.data }).code(200);
  } catch (error) {
    console.error('Error uploading file:', error);
    return h.response({ error: 'Failed to upload file' }).code(500);
  }
};

module.exports = {
  registerHandler,
  loginHandler,
  getArtist,
  getHistory,
  insertHistory,
  uploadHandler,
  inferImage,
};
