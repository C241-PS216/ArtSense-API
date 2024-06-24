const dotenv = require('dotenv');
dotenv.config();

const MODEL_URL = process.env.MODEL_URL;
const tf = require('@tensorflow/tfjs-node');

async function loadModel() {
  console.log(MODEL_URL);
  return tf.loadLayersModel(MODEL_URL);
}

module.exports = loadModel;
