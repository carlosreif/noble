/*jshint loopfunc: true */
var debug = require('debug')('version-info');

function VersionInfo(raw, version, subversion, manufacturer_name) {
  this.version = version;
  this.subversion = subversion;
  this.manufacturer_name = manufacturer_name;
  this.raw = raw;
}


VersionInfo.prototype.toString = function() {
  return JSON.stringify({
    version: this.version,
    subversion: this.subversion,
    manufacturer_name: this.manufacturer_name,
    raw: this.raw
  });
};

module.exports = VersionInfo;
