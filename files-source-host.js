import ts from "typescript";
import _ from "underscore";

const ROOTED = /^(\/|\\)/;

const filesMap = ts.createFileMap();

class SourceHost {
  setSource(fileSource) {
    this.fileSource = fileSource;
  }

  get(filePath) {
    if (this.fileSource) {
      const source = this.fileSource(filePath);
      if (_.isString(source)) return source;
    }

    if (filesMap.contains(filePath)) {
      return filesMap.get(filePath);
    }

    return null;
  }

  normalizePath(filePath) {
    if (!filePath) return null;

    const normPath = filePath.replace(ROOTED, '');
    if (!filesMap.contains(normPath)) {
      return normPath;
    }
    return filePath;
  }
}

module.exports = new SourceHost();
