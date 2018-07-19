/*jshint loopfunc: true */
var debug = require('debug')('peripheral');

var events = require('events');
var util = require('util');

function Peripheral(noble, id, address, addressType, connectable, advertisement, rssi) {
  this._noble = noble;

  this.id = id;
  this.uuid = id; // for legacy
  this.address = address;
  this.addressType = addressType;
  this.connectable = connectable;
  this.advertisement = advertisement;
  this.rssi = rssi;
  this.services = null;
  this.state = 'disconnected';
  this.leFeatures = null;
  this.versionInfo = null;
  this.pairing = null;
  this.pairingResponse = null;

  this.readRemoteVersionInformationTimeoutId = null;
  this.leReadRemoteFeaturesTimeoutId = null;
  this.pairingTimeoutId = null;
  this.connectionTimeoutId = null;

}

util.inherits(Peripheral, events.EventEmitter);

Peripheral.prototype.toString = function() {

  return JSON.stringify({
    id: this.id,
    address: this.address,
    addressType: this.addressType,
    connectable: this.connectable,
    advertisement: this.advertisement,
    rssi: this.rssi,
    state: this.state,
    leFeatures: this.leFeatures?this.leFeatures.toString():undefined,
    versionInfo: this.versionInfo,
    pairing: this.pairing,
    pairingResponse: this.pairingResponse
  }, this.replacer);
};

Peripheral.prototype.replacer = function (key, value)  {
  if (value === null) {
    return undefined;
  }
  return value;
}

Peripheral.prototype.toStringExtra = function() {
  return JSON.stringify({
    name: this.advertisement == null ? undefined : this.advertisement.localName,
    address: this.address,
    leFeatures: this.leFeatures.toString(),
    versionInfo: this.versionInfo,
    pairing: this.pairing,
    pairingResponse: this.pairingResponse == null ? null : this.pairingResponse.toString("hex")
  }, this.replacer);
}

Peripheral.prototype.toStringSimple = function() {
  return JSON.stringify({
    name: this.advertisement == null ? undefined : this.advertisement.localName,
    address: this.address,
    state: this.state,
  }, this.replacer);
}

Peripheral.prototype.toStringAddr = function() {
  return JSON.stringify({
    name: this.advertisement == null ? undefined : this.advertisement.localName,
    address: this.address,
  }, this.replacer);
}

Peripheral.prototype.connect = function(callback, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData) {
  debug('connect ', this.address);
  if (callback) {
    this.once('connect', function(error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData) {
      callback(error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData);
    });
  }

  if (this.state === 'connected') {
    this.emit('connect', new Error('Peripheral already connected'));
  } else {
    this.state = 'connecting';
    this._noble.connect(this.id);
  }
};

Peripheral.prototype.connectWithTimeout = function(callback, timeout_connection=10000) {
  debug('connectWithTimeout ', this.address);
  if (callback) {
    this.once('connect', function(error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData) {
      clearTimeout(this.connectionTimeoutId);
      debug("connectWithTimeout connect " + this.toStringAddr());
      callback(error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData);
    });

    function myTimeOut() {
      debug("connectWithTimeout myTimeout " + this.toStringAddr());
      this.removeAllListeners('connect')
      this._noble._bindings._nextOnConnectionQueue();
      this.state = 'disconnected';
      callback("Timeout");
    }
    this.connectionTimeoutId = setTimeout(myTimeOut.bind(this), timeout_connection)
  }

  if (this.state === 'connected') {
    this.emit('connect', new Error('Peripheral already connected'));
  } else {
    this.state = 'connecting';
    this._noble.connect(this.id);
  }
};


Peripheral.prototype.readRemoteVersionInformation = function(callback) {
  debug("readRemoteVersionInformation ", this.toStringAddr());
  if (callback) {
    this.once('discoverRemoteVersionInfo', function(versionInfo) {
      debug("readRemoteVersionInformation discoverRemoteVersionInfo: ", this.toStringAddr());
      clearTimeout(this.readRemoteVersionInformationTimeoutId);
      callback(this, versionInfo);
    });

    function myTimeOut() {
      debug("readRemoteVersionInformation myTimeout " + this.toStringAddr());
      this.removeAllListeners('discoverRemoteVersionInfo');
      callback(this, "Timeout");
    }
    this.readRemoteVersionInformationTimeoutId = setTimeout(myTimeOut.bind(this), 5000);
  }

  this._noble.readRemoteVersionInformation(this.id);
};

Peripheral.prototype.leReadRemoteFeatures = function(callback) {
  debug("leReadRemoteFeatures", this.toStringAddr());
  if (callback) {
    this.once('discoverFeatures', function(leFeatures) {
      debug("leReadRemoteFeatures discoverFeatures: " + this.toStringAddr());
      clearTimeout(this.leReadRemoteFeaturesTimeoutId);
      callback(this, leFeatures);
    });

    function myTimeOut() {
      debug("leReadRemoteFeatures myTimeout " + this.toStringAddr());
      this.removeAllListeners('discoverFeatures');
      callback(this, "Timeout");
    }
    this.leReadRemoteFeaturesTimeoutId = setTimeout(myTimeOut.bind(this), 5000);
  }

  this._noble.leReadRemoteFeatures(this.id);
};

Peripheral.prototype._clearTimeouts = function(callback) {
  clearTimeout(this.connectionTimeoutId);
  clearTimeout(this.pairingTimeoutId);
  clearTimeout(this.leReadRemoteFeaturesTimeoutId);
  clearTimeout(this.readRemoteVersionInformationTimeoutId);
}

Peripheral.prototype._clearListeners = function(callback) {
  this.removeAllListeners('discoverRemoteVersionInfo');
  this.removeAllListeners('discoverFeatures');
  this.removeAllListeners('connect');
  this.removeAllListeners('pairResult');
  this.removeAllListeners('ltkEdiv');
}

Peripheral.prototype.disconnect = function(callback) {
  debug('disconnect')
  this._clearTimeouts();
  if (callback) {
    this.once('disconnect', function() {
      callback(null);
    });
  }
  this.state = 'disconnecting';
  this._noble.disconnect(this.id);
};

Peripheral.prototype.disconnectWithTimeout = function (callback, timeout = 10000) {
  debug('disconnectWithTimeout ', this.address);
  this._clearTimeouts();
  if (callback) {
    this.once('disconnect', function () {
      clearTimeout(this.disconnectionTimeoutId);
      debug("disconnectWithTimeout disconnect " + this.toStringAddr());
      callback(null);
    });

    function myTimeOut() {
      // Timeout on disconnecting occured
      // TODO: manually disconnect - need to fix connection objects
      debug("disconnectWithTimeout myTimeout " + this.toStringAddr());
      this.removeAllListeners('disconnect')
      this.state = 'disconnected';
      callback("Timeout");
    }
    this.disconnectionTimeoutId = setTimeout(myTimeOut.bind(this), timeout)
  }

  this.state = 'disconnecting';
  this._noble.disconnect(this.id);
};

Peripheral.prototype.pair = function (buffSmpReq, passkeyOpt, passkeyVal, callbackFn, pairingTimeout) {
  debug('pair ', this.toStringAddr(),
    JSON.stringify(
      { buffSmpReq: buffSmpReq,
        passkeyOpt: passkeyOpt,
        passkeyVal: passkeyVal,
        callbackFn: callbackFn,
        pairingTimeout: pairingTimeout
      }));
  var pairComplete = false
  var pairResponse = false
  var authType = null
  var assocModel = null
  var tempLtk = null
  if (callbackFn) {
    this.once('pairResult', function (error, retAuthType, retAssocModel) {
      clearTimeout(this.pairingTimeoutId);
      debug("pair pairResult " + this.toStringAddr());
      pairResponse = true
      authType = retAuthType
      assocModel = retAssocModel
      debug('pair ', JSON.stringify({error:error}));
      if (error != null) {
        debug("pair pairComplete" + this.toStringAddr());
        pairComplete = true
      }
      callbackFn(error, authType, assocModel)
      return
    }.bind(this));

    this.once('ltkEdiv', function (ediv, rand, ltk) {
      debug("pair ltkEdiv " + this.toStringAddr());
      pairComplete = true
      tempLtk = ltk
      callbackFn(null, authType, assocModel, ediv, rand, ltk)
    });

    // Handle the case where peripheral doesn't respond to pairing request or doesn't send LTK.
    function myTimeOut() {
      debug("pair myTimeout " + this.toStringAddr());
      this.removeAllListeners('pairResult')
      this.removeAllListeners('ltkEdiv')
      if (pairComplete === false) {
        if (pairResponse === false) {
          debug('Executing callback with timeout.')
          callbackFn('Timeout', authType, assocModel)
        } else if (tempLtk == null) {
          if (this.state === 'disconnected') {
            debug('Executing callback with disconnect.')
            callbackFn('Disconnected', authType, assocModel)
          } else {
            debug('Executing callback with NoLtk. ' + authType + ' ' + assocModel)
            callbackFn(null, authType, assocModel, 'NoLtk')
          }
        } else {
          debug('Executing callback with Unknown.')
          callbackFn('Unknown',authType, assocModel)
        }
      }
      else {
        debug("Timed out but pairing is already completed. Ignoring..." + this.toStringAddr())
      }
    }
    this.pairingTimeoutId = setTimeout(myTimeOut.bind(this), pairingTimeout)
  }

  if (this.state === 'paired') {
    debug("pair already paired " + this.toStringAddr());
    pairComplete = true
    this.emit('pairResult', new Error('Peripheral already paired'))
  } else {
    debug("pair pairing " + this.toStringAddr());
    this.state = 'pairing'
    this._noble.pair(this.id, buffSmpReq, passkeyOpt, passkeyVal)
  }
}

Peripheral.prototype.stopPair = function (buffSmpReq, callback) {
  debug("stopPair " + this.toStringAddr());
  clearTimeout(this.pairingTimeoutId);
  this.removeAllListeners('pairResult')
}
Peripheral.prototype.updateRssi = function(callback) {
  if (callback) {
    this.once('rssiUpdate', function(rssi) {
      callback(null, rssi);
    });
  }

  this._noble.updateRssi(this.id);
};

Peripheral.prototype.discoverServices = function(uuids, callback) {
  if (callback) {
    this.once('servicesDiscover', function(services) {
      callback(null, services);
    });
  }

  this._noble.discoverServices(this.id, uuids);
};

Peripheral.prototype.discoverSomeServicesAndCharacteristics = function(serviceUuids, characteristicsUuids, callback) {
  this.discoverServices(serviceUuids, function(err, services) {
    var numDiscovered = 0;
    var allCharacteristics = [];

    for (var i in services) {
      var service = services[i];

      service.discoverCharacteristics(characteristicsUuids, function(error, characteristics) {
        numDiscovered++;

        if (error === null) {
          for (var j in characteristics) {
            var characteristic = characteristics[j];

            allCharacteristics.push(characteristic);
          }
        }

        if (numDiscovered === services.length) {
          if (callback) {
            callback(null, services, allCharacteristics);
          }
        }
      }.bind(this));
    }
  }.bind(this));
};

Peripheral.prototype.discoverAllServicesAndCharacteristics = function(callback) {
  this.discoverSomeServicesAndCharacteristics([], [], callback);
};

Peripheral.prototype.readHandle = function(handle, callback) {
  if (callback) {
    this.once('handleRead' + handle, function(data) {
      callback(null, data);
    });
  }

  this._noble.readHandle(this.id, handle);
};

Peripheral.prototype.writeHandle = function(handle, data, withoutResponse, callback) {
  if (!(data instanceof Buffer)) {
    throw new Error('data must be a Buffer');
  }

  if (callback) {
    this.once('handleWrite' + handle, function() {
      callback(null);
    });
  }

  this._noble.writeHandle(this.id, handle, data, withoutResponse);
};

module.exports = Peripheral;
