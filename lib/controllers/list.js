'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    Base = require('./base'),
    util = require('util');

var List = function(options) {
  List.super_.call(this, options);

  this._r = options.thinky.r;
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

function directMatch(r, field, value) {
  return (value.indexOf('-') === 0) ?
    r.row(field).ne(value.slice(1)) : r.row(field).eq(value);
}

List.prototype._applyDirectMatchFilter = function(query, q) {
  var r = this._r;
  var criteria = Object.keys(q)
    .map(function(field) {
      return (!Array.isArray(q[field])) ?
        directMatch(r, field, q[field]) :
        q[field].map(function(value) { return directMatch(r, field, value); })
          .reduce(function(l, r) { return (r._query[0] === 17) ? l.or(r) : l.and(r); });
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

List.prototype._applyOrderBy = function(query, sortQuery) {
  var self = this, r = self._r, order = [],
      properties = Array.isArray(sortQuery) ? sortQuery : sortQuery.split(',');

  while (properties.length) {
    var property = properties.shift();
    var orderFunction = (property.indexOf('-') === 0) ? r.desc : r.asc;
    if (property.indexOf('-') === 0) property = property.substring(1);
    var criteria = deepPropertyRowQuery(r, property);
    order.push(orderFunction(criteria));
  }

  return query.orderBy.apply(query, order);
};

function ensureSingleParameter(parameter) {
  return (Array.isArray(parameter) && parameter.length > 0) ?
    parameter[0] : parameter;
}

List.prototype.fetch = function(req, res, context) {
  var query = this.model,
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
  if (!_.isEmpty(req.query) || !_.isEmpty(criteria)) {
    // if an extra attribute is a secondary index, use that
    var indexes = Object.keys(this.model._indexes);
    var indexFilters = _.intersection(Object.keys(req.query), indexes);
    if (!!indexFilters.length) {
      var indexFilter = indexFilters[0];
      query = query.getAll(req.query[indexFilter], { index: indexFilter });
      delete req.query[indexFilter];
    }

    if (!_.isEmpty(req.query) || !_.isEmpty(criteria))
      query = this._applyDirectMatchFilter(query, _.merge(req.query, criteria));
  }

  // apply search and sort if they were specified in the query
  if (!!searchQuery) query = this._applySearch(query, _.merge(searchQuery, criteria));
  var countQuery = query;

  if (!!sortQuery) query = this._applyOrderBy(query, sortQuery);

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

      return context.continue;
    });
};

module.exports = List;
