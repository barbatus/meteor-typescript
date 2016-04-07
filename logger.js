"use strict";

var util = require('util');

function Logger() {
  this.prefix = "[meteor-typescript]: ";
  this.llevel = process.env.TYPESCRIPT_LOG;
}

var LP = Logger.prototype;

LP.debug = function(format, arg) {
  if (this.llevel >= 2) {
    var msg = arg ? util.format(format, arg) : format;
    console.log(this.prefix + msg);
  }
};

LP.assert = function(format, arg) {
  if (this.llevel >= 3) {
    var msg = arg ? util.format(format, arg) : format;
    console.log(this.prefix + msg);
  }
};

exports.Logger = new Logger();
