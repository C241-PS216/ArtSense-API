const validateToken = (firestore) => async (decoded, request, h) => {
  try {
    const token = request.state.token;

    if (!token) {
      return { isValid: false };
    }

    const tokensRef = firestore.collection('token');
    const snapshot = await tokensRef.where('token', '==', token).get();

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
