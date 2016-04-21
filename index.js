"use strict";

var assert = require("assert");
var ts = require("typescript");
var getDefaultCompilerOptions = require("./options").getDefaultCompilerOptions;
var convertCompilerOptionsOrThrow = require("./options").convertCompilerOptionsOrThrow;
var presetCompilerOptions = require("./options").presetCompilerOptions;
var CompileService = require("./compile-service").CompileService;
var createCSResult = require("./compile-service").createCSResult;
var ServiceHost = require("./compile-service-host").CompileServiceHost;
var sourceHost = require("./files-source-host").sourceHost;
var deepHash = require("./utils").deepHash;
var CompileCache = require("./cache").CompileCache;
var FileCache = require("./cache").FileCache;
var Logger = require("./logger").Logger;
var utils = require("./utils");
var tsu = require("./ts-utils").ts;
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
function lazyInit() {
  if (! compileCache) {
    setCacheDir();
  }
}

// A map of TypeScript Language Services
// per each Meteor architecture.
var serviceMap = {};
function getCompileService(arch) {
  if (! arch) arch = "global";

  if (serviceMap[arch]) return serviceMap[arch];

  var serviceHost = new ServiceHost(fileCache);
  var service = new CompileService(serviceHost);
  serviceMap[arch] = service;
  return service;
}

/**
 * Class that represents an incremental TypeScript build (compilation).
 * For the typical usage in a Meteor compiler plugin,
 * see a TypeScript compiler that based on this NPM:
 * https://github.com/barbatus/typescript-compiler/blob/master/typescript-compiler.js#L58
 *
 * @param filePaths Paths of the files to compile.
 * @param getFileContent Method that takes a file path
 *  and returns that file's content. To be used to pass file contents
 *  from a Meteor compiler plugin to the TypeScript compiler.
 * @param options Object with the options of the TypeSctipt build.
 *   Available options:
 *    - compilerOptions: TypeScript compiler options
 *    - arch: Meteor file architecture
 *    - useCache: whether to use cache 
 */
function TSBuild(filePaths, getFileContent, options) {
  Logger.debug("new build");

  var resOptions = validateAndConvertOptions(options);

  lazyInit();

  if (! resOptions)
    resOptions = {compilerOptions: getConvertedDefault()};

  if (! resOptions.compilerOptions) 
    resOptions.compilerOptions = getConvertedDefault();

  resOptions.compilerOptions = presetCompilerOptions(
    resOptions.compilerOptions);

  this.options = resOptions;

  sourceHost.setSource(getFileContent);

  var compileService = getCompileService(resOptions.arch);
  var serviceHost = compileService.getHost();
  serviceHost.setFiles(filePaths, resOptions);

  this.rebuildMap = getRebuildMap(filePaths, resOptions);
}

function rebuildWithNewTypings(typings, options) {
  if (! typings) return false;

  var tLen = typings.length;
  var compileService = getCompileService(options.arch);
  var serviceHost = compileService.getHost();
  for (var i = 0; i < tLen; i++) {
    var path = typings[i];
    if (serviceHost.isFileChanged(path)) return true;
  }

  return false;
}

var RebuildType = {
  FULL: 1,
  DIAG: 2
};

function getRebuildMap(filePaths, options) {
  assert.ok(options);

  if (options.useCache === false) return;

  var files = {};
  var compileService = getCompileService(options.arch);
  var serviceHost = compileService.getHost();

  if (serviceHost.isTypingsChanged()) {
    _.each(filePaths, function(filePath) {
      files[filePath] = RebuildType.FULL;
    });
    return files;
  }

  _.each(filePaths, function(filePath) {
    if (! serviceHost.isFileChanged(filePath)) {
      var refs = compileService.getReferences(filePath);
      if (refs) {
        files[filePath] = rebuildWithNewTypings(refs.typings, options);
        if (files[filePath]) {
          Logger.debug("recompile file %s because typings changed", filePath);
        };

        var modules = refs.modules;
        var mLen = modules.length;
        for (var i = 0; i < mLen; i++) {
          if (serviceHost.isFileChanged(modules[i])) {
            files[filePath] = RebuildType.FULL;
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
  Logger.debug("emit file %s", filePath);
  var options = this.options;

  var compileService = getCompileService(options.arch);

  var sourceFile = compileService.getSourceFile(filePath);
  if (! sourceFile) throw new Error("File " + filePath + " not found");

  var useCache = options && options.useCache;

  // Prepare file options which besides general ones
  // should contain a module name. Omit arch to avoid
  // re-compiling same files aimed for diff arch.
  var noArchOpts = _.omit(options, 'arch');
  var csOptions = {
    options: noArchOpts,
    moduleName: moduleName
  };

  if (useCache === false) {
    var result = compileService.compile(filePath, moduleName);
    compileCache.save(filePath, csOptions, result);
    return result;
  }

  var rebuild = this.rebuildMap[filePath];
  return compileCache.get(filePath, csOptions, function(cacheResult) {
    if (! cacheResult) {
      Logger.debug("cache miss: %s", filePath);
      return compileService.compile(filePath, moduleName);
    }

    if (rebuild === RebuildType.FULL) {
      Logger.debug("full rebuild: %s", filePath);
      return compileService.compile(filePath, moduleName);
    }

    var csResult = createCSResult(cacheResult);
    var tsDiag = csResult.diagnostics;
    // If file is not changed but contains errors from previous
    // build, then mark it as needs diagnostics re-evaluation.
    // This is due to some node modules may become
    // available in the mean time.
    if (tsDiag.hasUnresolvedModules()) {
      Logger.debug("diagnostics re-evaluation: %s", filePath);
      csResult.upDiagnostics(
        compileService.getDiagnostics(filePath));
      return csResult;
    }

    // Cached result is up to date, no action required.
    Logger.debug("file from cached: %s", filePath);
    return null;
  });
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
  // Next three to be used mainly
  // in the compile method above.
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
