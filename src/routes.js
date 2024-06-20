const Joi = require('@hapi/joi');
const { registerHandler, loginHandler, getArtist, getHistory, uploadHandler } = require('./handlers');

const routes = (firestore, storage) => [
  {
    method: 'POST',
    path: '/register',
    handler: registerHandler(firestore),
    options: {
      auth: false,  // No authentication required for registration
      validate: {
        payload: Joi.object({
          username: Joi.string().required(),
          password: Joi.string().required(),
        }),
      },
    },
  },
  {
    method: 'POST',
    path: '/login',
    handler: loginHandler(firestore),
    options: {
      auth: false,  // No authentication required for login
      validate: {
        payload: Joi.object({
          username: Joi.string().required(),
          password: Joi.string().required(),
        }),
      },
    },
  },
  {
    method: 'GET',
    path: '/profile',
    handler: (request, h) => {
      return h.response({ message: 'You are authenticated' }).code(200);
    },
  },
  {
    method: 'GET',
    path: '/artists/{artistName}',
    handler: getArtist(firestore),
  },
  {
    method: 'GET',
    path: '/history',
    handler: getHistory(firestore),
  },
  {
    method: 'POST',
    path: '/upload',
    handler: uploadHandler(storage, firestore),
    options: {
      payload: {
        output: 'stream',
        allow: 'multipart/form-data',
        maxBytes: 10 * 1024 * 1024, // 10 MB limit
      },
    },
  },
];

module.exports = routes;
