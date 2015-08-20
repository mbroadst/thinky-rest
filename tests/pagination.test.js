'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator');

var test = new TestFixture();
describe('Resource(pagination)', function() {
  before(function() {
    return test.initializeDatabase()
      .then(function() {
        test.models.User = test.db.createModel('users', {
          username: test.db.type.string().required(),
          email: test.db.type.string().validator(validator.isEmail)
        });

        test.userlist = [
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'william', email: 'william@gmail.com' }
        ];
      });
  });

  after(function() {
    return test.dropDatabase();
  });

  [
    {
      name: 'with default pagination',
      configuration: {}
    },
    {
      name: 'without pagination',
      configuration: {
        pagination: false
      }
    }
  ].forEach(function(suite) {

    describe('list ' + suite.name, function() {
      beforeEach(function() {
        return test.initializeServer()
          .then(function() {
            rest.initialize({ app: test.app, thinky: test.db });
            return test.models.User.save(_.cloneDeep(test.userlist));
          })
          .then(function() {
            rest.resource(_.extend(suite.configuration, {
              model: test.models.User
            }));
        });
      });

      afterEach(function(done) {
        return test.clearDatabase()
          .then(function() {
            test.server.close(done);
          });
      });

      it('should list records with no criteria', function(done) {
        request.get({ url: test.baseUrl + '/users' }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
          records = _.sortBy(records, 'username');
          expect(records).to.eql(test.userlist);

          if (!_.has(suite.configuration, 'pagination') || !!suite.configuration.pagination)
            expect(response.headers['content-range']).to.equal('items 0-4/5');
          else
            expect(response.headers['content-range']).to.not.exist;

          done();
        });
      });

    });

  });

});
