var assert = require("assert");
var ts = require("typescript");
var _ = require("underscore");

var assertProps = require("./utils").assertProps;
var Logger = require("./logger").Logger;

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

function getRootedPath(filePath) {
  if (ts.getRootLength(filePath) === 0) {
    return "/" + filePath;
  }
  return filePath;
}

function prepareSourceMap(sourceMapContent, fileContent, sourceMapPath) {
  var sourceMapJson = JSON.parse(sourceMapContent);
  sourceMapJson.sourcesContent = [fileContent];
  sourceMapJson.sources = [sourceMapPath];
  return sourceMapJson;
}

/** 
 * Gets all local modules given sourceFile imports types from.
 * Supports transitivity, i.e., if some module (directly imported)
 * re-exports types from another module, this another module
 * will be in the output too.
 */
function getDeps(sourceFile, checker) {
  var modules = [];

  function getModulePath(module) {
    if (! module) return null;

    var decl = module.declarations[0];
    var sf = decl.getSourceFile();
    if (sf && ! sf.isDeclarationFile) {
      return sf.path;
    }
    return null;
  }

  if (sourceFile.imports) {
    var paths = new Set();
    _.each(sourceFile.imports, function(importName) {
      var module = checker.getSymbolAtLocation(importName);
      if (module) {
        var path = getModulePath(module);
        if (path) {
          paths.add(path);
        }
        var nodes = checker.getExportsOfModule(module);
        _.each(nodes, function(node) {
          if (node.parent && node.parent !== module) {
            var path = getModulePath(node.parent);
            if (path) {
              paths.add(path);
            }
            return;
          }

          // If directly imported module re-uses and exports of a type
          // from another module, add this module to the dependency as well.
          var type = checker.getTypeAtLocation(node.declarations[0]);
          if (type && type.symbol) {
            var typeModule = type.symbol.parent;
            if (typeModule !== module) {
              var path = getModulePath(typeModule);
              if (path) {
                paths.add(path);
              }
            }
          }
        });
      }
    });
    paths.forEach(function(path) {
      modules.push(path)
    });
  }

  return modules;
}

function getDepsAndRefs(sourceFile, typeChecker) {
  assert.ok(typeChecker);

  var modules = getDeps(sourceFile, typeChecker);
  var refs = getRefs(sourceFile);
  var mappings = getMappings(sourceFile);

  return {
    modules: modules,
    refFiles: refs.refFiles,
    refTypings: refs.refTypings,
    mappings: mappings
  };
}

function getMappings(sourceFile) {
  var mappings = {};
  if (sourceFile.resolvedModules) {
    for (var modulePath in sourceFile.resolvedModules) {
      var module = sourceFile.resolvedModules[modulePath];
      if (module) {
        mappings[modulePath] = {
          resolvedPath: ts.removeFileExtension(
            module.resolvedFileName),
          external: module.isExternalLibraryImport
        };
      }
    }
  }
  return mappings;
}

function getRefs(sourceFile) {
  // Get references paths.
  // /// <reference path=".." />
  var refTypings = [], refFiles = [];
  if (sourceFile.referencedFiles) {
    var refPaths = sourceFile.referencedFiles.map(function(ref) {
      return ref.fileName;
    });

    refTypings = _.filter(refPaths, function(ref) {
      return isTypings(ref);
    });

    refFiles = _.filter(refPaths, function(ref) {
      return ! isTypings(ref);
    });
  }

  // Get resolved paths to reference types.
  /// <reference types=".." />
  if (sourceFile.resolvedTypeReferenceDirectiveNames) {
    for (var lib in sourceFile.resolvedTypeReferenceDirectiveNames) {
      var ref = sourceFile.resolvedTypeReferenceDirectiveNames[lib];
      if (ref) {
        refTypings.push(ref.resolvedFileName);
      }
    }
  }

  return {
    refFiles: refFiles,
    refTypings: refTypings
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

function TsDiagnostics(diagnostics) {
  assert.ok(this instanceof TsDiagnostics);
  assert.ok(diagnostics);
  assertProps(diagnostics, [
    'syntacticErrors', 'semanticErrors'
  ]);

  _.extend(this, diagnostics);
}

var TDP = TsDiagnostics.prototype;

TDP.hasErrors = function() {
  return !! this.semanticErrors.length ||
    !! this.syntacticErrors.length;
}

TDP.hasUnresolvedModules = function() {
  var index = _.findIndex(this.semanticErrors, function(msg) {
    return msg.code === ts.Diagnostics.Cannot_find_module_0.code;
  });
  return index !== -1;
};

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
      code: diagnostic.code,
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

function getExcludeRegExp(exclude) {
  if (! exclude) return exclude;

  return ts.getRegularExpressionForWildcard(exclude, "", "exclude");
}

exports.ts = {
  TsDiagnostics: TsDiagnostics,
  normalizePath: normalizePath,
  prepareSourceMap: prepareSourceMap,
  getDepsAndRefs: getDepsAndRefs,
  getRefs: getRefs,
  createDiagnostics: createDiagnostics,
  hasErrors: hasErrors,
  flattenDiagnostics: flattenDiagnostics,
  isSourceMap: isSourceMap,
  isTypings: isTypings,
  getExcludeRegExp: getExcludeRegExp,
  getRootedPath: getRootedPath
};
