const dotenv = require('dotenv');
dotenv.config();

const MODEL_URL = process.env.MODEL_URL;
const tf = require('@tensorflow/tfjs-node');

async function loadModel() {
  try {
    const model = await tf.loadLayersModel(MODEL_URL);
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    throw new Error('Failed to load model');
  }
}

module.exports = loadModel;

