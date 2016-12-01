var ts = require("typescript");
var _ = require("underscore");

var deepHash = require("./utils").deepHash;
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;
var Logger = require("./logger").Logger;
var StringScriptSnapshot = require("./script-snapshot").ScriptSnapshot;

function CompileServiceHost(fileCache) {
  this.files = {};
  this.fileCache = fileCache;
  this.fileContentMap = new Map();
  this.typingsChanged = false;
  this.appId = this.curDir = ts.sys.getCurrentDirectory();
}

exports.CompileServiceHost = CompileServiceHost;

var SH = CompileServiceHost.prototype;

SH.setFiles = function(filePaths, options) {
  this.options = options;
  this.filePaths = filePaths;

  var arch = options && options.arch;
  _.each(filePaths, function(filePath) {
    if (! this.files[filePath]) {
      this.files[filePath] = { version: 0 };
    }

    var source = sourceHost.get(filePath);
    this.files[filePath].changed = false;
    // Use file path with the current dir for the cache
    // to avoid same file names coincidences between apps.
    var fullPath = ts.combinePaths(this.curDir, filePath);
    var fileChanged = this.fileCache.isChanged(fullPath, arch, source);
    if (fileChanged) {
      this.files[filePath].version++;
      this.files[filePath].changed = true;
      this.fileCache.save(fullPath, arch, source);
      return;
    }
  }, this);
};

SH.setTypings = function(typings, options) {
  var dtsMap = {};
  var arch = options && options.arch;
  var typingsChanged = false;
  for (var i = 0; i < typings.length; i++) {
    var filePath = typings[i];
    if (this.hasFile(filePath)) { 
      dtsMap[filePath] = true;
      if (this.isFileChanged(filePath)) {
        Logger.debug("declaration file %s changed", filePath);
        typingsChanged = true;
      }
      continue;
    }
    var fullPath = ts.combinePaths(this.curDir, filePath);
    var source = this.getFile(fullPath);
    if (source) {
      dtsMap[filePath] = true;
      var fileChanged = this.fileCache.isChanged(fullPath, arch, source);
      if (fileChanged) {
        this.fileCache.save(fullPath, arch, source);
        Logger.debug("declaration file %s changed", filePath);
        typingsChanged = true;
      }
    }
  };

  // Investigate if the number of declaration files have changed.
  // In the positive case, we'll need to revaluate diagnostics
  // for all files of specific architecture.
  if (arch) {
    // Check if typings map differs from the previous value.
    var mapChanged = this.fileCache.isChanged(this.appId, arch, dtsMap);
    if (mapChanged) {
      Logger.debug("typings of %s changed", arch);
      typingsChanged = mapChanged;
    }
    this.fileCache.save(this.appId, arch, dtsMap);
  }

  this.typingsChanged = typingsChanged;
}

SH.isFileChanged = function(filePath) {
  var normPath = sourceHost.normalizePath(filePath);
  var file = this.files[normPath];
  return file && file.changed;
};

SH.hasFile = function(filePath) {
  var normPath = sourceHost.normalizePath(filePath);
  return !! this.files[normPath];
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
  var normPath = sourceHost.normalizePath(filePath);
  return this.files[normPath] &&
    this.files[normPath].version.toString();
};

SH.getScriptSnapshot = function(filePath) {
  var source = sourceHost.get(filePath);
  if (source !== null) {
    return new StringScriptSnapshot(source);
  }

  var fileContent = this.getFile(filePath);
  return fileContent ? new StringScriptSnapshot(fileContent) : null;
};

SH.getFile = function(filePath) {
  // Read node_modules files optimistically.
  var fileContent = this.fileContentMap.get(filePath);
  if (! fileContent) {
    fileContent = ts.sys.readFile(filePath, "utf-8");
    this.fileContentMap.set(filePath, fileContent);
  }
  return fileContent;
};

SH.getCompilationSettings = function() {
  return this.options.compilerOptions;
};

SH.getDefaultLibFileName = function() {
  var libName = ts.getDefaultLibFilePath(
    this.getCompilationSettings());
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
