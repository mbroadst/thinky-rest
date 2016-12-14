'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    Base = require('./base'),
    util = require('util');

var List = function(options) {
  List.super_.call(this, options);

  this._r = options.odm.r;
};

util.inherits(List, Base);

List.prototype.action = 'list';
List.prototype.method = 'get';
List.prototype.plurality = 'plural';

List.prototype._applySearch = function(query, q) {
  var self = this, r = self._r;

  // tag search
  if (q.indexOf(':') !== -1) {
    var tokens = q.split(':');
    var criteria = (tokens[1].indexOf('-') === 0) ?
      r.row(tokens[0]).coerceTo('string').match('(?i)' + tokens[1].slice(1)).not() :
      r.row(tokens[0]).coerceTo('string').match('(?i)' + tokens[1]);
    return query.filter(criteria);
  }

  // pseudo full-text search
  return query.filter(function(doc) {
    return doc.keys()
      .map(function(key) { return doc(key); })
      .map(function(val) { return r.branch(val.coerceTo('string').match('(?i)' + q), true, false); })
      .reduce(function(left, right) { return left.or(right); });
  });
};

function determineFieldType(schema, field) {
  // thinkagain schema
  if (schema.hasOwnProperty('properties') && schema.properties.hasOwnProperty(field)) {
    return schema.properties[field].type;
    // @todo: if (Array.isArray(type)) {}
  }

  // thinky schema
  if (schema.hasOwnProperty(field)) {
    switch (schema[field].constructor.name) {
    case 'TypeBoolean': return 'boolean';
    case 'TypeArray': return 'array';
    case 'TypeNumber': return 'number';
    default: return 'string';
    }
  }
}

function convertFieldToSchemaType(type, value) {
  if (type === undefined) {
    return value;
  }

  switch (type) {
  case 'boolean':
    if (value === 'false') return false;
    if (value === 'true') return true;
    return Boolean(value);
  case 'number':
    return Number(value);
  default:
  case 'string':
    return String(value);
  }
}

function directMatch(r, field, value, type) {
  var convertedValue =
    convertFieldToSchemaType(type, (value.indexOf('-') === 0) ? value.slice(1) : value);
  return (value.indexOf('-') === 0) ?
    r.row(field).ne(convertedValue) : r.row(field).eq(convertedValue);
}

List.prototype._applyDirectMatchFilter = function(query, q, schema) {
  var r = this._r;
  var criteria = Object.keys(q)
    .map(function(field) {
      var value = (q[field].indexOf(',') !== -1) ? q[field].split(',') : q[field];
      var type = determineFieldType(schema, field);

      return (!Array.isArray(value)) ?
        directMatch(r, field, value, type) :
        value.map(function(value) { return directMatch(r, field, value, type); })
          .reduce(function(l, r) { return (r._query[0] === 17) ? l.or(r) : l.and(r); });
      // NOTE: 17 above is the RethinkDB protobuf value for the EQ operation
    })
    .reduce(function(left, right) { return left.or(right); });
  return query.filter(criteria);
};

var arrayRegex = /\[([0-9]*?)\]/g;
function deepPropertyRowQuery(r, property) {
  var criteria = null;
  var propertyParts = property.split('.');
  while (propertyParts.length) {
    var p = propertyParts.shift();
    var cap = arrayRegex.exec(p);
    if (!!cap) p = p.replace(arrayRegex, '');

    // add to criteria, optionally adding an array index if present
    criteria = (criteria === null) ? r.row(p) : criteria(p);
    if (!!cap && !!cap[1]) criteria = criteria.nth(parseInt(cap[1]));
  }

  return criteria;
}

List.prototype._applyOrderBy = function(query, sortQuery, canUseSecondaryIndex) {
  var self = this, r = self._r, order = [],
      properties = Array.isArray(sortQuery) ? sortQuery : sortQuery.split(',');

  var orderByOptions = null;
  while (properties.length) {
    var property = properties.shift();
    var orderFunction = (property.indexOf('-') === 0) ? r.desc : r.asc;
    if (property.indexOf('-') === 0) property = property.substring(1);

    // add an index for the first encountered order, if it exists and no filter is present
    if (this.model._indexes.hasOwnProperty(property) &&
        orderByOptions === null && canUseSecondaryIndex) {
      orderByOptions = { index: property };
    }

    var criteria = deepPropertyRowQuery(r, property);
    order.push(orderFunction(criteria));
  }

  if (!!orderByOptions) order.push(orderByOptions);
  return query.orderBy.apply(query, order);
};

function ensureSingleParameter(parameter) {
  return (Array.isArray(parameter) && parameter.length > 0) ?
    parameter[0] : parameter;
}

function getSchema(model) {
  return model._schema.hasOwnProperty('_schema') ? model._schema._schema : model._schema;
}

List.prototype.fetch = function(req, res, context) {
  var query = this.model,
      schema = getSchema(this.model),
      criteria = context.criteria || {},
      defaultCount = 100,
      count = +context.count || +req.query.count || defaultCount,
      offset = +context.offset || +req.query.offset || 0,
      sortQuery, searchQuery;

  delete req.query.count;
  delete req.query.offset;

  offset += context.page * count || req.query.page * count || 0;
  if (count > 1000) count = 1000;
  if (count < 0) count = defaultCount;

  var searchParam = this.resource.search.param;
  if (_.has(req.query, searchParam)) {
    searchQuery = ensureSingleParameter(req.query[searchParam]);
    delete req.query[searchParam];
  }

  var sortParam = this.resource.sort.param;
  if (_.has(req.query, sortParam) || !!this.resource.sort.default) {
    sortQuery = req.query[sortParam] || this.resource.sort.default || '';
    delete req.query[sortParam];
  }

  // apply any extra filter attributes
  var canUseSecondaryIndex = true;
  if (!_.isEmpty(req.query) || !_.isEmpty(criteria)) {
    // if an extra attribute is a secondary index, use that
    var indexes = Object.keys(this.model._indexes);
    var indexFilters = _.intersection(Object.keys(req.query), indexes);
    if (!!indexFilters.length) {
      var indexFilter = indexFilters[0];
      var isNegated = Array.isArray(req.query[indexFilter]) ?
        req.query[indexFilter].some(function(v) { return v.indexOf('-') === 0; }) :
        req.query[indexFilter].indexOf('-') === 0;

      if (!isNegated) {
        query = Array.isArray(req.query[indexFilter]) ?
          query.getAll.apply(query, req.query[indexFilter].concat([{ index: indexFilter }])) :
          query.getAll(req.query[indexFilter], { index: indexFilter });

        delete req.query[indexFilter];
        canUseSecondaryIndex = false;
      }
    }

    if (!_.isEmpty(req.query) || !_.isEmpty(criteria)) {
      query = this._applyDirectMatchFilter(query, _.merge(req.query, criteria), schema);
      canUseSecondaryIndex = false;
    }
  }

  // apply search and sort if they were specified in the query
  if (!!sortQuery) query = this._applyOrderBy(query, sortQuery, canUseSecondaryIndex);
  if (!!searchQuery) query = this._applySearch(query, _.merge(searchQuery, criteria));
  var countQuery = query;

  // apply offset/limit
  query = query.slice(offset, offset + count);

  // execute queries
  var self = this;
  return Promise.all([ query.run(), countQuery.count().execute() ])
    .spread(function(results, total) {
      context.instance = results;
      if (!!self.resource.pagination) {
        var start = offset;
        var end = (start + results.length - 1);
        end = (end === -1) ? 0 : end;

        res.header('Content-Range', 'items ' + [[start, end].join('-'), total].join('/'));
      }

      if (!!context.debug) context.query = query;
      return context.continue;
    });
};

module.exports = List;
