"use strict";

var assert = require("assert");
var ts = require("typescript");
var _ = require("underscore");
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;

function CompileService(serviceHost) {
  this.serviceHost = serviceHost;
  this.service = ts.createLanguageService(serviceHost);
}

exports.CompileService = CompileService;

var CP = CompileService.prototype;

CP.compile = function(filePath, moduleName) {
  var sourceFile = this.getSourceFile(filePath);
  assert.ok(sourceFile);

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

CP.getHost = function() {
  return this.serviceHost;
};

CP.getDocRegistry = function() {
  return this.registry;
}

CP.getSourceFile = function(filePath) {
  var program = this.service.getProgram();
  return program.getSourceFile(filePath);
};

CP.getReferences = function(filePath) {
  return tsu.getReferences(this.getSourceFile(filePath));
};

CP.getDiagnostics = function(filePath) {
  return tsu.createDiagnostics(
    this.service.getSyntacticDiagnostics(filePath),
    this.service.getSemanticDiagnostics(filePath)
  )
};
