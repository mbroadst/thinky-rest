'use strict';
var type = require('thinky').type,
    validator = require('validator');

var schemas = module.exports = {};

if (!!process.env.USE_THINKAGAIN) {
  schemas.User = {
    type: 'object',
    properties: {
      username: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
    required: [ 'username' ]
  };

  schemas.Person = {
    type: 'object',
    properties: {
      firstname: { type: 'string' },
      lastname: { type: 'string' }
    }
  };
} else {
  schemas.User = {
    username: type.string().required(),
    email: type.string().validator(validator.isEmail)
  };

  schemas.Person = {
    firstname: type.string(),
    lastname: type.string()
  };
}
