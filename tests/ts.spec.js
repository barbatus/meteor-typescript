var meteorTS = require("../index");

describe("meteor-typescript -> ", function() {

  describe("testing exports and options -> ", function() {
    var testCodeLine = "export const foo = 'foo'";

    it("should compile with defaults", function() {
      var result = meteorTS.compile(testCodeLine);
      expect(result.code.indexOf("exports.foo")).toEqual(0);
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
  });

});
