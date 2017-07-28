"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; // Copied from https://github.com/meteor/babel/blob/master/util.js

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _crypto = require("crypto");

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.mkdirp = function mkdirp(dir) {
  if (!_fs2.default.existsSync(dir)) {
    var parentDir = _path2.default.dirname(dir);
    if (parentDir !== dir) {
      mkdirp(parentDir);
    }

    try {
      _fs2.default.mkdirSync(dir);
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  return dir;
};

// Borrowed from another MIT-licensed project that benjamn wrote:
// https://github.com/reactjs/commoner/blob/235d54a12c/lib/util.js#L136-L168
function deepHash(val) {
  var hash = (0, _crypto.createHash)("sha1");
  var type = typeof val === "undefined" ? "undefined" : _typeof(val);

  if (val === null) {
    type = "null";
  }

  switch (type) {
    case "object":
      var keys = Object.keys(val);

      // Array keys will already be sorted.
      if (!Array.isArray(val)) {
        keys.sort();
      }

      keys.forEach(function (key) {
        if (typeof val[key] === "function") {
          // Silently ignore nested methods, but nevertheless complain below
          // if the root value is a function.
          return;
        }

        hash.update(key + "\0").update(deepHash(val[key]));
      });

      break;

    case "function":
      _assert2.default.ok(false, "cannot hash function objects");
      break;

    default:
      hash.update("" + val);
      break;
  }

  return hash.digest("hex");
}

exports.deepHash = function (val) {
  var argc = arguments.length;
  if (argc === 1) {
    return deepHash(val);
  }

  var args = new Array(argc);
  for (var i = 0; i < argc; ++i) {
    args[i] = arguments[i];
  }

  return deepHash(args);
};

exports.assertProps = function (obj, props) {
  _assert2.default.ok(obj);
  _assert2.default.ok(props);

  var len = props.length;
  for (var i = 0; i < len; i++) {
    _assert2.default.ok(_underscore2.default.has(obj, props[i]), "Prop " + props[i] + " not defined");
  }
};