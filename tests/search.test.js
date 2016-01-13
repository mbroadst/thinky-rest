'use strict';

var Promise = require('bluebird'),
    request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../lib'),
    TestFixture = require('./test-fixture'),
    validator = require('validator');

var test = new TestFixture();
describe('Resource(search)', function() {
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
        test.models.UserWithIndex.ensureIndex('username');

        test.userlist = [
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'william', email: 'william@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' }
        ];

        return Promise.all([
          test.models.User.tableReady(), test.models.UserWithIndex.tableReady()
        ]);
      });
  });

  after(function() {
    return test.dropDatabase();
  });

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
      .then(function() {
        test.server.close(done);
      });
  });

  [
    {
      name: 'with default options',
      config: {},
      query: 'gmail.com',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'only using the first provided search term',
      config: {},
      extraQuery: 'q=william&q=henry',
      expectedResults: [{ username: 'william', email: 'william@gmail.com' }]
    },
    {
      name: 'using tag searching',
      config: {},
      query: 'username:he',
      expectedResults: [
        { username: 'henry', email: 'henry@gmail.com' }
      ]
    },
    {
      name: 'using tag searching (negated)',
      config: {},
      query: 'username:-he',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'with custom search param',
      config: {
        search: {
          param: 'search'
        }
      },
      query: 'william',
      expectedResults: [{ username: 'william', email: 'william@gmail.com' }]
    },
    {
      name: 'with custom search operator',
      config: {
        search: {
          operator: '$eq'
        }
      },
      query: 'william',
      expectedResults: [{ username: 'william', email: 'william@gmail.com' }]
    },
    {
      name: 'in combination with filtered results',
      config: {},
      query: 'aaaa&username=arthur',
      expectedResults: [{ username: 'arthur', email: 'aaaaarthur@gmail.com' }]
    },
    {
      name: 'with existing search criteria',
      config: {},
      preFlight: function(req, res, context) {
        context.criteria = { username: "arthur" };
        return context.continue;
      },
      query: '@gmail.com',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' }
      ]
    },
    {
      name: 'using a secondary index if it exists',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=arthur',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' }
      ]
    },
    {
      name: 'using a secondary index in combination with sort',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=arthur&sort=username',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' }
      ]
    }
  ].forEach(function(testCase) {
    it('should search ' + testCase.name, function(done) {
      if (!!testCase.config.model) testCase.config.model = testCase.config.model();
      var resourceConfig = _.defaults(testCase.config, {
        model: test.models.User,
        endpoints: ['/users', '/users/:id']
      });

      var testResource = rest.resource(resourceConfig);
      var searchParam =
        testCase.config.search ? testCase.config.search.param || 'q' : 'q';

      if (testCase.preFlight)
        testResource.list.fetch.before(testCase.preFlight);

      var url = test.baseUrl + resourceConfig.endpoints[0] + '?';
      if (!!testCase.query) {
        url = url + searchParam + '=' + testCase.query;
        if (!!testCase.extraQuery) url = url + '&';
      }

      if (!!testCase.extraQuery) url = url + testCase.extraQuery;
      request.get({ url: url }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        records = _.sortBy(records, 'email');
        expect(records).to.eql(testCase.expectedResults);
        done();
      });
    });

  });

});
