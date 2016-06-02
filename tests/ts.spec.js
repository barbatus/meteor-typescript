var ts = require("typescript");
var fs = require("fs");
var _ = require("underscore");
var randomstring = require("randomstring");

var meteorTS = require("../index");
var TSBuild = require("../index").TSBuild;
var CompileCache = require("../cache").CompileCache;

describe("meteor-typescript -> ", function() {
  function getOptions(options) {
    if (! options) options = {};
    options.useCache = false;
    return options;
  }

  describe("testing exports and options -> ", function() {
    var testCodeLine = "export const foo = 'foo'";

    it("should compile with defaults", function() {
      var result = meteorTS.compile(testCodeLine, getOptions());
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
      var result = meteorTS.compile(testCodeLine, getOptions({
        compilerOptions: null,
        typings: undefined
      }));
      expect(result.code).not.toBeNull();
    });

    it("don't impose 'use strict' by default", function() {
      var result = meteorTS.compile(testCodeLine, getOptions());
      expect(result.code).not.toContain("use strict");
    });

    it("should recognize preset options", function() {
      var result = meteorTS.compile(testCodeLine, getOptions({
        compilerOptions: {
          module: "system"
        }
      }));
      expect(result.code).toContain("System.register");
    });

    it("should add module with moduleName name when moduleName is set", function() {
        var result = meteorTS.compile(testCodeLine, getOptions({
          compilerOptions: {
            module: "system"
          },
          moduleName: "fooModule"
        }));
        expect(result.code.indexOf("System.register(\"fooModule\""))
          .toEqual(0);
    });

    it("should throw on wrong compiler option", function() {
      var test = function() {
          meteorTS.compile(testCodeLine, getOptions({
            compilerOptions: {
              module: "wrong"
            }
          }));
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

    it("should have isExternal to be true if ES6 modules are used and " +
        "false in case of internal modules", function() {
      var result = meteorTS.compile(testCodeLine, getOptions());
      expect(result.isExternal).toEqual(true);

      var codeLine = "module foo { export var fooVar = \'fooVar\'}";
      var result = meteorTS.compile(codeLine, getOptions());
      expect(result.isExternal).toEqual(false);
    });

    it("should compile React if jsx set", function() {
      var reactCodeLine = "class Component { render() { return <div />; } }";
      var result = meteorTS.compile(reactCodeLine, getOptions({
        compilerOptions: {
          jsx: "react"
        },
        typings: ["typings/lib.d.ts"]
      }));

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });
  });

  describe("testing diagnostics and typings -> ", function() {
    var codeLineWithImport = "import {api} from 'lib'; export const foo = 'foo'";

    it("should contain a semantic error when some module undefined", function() {
      var result = meteorTS.compile(codeLineWithImport, getOptions());

      expect(result.diagnostics.semanticErrors).not.toBeNull();
      expect(result.diagnostics.semanticErrors.length).toEqual(1);
      var code = result.diagnostics.semanticErrors[0].code;
      expect(code).toEqual(ts.Diagnostics.Cannot_find_module_0.code);
      var error = result.diagnostics.semanticErrors[0].message;
      expect(error).toContain("Cannot find module 'lib'");
    });

    it("diagnostics re-evaluation works fine", function() {
      var result1 = meteorTS.compile(codeLineWithImport);

      var code1 = result1.diagnostics.semanticErrors[0].code;
      expect(code1).toEqual(ts.Diagnostics.Cannot_find_module_0.code);

      var result2 = meteorTS.compile(codeLineWithImport);

      var code2 = result2.diagnostics.semanticErrors[0].code;
      expect(code2).toEqual(ts.Diagnostics.Cannot_find_module_0.code);
    });

    it("declaration file with module declaration should remove an error", function() {
      var result = meteorTS.compile(codeLineWithImport, getOptions({
        typings: ["typings/lib.d.ts"]
      }));

      expect(result.diagnostics.semanticErrors).not.toBeNull();
      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("should always include lib.core.d.ts", function() {
      var codeLine = "new Object();";
      var result = meteorTS.compile(codeLine, getOptions({
        arch: "web.browser"
      }));

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("should not include lib.d.ts when target arch not web", function() {
      var codeLine = "new Plugin()";
      var result = meteorTS.compile(codeLine, getOptions({
        arch: "os"
      }));

      expect(result.diagnostics.semanticErrors.length).toEqual(1);
    });
  });

  describe("testing module resolution -> ", function() {
    var testCodeLine = "import {FakeApi} from 'lib/fake'";

    it("should resolve NodeJS-way by default", function() {
      var result = meteorTS.compile(testCodeLine, getOptions());

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });
  });

  describe("testing incremental build -> ", function() {
    var testCodeLine = "export const foo = 'foo'";

    it("should compile with defaults", function() {
      var build = new TSBuild(["foo.ts"], function(filePath) {
        if (filePath === "foo.ts") return testCodeLine;
      }, getOptions());
      var result = build.emit("foo.ts");
      expect(result.code).toContain("exports.foo");
    });

    it("meteor compiler options preset applied", function() {
      var build = new TSBuild(["foo.ts"], function(filePath) {
        if (filePath === "foo.ts") return testCodeLine;
      }, getOptions());

      expect(build.options.compilerOptions).toEqual(
        jasmine.objectContaining({
          watch: false,
          outDir: null,
          outFile: null
        }));
    });

    it("should access local dependency using provided content getter", function() {
      var importCodeLine = "import {foo} from './foo1'";

      var build = new TSBuild(["foo1.ts", "foo2.ts"], function(filePath) {
        if (filePath === "foo1.ts") return testCodeLine;
        if (filePath === "foo2.ts") return importCodeLine;
      }, getOptions());

      var result = build.emit("foo2.ts");

      expect(result.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("file version should grow when file is changed", function() {
      var changedCode = "export const foo = 'foo1'";

      var build1 = new TSBuild(["foo3.ts"], function(filePath) {
        if (filePath === "foo3.ts") return testCodeLine;
      }, getOptions());

      var result1 = build1.emit("foo3.ts");

      var build2 = new TSBuild(["foo3.ts"], function(filePath) {
        if (filePath === "foo3.ts") return changedCode;
      }, getOptions());

      var result2 = build2.emit("foo3.ts");

      expect(result1.version).toEqual("1");
      expect(result2.version).toEqual("2");
    });

    it("file version should remain the same if file is not changed", function() {
      var build = new TSBuild(["foo4.ts"], function(filePath) {
        if (filePath === "foo4.ts") return testCodeLine;
      });
      var result1 = build.emit("foo4.ts");
      var result2 = build.emit("foo4.ts");

      expect(result1.version).toEqual(result2.version);
    });

    it("should update diagnostics when file's module dependency has changed", function() {
      var importCodeLine = "import {foo} from './foo5'";

      var build1 = new TSBuild(["foo5.ts", "foo6.ts"], function(filePath) {
        if (filePath === "foo5.ts") return testCodeLine;
        if (filePath === "foo6.ts") return importCodeLine;
      });

      var result1 = build1.emit("foo6.ts");

      expect(result1.diagnostics.semanticErrors.length).toEqual(0);
      expect(result1.references.modules).toEqual(['foo5.ts']);

      var changedCode = "export const foo1 = 'foo'";
      var build2 = new TSBuild(["foo5.ts", "foo6.ts"], function(filePath) {
        if (filePath === "foo5.ts") return changedCode;
        if (filePath === "foo6.ts") return importCodeLine;
      });

      var result2 = build2.emit("foo6.ts");

      expect(result2.diagnostics.semanticErrors.length).toEqual(1);
    });

    it("should update diagnostics when typings has changed", function() {
      var foo7 = "declare module 'foo7' { export var foo = 'foo' }";
      var foo8 = "import {foo} from 'foo7'";

      var build1 = new TSBuild(["foo8.ts", "foo7.d.ts"], function(filePath) {
        if (filePath === "foo7.d.ts") return foo7;
        if (filePath === "foo8.ts") return foo8;
      });

      var result1 = build1.emit("foo8.ts");

      expect(result1.diagnostics.semanticErrors.length).toEqual(0);

      var newTypigns = "declare module 'foo7' { export var foo1 = 'foo' }";
      var build2 = new TSBuild(["foo7.d.ts", "foo8.ts"], function(filePath) {
        if (filePath === "foo7.d.ts") return newTypigns;
        if (filePath === "foo8.ts") return foo8;
      });

      var result2 = build2.emit("foo8.ts");

      expect(result2.diagnostics.semanticErrors.length).toEqual(1);
    });

    it("should update diagnostics when file's references has changed", function() {
      var foo9 = "module foo9 { export var foo = 'foo' }";
      var foo10 = "/// <reference path='foo9.ts' /> \n " +
                  "module foo10 { export var foo = foo9.foo }";

      var build1 = new TSBuild(["foo9.ts", "foo10.ts"], function(filePath) {
        if (filePath === "foo9.ts") return foo9;
        if (filePath === "foo10.ts") return foo10;
      });

      var result1 = build1.emit("foo10.ts");

      expect(result1.diagnostics.semanticErrors.length).toEqual(0);

      var changed = "module foo9 { export var foo1 = 'foo' }";
      var build2 = new TSBuild(["foo9.ts", "foo10.ts"], function(filePath) {
        if (filePath === "foo9.ts") return changed;
        if (filePath === "foo10.ts") return foo10;
      });

      var result2 = build2.emit("foo10.ts");

      expect(result2.diagnostics.semanticErrors.length).toEqual(1);
      expect(result2.diagnostics.semanticErrors[0].message).toContain("'foo' does not exist");
    });

    it("should handle ambient typings properly", function() {
      var foo11 = "declare module Foo { interface Test {}};";
      var foo12 = "var test: Foo.Test";

      var build1 = new TSBuild(["foo11.d.ts", "foo12.ts"], function(filePath) {
        if (filePath === "foo11.d.ts") return foo11;
        if (filePath === "foo12.ts") return foo12;
      });

      var result1 = build1.emit("foo12.ts");

      expect(result1.diagnostics.semanticErrors.length).toEqual(0);
    });

    it("should take result from cache for once compiled code", function() {
      var build1 = new TSBuild(["foo13.ts"], function(filePath) {
        if (filePath === "foo13.ts") return testCodeLine;
      });
      var result1 = build1.emit("foo13.ts");

      var changedCode = "export const foo1 = 'foo'";
      var build2 = new TSBuild(["foo13.ts"], function(filePath) {
        if (filePath === "foo13.ts") return changedCode;
      });
      var result2 = build2.emit("foo13.ts");

      var build3 = new TSBuild(["foo13.ts"], function(filePath) {
        if (filePath === "foo13.ts") return testCodeLine;
      });
      var result3 = build3.emit("foo13.ts");

      expect(result3).toEqual(result1);
    });

    it("should re-compile for a new module name", function() {
      var options = {
        compilerOptions: {
          module: "system"
        }
      };
      var build1 = new TSBuild(["foo14.ts"], function(filePath) {
        if (filePath === "foo14.ts") return testCodeLine;
      }, options);
      var result1 = build1.emit("foo14.ts", "foo");

      expect(result1.code).toContain("System.register(\"foo");

      var result2 = build1.emit("foo14.ts", "foo1");

      expect(result2.code).toContain("System.register(\"foo1");
    });

    it("should compile empty content", function() {
      var build = new TSBuild(["foo15.ts"], function(filePath) {
        if (filePath === "foo15.ts") return '';
      });
      var result = build.emit("foo15.ts", "foo");
    });

    it("should throw on emitting non-existed file", function() {
      var build = new TSBuild();
      var foo16 = function() {
        build.emit("foo16.ts", "foo");
      };

      expect(foo16).toThrow();
    });

    it("should evaluate script changes properly", function() {
      var content1 = fs.readFileSync("./file1.ts", 'utf8');
      var content2 = fs.readFileSync("./file2.ts", 'utf8');

      var build1 = new TSBuild(["foo17.ts"], function(filePath) {
        if (filePath === "foo17.ts") return content1;
      });
      var result1 = build1.emit("foo17.ts");

      var build2 = new TSBuild(["foo17.ts"], function(filePath) {
        if (filePath === "foo17.ts") return content2;
      });
      var result2 = build2.emit("foo17.ts");

      expect(result2.code).toContain("newlog");
      expect(result2.code).toContain("te_");
    });
  });

  describe("cache profiling -> ", function() {
    var files = {};
    _.times(10, function() {
      var name = randomstring.generate(10);
      files[name] = {
        content: randomstring.generate(1024 * 1024)
      };
    });

    var cache = new CompileCache(null, {
      get: function(filePath) {
        return files[filePath];
      }
    });

    var filePaths = _.keys(files);
    _.each(filePaths, function(filePath) {
      cache.save(filePath, {}, files[filePath]);
    });

    var elapsed = 0;
    _.each(filePaths, function(filePath) {
      var start = Date.now();
      var result = cache.get(filePath, {}, function() {
        return null;
      });
      var elapsed = Date.now() - start;
      expect(elapsed <= 10).toEqual(true);
      expect(result).toEqual(files[filePath]);
    });
  });
});
