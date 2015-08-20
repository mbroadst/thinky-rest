'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator');

var test = new TestFixture();
describe('Resource(sort)', function() {
  before(function() {
    return test.initializeDatabase()
      .then(function() {
        test.models.User = test.db.createModel('users', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });

        test.userlist = [
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'william', email: 'william@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' }
        ];
      });
  });

  after(function() {
    return test.dropDatabase();
  });

  beforeEach(function() {
    return test.initializeServer()
      .then(function() {
        return test.models.User.save(_.cloneDeep(test.userlist));
      })
      .then(function() {
        rest.initialize({ app: test.app, thinky: test.db });
      });
  });

  afterEach(function(done) {
    test.clearDatabase()
      .then(function() {
        test.server.close(done);
      });
  });

//////

  it('should sort with default options', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) {
          return _.omit(r, 'id');
        });
        expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
        done();
    });
  });

  it('should sort with custom param', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id'],
      sort: {
        param: 'orderby'
      }
    });

    request.get({
      url: test.baseUrl + '/users?orderby=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = JSON.parse(body).map(function(r) {
        return _.omit(r, 'id');
      });
      expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
      done();
    });
  });

  it('should sort with restricted attributes', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id'],
      sort: {
        attributes: ['email']
      }
    });

    request.get({
      url: test.baseUrl + '/users?sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = JSON.parse(body).map(function(r) {
        return _.omit(r, 'id');
      });
      expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
      done();
    });
  });

  it('should sort with default sort criteria', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id'],
      sort: {
        default: "email"
      }
    });

    request.get({
      url: test.baseUrl + '/users'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = JSON.parse(body).map(function(r) {
        return _.omit(r, 'id');
      });
      expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
      done();
    });
  });

  it('should sort with query overriding default sort criteria', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id'],
      sort: {
        default: "-email"
      }
    });

    request.get({
      url: test.baseUrl + '/users?sort=username'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = JSON.parse(body).map(function(r) {
        return _.omit(r, 'id');
      });
      expect(records).to.eql(_.sortByAll(test.userlist, ['username']));
      done();
    });
  });

  // it('should fail sorting with a restricted attribute', function(done) {
  //   rest.resource({
  //     model: test.models.User,
  //     endpoints: ['/users', '/users/:id'],
  //     sort: {
  //       attributes: ['email']
  //     }
  //   });

  //   request.get({
  //     url: test.baseUrl + '/users?sort=username'
  //   }, function(err, response, body) {
  //     expect(response.statusCode).to.equal(400);
  //     var result = JSON.parse(body);
  //     expect(result.message).to.contain('Sorting not allowed');
  //     expect(result.errors).to.eql(['username']);
  //     done();
  //   });
  // });

  // it('should fail sorting with multiple restricted attributes', function(done) {
  //   rest.resource({
  //     model: test.models.User,
  //     endpoints: ['/users', '/users/:id'],
  //     sort: {
  //       attributes: ['email']
  //     }
  //   });

  //   request.get({
  //     url: test.baseUrl + '/users?sort=username,-invalid'
  //   }, function(err, response, body) {
  //     expect(response.statusCode).to.equal(400);
  //     var result = JSON.parse(body);
  //     expect(result.message).to.contain('Sorting not allowed');
  //     expect(result.errors).to.eql(['username','invalid']);
  //     done();
  //   });
  // });
});
