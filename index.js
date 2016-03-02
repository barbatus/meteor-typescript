"use strict";

var ts = require("typescript");
var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var CompileService = require("./compile-service").CompileService;
var ServiceHost = require("./compile-service-host").CompileServiceHost;
var sourceHost = require("./files-source-host").sourceHost;
var deepHash = require("./utils").deepHash;
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
var serviceHost;
var compileService;
var docRegistry;

function lazyInit() {
  if (! compileCache) {
    setCacheDir();
  }

  if (! docRegistry) {
    docRegistry = ts.createDocumentRegistry();
  }

  if (! serviceHost) {
    serviceHost = new ServiceHost(compileCache);
  }

  if (! compileService) {
    compileService = new CompileService(serviceHost, docRegistry);
  }
}

function TSBuild(filePaths, getFileContent, options) {
  validateAndConvertOptions(options);

  lazyInit();

  if (! options)
    options = {compilerOptions: getConvertedDefault()};

  if (! options.compilerOptions) 
    options.compilerOptions = getConvertedDefault();

  this.options = options;

  sourceHost.setSource(getFileContent);

  serviceHost.setFiles(filePaths, options);
}

exports.TSBuild = TSBuild;

var BP = TSBuild.prototype;

BP.emit = function(filePath, moduleName) {
  var options = this.options;
  var useCache = options && options.useCache;

  if (useCache === false) {
    return compileService.compile(filePath, moduleName);
  }

  return compileCache.get(filePath, options, function() {
    return compileService.compile(filePath, moduleName);
  });
};

exports.compile = function compile(fileContent, options) {
  if (typeof fileContent !== "string") {
    throw new Error("fileContent should be a string");
  }

  var optPath = options && options.filePath;
  var moduleName = options && options.moduleName;

  var optPath = optPath ? optPath : deepHash(fileContent, options) + ".ts";
  var getFileContent = function(filePath) {
    if (filePath === optPath) {
      return fileContent;
    }
  }

  var newBuild = new TSBuild([optPath], getFileContent, options);
  return newBuild.emit(optPath, moduleName);
};

var validOptions = {
  "compilerOptions": "Object",
  "filePath": "String",
  "moduleName": "String",
  "typings": "Array",
  "arch": "String",
  "useCache": "Boolean"
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
