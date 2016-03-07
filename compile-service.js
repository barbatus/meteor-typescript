"use strict";

var assert = require("assert");
var ts = require("typescript");
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;

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

  var code, sourceMap;
  _.each(result.outputFiles, function(file) {
    if (tsu.normalizePath(filePath) !==
          tsu.normalizePath(file.name)) return;

    var text = file.text;
    if (tsu.isSourceMap(file.name)) {
      var source = sourceHost.get(filePath);
      sourceMap = tsu.prepareSourceMap(text, source, filePath);
    } else {
      code = text;
    }
  }, this);

  return {
    code: code,
    sourceMap: sourceMap,
    version: this.serviceHost.getScriptVersion(filePath),
    isExternal: ts.isExternalModule(sourceFile),
    references: tsu.getReferences(sourceFile),
    diagnostics: this.getDiagnostics(filePath)
  };
};

CP.getSourceFile = function(filePath) {
  var options = this.serviceHost.getCompilationSettings();
  var script = this.serviceHost.getScriptSnapshot(filePath);
  var version = this.serviceHost.getScriptVersion(filePath);
  var sourceFile = this.registry.acquireDocument(
    filePath, options, script, version);
  return sourceFile;
};

CP.getDiagnostics = function(filePath) {
  // Parse diagnostics.
  var syntactic = tsu.flattenDiagnostics(
    this.service.getSyntacticDiagnostics(filePath));
  var semantic = tsu.flattenDiagnostics(
    this.service.getSemanticDiagnostics(filePath));
  return {
    syntacticErrors: syntactic,
    semanticErrors: semantic
  };
};
