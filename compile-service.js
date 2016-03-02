"use strict";

var assert = require("assert");
var ts = require("typescript");
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;

function CompileService(serviceHost, docRegistry) {
  this.serviceHost = serviceHost;
  this.registry = docRegistry;
  this.service = ts.createLanguageService(serviceHost, docRegistry);
}

exports.CompileService = CompileService;

var CP = CompileService.prototype;

CP.compile = function(filePath, moduleName) {
  var sourceFile = this.getSourceFile(filePath);
  if (moduleName) {
    sourceFile.moduleName = moduleName;
  }

  var result = this.service.getEmitOutput(filePath);

  // Parse diagnostics.
  var syntactic = flattenDiagnostics(
    this.service.getSyntacticDiagnostics(filePath));
  var semantic = flattenDiagnostics(
    this.service.getSemanticDiagnostics(filePath));
  var diagnostics = {
    syntacticErrors: syntactic,
    semanticErrors: semantic
  };

  var code, sourceMap;
  _.each(result.outputFiles, function(file) {
    if (normalizePath(filePath) !==
          normalizePath(file.name)) return;

    if (ts.fileExtensionIs(file.name, '.map')) {
      var source = sourceHost.get(filePath);
      sourceMap = prepareSourceMap(file.text, source, filePath);
    } else {
      code = file.text;
    }
  }, this);

  return {
    code: code,
    version: this.serviceHost.getScriptVersion(filePath),
    sourceMap: sourceMap,
    referencedPaths: getReferencedPaths(sourceFile),
    diagnostics: diagnostics
  };
};

CP.getSourceFile = function(filePath) {
  var options = this.serviceHost.getCompilationSettings();
  var script = this.serviceHost.getScriptSnapshot(filePath);
  var version = this.serviceHost.getScriptVersion(filePath);
  // TODO: add ts.ScriptKind?
  var sourceFile = this.registry.acquireDocument(
    filePath, options, script, version);
  return sourceFile;
};

// HELPERS

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

function getReferencedPaths(sourceFile) {
  var referencedPaths = [];

  // Get resolved modules.
  if (sourceFile.resolvedModules) {
    for (var moduleName in sourceFile.resolvedModules) {
      var module = sourceFile.resolvedModules[moduleName];
      if (module && module.resolvedFileName) {
        referencedPaths.push(module.resolvedFileName);
      }
    }
  }

  // Get declaration file references.
  if (sourceFile.referencedFiles) {
    referencedPaths = sourceFile.referencedFiles.map(function(ref) {
      return ref.fileName;
    });
  }

  return referencedPaths;
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
