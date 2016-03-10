"use strict";

var util = require('util');

function Logger() {
  this.prefix = "[meteor-typescript]: ";
  this.llevel = process.env.TYPESCRIPT_LOG;
}

var LP = Logger.prototype;

LP.debug = function(format, msg) {
  if (this.llevel >= 2) {
    console.log(this.prefix + util.format(format, msg));
  }
};

exports.Logger = new Logger();
