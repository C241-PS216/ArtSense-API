const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const db = admin.firestore();
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS);

const registerHandler = async (request, h) => {
  try {
    const { username, password } = request.payload;
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const userId = nanoid();

    const userRef = db.collection('users').doc(userId);
    await userRef.set({ username, password: hashedPassword });

    return h.response({ 
      userId, 
      username 
    }).code(201);
  } catch (error) {
    console.error('Error registering user:', error);
    return h.response({ 
      error: 'Failed to register user' 
    }).code(500);
  }
};

const loginHandler = async (request, h) => {
  try {
    const { username, password } = request.payload;

    const usersRef = db.collection('users');
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

const getArtist = (request, h) => {
  const { artistName } = request.params;

  const artist = db.collection('Artist')
  
}

module.exports(
  registerHandler,
  loginHandler,
  getArtist,
)