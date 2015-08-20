'use strict';

var rest = require('../lib'),
    expect = require('chai').expect;

describe('ThinkyRest', function() {
  it('should throw an exception when initialized without arguments', function(done) {
    expect(rest.initialize).to.throw('please specify an app');
    done();
  });

  it('should throw an exception when initialized without a think instance', function(done) {
    expect(rest.initialize.bind(rest, {
      app: {}
    })).to.throw('please specify a thinky instance');
    done();
  });

  it('should throw an exception with an invalid updateMethod', function(done) {
    expect(rest.initialize.bind(rest, {
      app: {},
      thinky: {},
      updateMethod: 'dogs'
    })).to.throw('updateMethod must be one of PUT, POST, or PATCH');
    done();
  });
});
