'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    Endpoint = require('../endpoint'),
    errors = require('../errors'),
    utils = require('../utils');

var Controller = function(options) {
  this.initialize(options);
};

Controller.prototype.initialize = function(options) {
  this.endpoint = new Endpoint(options.endpoint);
  this.model = options.model;
  this.app = options.app;
  this.isRestify = options.isRestify;
  this.resource = options.resource;
  this.odm = options.odm;
  if (!!options.documentValidation) {
    this.validation = utils.generateValidation(this, options.model);
  }

  this.route();
};

Controller.milestones = [
  'start', 'auth', 'fetch', 'data', 'write', 'send', 'complete'
];

Controller.hooks = Controller.milestones.reduce(function(hooks, milestone) {
  ['_before', '', '_after'].forEach(function(modifier) {
    hooks.push(milestone + modifier);
  });

  return hooks;
}, []);

Controller.prototype.error = function(req, res, err) {
  res.status(err.status);
  res.json({
    message: err.message,
    errors: err.errors
  });
};

Controller.prototype.send = function(req, res, context) {
  res.json(context.instance);
  return context.continue;
};

Controller.prototype.route = function() {
  var app = this.app,
      endpoint = this.endpoint,
      self = this;

  var pathOptions = endpoint.string;
  if (this.isRestify) {
    if (self.method === 'delete')
      self.method = 'del';

    pathOptions = { path: endpoint.string };
    if (!!self.validation) pathOptions.validation = self.validation;
  }

  app[self.method](pathOptions, function(req, res) {
    if (req.query._ !== undefined) delete req.query._;  // kill the cache buster
    self._control(req, res);
  });
};

Controller.prototype._control = function(req, res) {
  var hookChain = Promise.resolve(false),
      self = this,
      context = {
        instance: undefined,
        criteria: null,
        attributes: {}
      };

  Controller.milestones.forEach(function(milestone) {
    if (!self[milestone])
      return;

    [milestone + '_before', milestone, milestone + '_after'].forEach(function(hook) {
      if (!self[hook])
        return;

      hookChain = hookChain.then(function runHook(skip) {
        if (skip) return true;

        var functions = Array.isArray(self[hook]) ? self[hook] : [self[hook]];

        // return the function chain. This means if the function chain resolved
        // to skip then all the remaining hooks on this milestone will also be
        // skipped and we will go to the next milestone
        return functions.reduce(function(prev, current) {
          return prev.then(function runHookFunction(skipNext) {

            // if any asked to skip keep returning true to avoid calling further
            // functions inside this hook
            if (skipNext) return true;

            var decisionPromise = new Promise(function(resolve) {
              _.assign(context, {
                skip: function() {
                  resolve(context.skip);
                },
                stop: function() {
                  resolve(new errors.RequestCompleted());
                },
                continue: function() {
                  resolve(context.continue);
                },
                error: function(status, message, errorList, cause) {
                  // if the second parameter is undefined then we are being
                  // passed an error to rethrow, otherwise build an EpilogueError
                  if (_.isUndefined(message)) {
                    resolve(status);
                  } else {
                    resolve(new errors.ThinkyRestError(status, message, errorList, cause));
                  }
                }
              });
            });

            return Promise.resolve(current.call(self, req, res, context))
              .then(function(result) {
                // if they were returned directly or as a result of a promise
                if (_.includes([context.skip, context.continue, context.stop], result)) {
                  // call it to resolve the decision
                  result();
                }

                return decisionPromise.then(function(decision) {
                  if (decision === context.continue) return false;
                  if (decision === context.skip) return true;

                  // must be an error/context.stop, throw the decision for error handling
                  throw decision;
                });
              });
          });
        }, Promise.resolve(false));
      });
    });

    hookChain = hookChain.then(function() {
      // clear any passed results so the next milestone will run even if a
      // _after said to skip
      return false;
    });
  });

  hookChain
    .catch(self.odm.Errors.DocumentNotFound, function(err) {
      self.error(req, res, new errors.NotFoundError(null, [err]));
    })
    .catch(self.odm.Errors.ValidationError, function(err) {
      if (err.hasOwnProperty('errors')) {
        // TODO: this is a crude way of determining if we are using thinkagain
        return self.error(req, res, new errors.BadRequestError(err.message, err.errors));
      }

      var parts = err.message.replace(/\n/, '').split('Original error:');
      var message = parts[0].trim();
      var fields = parts[1].match(/\[(.*?)\]/g).map(function(m) {
        return m.replace(/[[\]]/g, '');
      });

      self.error(req, res, new errors.BadRequestError(message, fields, err));
    })
    .catch(errors.RequestCompleted, function() { /* noop */ })
    .catch(errors.ThinkyRestError, function(err) {
      self.error(req, res, err);
    })
    .error(function(err) {
      self.error(req, res, new errors.ThinkyRestError(500, 'internal error', [err.message], err));
    });
};

Controller.prototype.milestone = function(name, callback) {
  if (!_.includes(Controller.hooks, name))
    throw new Error('invalid milestone: ' + name);

  if (!this[name]) {
    this[name] = [];
  } else if (!Array.isArray(this[name])) {
    this[name] = [ this[name] ];
  }

  this[name].push(callback);
};

module.exports = Controller;
