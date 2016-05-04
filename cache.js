'use strict';

var path = require("path");
var fs = require("fs");
var assert = require("assert");
var LRU = require("lru-cache");
var sizeof = require('object-sizeof');
var utils = require("./utils");
var pkgVersion = require("./package.json").version;
var random = require("random-js")();
var globalSourceHost = require("./files-source-host").sourceHost;
var Logger = require("./logger").Logger;

function meteorLocalDir() {
  var cwdDir = process.cwd();
  return cwdDir ? path.join(cwdDir, ".meteor", "local") : __dirname;
}

function ensureCacheDir(cacheDir) {
  cacheDir = path.resolve(
    cacheDir ||
    process.env.TYPESCRIPT_CACHE_DIR ||
    path.join(meteorLocalDir(), ".typescript-cache")
  );

  try {
    utils.mkdirp(cacheDir);
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  return cacheDir;
}

function Cache(length) {
  assert.ok(this instanceof Cache);

  var maxSize = process.env.TYPESCRIPT_CACHE_SIZE;
  this._cache = new LRU({
    max: maxSize || 1024 * 1024 * 100,
    length: function(obj, key) {
      return sizeof(obj);
    }
  });
};

exports.Cache = Cache;

var Cp = Cache.prototype;

Cp._get = function(cacheKey) {
  var pget = Logger.newProfiler("cache get");
  var result = this._cache.get(cacheKey);
  pget.end();

  if (! result) {
    var pread = Logger.newProfiler("cache read");
    result = this._readCache(cacheKey);
    pread.end();
  }

  return result; 
};

Cp._save = function(cacheKey, result) {
  var psave = Logger.newProfiler("cache save");
  this._cache.set(cacheKey, result);
  this._writeCacheAsync(cacheKey, result);
  psave.end();
};

Cp._cacheFilename = function(cacheKey) {
  // We want cacheKeys to be hex so that they work on any FS
  // and never end in .cache.
  if (!/^[a-f0-9]+$/.test(cacheKey)) {
    throw Error("bad cacheKey: " + cacheKey);
  }

  return path.join(this.cacheDir, cacheKey + ".cache");
}

Cp._readFileOrNull = function(filename) {
  try {
    return fs.readFileSync(filename, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT")
      return null;
    throw e;
  }
}

Cp._parseJSONOrNull = function(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    if (e instanceof SyntaxError)
      return null;
    throw e;
  }
}

// Returns null if the file does not exist or can't be parsed; otherwise
// returns the parsed compileResult in the file.
Cp._readAndParseCompileResultOrNull = function(filename) {
  var content = this._readFileOrNull(filename);
  return this._parseJSONOrNull(content);
}

Cp._readCache = function(cacheKey) {
  if (! this.cacheDir) {
    return null;
  }

  var cacheFilename = this._cacheFilename(cacheKey);
  var compileResult = this._readAndParseCompileResultOrNull(cacheFilename);
  if (! compileResult) {
    return null;
  }
  this._cache.set(cacheKey, compileResult);

  return compileResult;
}

// We want to write the file atomically.
// But we also don't want to block processing on the file write.
Cp._writeFileAsync = function(filename, contents) {
  var tempFilename = filename + ".tmp." + random.uuid4();
  fs.writeFile(tempFilename, contents, function(err) {
    // ignore errors, it's just a cache
    if (err) {
      return;
    }
    fs.rename(tempFilename, filename, function(err) {
      // ignore this error too.
    });
  });
}

Cp._writeCacheAsync = function(cacheKey, compileResult) {
  if (! this.cacheDir) return;

  var cacheFilename = this._cacheFilename(cacheKey);
  var cacheContents = JSON.stringify(compileResult);
  this._writeFileAsync(cacheFilename, cacheContents);
}


// Cache to save and retrieve compiler results.
function CompileCache(cacheDir, sourceHost) {
  Cache.apply(this);
  this.cacheDir = ensureCacheDir(cacheDir);
  this.sourceHost = sourceHost || globalSourceHost;
}

var CCp = CompileCache.prototype = new Cache();

CCp.get = function(filePath, options, compileFn) {
  var source = this.sourceHost.get(filePath);
  var cacheKey = utils.deepHash(pkgVersion, source, options);

  var compileResult = this._get(cacheKey);
  if (compileResult) {
    Logger.debug("file %s result is in cache", filePath);
  }

  var newResult = compileFn(compileResult);
  if (newResult) {
    newResult.hash = cacheKey;
    this._save(cacheKey, newResult);
    return newResult;
  }

  return compileResult;
};

CCp.save = function(filePath, options, compileResult) {
  var source = this.sourceHost.get(filePath);
  var cacheKey = utils.deepHash(pkgVersion, source, options);

  this._save(cacheKey, compileResult);
};

// Check if a compiler result has changed for a file
// to compile with specific options.
CCp.resultChanged = function(filePath, options) {
  var source = this.sourceHost.get(filePath);
  var cacheKey = utils.deepHash(pkgVersion, source, options);
  var compileResult = this._cache.get(cacheKey);

  if (! compileResult) {
    compileResult = this._readCache(cacheKey);
  }

  return ! compileResult;
};

exports.CompileCache = CompileCache;


/**
 * Simple cache that saves file content hashes.
 * Used to check if a file content has been changed
 * between two successive compilations.
 */
function FileCache(cacheDir) {
  Cache.apply(this);
  this.cacheDir = ensureCacheDir(cacheDir);
}

FileCache.prototype = new Cache();

exports.FileCache = FileCache;

var FCp = FileCache.prototype = new Cache();

FCp.save = function(filePath, arch, content) {
  var profile = {filePath: filePath, arch: arch};
  var cacheKey = utils.deepHash(profile);
  var contentHash = utils.deepHash(content);
  this._save(cacheKey, contentHash);
};

FCp.isChanged = function(filePath, arch, content) {
  var profile = {filePath: filePath, arch: arch};
  var cacheKey = utils.deepHash(profile);
  var contentHash = utils.deepHash(content);
  return this._get(cacheKey) !== contentHash;
};
