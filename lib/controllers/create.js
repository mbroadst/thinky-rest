'use strict';

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base');

var Create = function(args) {
  Create.super_.call(this, args);
};

util.inherits(Create, Base);

Create.prototype.action = 'create';
Create.prototype.method = 'post';
Create.prototype.plurality = 'plural';

Create.prototype.write = function(req, res, context) {
  context.attributes = _.extend(context.attributes, req.body);
  var options = context.options || {};

  var self = this;
  return this.model
    .save(context.attributes, options)
    .then(function(result) {
      if (self.resource) {
        var endpoint = self.resource.endpoints.singular;
        var location = endpoint.replace(/:(\w+)/g, function(match, $1) {
          return result[$1];
        });

        res.header('Location', location);
      }

      res.status((!result.changes && !!result.unchanged) ? 304 : 201);
      context.instance = result;
      return context.continue;
    });
};

module.exports = Create;
