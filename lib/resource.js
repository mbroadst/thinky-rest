'use strict';

var _ = require('lodash'),
    Controllers = require('./controllers');

var Resource = function(options) {
  _.defaults(options, {
    actions: ['create', 'read', 'update', 'delete', 'list'],
    pagination: true,
    documentValidation: false
  });

  _.defaultsDeep(options, {
    search: {
      param: 'q'
    },
    sort: {
      param: 'sort'
    }
  });

  this.app = options.app;
  this.odm = options.odm;
  this.model = options.model;
  this.actions = options.actions;
  this.endpoints = {
    plural: options.endpoints[0],
    singular: options.endpoints[1] || options.endpoints[0]
  };
  this.updateMethod = options.updateMethod;
  this.pagination = options.pagination;
  this.search = options.search;
  this.sort = options.sort;

  this.controllers = {};
  this.actions.forEach(function(action) {
    var Controller = Controllers[action];
    var endpoint = this.endpoints[Controller.prototype.plurality];

    this.controllers[action] = new Controller({
      endpoint: endpoint,
      app: this.app,
      model: this.model,
      odm: this.odm,
      resource: this,
      documentValidation: !!options.documentValidation,
      isRestify: options.isRestify
    });
  }.bind(this));

  var hooks = Controllers.base.hooks,
      self = this;

  this.actions.forEach(function(action) {
    self[action] = self[action] || {};
    hooks.forEach(function(hook) {
      self[action][hook] = function(f) {
        self.controllers[action].milestone(hook, f);
      };

      self[action][hook].before = function(f) {
        self.controllers[action].milestone(hook + '_before', f);
      };

      self[action][hook].after = function(f) {
        self.controllers[action].milestone(hook + '_after', f);
      };
    });
  });

  this.all = {};

  hooks.forEach(function(hook) {
    self.all[hook] = function(f) {
      self.actions.forEach(function(action) {
        self.controllers[action].milestone(hook, f);
      });
    };

    self.all[hook].before = function(f) {
      self.actions.forEach(function(action) {
        self.controllers[action].milestone(hook + '_before', f);
      });
    };

    self.all[hook].after = function(f) {
      self.actions.forEach(function(action) {
        self.controllers[action].milestone(hook + '_after', f);
      });
    };

  });
};

Resource.prototype.use = function(middleware) {
  var self = this,
      actions = _.clone(self.actions);

  actions.push('all');
  actions.forEach(function(action) {
    if (_.has(middleware, action)) {
      _.forOwn(middleware[action], function(definition, milestone) {
        if (_.isFunction(definition)) {
          self[action][milestone](definition);
        } else {
          if (_.has(definition, 'action')) self[action][milestone](definition.action);
          if (_.has(definition, 'before')) self[action][milestone].before(definition.before);
          if (_.has(definition, 'after')) self[action][milestone].after(definition.after);
        }
      });
    }
  });

  if (_.has(middleware, 'extraConfiguration') && _.isFunction(middleware.extraConfiguration))
    middleware.extraConfiguration(this);
};

module.exports = Resource;
