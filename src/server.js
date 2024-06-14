const Hapi = require('@hapi/hapi');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const routes = require('./routes');
const { validateToken } = require('./middleware');

dotenv.config();

const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
const JWT_SECRET = process.env.JWT_SECRET;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: 'localhost',
  });

  await server.register(require('@hapi/jwt'));

  server.auth.strategy('jwt', 'jwt', {
    key: JWT_SECRET,
    validate: validateToken,
    verifyOptions: { algorithms: ['HS256'] },
  });

  server.auth.default('jwt');

  server.route(routes);

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

init();
