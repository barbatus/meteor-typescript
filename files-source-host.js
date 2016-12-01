var ts = require("typescript");
var _ = require("underscore");

var ROOTED = /^(\/|\\)/;

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

SH.normalizePath = function(filePath) {
  if (! filePath) return null;
  var normPath = filePath.replace(ROOTED, '');
  if (! filesMap.contains(normPath)) {
    return normPath;
  }
  return filePath;
}

SH.loadSourceFile = function(filePath) {
  var execPath = ts.sys.getExecutingFilePath();
  var npmPath = ts.combinePaths(ts.getDirectoryPath(
    ts.normalizePath(execPath)),  "../../../");

  var content = ts.sys.readFile(npmPath + filePath, "utf-8");
  var sourceFile = ts.createSourceFile(filePath, content);
  filesMap.set(filePath, sourceFile);
};

exports.sourceHost = new SourceHost();
