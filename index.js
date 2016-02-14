'use strict';

var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var tsCompile = require("./typescript").compile;
var Cache = require("./cache").Cache;
var _ = require("underscore");

function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new Cache(function(source, options) {
    return tsCompile(source, options);
  }, cacheDir);
};

exports.setCacheDir = setCacheDir;

var compileCache;
exports.compile = function compile(source, options) {
  validateAndConvertOptions(options);

  if (! options)
    options = {compilerOptions: getDefaultCompilerOptions()};

  if (! options.compilerOptions) 
    options.compilerOptions = getDefaultCompilerOptions();

  if (options.compilerOptions.useCache) {
    return tsCompile(source, options);
  }

  if (! compileCache) {
    setCacheDir();
  }

  return compileCache.get(source, options);
};

var validOptions = {
  "compilerOptions": "object",
  "filePath": "string",
  "moduleName": "string",
  "typings": "array"
};
var validOptionsMsg = "Valid options are" +
  "compilerOptions, filePath, moduleName, and typings";

function validateAndConvertOptions(options) {
  if (! options) return;

  // Validate top level options.
  for (var option in options) {
    if (options.hasOwnProperty(option)) {
      if (validOptions[option] === undefined) {
        throw new Error("Unknown option: " + option + "." +
          validOptionsMsg);
      }

      if (typeof options[option] !== validOptions[option]) {
        throw new Error(option + " should be of type " +
          validOptions[option]);
      }
    }
  }

  // Validate and convert compilerOptions.
  if (options.compilerOptions) {
    options.compilerOptions = convertCompilerOptionsOrThrow(
      options.compilerOptions);
  }
}

exports.getDefaultOptions = function getDefaultOptions() {
  return {
    compilerOptions: getDefaultCompilerOptions()
  }
}
