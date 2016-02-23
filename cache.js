'use strict';

var path = require("path");
var fs = require("fs");
var assert = require("assert");
var LRU = require("lru-cache");
var utils = require("./utils");
var pkgVersion = require("./package.json").version;
var random = require("random-js")();

function ensureCacheDir(cacheDir) {
  cacheDir = path.resolve(
    cacheDir ||
    process.env.TYPESCRIPT_CACHE_DIR ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || __dirname,
        ".typescript-cache"
    )
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

function Cache(compileFn, cacheDir) {
  assert.ok(this instanceof Cache);
  assert.strictEqual(typeof compileFn, "function");

  this.compileFn = compileFn;
  this.cacheDir = ensureCacheDir(cacheDir);

  var maxSize = process.env.TYPESCRIPT_CACHE_SIZE;
  this._cache = new LRU({
    max: maxSize || 1024 * 10 * 10
  });
};

exports.Cache = Cache;

var Cp = Cache.prototype;

Cp.get = function(source, options) {
  var cacheKey = utils.deepHash(pkgVersion, source, options);
  var compileResult = this._cache.get(cacheKey);

  if (! compileResult) {
    compileResult = this._readCache(cacheKey);
  }

  if (! compileResult) {
    compileResult = this.compileFn(source, options);
    compileResult.hash = cacheKey;
    this._cache.set(cacheKey, compileResult);
    this._writeCacheAsync(cacheKey, compileResult);
  }

  return compileResult;
}

Cp._cacheFilename = function(cacheKey) {
  // We want cacheKeys to be hex so that they work on any FS
  // and never end in .cache.
  if (!/^[a-f0-9]+$/.test(cacheKey)) {
    throw Error('bad cacheKey: ' + cacheKey);
  }

  return path.join(this.cacheDir, cacheKey + '.cache');
}

Cp._readFileOrNull = function(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT')
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
  var tempFilename = filename + '.tmp.' + random.uuid4();
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
