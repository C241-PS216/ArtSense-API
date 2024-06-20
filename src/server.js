const Hapi = require('@hapi/hapi');
const dotenv = require('dotenv');
const routes = require('./routes');
const { validateToken } = require('./middleware');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const firestore = new Firestore({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.FIRESTORE_KEY_FILE_PATH
});

const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.STORAGE_KEYFILE
});

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    routes: {
      cors: true,
    },
  });

  await server.register(require('@hapi/jwt'));

  server.auth.strategy('jwt', 'jwt', {
    keys: JWT_SECRET,
    validate: validateToken(firestore),
    verify: {
      // Verify configuration block
      aud: false, // Disable audience validation (or specify the audience if needed)
      iss: false, // Disable issuer validation (or specify the issuer if needed)
      sub: false, // Disable subject validation (or specify the subject if needed)
    },
  });

  server.auth.default('jwt');
  console.log("1");
  server.route(routes(firestore, storage));
  console.log("2");

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
