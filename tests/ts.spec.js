var meteorTS = require("../index");

describe("meteor-typescript", function() {

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

  it("should recognize preset options", function() {
    var result = meteorTS.compile(testCodeLine, {
      compilerOptions: {
        module: "system"
      }
    });
    expect(result.code.indexOf("System.register")).toEqual(0);
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
