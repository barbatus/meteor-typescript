'use strict';

var ts = require("typescript");
var _ = require("underscore");

function getCompilerOptions(customOptions) {
  var compilerOptions = ts.getDefaultCompilerOptions();

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
function getDefaultCompilerOptions() {
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

exports.getDefaultCompilerOptions = getDefaultCompilerOptions;

var customOptions = ['useCache'];
function isCustomOption(option) {
  return customOptions.indexOf(option) !== -1;
}

function validateCustomOptions(options) {
  if ('useCache' in options) {
    if (typeof options['useCache'] !== 'boolean') {
      throw new Error('useCache should be boolean');
    }
  }
}

// Validate compiler options and convert them from 
// user-friendly format to enum values used by TypeScript:
// 'system' string converted to ts.ModuleKind.System value.
function convertCompilerOptionsOrThrow(options) {
  if (! options) return null;

  var compilerOptions = _.clone(options);
  var customOptions = {};
  if (compilerOptions) {
    for (var option in compilerOptions) {
      if (isCustomOption(option)) {
        customOptions[option] = compilerOptions[option];
        delete compilerOptions[option];
      }
    }
  }

  var testOptions = {};
  testOptions.compilerOptions = compilerOptions;
  testOptions.files = [];
  var result = ts.parseJsonConfigFileContent(testOptions);

  if (result.errors && result.errors.length) {
    throw new Error(result.errors[0].messageText);
  }

  validateCustomOptions(customOptions);

  // Add converted compiler options plus custom options back.
  compilerOptions = _.extend(
    result.options, customOptions);

  return compilerOptions;
}

exports.convertCompilerOptionsOrThrow = convertCompilerOptionsOrThrow;
