"use strict";

var ts = require("typescript");
var deepHash = require("./utils").deepHash;
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;

function CompileServiceHost(fileCache) {
  this.files = {};
  this.fileCache = fileCache;
  this.typingsChanged = false;
  this.appId = ts.sys.getCurrentDirectory();
  this.webArchExp = new RegExp("^web\.");
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

    if (this.fileCache.isChanged(filePath)) {
      this.files[filePath].version++;
      this.files[filePath].changed = true;
      typingsChanged = typingsChanged || isTypings;
      this.fileCache.save(filePath);
    }
  }, this);

  this.typingsChanged = typingsChanged ||
    this.fileCache.isChanged(this.appId, typings);
  this.fileCache.save(this.appId, typings);
};

SH.isFileChanged = function(filePath) {
  return this.files[filePath].changed;
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
  if (source) {
    return ts.ScriptSnapshot.fromString(source);
  }

  var fileContent = ts.sys.readFile(filePath, "utf-8");
  return fileContent ?
    ts.ScriptSnapshot.fromString(fileContent) : null;
};

SH.getCompilationSettings = function() {
  return this.options.compilerOptions;
};

SH.getDefaultLibFileName = function() {
  var libName = ts.getDefaultLibFilePath(
    this.getCompilationSettings());
  if (! this.webArchExp.test(this.options.arch)) {
    return libName.replace(/lib\./, 'lib.core.');
  }
  return libName;
};

SH.getCurrentDirectory = function() {
  return "";
};
