'use strict';

const assert = require("assert");
const ts = require("typescript");
const getCompilerOptions = require("./options").getCompilerOptions;
const _ = require("underscore");
const deepHash = require("./utils").deepHash;

exports.compile = function compile(fileContent, options) {
  let compilerOptions = getCompilerOptions(
    options.compilerOptions);

  const filePath = options.filePath || deepHash(fileContent) + ".ts";
  let sourceFile = ts.createSourceFile(filePath,
    fileContent, compilerOptions.target);
  if (options.moduleName) {
    sourceFile.moduleName = options.moduleName;
  }

  let defaultHost = ts.createCompilerHost(compilerOptions);

  let customHost = {
    getSourceFile: function(fileName, target) {
      // Skip reading the file content again, we have it already. 
      if (fileName === ts.normalizeSlashes(filePath)) {
        return sourceFile;
      }
      return defaultHost.getSourceFile(fileName, target);
    }
  };

  let compilerHost = _.extend({}, defaultHost, customHost);
  let fileNames = [filePath];
  if (options.typings) {
    fileNames.concat(options.typings);
  }
  let program = ts.createProgram(fileNames, compilerOptions, compilerHost);

  let code, sourceMap;
  const processResult = (fileName, outputCode, writeByteOrderMark) => {
    if (normalizePath(fileName) !==
          normalizePath(filePath)) return;

    if (ts.fileExtensionIs(fileName, '.map')) {
      var sourceMapPath = options.moduleName ?
        options.moduleName : filePath;
      sourceMap = prepareSourceMap(outputCode,
        fileContent, sourceMapPath);
    } else {
      code = outputCode;
    }
  }
  program.emit(sourceFile, processResult);

  return { 
    code,
    sourceMap,
    referencedPaths: getReferencedPaths(sourceFile),
    diagnostics: readDiagnostics(program, filePath)
  };
}

// 1) Normalizes slashes in the file path
// 2) Removes file extension
function normalizePath(filePath) {
  let resultName = filePath;
  if (ts.fileExtensionIs(resultName, '.map')) {
    resultName = resultName.replace('.map', '');
  }
  return ts.removeFileExtension(
    ts.normalizeSlashes(resultName));
}

function prepareSourceMap(sourceMapContent, fileContent, sourceMapPath) {
  let sourceMapJson = JSON.parse(sourceMapContent);
  sourceMapJson.sourcesContent = [fileContent];
  sourceMapJson.sources = [sourceMapPath];
  return sourceMapJson;
}

function getReferencedPaths(sourceFile) {
  let referencedPaths = [];

  // Get resolved modules.
  if (sourceFile.resolvedModules) {
    for (let moduleName in sourceFile.resolvedModules) {
      let module = sourceFile.resolvedModules[moduleName];
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
  let sourceFile;
  if (filePath) {
    sourceFile = program.getSourceFile(filePath);
  }

  let syntactic = flattenDiagnostics(
    program.getSyntacticDiagnostics(sourceFile));
  let semantic =  flattenDiagnostics(
    program.getSemanticDiagnostics(sourceFile));

  return {
    syntactic,
    semantic
  };
}

function flattenDiagnostics(tsDiagnostics) {
  let diagnostics = [];

  tsDiagnostics.forEach(function(diagnostic) {
    if (!diagnostic.file) return;

    let pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    let line = pos.line + 1;
    let column = pos.character + 1;

    diagnostics.push({
      fileName: diagnostic.file.fileName,
      message: message,
      line: line,
      column: column
    });
  });

  return diagnostics;
}
