'use strict';

var assert = require("assert");
var ts = require("typescript");
var presetCompilerOptions = require("./options").presetCompilerOptions;
var _ = require("underscore");
var deepHash = require("./utils").deepHash;

exports.compile = function compile(fileContent, options) {
  var compilerOptions = presetCompilerOptions(
    options.compilerOptions);

  var filePath = options.filePath || deepHash(fileContent) + ".ts";
  var sourceFile = ts.createSourceFile(filePath,
    fileContent, compilerOptions.target);
  if (options.moduleName) {
    sourceFile.moduleName = options.moduleName;
  }

  var defaultHost = ts.createCompilerHost(compilerOptions);

  var customHost = {
    getSourceFile: function(fileName, target) {
      // Skip reading the file content again, we have it already. 
      if (fileName === ts.normalizeSlashes(filePath)) {
        return sourceFile;
      }
      return defaultHost.getSourceFile(fileName, target);
    }
  };

  var compilerHost = _.extend({}, defaultHost, customHost);
  var fileNames = [filePath];
  if (options.typings) {
    fileNames = fileNames.concat(options.typings);
  }
  var program = ts.createProgram(fileNames, compilerOptions, compilerHost);

  var code, sourceMap;
  var processResult =
    function(fileName, outputCode, writeByteOrderMark) {
      if (normalizePath(fileName) !==
            normalizePath(filePath)) return;

      if (ts.fileExtensionIs(fileName, '.map')) {
        sourceMap = prepareSourceMap(outputCode,
          fileContent, filePath);
      } else {
        code = outputCode;
      }
    }
  program.emit(sourceFile, processResult);

  return { 
    code: code,
    sourceMap: sourceMap,
    referencedPaths: getReferencedPaths(sourceFile),
    diagnostics: readDiagnostics(program, filePath)
  };
}

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

function readDiagnostics(program, filePath) {
  var sourceFile;
  if (filePath) {
    sourceFile = program.getSourceFile(filePath);
  }

  var syntactic = flattenDiagnostics(
    program.getSyntacticDiagnostics(sourceFile));
  var semantic =  flattenDiagnostics(
    program.getSemanticDiagnostics(sourceFile));

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
    if (!diagnostic.file) continue;

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
