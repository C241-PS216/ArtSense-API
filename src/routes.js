const Joi = require('@hapi/joi');

const { registerHandler, loginHandler, getArtist, getHistory } = require('./handlers');

const routes = (firestore) => [
  {
    method: 'POST',
    path: '/register',
    handler: registerHandler(firestore),
    options: {
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
];

module.exports = routes;
