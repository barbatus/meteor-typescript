"use strict";

var ts = require("typescript");
var _ = require("underscore");

var filesMap = ts.createFileMap();

function SourceHost() {}

var SH = SourceHost.prototype;

SH.setSource = function(fileSource) {
  this.fileSource = fileSource;
};

SH.get = function(filePath) {
  if (this.fileSource) {
    var source = this.fileSource(filePath);
    if (_.isString(source)) return source;
  }

  if (filesMap.contains(filePath)) {
    return filesMap.get(filePath);
  }

  return null;
};

SH.loadSourceFile = function(filePath) {
  var execPath = ts.sys.getExecutingFilePath();
  var npmPath = ts.combinePaths(ts.getDirectoryPath(
    ts.normalizePath(execPath)),  "../../../");

  var content = ts.sys.readFile(npmPath + filePath, "utf-8");
  var sourceFile = ts.createSourceFile(filePath, content);
  filesMap.set(filePath, sourceFile);
};

exports.sourceHost = new SourceHost();
