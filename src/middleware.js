const admin = require('firebase-admin');
const db = admin.firestore();

exports.validateToken = async (decoded, request, h) => {
  try {
    const token = request.state.token;

    if (!token) {
      return { isValid: false };
    }

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('token', '==', token).get();

    if (snapshot.empty) {
      return { isValid: false };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating token:', error);
    return { isValid: false };
  }
};
