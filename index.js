'use strict';

const getDefaultOptions = require("./options").getDefaultOptions;
const tsCompile = require("./typescript").compile;
const Cache = require("./cache").Cache;

function setCacheDir(cacheDir) {
  if (compileCache && compileCache.cacheDir === cacheDir) {
    return;
  }

  compileCache = new Cache(function(source, options) {
    return tsCompile(source, options);
  }, cacheDir);
}

exports.setCacheDir = setCacheDir;

let compileCache;
exports.compile = function compile(source, options) {
  options = options || {compilerOptions: getDefaultOptions()};

  if (! options.useCache) {
    return tsCompile(source, options);
  }

  if (! compileCache) {
    setCacheDir();
  }

  return compileCache.get(source, options);
};
