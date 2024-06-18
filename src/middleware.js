const validateToken = (firestore) => async (decoded, request, h) => {
  try {
    const token = request.state.token;

    if (!token) {
      return { isValid: false };
    }

    const usersRef = firestore.collection('users');
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

module.exports = {
  validateToken,
};
