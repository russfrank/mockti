var fs = require('fs');
var data = JSON.parse(fs.readFileSync(__dirname + '/api.jsca'));
var Emitter = require('eventemitter2').EventEmitter2;
var util = require('util');
var _ = require('underscore');

// Modify Emitter's prototype to conform with what Ti does
Emitter.prototype.addEventListener = Emitter.prototype.on;
Emitter.prototype.removeEventListener = Emitter.prototype.removeListener;
Emitter.prototype.fireEvent = Emitter.prototype.emit;

Titanium = Ti = {};

function retrieve (root, list) {
  var name = list.shift();
  if (!root[name]) {
    var newobj = {};
    newobj.name = name;
    _.extend(newobj, Emitter.prototype);
    Emitter.call(newobj);
    root[name] = newobj;
  }
  var current = root[name];
  if (list.length > 0) return retrieve(current, list);
  else return current;
}

function method (namespace, obj, name) {
  // dont want to overwrite these
  if (['addEventListener', 'removeEventListener', 'fireEvent'].indexOf(name) != -1) return;

  // factory
  if (name.indexOf('create') != -1) {
    obj[name] = function (props) {
      var proto = retrieve(Ti, namespace.concat([name.slice(6)]));
      var ret = {};
      _.extend(ret, proto, props);
      return ret;
    };

    return;
  }

  if (name == 'add') {
    obj.add = function (view) {
      this.children = this.children || [];
      this.children.push(view);
    };
  }

  // otherwise it's some method so just make it emit that this method was
  // called
  obj[name] = function () {
    if (this.fireEvent) this.fireEvent('function::' + name, {});
  };
}

data.types.forEach(function (item) {
  // Don't worry about stuff that isn't actually in the Titanium namespace for
  // now
  if (item.name.indexOf('Titanium.') == -1) return;

  var name = item.name.slice(9);
  var namespace = name.split('.').slice(-1);
  var obj = retrieve(Ti, name.split('.'));
  
  item.functions.forEach(function (fn) {
    method(namespace, obj, fn.name);
  });

  item.properties.forEach(function (prop) {
  });
});

// Some manual stuff

Ti.Platform ={
  osname: 'android',
  version: '6',
  model: 'mock',
  id: 'mock-id',
  is24HourTimeFormat: function () { return false; },
  Android: {API_LEVEL: 18},
  displayCaps: {
    platformWidth: 480,
    platformHeight: 800,
    dpi: 160
  }
};

Ti.Network._requests = {};
var old = Ti.Network.createHTTPClient;
Ti.Network.createHTTPClient = function (spec) {
  var xhr = old(spec);
  xhr.open = function (method, url) {
    xhr.method = method;
    xhr.url = url;
    Ti.Network._requests[url] = xhr;
    xhr.fireEvent('function::open', arguments);
  };

  xhr.send = function (data) {
    xhr.data = data;
    xhr.fireEvent('function::send', arguments);
  };

  return xhr;
};

module.exports = Ti;