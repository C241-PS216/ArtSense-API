const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');
const sharp = require('sharp');

async function inferImage(imageUrl, model){
  try {
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

    // Make a prediction
    const prediction = model.predict(tensor);

    // Fetch artist data
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
};

module.exports = inferImage;