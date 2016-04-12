"use strict";

var ts = require("typescript");
var _ = require("underscore");

// 1) Normalizes slashes in the file path
// 2) Removes file extension
function normalizePath(filePath) {
  var resultName = filePath;
  if (ts.fileExtensionIs(resultName, '.map')) {
    resultName = resultName.replace('.map', '');
  }
  return ts.removeFileExtension(
    ts.normalizeSlashes(resultName));
}

function prepareSourceMap(sourceMapContent, fileContent, sourceMapPath) {
  var sourceMapJson = JSON.parse(sourceMapContent);
  sourceMapJson.sourcesContent = [fileContent];
  sourceMapJson.sources = [sourceMapPath];
  return sourceMapJson;
}

function getReferences(sourceFile) {
  var modules = [];

  // Get resolved modules.
  if (sourceFile.resolvedModules) {
    for (var moduleName in sourceFile.resolvedModules) {
      var module = sourceFile.resolvedModules[moduleName];
      if (module && module.resolvedFileName) {
        modules.push(module.resolvedFileName);
      }
    }
  }

  // Get file references.
  var typings = [], files = [];
  if (sourceFile.referencedFiles) {
    var referencedPaths = sourceFile.referencedFiles.map(function(ref) {
      return ref.fileName;
    });

    typings = _.filter(referencedPaths, function(ref) {
      return isTypings(ref);
    });

    files = _.filter(referencedPaths, function(ref) {
      return ! isTypings(ref);
    });
  }

  return {
    modules: modules.concat(files),
    typings: typings
  };
}

function createDiagnostics(tsSyntactic, tsSemantic) {
  // Parse diagnostics to leave only info we need.
  var syntactic = flattenDiagnostics(tsSyntactic);
  var semantic = flattenDiagnostics(tsSemantic);
  return {
    syntacticErrors: syntactic,
    semanticErrors: semantic
  };
}

function flattenDiagnostics(tsDiagnostics) {
  var diagnostics = [];

  var dLen = tsDiagnostics.length;
  for (var i = 0; i < dLen; i++) {
    var diagnostic = tsDiagnostics[i];
    if (! diagnostic.file) continue;

    var pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    var line = pos.line + 1;
    var column = pos.character + 1;

    diagnostics.push({
      fileName: diagnostic.file.fileName,
      message: message,
      line: line,
      column: column
    });
  }

  return diagnostics;
}

function hasErrors(diagnostics) {
  if (! diagnostics) return true;

  return !! diagnostics.semanticErrors.length ||
    !! diagnostics.syntacticErrors.length;
}

function isSourceMap(fileName) {
  return ts.fileExtensionIs(fileName, '.map');
}

function isTypings(fileName) {
  return ts.fileExtensionIs(fileName, '.d.ts');
}

exports.ts = {
  normalizePath: normalizePath,
  prepareSourceMap: prepareSourceMap,
  getReferences: getReferences,
  createDiagnostics: createDiagnostics,
  hasErrors: hasErrors,
  flattenDiagnostics: flattenDiagnostics,
  isSourceMap: isSourceMap,
  isTypings: isTypings
};
