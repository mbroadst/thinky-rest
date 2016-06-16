'use strict';

var util = require('util');

var ThinkyRestError = function(status, message, errors, cause) {
  this.name = 'ThinkyRestError';
  this.message = message || 'ThinkyRestError';
  this.errors = errors || [];
  this.status = status || 500;
  this.cause = cause;
  Error.captureStackTrace(this, this.constructor);
};
util.inherits(ThinkyRestError, Error);

var BadRequestError = function(message, errors, cause) {
  ThinkyRestError.call(this, 400, message || 'Bad Request', errors, cause);
  this.name = 'BadRequestError';
};
util.inherits(BadRequestError, ThinkyRestError);

var ForbiddenError = function(message, errors, cause) {
  ThinkyRestError.call(this, 403, message || 'Forbidden', errors, cause);
  this.name = 'ForbiddenError';
};
util.inherits(ForbiddenError, ThinkyRestError);

var NotFoundError = function(message, errors, cause) {
  ThinkyRestError.call(this, 404, message || 'Not Found', errors, cause);
  this.name = 'NotFoundError';
};
util.inherits(NotFoundError, ThinkyRestError);

var RequestCompleted = function() {
  Error.call(this);
  this.name = 'RequestCompleted';
};
util.inherits(RequestCompleted, Error);

module.exports = {
  NotFoundError: NotFoundError,
  BadRequestError: BadRequestError,
  ThinkyRestError: ThinkyRestError,
  ForbiddenError: ForbiddenError,
  RequestCompleted: RequestCompleted
};
