const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');
const sharp = require('sharp');

async function inferImage(imageUrl, model, artistSnapshot) {
  try {
    console.log('Downloading image from URL:', imageUrl);
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });
    const imageBuffer = Buffer.from(imageResponse.data, 'binary');
    const image = await sharp(imageBuffer)
      .resize({ width: 224, height: 224 })
      .toBuffer();

    const tensor = tf.node
      .decodeImage(image)
      .expandDims(0)
      .toFloat()
      .div(tf.scalar(255.0));

    console.log('Making a prediction');
    const prediction = model.predict(tensor);

    console.log('Prediction result:', prediction);

    const artistName = prediction.argMax(-1).dataSync()[0];
    const artistDoc = artistSnapshot.docs.find(
      (doc) => doc.data().nama === artistName
    );
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
}

module.exports = inferImage;
