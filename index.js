"use strict";

var ts = require("typescript");
var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var CompileService = require("./compile-service").CompileService;
var ServiceHost = require("./compile-service-host").CompileServiceHost;
var sourceHost = require("./files-source-host").sourceHost;
var deepHash = require("./utils").deepHash;
var CompileCache = require("./cache").CompileCache;
var FileCache = require("./cache").FileCache;
var Logger = require("./logger").Logger;
var utils = require("./utils");
var _ = require("underscore");

var compileCache;
var fileCache;
function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new CompileCache(cacheDir);
  fileCache = new FileCache(cacheDir);
};

exports.setCacheDir = setCacheDir;

function getConvertedDefault() {
  return convertCompilerOptionsOrThrow(
    getDefaultCompilerOptions());
}

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
    serviceHost = new ServiceHost(fileCache);
  }

  if (! compileService) {
    compileService = new CompileService(serviceHost, docRegistry);
  }
}

function TSBuild(filePaths, getFileContent, options) {
  var resOptions = validateAndConvertOptions(options);

  lazyInit();

  if (! resOptions)
    resOptions = {compilerOptions: getConvertedDefault()};

  if (! resOptions.compilerOptions) 
    resOptions.compilerOptions = getConvertedDefault();

  this.options = resOptions;

  sourceHost.setSource(getFileContent);

  serviceHost.setFiles(filePaths, resOptions);

  this.rebuildMap = getRebuildMap(filePaths, resOptions);
}

function rebuildWithNewTypings(typings) {
  if (! typings) return false;

  var tLen = typings.length;
  for (var i = 0; i < tLen; i++) {
    var path = typings[i];
    if (serviceHost.isFileChanged(path)) return true;
  }

  return false;
}

function getRebuildMap(filePaths, options) {
  var files = {};

  if (serviceHost.isTypingsChanged()) {
    _.each(filePaths, function(filePath) {
      files[filePath] = true;
    });
    return files;
  }

  _.each(filePaths, function(filePath) {
    if (! compileCache.resultChanged(filePath, options)) {
      var result = compileCache.get(filePath, options);
      var refs = result.references;
      if (refs) {
        files[filePath] = rebuildWithNewTypings(refs.typings);
        if (files[filePath]) return;

        var modules = refs.modules;
        var mLen = modules.length;
        for (var i = 0; i < mLen; i++) {
          if (compileCache.resultChanged(modules[i], options)) {
            files[filePath] = true;
            break;
          }
        }
      }
    }
  });

  return files;
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
    Logger.debug("cache miss: %s", filePath);
    return compileService.compile(filePath, moduleName);
  }, this.rebuildMap[filePath]);
};

exports.compile = function compile(fileContent, options) {
  if (typeof fileContent !== "string") {
    throw new Error("fileContent should be a string");
  }

  var optPath = options && options.filePath;
  var moduleName = options && options.moduleName;

  if (! optPath) {
    optPath = deepHash(fileContent, options);
    var tsx = (options && options.compilerOptions && 
      options.compilerOptions.jsx);
    optPath += tsx ? ".tsx" : ".ts";
  }

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
  if (! options) return null;

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

  var resOptions = _.clone(options);
  // Validate and convert compilerOptions.
  if (options.compilerOptions) {
    resOptions.compilerOptions = convertCompilerOptionsOrThrow(
      options.compilerOptions);
  }

  return resOptions;
}

exports.validateAndConvertOptions = validateAndConvertOptions;

exports.getDefaultOptions = function getDefaultOptions() {
  return {
    compilerOptions: getDefaultCompilerOptions()
  }
}
