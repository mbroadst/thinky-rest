'use strict';

var _ = require('lodash'),
    inflection = require('inflection'),

    Resource = require('./resource'),
    Endpoint = require('./endpoint'),
    Controllers = require('./controllers'),
    Errors = require('./errors');

module.exports = {
  initialize: function(options) {
    options = options || {};
    if (!options.app)
      throw new Error('please specify an app');

    if (!options.thinky)
      throw new Error('please specify a thinky instance');

    this.app = options.app;
    this.thinky = options.thinky;
    this.base = options.base || '';

    this.updateMethod = undefined;
    if (options.updateMethod) {
      var method = options.updateMethod.toLowerCase();
      if (!method.match(/^(put|post|patch)$/)) {
        throw new Error('updateMethod must be one of PUT, POST, or PATCH');
      }

      this.updateMethod = method;
    }
  },

  resource: function(options) {
    options = options || {};
    if (!options.model)
      throw new Error('please specify a valid model');
      
    if (!options.endpoints || !options.endpoints.length) {
      options.endpoints = [];
      var plural = inflection.pluralize(options.model._schema._model._name);
      var singular = inflection.singularize(options.model._schema._model._name);
      var pk = options.model._schema._model._pk;
      options.endpoints.push('/' + plural);
      options.endpoints.push('/' + singular + '/:' + pk);  
    }

    var endpoints = [];
    options.endpoints.forEach(function(e) {
      var endpoint = this.base + e;
      endpoints.push(endpoint);
    }.bind(this));

    var resource = new Resource({
      app: this.app,
      thinky: this.thinky,
      model: options.model,
      endpoints: endpoints,
      actions: options.actions,
      pagination: options.pagination,
      updateMethod: this.updateMethod,
      search: options.search,
      sort: options.sort
    });

    return resource;
  },

  Resource: Resource,
  Endpoint: Endpoint,
  Controllers: Controllers,
  Errors: Errors
};
