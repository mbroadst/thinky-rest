'use strict';

var Promise = require('bluebird'),
    http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    restify = require('restify'),
    chai = require('chai'),
    uuid = require('uuid');

var odm = (!!process.env.USE_THINKAGAIN) ? require('thinkagain') : require('thinky');

function TestFixture() {
  this.models = {};
}

TestFixture.prototype.initializeDatabase = function() {
  this.dbName = (uuid.v4()).replace(/-/g, '');
  this.db = odm({
    db: this.dbName,
    silent: true
  });

  return this.db.dbReady();
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
