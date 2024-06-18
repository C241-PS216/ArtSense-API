const Joi = require('@hapi/joi');

const handlers = require('./handler');

const routes = (firestore) => [
  {
    method: 'POST',
    path: '/register',
    handler: handlers.registerHandler(firestore),
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
    handler: handlers.loginHandler(firestore),
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
    handler: handlers.getArtist(firestore),
  },
  {
    method: 'GET',
    path: '/history',
    handler: handlers.getHistory(firestore),
  },
];

module.exports = routes;
