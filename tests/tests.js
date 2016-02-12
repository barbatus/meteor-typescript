var meteorTS = require("../index");
var assert = require("assert");

// Some dummy test.
var result = meteorTS.compile("export const foo = 600;");
assert.equal(result.code.indexOf("exports.foo = 600;"), 0);

var converted = meteorTS.convertOptionsOrThrow({
  compilerOptions: {
    module: 'system'
  }
});
