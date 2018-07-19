var debug = require('debug')('pairing-response');


function AuthReq(ar) {
  this.BondingFlags = null;
  this.MIMT = null;
  this.SC = null;
  this.Keypress = null;
  this.CT2 = null;
  if (typeof ar !== 'undefined') {
    this.parse(ar);
  }
}

AuthReq.prototype.parse = function (authReq) {
  this.BondingFlags = (authReq >> 0) & 3;
  this.MIMT = (authReq >> 2) & 1;
  this.SC = (authReq >> 3) & 1;
  this.Keypress = (authReq >> 4) & 1;
  this.CT2 = (authReq >> 5) & 1;
}

AuthReq.prototype.toString = function () {
  console.log(JSON.stringify({
    BondingFlags: this.BondingFlags,
    MIMT: this.MIMT,
    SC: this.SC,
    Keypress: this.Keypress,
    CT2: this.CT2
  }));

  return JSON.stringify({
    BondingFlags: this.BondingFlags,
    MIMT: this.MIMT,
    SC: this.SC,
    Keypress: this.Keypress,
    CT2: this.CT2
  });

}

function PairingResponse(response) {
  debug('PairingResponse: ', response.toString('hex'));
  this.raw = response;
  this.IoCapability = null;
  this.OobDataFlag = null;
  this.AuthReq = null;
  this.MaximumEncryptionKeySize = null;
  this.InitiatorKeyDistribution = null
  this.ResponderKeyDistribution = null;
  if (typeof response !== 'undefined') {
    this.parse(response);
  }
}

PairingResponse.prototype.parse = function (response) {
  this.IoCapability = response.readUInt8(1);
  this.OobDataFlag = response.readUInt8(2);
  var authReq = response.readUInt8(3);
  this.AuthReq = new AuthReq(authReq);
  this.MaximumEncryptionKeySize = response.readUInt8(4);
  this.InitiatorKeyDistribution = response.readUInt8(5);
  this.ResponderKeyDistribution = response.readUInt8(6);
}

PairingResponse.prototype.toString = function () {
  return JSON.stringify({
    IoCapability: this.IoCapability,
    OobDataFlag: this.OobDataFlag,
    AuthReq: this.AuthReq,
    MaximumEncryptionKeySize: this.MaximumEncryptionKeySize,
    InitiatorKeyDistribution: this.InitiatorKeyDistribution,
    ResponderKeyDistribution: this.ResponderKeyDistribution
  });
};

module.exports = PairingResponse;
