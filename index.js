'use strict';

var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var tsCompile = require("./typescript").compile;
var Cache = require("./cache").Cache;
var _ = require("underscore");

exports.setCacheDir = function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new Cache(function(source, options) {
    return tsCompile(source, options);
  }, cacheDir);
};

var compileCache;
exports.compile = function compile(source, options) {
  options = options ? convertOptionsOrThrow(options) :
    {compilerOptions: getDefaultCompilerOptions()};

  if (! options.useCache) {
    return tsCompile(source, options);
  }

  if (! compileCache) {
    setCacheDir();
  }

  return compileCache.get(source, options);
};

function convertOptionsOrThrow(options) {
  if (! options.compilerOptions) return null;

  var compilerOptions = convertCompilerOptionsOrThrow(options.compilerOptions);
  var result = _.clone(options);
  result.compilerOptions = compilerOptions;

  return result;
}

exports.convertOptionsOrThrow = convertOptionsOrThrow;

exports.getDefaultOptions = function getDefaultOptions() {
  return {
    compilerOptions: getDefaultCompilerOptions()
  }
}
