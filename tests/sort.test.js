'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator');

function parseAndRemoveFields(data, fields) {
  return JSON.parse(data).map(function(r) { return _.omit(r, fields); });
}

var test = new TestFixture();
describe('Resource(sort)', function() {
  before(function() {
    return test.initializeDatabase()
      .then(function() {
        test.models.User = test.db.createModel('users', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });

        test.models.UserWithIndex = test.db.createModel('usersWithIndex', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });
        test.models.UserWithIndex.ensureIndex('email');

        test.userlist = [
          { username: 'arthur', email: 'arthur@gmail.com', other: { data: 'a' }, array: [ { data: 'f' } ] },
          { username: 'james', email: 'james@gmail.com', other: { data: 'b' }, array: [ { data: 'e' } ] },
          { username: 'henry', email: 'henry@gmail.com', other: { data: 'c' }, array: [ { data: 'd' } ] },
          { username: 'william', email: 'william@gmail.com', other: { data: 'd' }, array: [ { data: 'c' } ] },
          { username: 'edward', email: 'edward@gmail.com', other: { data: 'e' }, array: [ { data: 'b' } ] },
          { username: 'arthur', email: 'aaaaarthur@gmail.com', other: { data: 'f' }, array: [ { data: 'a' } ] }
        ];

        return Promise.all([
          test.models.User.tableReady(), test.models.UserWithIndex.tableReady()
        ]);
      });
  });

  after(function() { return test.dropDatabase(); });
  beforeEach(function() {
    return test.initializeServer()
      .then(function() {
        return Promise.all([ test.models.User.ready(), test.models.UserWithIndex.ready() ]);
      })
      .then(function() {
        return Promise.all([
          test.models.User.save(_.cloneDeep(test.userlist)),
          test.models.UserWithIndex.save(_.cloneDeep(test.userlist))
        ]);
      })
      .then(function() {
        rest.initialize({ app: test.app, thinky: test.db });
      });
  });

  afterEach(function(done) {
    test.clearDatabase()
      .then(function() { test.server.close(done); });
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
        var records = parseAndRemoveFields(body, ['id']);
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
      var records = parseAndRemoveFields(body, ['id']);
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
      var records = parseAndRemoveFields(body, ['id']);
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
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
      done();
    });
  });

  it('should sort with query overriding default sort criteria', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id'],
      sort: {
        default: "-username"
      }
    });

    request.get({
      url: test.baseUrl + '/users?sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
      done();
    });
  });

  it('should sort by deep criteria', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=other.data'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['other.data']));
      done();
    });
  });

  it('should sort by deep criteria with an array', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=array[0].data'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['array[0].data']));
      done();
    });
  });

  it('should sort by deep criteria with an array descending', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=-array[0].data'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['array[0].data']).reverse());
      done();
    });
  });

  it('should sort by deep criteria in descending', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=-other.data'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id']);
      expect(records).to.eql(_.sortByAll(test.userlist, ['other.data']).reverse());
      done();
    });
  });

  it('should sort by a single field ascending', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id', 'other', 'array']);
      expect(records).to.eql([
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]);

      done();
    });
  });

  it('should sort by a single field descending', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=-email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id', 'other', 'array']);
      expect(records).to.eql([
        { username: 'william', email: 'william@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'arthur', email: 'aaaaarthur@gmail.com' }
      ]);

      done();
    });
  });

  it('should sort by multiple fields', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=username,email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id', 'other', 'array']);
      expect(records).to.eql([
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]);

      done();
    });
  });

  it('should sort by multiple fields ascending/descending', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=username,-email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id', 'other', 'array']);
      expect(records).to.eql([
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]);

      done();
    });
  });

  it('should sort by multiple fields (multiple query items)', function(done) {
    rest.resource({
      model: test.models.User,
      endpoints: ['/users', '/users/:id']
    });

    request.get({
      url: test.baseUrl + '/users?sort=username&sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      var records = parseAndRemoveFields(body, ['id', 'other', 'array']);
      expect(records).to.eql([
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]);

      done();
    });
  });

  it('should sort using a secondary index if available', function(done) {
    var resource = rest.resource({
      model: test.models.UserWithIndex,
      endpoints: ['/users', '/users/:id']
    });

    resource.list.fetch.before(function(req, res, context) {
      context.debug = true;
      return context.continue;
    });
    resource.list.send.after(function(req, res, context) {
      expect(context.query._query._query[1][0][2]).to.eql({ index: 'email' });
      done();
    });

    request.get({
      url: test.baseUrl + '/users?sort=email'
    }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
        var records = parseAndRemoveFields(body, ['id']);
        expect(records).to.eql(_.sortByAll(test.userlist, ['email']));
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
