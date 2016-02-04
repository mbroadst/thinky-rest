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
      extraQuery: 'q=william&q=henry',
      expectedResults: [{ username: 'william', email: 'william@gmail.com' }]
    },
    {
      name: 'using tag searching',
      query: 'username:he',
      expectedResults: [
        { username: 'henry', email: 'henry@gmail.com' }
      ]
    },
    {
      name: 'using tag searching (negated)',
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
      query: 'aaaa&username=arthur',
      expectedResults: [{ username: 'arthur', email: 'aaaaarthur@gmail.com' }]
    },
    {
      name: 'with existing search criteria',
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
      preFlight: function(req, res, context) {
        context.debug = true;
        return context.continue;
      },
      postFlight: function(req, res, context) {
        expect(context.query._query._query[1][0][2]).to.eql({ index: 'username' });
        return context.continue;
      },
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' }
      ]
    },
    {
      name: 'using a secondary index if it exists (multiple queries/docs)',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=arthur&username=edward',
      preFlight: function(req, res, context) {
        context.debug = true;
        return context.continue;
      },
      postFlight: function(req, res, context) {
        expect(context.query._query._query[1][0][2]).to.eql({ index: 'username' });
        return context.continue;
      },
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' }
      ]
    },
    {
      name: 'without a cache busting token affecting results',
      extraQuery: '_=1454605315780',
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
      name: 'without a cache busting token affecting results (2)',
      query: 'gmail.com',
      extraQuery: '_=1454605315780',
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
      name: 'and not use an existing secondary index if the term is negated',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=-arthur',
      preFlight: function(req, res, context) {
        context.debug = true;
        return context.continue;
      },
      postFlight: function(req, res, context) {
        expect(context.query._query._query[1][0][2]).to.be.undefined;
        return context.continue;
      },
      expectedResults: [
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'and not use an existing secondary index if one of multiple terms are negated',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=-arthur&username=edward',
      preFlight: function(req, res, context) {
        context.debug = true;
        return context.continue;
      },
      postFlight: function(req, res, context) {
        expect(context.query._query._query[1][0][2]).to.be.undefined;
        return context.continue;
      },
      expectedResults: [
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'using a secondary index in combination with sort',
      config: {
        model: function() { return test.models.UserWithIndex; }
      },
      extraQuery: 'username=arthur&sort=username',
      preFlight: function(req, res, context) {
        context.debug = true;
        return context.continue;
      },
      postFlight: function(req, res, context) {
        expect(context.query._query._query[1][0][1][0][2]).to.eql({ index: 'username' });
        return context.continue;
      },
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' }
      ]
    },
    {
      name: 'using multiple instances of the same direct filter (single query)',
      extraQuery: 'username=arthur,william',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'using multiple instances of the same direct filter (multiple queries)',
      extraQuery: 'username=arthur&username=william',
      expectedResults: [
        { username: 'arthur', email: 'aaaaarthur@gmail.com' },
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'using a negated direct filter',
      extraQuery: 'username=-arthur',
      expectedResults: [
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'using a negated direct filter on multiple keys (single query)',
      extraQuery: 'username=-arthur,-edward',
      expectedResults: [
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    },
    {
      name: 'using a negated direct filter on multiple keys (multiple queries)',
      extraQuery: 'username=-arthur&username=-edward',
      expectedResults: [
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'william', email: 'william@gmail.com' }
      ]
    }
  ].forEach(function(testCase) {
    it('should search ' + testCase.name, function(done) {
      testCase.config = testCase.config || {};
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
      if (testCase.postFlight)
        testResource.list.send.before(testCase.postFlight);

      var url = test.baseUrl + resourceConfig.endpoints[0] + '?';
      if (!!testCase.query) {
        url = url + searchParam + '=' + testCase.query;
        if (!!testCase.extraQuery) url = url + '&';
      }

      if (!!testCase.extraQuery) url = url + testCase.extraQuery;
      request.get({ url: url }, function(err, response, body) {
        if (response.statusCode !== 200) console.log(body);
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        records = _.sortBy(records, 'email');
        expect(records).to.eql(testCase.expectedResults);
        done();
      });
    });

  });

});
