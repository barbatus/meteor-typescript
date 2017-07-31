import assert from "assert";
import ts from "typescript";
import _ from "underscore";

import { Logger } from "./logger";
import { sourceHost } from "./files-source-host";
import { ts as tsu } from "./ts-utils";
import { assertProps } from "./utils";

export default class CompileService {
  constructor(serviceHost) {
    this.serviceHost = serviceHost;
    this.service = ts.createLanguageService(serviceHost);
  }

  compile(filePath, moduleName) {
    const sourceFile = this.getSourceFile(filePath);
    assert.ok(sourceFile);

    if (moduleName) {
      sourceFile.moduleName = moduleName;
    }

    const result = this.service.getEmitOutput(filePath);

    let code, sourceMap;
    _.each(result.outputFiles, function(file) {
      if (tsu.normalizePath(filePath) !==
            tsu.normalizePath(file.name)) return;

      const text = file.text;
      if (tsu.isSourceMap(file.name)) {
        const source = sourceHost.get(filePath);
        sourceMap = tsu.prepareSourceMap(text, source, filePath);
      } else {
        code = text;
      }
    }, this);

    const checker = this.getTypeChecker();
    const pcs = Logger.newProfiler("process csresult");
    const deps = tsu.getDepsAndRefs(sourceFile, checker);
    const meteorizedCode = this.rootifyPaths(code, deps.mappings); 
    const csResult = createCSResult({
      code: meteorizedCode,
      sourceMap,
      version: this.serviceHost.getScriptVersion(filePath),
      isExternal: ts.isExternalModule(sourceFile),
      dependencies: deps,
      diagnostics: this.getDiagnostics(filePath)
    });
    pcs.end();

    return csResult;
  }

  getHost() {
    return this.serviceHost;
  }

  getDocRegistry() {
    return this.registry;
  }

  getSourceFile(filePath) {
    const program = this.service.getProgram();
    return program.getSourceFile(filePath);
  }

  getDepsAndRefs(filePath) {
    const checker = this.getTypeChecker();
    return tsu.getDepsAndRefs(this.getSourceFile(filePath), checker);
  }

  getRefTypings(filePath) {
    const refs = tsu.getRefs(this.getSourceFile(filePath));
    return refs.refTypings;
  }

  getTypeChecker() {
    return this.service.getProgram().getTypeChecker();
  }

  getDiagnostics(filePath) {
    return tsu.createDiagnostics(
      this.service.getSyntacticDiagnostics(filePath),
      this.service.getSemanticDiagnostics(filePath)
    );
  }

  rootifyPaths(code, mappings) {
    function buildPathRegExp(modulePath) {
      const regExp = new RegExp("(require\\(\"|\')(" + modulePath + ")(\"|\'\\))", "g");
      return regExp;
    }

    mappings = mappings.filter(module => module.resolved && !module.external);
    Logger.assert("process mappings %s", mappings.map((module) => module.resolvedPath));
    for (const module of mappings) {
      const usedPath = module.modulePath;
      const resolvedPath = module.resolvedPath;

      // Fix some weird v2.1.x bug where
      // LanguageService converts dotted paths
      // to relative in the code.
      const regExp = buildPathRegExp(resolvedPath);
      code = code.replace(regExp, function(match, p1, p2, p3, offset) {
        return p1 + tsu.getRootedPath(resolvedPath) + p3;
      });

      // Skip path replacement for dotted paths.
      if (! usedPath.startsWith(".")) {
        const regExp = buildPathRegExp(usedPath);
        code = code.replace(regExp, function(match, p1, p2, p3, offset) {
          return p1 + tsu.getRootedPath(resolvedPath) + p3;
        });
      }
    }
    return code;
  }
}

export function createCSResult(result) {
  assertProps(result, [
    "code", "sourceMap", "version",
    "isExternal", "dependencies", "diagnostics"
  ]);
  result.diagnostics = new tsu.TsDiagnostics(
    result.diagnostics);

  return new CSResult(result);
}

export class CSResult {
  constructor(result) {
    assert.ok(this instanceof CSResult);

    _.extend(this, result);
  }

  upDiagnostics(diagnostics) {
    this.diagnostics = new tsu.TsDiagnostics(diagnostics);
  }
}
