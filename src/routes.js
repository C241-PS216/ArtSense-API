const Joi = require('@hapi/joi');
const { 
  registerHandler, 
  loginHandler ,
  getArtist,
} = require('./handlers');

const routes = [
  {
    method: 'POST',
    path: '/register',
    handler: registerHandler,
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
    handler: loginHandler,
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
    handler: getArtist,
  },
];

module.exports = routes;
