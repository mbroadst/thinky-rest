'use strict';

module.exports = function(endpoint) {
  this.string = endpoint;
  this.attributes = endpoint
    .split('/')
    .filter(function(c) { return ~c.indexOf(':') && ~~c.indexOf(':unused'); })
    .map(function(c) { return c.substring(1); });
};
