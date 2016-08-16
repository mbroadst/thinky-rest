'use strict';
var u = module.exports = {};

u.generateValidation = function(controller, model) {
  var resource = controller.resource,
      action = controller.action,
      schema = JSON.parse(JSON.stringify(model._schema));

  var params = {};
  var validation = {};
  if (action === 'list') {
    params.count = { type: 'integer', default: 100 };
    params.offset = { type: 'integer', default: 0 };
    params[resource.sort.param] = { type: 'string' };
    params[resource.search.param] = { type: 'string' };
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
    validation.params =
      { type: 'object', properties: params };
  }

  return validation;
};
