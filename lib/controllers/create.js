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
  var options = context.options || {};
  context.attributes = _.defaults(context.attributes, req.body);
  this.endpoint.attributes.forEach(function(a) {
    if (req.params.hasOwnProperty(a)) context.attributes[a] = req.params[a];
  });


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
    })
    .catch(function(error) {
      if (error.message.match(/Duplicate primary key/)) {
        res.status(409);
        res.send('Duplicate primary key');
        return context.stop;
      }

      throw error;
    });
};

module.exports = Create;
