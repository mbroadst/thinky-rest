'use strict';
var u = module.exports = {};

u.generateValidation = function(controller, model) {
  var resource = controller.resource,
      action = controller.action,
      schema = JSON.parse(JSON.stringify(model._schema));

  var query = {}, params = {};
  var validation = {}, responses = {};
  responses['default'] = {
    description: 'Unexpected error',
    schema: { $ref: '#/definitions/Error' }
  };

  if (action === 'list') {
    query.count = { type: 'integer', default: 100 };
    query.offset = { type: 'integer', default: 0 };
    query[resource.sort.param] = { type: 'string' };
    query[resource.search.param] = { type: 'string' };

    responses['200'] = {
      description: 'Success',
      schema: { type: 'array', items: schema }
    };

    responses['404'] = {
      description: 'Not found',
      schema: { $ref: '#/definitions/Error' }
    };
  }

  if (action === 'create' || action === 'update') {
    validation = { body: schema };
    responses['200'] = { description: 'Success' };

    if (action === 'update') {
      responses['404'] = {
        description: 'Not found',
        schema: { $ref: '#/definitions/Error' }
      };

      delete validation.body.required;
    } else {
      responses['304'] = { description: 'Not modified' };
      responses['409'] = {
        description: 'Duplicate record',
        schema: { $ref: '#/definitions/Error' }
      };
    }
  }

  if (action === 'read' || action === 'delete') {
    responses['404'] = {
      description: 'Not found',
      schema: { $ref: '#/definitions/Error' }
    };

    if (action === 'read') {
      responses['200'] = {
        description: 'Success',
        schema: schema
      };
    }
  }

  controller.endpoint.attributes.forEach(function(attr) {
    if (schema.hasOwnProperty('properties') &&
        schema.properties.hasOwnProperty(attr)) {
      params[attr] = schema.properties[attr];
    }
  });

  if (Object.keys(params).length !== 0) {
    validation.params = {
      type: 'object', properties: params, required: Object.keys(params)
    };
  }

  if (Object.keys(query).length !== 0) {
    validation.query = { type: 'object', properties: query };
  }

  if (Object.keys(responses).length !== 0) {
    validation.responses = responses;
  }

  return validation;
};
