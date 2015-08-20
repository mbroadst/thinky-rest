'use strict';

var thinky = require('thinky'),
    http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    restify = require('restify'),
    chai = require('chai'),
    uuid = require('uuid');

function TestFixture() {
  this.models = {};
}

TestFixture.prototype.initializeDatabase = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.dbName = (uuid.v4()).replace(/-/g, '');
    self.db = thinky({
      db: self.dbName,
      silent: true
    });

    resolve();
  });
};

TestFixture.prototype.initializeServer = function() {
  var self = this;
  if (process.env.USE_RESTIFY) {
    self.server = self.app = restify.createServer();
    self.server.use(restify.queryParser());
    self.server.use(restify.bodyParser());
  } else {
    self.app = express();
    self.app.use(bodyParser.json());
    self.app.use(bodyParser.urlencoded({ extended: false }));
    self.server = http.createServer(self.app);
  }

  return new Promise(function(resolve, reject) {
    self.server.listen(0, '127.0.0.1', function() {
      self.baseUrl =
        'http://' + self.server.address().address + ':' + self.server.address().port;
      resolve();
    });
  });
};

TestFixture.prototype.clearDatabase = function() {
  var self = this, promises = [];
  Object.keys(this.db.models).forEach(function(model) {
    promises.push(self.db.r.table(model).delete().run());
  });

  return Promise.all(promises)
    .catch(function(err) {});
};

TestFixture.prototype.dropDatabase = function() {
  var self = this;
  return self.db.r
    .dbDrop(self.dbName)
    .then(function() {
      self.dbName = undefined;
      self.db = undefined;
    });
};

// always print stack traces when an error occurs
chai.config.includeStack = true;

module.exports = TestFixture;
