const Hapi = require('@hapi/hapi');
const dotenv = require('dotenv');
const routes = require('./routes');
const { validateToken } = require('./middleware');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

dotenv.config();

const firestore = new Firestore({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.FIRESTORE_KEYFILE
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

  server.auth.strategy('jwt', 'jwt', {
    key: process.env.JWT_SECRET,
    validate: validateToken(firestore),
    verifyOptions: {
      algorithms: ['HS256'],
    },
  });

  server.auth.default('jwt');

  server.route(routes(firestore, storage));

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
