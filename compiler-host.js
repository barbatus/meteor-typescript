
var ts = require("typescript");
var deepHash = require("./utils").deepHash;
var _ = require("underscore");
var presetCompilerOptions = require("./options").presetCompilerOptions;

var filesMap = ts.createFileMap();

function CompilerHost(fileContent, options) {
  this.options = options;
  this.fileContent = fileContent;
  this.getFileContent = _.isFunction(fileContent) ? fileContent : null;

  this.defaultHost = ts.createCompilerHost(
    this.getCompilerOptions());
  _.defaults(this, this.defaultHost);

  this.webArchExp = new RegExp("^web\.");
}

exports.CompilerHost = CompilerHost;

var CP = CompilerHost.prototype;

CP.getCompilerOptions = function() {
  if (! this.compilerOptions) {
    this.compilerOptions = presetCompilerOptions(
      this.options.compilerOptions);
  }
  return this.compilerOptions;
};

CP.getFilePath = function() {
  if (! this.filePath) {
    var filePath = this.options.filePath;
    filePath = filePath && ts.normalizeSlashes(filePath);
    this.filePath = filePath ||
      deepHash(this.getFileSource()) + ".ts";
  }
  return this.filePath;
};

CP.getFileSource = function() {
  if (! this.source) {
    var filePath = this.options.filePath;
    this.source = this.getFileContent ?
      this.getFileContent(filePath) : this.fileContent;
  }
  return this.source;
};

CP.getMainSourceFile = function() {
  if (! this.sourceFile) {
    var source = this.getFileSource();
    var filePath = this.getFilePath();
    var target = this.getCompilerOptions().target;
    var moduleName = this.options.moduleName;
    var sourceFile = ts.createSourceFile(filePath, source, target);
    if (moduleName) {
      sourceFile.moduleName = moduleName;
    }
    this.sourceFile = sourceFile;
    filesMap.set(filePath, this.sourceFile);
  }
  return this.sourceFile;
};

CP.getRootFileNames = function() {
  var fileNames = [this.filePath];
  var typings = this.options.typings;
  if (typings) {
    fileNames = fileNames.concat(typings);
  }
  return fileNames; 
};

CP.getSourceFile = function(filePath, target, onError) {
  // Skip reading again the source file that we compile,
  // we have it already.
  if (filePath === this.filePath) return this.getMainSourceFile();

  if (this.getFileContent) {
    var content = this.getFileContent(filePath);
    if (content) {
      var file = ts.createSourceFile(filePath,
        content, this.compilerOptions.target);
      filesMap.set(filePath, file);
      return file;
    }
  }

  if (filesMap.contains(filePath)) {
    return filesMap.get(filePath);
  }

  var file = this.defaultHost.getSourceFile(filePath, target, onError);
  filesMap.set(filePath, file);

  return file;
};

CP.getDefaultLibFileName = function() {
  var libName = this.defaultHost.getDefaultLibFileName(
    this.getCompilerOptions());
  if (!this.webArchExp.test(this.options.arch)) {
    return libName.replace(/lib\./, 'lib.core.');
  }
  return libName;
};

CP.getCurrentDirectory = function() {
  return "";
};
