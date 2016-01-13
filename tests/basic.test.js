'use strict';

var Promise = require('bluebird'),
    request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator');

var test = new TestFixture();
describe('Resource(basic)', function() {
  before(function() {
    return test.initializeDatabase()
      .then(function() {
        test.models.User = test.db.createModel('users', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });

        test.models.Person = test.db.createModel('person', {
          firstname: test.db.type.string(),
          lastname: test.db.type.string()
        });

        return Promise.all([
          test.models.User.tableReady(), test.models.Person.tableReady()
        ]);
      });
  });

  after(function() {
    return test.dropDatabase();
  });

  beforeEach(function() {
    return test.initializeServer()
      .then(function() {
        rest.initialize({
          app: test.app,
          thinky: test.db
        });

        test.userResource = rest.resource({
          model: test.models.User,
          endpoints: ['/users', '/user/:id']
        });

        test.userProfileResource = rest.resource({
          model: test.models.User,
          endpoints: ['/users/:username/profile', '/user/:username/profile'],
          actions: ['create']
        });

        test.userResource.list.fetch.before(function(req, res, context) {
          if (!!test.userResource.enableCriteriaTest) {
            context.criteria = { id: 1 };
            test.userResource.enableCriteriaTest = false;
          }

          return context.continue;
        });
      });
  });

  afterEach(function(done) {
    test.clearDatabase()
      .then(function() {
        test.userResource = undefined;
        test.server.close(done);
      });
  });

  // TESTS
  describe('construction', function() {
    it('should throw an exception if called with an invalid model', function(done) {
      expect(rest.resource).to.throw('please specify a valid model');
      done();
    });

    it('should throw an exception if created with an invalid model', function(done) {
      try {
        var resource = new rest.Resource(); // jshint ignore:line
      } catch (exception) {
        expect(exception).to.eql(new Error('resource needs a model'));
        done();
      }

    });

    it('should auto generate endpoints if none were provided', function() {
      var resource = rest.resource({
        model: test.models.Person
      });

      expect(resource.endpoints).to.eql({ plural: '/people', singular: '/person/:id' });
    });

  });

  describe('create', function() {
    it('should create a record', function(done) {
      request.post({
        url: test.baseUrl + '/users',
        json: { username: 'arthur', email: 'arthur@gmail.com' }
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(201);
        expect(response.headers.location).to.match(/\/user\/\.*?/);
        done();
      });
    });

    it('should create a record using the endpoint attributes', function(done) {
      request.post({
        url: test.baseUrl + '/users/arthur/profile',
        json: { email: 'arthur@gmail.com' }
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(201);
        expect(response.headers.location).to.match(/\/user\/\.*?/);
        delete body.id;
        expect(body).to.eql({ username: 'arthur', email: 'arthur@gmail.com' });
        done();
      });
    });

    [
      {
        description: 'should catch validation errors',
        record: { username: 'blah', email: 'notanemail' },
        expected: {
          statusCode: 400,
          fields: ['email']
        }
      },
      {
        description: 'should catch null field errors',
        record: { email: 'valid@email.com' },
        expected: {
          statusCode: 400,
          fields: ['username']
        }
      }
    ].forEach(function(createTest) {
      it(createTest.description, function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: createTest.record
        }, function(error, response, body) {
          var result = _.isObject(body) ? body : JSON.parse(body);
          expect(response.statusCode).to.equal(createTest.expected.statusCode);
          expect(result).to.contain.keys(['message', 'errors']);
          expect(result.errors).to.eql(createTest.expected.fields);

          done();
        });
      });
    });

  });

  describe('read', function() {
    it('should return proper error for an invalid record', function(done) {
      request.get({
        url: test.baseUrl + '/user/42'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('message');
        done();
      });
    });

    it('should read a record', function(done) {
      var userData = { username: 'jamez', email: 'jamez@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.get({
          url: test.baseUrl + path
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var record = _.isObject(body) ? body : JSON.parse(body);

          delete record.id;
          expect(record).to.eql(userData);
          done();
        });
      });
    });

    // it('should return an error when find fails during read', function(done) {
    //   request.post({
    //     url: test.baseUrl + '/users',
    //     json: { username: 'jamez', email: 'jamez@gmail.com' }
    //   }, function(error, response, body) {
    //     expect(error).is.null;
    //     expect(response.headers.location).is.not.empty;
    //     var path = response.headers.location;

    //     test.models.User.enableBrokenFindTest = true;
    //     request.get({
    //       url: test.baseUrl + path
    //     }, function(err, response, body) {
    //       expect(response.statusCode).to.equal(500);
    //       var record = _.isObject(body) ? body : JSON.parse(body);
    //       expect(record.errors).to.be.ok;
    //       expect(record.errors[0]).to.equal('brokenFind');
    //       done();
    //     });
    //   });
    // });

  });

  describe('update', function() {
    it('should return 404 for invalid record', function(done) {
      request.put({
        url: test.baseUrl + '/user/42'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('message');
        expect(record.message).to.contain('Not Found');
        done();
      });
    });

    it('should update a record', function(done) {
      var userData = { username: 'jamez', email: 'jamez@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.put({
          url: test.baseUrl + path,
          json: { email: 'emma@fmail.co.uk' }
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var record = _.isObject(body) ? body : JSON.parse(body);

          delete record.id;
          userData.email = 'emma@fmail.co.uk';
          expect(record).to.eql(userData);
          done();
        });
      });
    });
  });

  describe('delete', function() {
    it('should return proper error for invalid record', function(done) {
      request.del({
        url: test.baseUrl + '/user/42'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('message');
        done();
      });
    });

    it('should delete a record', function(done) {
      var userData = { username: 'chicken', email: 'chicken@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.del({
          url: test.baseUrl + path
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);

          request.get({ url: test.baseUrl + path }, function(err, response, body) {
            expect(response.statusCode).is.equal(404);
            done();
          });
        });
      });
    });

    // it('should return an error when find fails during delete', function(done) {
    //   request.post({
    //     url: test.baseUrl + '/users',
    //     json: { username: 'jamez', email: 'jamez@gmail.com' }
    //   }, function(error, response, body) {
    //     expect(error).is.null;
    //     expect(response.headers.location).is.not.empty;
    //     var path = response.headers.location;

    //     test.models.User.enableBrokenFindTest = true;
    //     request.del({
    //       url: test.baseUrl + path
    //     }, function(err, response, body) {
    //       expect(response.statusCode).to.equal(500);
    //       var record = _.isObject(body) ? body : JSON.parse(body);
    //       expect(record.errors).to.be.ok;
    //       expect(record.errors[0]).to.equal('brokenFind');
    //       done();
    //     });
    //   });
    // });

  });

  var util = require('util');
  describe('list', function() {
    beforeEach(function() {
      test.userlist = [
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'william', email: 'william@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'arthur', email: 'aaaaarthur@gmail.com' }
      ];

      return test.models.User.save(_.cloneDeep(test.userlist))
        .then(function() {
          test.userlist = _.sortByAll(test.userlist, ['username', 'email']);
        });
    });

    afterEach(function() {
      return test.models.User.delete()
        .catch(function(err) {})
        .then(function() {
          delete test.userlist;
        });
    });

    function parseAndRemoveId(data) {
      return JSON.parse(data).map(function(r) { delete r.id; return r; });
    }

    it('should list all records', function(done) {
      request.get({
        url: test.baseUrl + '/users'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = _.sortByAll(parseAndRemoveId(body), ['username', 'email']);
        expect(records).to.eql(test.userlist);
        expect(response.headers['content-range']).to.equal('items 0-5/6');
        done();
      });
    });

    it('should list all records matching a field name and value', function(done) {
      request.get({
        url: test.baseUrl + '/users?username=henry'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = parseAndRemoveId(body);
        expect(records).to.eql([{ username: 'henry', email: 'henry@gmail.com' }]);
        expect(response.headers['content-range']).to.equal('items 0-0/1');
        done();
      });
    });

    it('should list some records using offset and count', function(done) {
      request.get({
        url: test.baseUrl + '/users?offset=1&count=2'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.have.length(2);
        expect(response.headers['content-range']).to.equal('items 1-2/6');
        done();
      });
    });

    it('should support a generic query string', function(done) {
      request.get({
        url: test.baseUrl + '/users?q=ll'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(response.headers['content-range']).to.equal('items 0-0/1');
        expect(records).to.eql([{ username: 'william', email: 'william@gmail.com' }]);
        done();
      });
    });

    it('should support a generic query string as well as other criteria', function(done) {
      request.get({
        url: test.baseUrl + '/users?q=gmail&offset=1&count=2&sort=email'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(response.headers['content-range']).to.equal('items 1-2/6');
        expect(records).to.eql([
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' }
        ]);

        done();
      });
    });

    // it('should support a generic query string as well as criteria added in a milestone', function(done) {
    //   test.userResource.enableCriteriaTest = true;

    //   request.get({
    //     url: test.baseUrl + '/users?q=gmail'
    //   }, function(err, response, body) {
    //     expect(response.statusCode).to.equal(200);
    //     var records = parseAndRemoveId(body);
    //     expect(response.headers['content-range']).to.equal('items 0-0/1');
    //     expect(records).to.eql([
    //       { username: 'arthur', email: 'arthur@gmail.com' }
    //     ]);

    //     done();
    //   });
    // });

    it('should return a valid content-range with no results for a query', function(done) {
      request.get({
        url: test.baseUrl + '/users?q=zzzz'
      }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([]);
        expect(response.headers['content-range']).to.equal('items 0-0/0');
        done();
      });
    });


    it('should set a default count if an invalid count was provided', function() {
      var promises = [];
      [-1, 1001].forEach(function(count) {
        promises.push(new Promise(function(resolve, reject) {
          request.get({
            url: test.baseUrl + '/users?count=' + count
          }, function(err, response, body) {
            expect(response.statusCode).to.equal(200);
            resolve();
          });

        }));
      });

      return Promise.all(promises);
    });

  });

});
