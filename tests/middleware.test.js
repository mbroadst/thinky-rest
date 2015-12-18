'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator'),
    testMiddleware = require('./data/test-middleware'),
    testMiddlewareBeforeAndAfter = require('./data/test-middleware-before-after');

function verifyBeforeAndAfter(object) {
  expect(object.action).to.be.true;
  expect(object.before).to.be.true;
  expect(object.after).to.be.true;
}

var test = new TestFixture();
describe('Middleware', function() {
  before(function() {
    return test.initializeDatabase()
      .then(function() {
        test.models.User = test.db.createModel('users', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });

        return test.models.User.tableReady();
      });
  });

  after(function() {
    return test.dropDatabase();
  });

  beforeEach(function() {
    return test.initializeServer();
  });

  afterEach(function(done) {
    return test.clearDatabase()
      .then(function() {
        test.userResource = undefined;
        test.server.close(done);
      });
  });

  _.forOwn({
    'without before and after': testMiddleware,
    'with before and after': testMiddlewareBeforeAndAfter
  }, function(middleware, description) {

    describe(description, function() {
      beforeEach(function(done) {
        rest.initialize({ app: test.app, thinky: test.db });
        test.userResource = rest.resource({ model: test.models.User });
        test.userResource.use(middleware);
        expect(middleware.results.extraConfiguration).to.be.true;

        done();
      });

      it('should allow definitions for create milestones', function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: { username: 'jamez', email: 'jamez@gmail.com' }
        }, function(err, response, body) {
          expect(err).to.be.null;
          expect(response.statusCode).to.equal(201);
          _.forOwn(middleware.results.create, function(result, milestone) {
            if (middleware === testMiddlewareBeforeAndAfter) {
              verifyBeforeAndAfter(middleware.results.create[milestone]);
              verifyBeforeAndAfter(middleware.results.all[milestone]);
            } else {
              expect(middleware.results.create[milestone]).to.be.true;
              expect(middleware.results.all[milestone]).to.be.true;
            }
          });

          done();
        });
      });

      it('should allow definitions for list milestones', function(done) {
        request.get({
          url: test.baseUrl + '/users'
        }, function(err, response, body) {
          _.forOwn(middleware.results.list, function(result, milestone) {
            if (middleware === testMiddlewareBeforeAndAfter) {
              verifyBeforeAndAfter(middleware.results.list[milestone]);
              verifyBeforeAndAfter(middleware.results.all[milestone]);
            } else {
              expect(middleware.results.list[milestone]).to.be.true;
              expect(middleware.results.all[milestone]).to.be.true;
            }
          });

          done();
        });
      });

      it('should allow definitions for read milestones', function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: { username: 'jamez', email: 'jamez@gmail.com' }
        }, function(err, response, body) {
          expect(err).to.be.null;
          expect(response.statusCode).to.equal(201);
          var record = _.isObject(body) ? body : JSON.parse(body);
          request.get({
            url: test.baseUrl + '/user/' + record.id
          }, function(err, response, body) {
            _.forOwn(middleware.results.read, function(result, milestone) {
              if (middleware === testMiddlewareBeforeAndAfter) {
                verifyBeforeAndAfter(middleware.results.read[milestone]);
                verifyBeforeAndAfter(middleware.results.all[milestone]);
              } else {
                expect(middleware.results.read[milestone]).to.be.true;
                expect(middleware.results.all[milestone]).to.be.true;
              }
            });

            done();
          });
        });
      });

      it('should allow definitions for update milestones', function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: { username: 'jamez', email: 'jamez@gmail.com' }
        }, function(err, response, body) {
          expect(err).to.be.null;
          expect(response.statusCode).to.equal(201);
          var record = _.isObject(body) ? body : JSON.parse(body);

          request.put({
            url: test.baseUrl + '/user/' + record.id,
            json: { username: 'another', email: 'name@gmail.com' }
          }, function(err, response, body) {
            _.forOwn(middleware.results.update, function(result, milestone) {
              if (middleware === testMiddlewareBeforeAndAfter) {
                verifyBeforeAndAfter(middleware.results.update[milestone]);
                verifyBeforeAndAfter(middleware.results.all[milestone]);
              } else {
                expect(middleware.results.update[milestone]).to.be.true;
                expect(middleware.results.all[milestone]).to.be.true;
              }
            });

            done();
          });
        });
      });

      it('should allow definitions for delete milestones', function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: { username: 'jamez', email: 'jamez@gmail.com' }
        }, function(err, response, body) {
          expect(err).to.be.null;
          expect(response.statusCode).to.equal(201);
          var record = _.isObject(body) ? body : JSON.parse(body);

          request.del({
            url: test.baseUrl + '/user/' + record.id
          }, function(err, response, body) {
            _.forOwn(middleware.results.delete, function(result, milestone) {
              if (middleware === testMiddlewareBeforeAndAfter) {
                verifyBeforeAndAfter(middleware.results.delete[milestone]);
                verifyBeforeAndAfter(middleware.results.all[milestone]);
              } else {
                expect(middleware.results.delete[milestone]).to.be.true;
                expect(middleware.results.all[milestone]).to.be.true;
              }
            });

            done();
          });
        });
      });
    });
  });
});
