'use strict';
var u = module.exports = {};

u.generateValidation = function(controller, model) {
  var resource = controller.resource,
      action = controller.action,
      schema = JSON.parse(JSON.stringify(model._schema));

  var query = {}, params = {};
  var validation = {};
  if (action === 'list') {
    query.count = { type: 'integer', default: 100 };
    query.offset = { type: 'integer', default: 0 };
    query[resource.sort.param] = { type: 'string' };
    query[resource.search.param] = { type: 'string' };
  }

  if (action === 'create' || action === 'update') {
    validation = { body: schema };
    if (action === 'update') {
      delete validation.body.required;
    }
  }

  controller.endpoint.attributes.forEach(function(attr) {
    if (schema.hasOwnProperty('properties') &&
        schema.properties.hasOwnProperty(attr)) {
      params[attr] = schema.properties[attr];
    }
  });

  if (Object.keys(params).length !== 0) {
    validation.params = { type: 'object', properties: params };
  }

  if (Object.keys(query).length !== 0) {
    validation.query = { type: 'object', properties: query };
  }

  return validation;
};
