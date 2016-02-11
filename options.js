'use strict';

const ts = require("typescript");
const _ = require("underscore");

function getCompilerOptions(customOptions) {
  let compilerOptions = ts.getDefaultCompilerOptions();

  _.extend(compilerOptions, customOptions);

  // Support decorators by default.
  compilerOptions.experimentalDecorators = true;

  // Declaration files are expected to
  // be generated separately.
  compilerOptions.declaration = false;

  // Overrides watching,
  // it is handled by Meteor itself.
  compilerOptions.watch = false;

  // We use source maps via Meteor file API,
  // This class's API provides source maps
  // separately but alongside compilation results.
  // Hence, skip generating inline source maps.
  compilerOptions.inlineSourceMap = false;
  compilerOptions.inlineSources = false;

  // Always emit.
  compilerOptions.noEmit = false;
  compilerOptions.noEmitOnError = false;

  // Don't generate any files, hence,
  // skip setting outDir and outFile.
  compilerOptions.outDir = null;
  compilerOptions.outFile = null;

  // This is not need as well.
  // API doesn't have paramless methods.
  compilerOptions.rootDir = null;
  compilerOptions.sourceRoot = null;

  return compilerOptions;
}

exports.getCompilerOptions = getCompilerOptions;

// Default compiler options.
function getDefaultOptions() {
  return {
    module : ts.ModuleKind.None,
    target: ts.ScriptTarget.ES5,
    sourceMap: true,
    noResolve: false,
    diagnostics: true,
    // Custom option to turn on/off cache.
    useCache: true,
    // Always emit class metadata,
    // especially useful for Angular2.
    emitDecoratorMetadata: true
  }
}

exports.getDefaultOptions = getDefaultOptions;
