"use strict";

var ts = require("typescript");
var deepHash = require("./utils").deepHash;
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;
var Logger = require("./logger").Logger;
var StringScriptSnapshot = require("./script-snapshot").ScriptSnapshot;

function CompileServiceHost(fileCache) {
  this.files = {};
  this.fileCache = fileCache;
  this.typingsChanged = false;
  this.appId = this.curDir = ts.sys.getCurrentDirectory();
  this.webArchExp = new RegExp("^web");
}

exports.CompileServiceHost = CompileServiceHost;

var SH = CompileServiceHost.prototype;

SH.setFiles = function(filePaths, options) {
  this.options = options;
  var typingsChanged = false;
  var typings = {};

  _.each(filePaths, function(filePath) {
    var isTypings = tsu.isTypings(filePath);
    if (isTypings) typings[filePath] = true;

    if (! this.files[filePath]) {
      this.files[filePath] = { version: 0 };
    }

    var arch = options.arch;
    var source = sourceHost.get(filePath);
    // Use file path with the current dir for the cache
    // to avoid same file names coincidences between apps.
    var fullPath = ts.combinePaths(this.curDir, filePath);
    var fileChanged = this.fileCache.isChanged(
      fullPath, arch, source);
    if (! fileChanged) {
      this.files[filePath].changed = false;
    }

    if (fileChanged) {
      this.files[filePath].version++;
      this.files[filePath].changed = true;
      if (isTypings) {
        Logger.debug("declaration file %s changed", filePath);
        typingsChanged = true;
      }
      this.fileCache.save(fullPath, arch, source);
      return;
    }
  }, this);

  this.typingsChanged = typingsChanged;

  // Investigate if the number of declaration files have changed.
  // In the positive case, we'll need to revaluate diagnostics
  // for all files of specific architecture.
  if (options && options.arch) {
    var arch = options.arch;
    // Check if the typings array differs from the previous value.
    typingsChanged = this.fileCache.isChanged(this.appId, arch, typings);
    if (typingsChanged) {
      Logger.debug("typings of %s changed", arch);
      this.typingsChanged = typingsChanged;
    }
    this.fileCache.save(this.appId, arch, typings);
  }
};

SH.isFileChanged = function(filePath) {
  var file = this.files[filePath];
  return file && file.changed;
};

SH.hasFile = function(filePath) {
  return !! this.files[filePath];
};

SH.isTypingsChanged = function() {
  return this.typingsChanged;
};

SH.getScriptFileNames = function() {
  var rootFilePaths = {};
  for (var filePath in this.files) {
    rootFilePaths[filePath] = true;
  }

  // Add in options.typings, which is used
  // to set up typings that should be read from disk.
  var typings = this.options.typings;
  if (typings) {
    _.each(typings, function(filePath) {
      if (! rootFilePaths[filePath]) {
        rootFilePaths[filePath] = true;
      }
    });
  }

  return _.keys(rootFilePaths);
};

SH.getScriptVersion = function(filePath) {
  return this.files[filePath] &&
    this.files[filePath].version.toString();
};

SH.getScriptSnapshot = function(filePath) {
  var source = sourceHost.get(filePath);
  if (source !== null) {
    return new StringScriptSnapshot(source);
  }

  var fileContent = ts.sys.readFile(filePath, "utf-8");
  return fileContent ? new StringScriptSnapshot(fileContent) : null;
};

SH.getCompilationSettings = function() {
  return this.options.compilerOptions;
};

SH.getDefaultLibFileName = function() {
  var libName = ts.getDefaultLibFilePath(
    this.getCompilationSettings());
  if (! this.webArchExp.test(this.options.arch)) {
    var dir = ts.getDirectoryPath(libName);
    libName = ts.combinePaths(dir, "lib.core.d.ts");
  }
  Logger.assert("default lib %s", libName);
  return libName;
};

// Returns empty since we process for simplicity
// file paths relative to the Meteor app.
SH.getCurrentDirectory = function() {
  return "";
};

SH.useCaseSensitiveFileNames = function() {
  return true;
};
