var assert = require("assert");
var ts = require("typescript");
var _ = require("underscore");

var Logger = require("./logger").Logger;
var sourceHost = require("./files-source-host").sourceHost;
var tsu = require("./ts-utils").ts;
var assertProps = require("./utils").assertProps;

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

  var checker = this.getTypeChecker();
  var pcs = Logger.newProfiler("process csresult");
  var csResult = createCSResult({
    code: code,
    sourceMap: sourceMap,
    version: this.serviceHost.getScriptVersion(filePath),
    isExternal: ts.isExternalModule(sourceFile),
    dependencies: tsu.getDepsAndRefs(sourceFile, checker),
    diagnostics: this.getDiagnostics(filePath)
  });
  pcs.end();

  return csResult;
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

CP.getDepsAndRefs = function(filePath) {
  var checker = this.getTypeChecker();
  return tsu.getDepsAndRefs(this.getSourceFile(filePath), checker);
};

CP.getRefTypings = function(filePath) {
  var refs = tsu.getRefs(this.getSourceFile(filePath));
  return refs.refTypings;
};

CP.getTypeChecker = function() {
  return this.service.getProgram().getTypeChecker();
};

CP.getDiagnostics = function(filePath) {
  return tsu.createDiagnostics(
    this.service.getSyntacticDiagnostics(filePath),
    this.service.getSemanticDiagnostics(filePath)
  )
};

function createCSResult(result) {
  assertProps(result, [
    "code", "sourceMap", "version",
    "isExternal", "dependencies", "diagnostics"
  ]);
  result.diagnostics = new tsu.TsDiagnostics(
    result.diagnostics);

  return new CSResult(result);
}

exports.createCSResult = createCSResult;

function CSResult(result) {
  assert.ok(this instanceof CSResult);

  _.extend(this, result);
}

var CRP = CSResult.prototype;

CRP.upDiagnostics = function(diagnostics) {
  this.diagnostics = new tsu.TsDiagnostics(diagnostics);
};
