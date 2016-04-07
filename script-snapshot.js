var ts = require("typescript");
var jsdiff = require('diff');
var Logger = require("./logger").Logger;

function StringScriptSnapshot(text) {
  this.text = text;
}

exports.ScriptSnapshot = StringScriptSnapshot;

StringScriptSnapshot.prototype.getText = function(start, end) {
  return this.text.substring(start, end);
};

StringScriptSnapshot.prototype.getLength = function() {
  return this.text.length;
};

StringScriptSnapshot.prototype.getChangeRange = function(oldSnapshot) {
  if (! oldSnapshot) return undefined;

  var diffs = jsdiff.diffChars(oldSnapshot.text, this.text);
  if (diffs.length) {
    var ind = 0;
    var changes = [];
    for (var i = 0; i < diffs.length; i++) {
      var diff = diffs[i];
      if (diff.added) {
        changes.push(ts.createTextChangeRange(
          ts.createTextSpan(ind, 0), diff.count));
        ind += diff.count;
        continue;
      }

      if (diff.removed) {
        changes.push(ts.createTextChangeRange(
          ts.createTextSpan(ind, diff.count), 0));
        continue;
      }

      ind += diff.count;
    }

    changes = ts.collapseTextChangeRangesAcrossMultipleVersions(changes);
    Logger.assert("accumulated file changes %j", changes);

    return changes;
  }

  return ts.createTextChangeRange(ts.createTextSpan(0, 0), 0);
};
