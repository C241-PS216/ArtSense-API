const validateToken = (firestore) => async (decoded, request, h) => {
  try {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return { isValid: false };
    }

    const token = authorization.split(' ')[1]; // Extract the token part from "Bearer <token>"

    if (!token) {
      return { isValid: false };
    }

    const tokensRef = firestore.collection('tokens');
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
