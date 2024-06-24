const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const inferImage = require('./inferImage');
const tf = require('@tensorflow/tfjs-node');
const loadModel = require('./loadModel');


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

    const model = loadModel();
    const artistData = await inferImage(publicUrl, model);

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
  getProfile,
};
