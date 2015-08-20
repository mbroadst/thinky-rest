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
  var self = this;

    // tag search
  if (q.indexOf(':') !== -1) {
    var tokens = q.split(':');
    return query.filter(
      self._r.row(tokens[0]).coerceTo('string').match('(?i)' + tokens[1])
    );
  }

  // pseudo full-text search
  return query.filter(function(doc) {
    return doc.keys().map(function(key) {
      return doc(key);
    }).map(function(val) {
      return self._r.branch(val.coerceTo('string').match('(?i)' + q), true, false);
    }).reduce(function(left, right) {
      return left.or(right);
    });
  });
};

List.prototype._applyOrderBy = function(query, sortQuery) {
  var self = this, order = [],
      properties = sortQuery.split(',');

  properties.forEach(function(property) {
    if (property.indexOf('-') === 0) {
      order.push(self._r.desc(property.substring(1)));
    } else {
      order.push(self._r.asc(property));
    }
  });

  return query.orderBy.apply(query, order);
};

List.prototype.fetch = function(req, res, context) {
  var query = this.model,
      criteria = context.criteria || {},
      defaultCount = 100,
      count = +context.count || +req.query.count || defaultCount,
      offset = +context.offset || +req.query.offset || 0;

  delete req.query.count;
  delete req.query.offset;

  offset += context.page * count || req.query.page * count || 0;
  if (count > 1000) count = 1000;
  if (count < 0) count = defaultCount;

  var searchParam = this.resource.search.param;
  if (_.has(req.query, searchParam)) {
    query = this._applySearch(query, _.merge(req.query[searchParam], criteria));
    delete req.query[searchParam];
  }

  var sortParam = this.resource.sort.param;
  if (_.has(req.query, sortParam) || !!this.resource.sort.default) {
    var sortQuery = req.query[sortParam] || this.resource.sort.default || '';
    query = this._applyOrderBy(query, sortQuery);
    delete req.query[sortParam];
  }

  // apply an extra filter attributes
  if (!_.isEmpty(req.query) || !_.isEmpty(criteria)) {
    query = query.filter(_.merge(req.query, criteria));
  }

  var countQuery = query;

  // apply offset/limit
  query = query.slice(offset, offset + count);

  // execute queries
  var self = this;
  return Promise.all([
    query.run(),
    countQuery.count().execute()
  ])
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
