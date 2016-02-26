var meteorTS = require("../index");

describe("meteor-typescript -> ", function() {

  describe("testing exports and options -> ", function() {
    var testCodeLine = "export const foo = 'foo'";

    it("should compile with defaults", function() {
      var result = meteorTS.compile(testCodeLine);
      expect(result.code).toContain("exports.foo");
    });

    it("should throw on wrong option", function() {
      var test = function() {
        meteorTS.compile(testCodeLine, {
          "wrong": true
        });
      };
      expect(test).toThrow();
    });

    it("should allow null options", function() {
      var result = meteorTS.compile(testCodeLine, {
        compilerOptions: null,
        typings: undefined
      });
      expect(result.code).not.toBeNull();
    });

    it("should recognize preset options", function() {
      var result = meteorTS.compile(testCodeLine, {
        compilerOptions: {
          module: "system"
        }
      });
      expect(result.code).toContain("System.register");
    });

    it("should add module with moduleName name when moduleName is set",
      function() {
        var result = meteorTS.compile(testCodeLine, {
          compilerOptions: {
            module: "system"
          },
          moduleName: "fooModule"
        });
        expect(result.code.indexOf("System.register(\"fooModule\""))
          .toEqual(0);
      });

    it("should throw on wrong compiler option", function() {
      var test = function() {
          meteorTS.compile(testCodeLine, {
            compilerOptions: {
            module: "wrong"
          }
        });
      };
      expect(test).toThrow();
    });

    it("should validate options", function() {
      var test = function() {
        meteorTS.validateAndConvertOptions({
          wrong: true
        });
      };

      expect(test).toThrow(new Error("Unknown option: wrong.\n" +
        "Valid options are compilerOptions, filePath, moduleName, and typings."));
    });
  });

  describe("testing diagnostics and typings -> ", function() {
    var codeLineWithImport = "import {api} from 'lib'; export const foo = 'foo'";

    it("should contain a semantic error when some module undefined", function() {
      var result = meteorTS.compile(codeLineWithImport);

      expect(result.diagnostics.semanticErrors).not.toBeNull();
      expect(result.diagnostics.semanticErrors.length).toEqual(1);
      var error = result.diagnostics.semanticErrors[0].message;
      expect(error).toContain("Cannot find module 'lib'");
    });

    it("declaration file with module declaration should remove an error", function() {
      var result = meteorTS.compile(codeLineWithImport, {
        typings: ["typings/lib.d.ts"]
      });

      expect(result.diagnostics.semanticErrors).not.toBeNull();
      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("should always include lib.core.d.ts", function() {
      var codeLine = "new Object()";
      var result = meteorTS.compile(codeLine);

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("should not include lib.dom.d.ts when target arch not web", function() {
      var codeLine = "new Window()";
      var result = meteorTS.compile(codeLine, {
        arch: "os"
      });

      expect(result.diagnostics.semanticErrors.length).toEqual(1);
    });
  });

  describe("testing module resolution -> ", function() {
    var testCodeLine = "import {FakeApi} from 'lib/fake'";

    it("should resolve NodeJS-way by default", function() {
      var result = meteorTS.compile(testCodeLine);

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });
  });

  describe("testing file content getter -> ", function() {
    var testCodeLine = "export const foo = 'foo'";

    it("should get file content using getter if provided", function() {
      var getContent = function(filePath) {
        return filePath === "foo.ts" ? testCodeLine : null;
      };
      var result = meteorTS.compile(getContent, {
        filePath: "foo.ts"
      });

      expect(result.code).toContain("exports.foo");
    });

    it("should have compiled files cache", function() {
      meteorTS.compile(testCodeLine, {
        filePath: "foo1.ts"
      });
      // foo1.ts is empty, it should pick up already
      // compiled one from internal cache.
      var importCodeLine = "import {foo} from './foo1'";
      var result = meteorTS.compile(importCodeLine);

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });
  });
});
