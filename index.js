'use strict';

var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var tsCompile = require("./typescript").compile;
var CompilerHost = require("./compiler-host").CompilerHost;
var Cache = require("./cache").Cache;
var _ = require("underscore");

function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new Cache(cacheDir);
};

exports.setCacheDir = setCacheDir;

function getConvertedDefault() {
  return convertCompilerOptionsOrThrow(
    getDefaultCompilerOptions());
}

var compileCache;
exports.compile = function compile(fileContent, options) {
  validateAndConvertOptions(options);

  if (! options)
    options = {compilerOptions: getConvertedDefault()};

  if (! options.compilerOptions) 
    options.compilerOptions = getConvertedDefault();

  var chost = new CompilerHost(fileContent, options);
  if (options.compilerOptions.useCache) {
    return tsCompile(chost);
  }

  if (! compileCache) {
    setCacheDir();
  }

  var source = chost.getFileSource();
  return compileCache.get(source, options, function() {
    return tsCompile(chost);
  });
};

var validOptions = {
  "compilerOptions": "Object",
  "filePath": "String",
  "moduleName": "String",
  "typings": "Array",
  "arch": "String"
};
var validOptionsMsg = "Valid options are " +
  "compilerOptions, filePath, moduleName, and typings.";

function checkType(option, optionName) {
  if (! option) return true;

  return option.constructor.name === validOptions[optionName];
}

function validateAndConvertOptions(options) {
  if (! options) return;

  // Validate top level options.
  for (var option in options) {
    if (options.hasOwnProperty(option)) {
      if (validOptions[option] === undefined) {
        throw new Error("Unknown option: " + option + ".\n" +
          validOptionsMsg);
      }

      if (! checkType(options[option], option)) {
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

exports.validateAndConvertOptions = validateAndConvertOptions;

exports.getDefaultOptions = function getDefaultOptions() {
  return {
    compilerOptions: getDefaultCompilerOptions()
  }
}
