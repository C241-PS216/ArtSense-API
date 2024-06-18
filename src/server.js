const Hapi = require('@hapi/hapi');
const dotenv = require('dotenv');
const routes = require('./routes');
const { validateToken } = require('./middleware');
const { Firestore } = require('@google-cloud/firestore');

dotenv.config();

const firestore = new Firestore({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.FIRESTORE_KEY_FILE_PATH,
});

const JWT_SECRET = process.env.JWT_SECRET;

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: 'localhost',
  });

  await server.register(require('@hapi/jwt'));

  server.auth.strategy('jwt', 'jwt', {
    key: JWT_SECRET,
    validate: validateToken(firestore),
    verifyOptions: { algorithms: ['HS256'] },
  });

  server.auth.default('jwt');

  server.route(routes(firestore));

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

init();
