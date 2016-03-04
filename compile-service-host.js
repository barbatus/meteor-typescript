"use strict";

var ts = require("typescript");
var deepHash = require("./utils").deepHash;
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;

function CompileServiceHost(compileCache, typingsCache) {
  this.compileCache = compileCache;
  this.typingsCache = typingsCache;

  this.files = {};
  this.webArchExp = new RegExp("^web\.");
}

exports.CompileServiceHost = CompileServiceHost;

var SH = CompileServiceHost.prototype;

SH.setFiles = function(filePaths, options) {
  this.options = options;

  _.each(filePaths, function(filePath) {
    if (! this.files[filePath]) {
      this.files[filePath] = { version: 1 };
      return;
    }

    if (tsu.isTypings(filePath)) {
      if (this.typingsCache.isChanged(filePath)) {
        this.files[filePath].version++;
      }
      return;
    }

    if (this.compileCache.resultChanged(filePath, options)) {
      this.files[filePath].version++;
    }
  }, this);
};

SH.getScriptFileNames = function() {
  var rootFilePaths = [];
  for (var filePath in this.files) {
    rootFilePaths.push(filePath);
  }
  var typings = this.options.typings;
  if (typings) {
    rootFilePaths = rootFilePaths.concat(typings);
  }
  return rootFilePaths;
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
