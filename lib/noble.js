var debug = require('debug')('noble');

var events = require('events');
var util = require('util');

var Peripheral = require('./peripheral');
var Service = require('./service');
const VersionInfo = require('./version-info');
const LeFeatures = require('./le-features');
var Characteristic = require('./characteristic');
var Descriptor = require('./descriptor');

function Noble(bindings) {
  debug("Noble");
  this.initialized = false;

  this.address = 'unknown';
  this._state = 'unknown';
  this._bindings = bindings;
  this._peripherals = {};
  this._services = {};
  this._characteristics = {};
  this._descriptors = {};
  this._discoveredPeripheralUUids = [];

  this._bindings.on('stateChange', this.onStateChange.bind(this));
  this._bindings.on('addressChange', this.onAddressChange.bind(this));
  this._bindings.on('scanStart', this.onScanStart.bind(this));
  this._bindings.on('scanStop', this.onScanStop.bind(this));
  this._bindings.on('discover', this.onDiscover.bind(this));
  this._bindings.on('connect', this.onConnect.bind(this));
  this._bindings.on('disconnect', this.onDisconnect.bind(this));
  this._bindings.on('discoverFeatures', this.onDiscoverFeatures.bind(this));
  this._bindings.on('discoverRemoteVersionInfo', this.onDiscoverRemoteVersionInfo.bind(this));
  this._bindings.on('pair', this.onPair.bind(this))
  this._bindings.on('pairingResponse', this.onPairingResponse.bind(this))
  this._bindings.on('edivRand', this.onEdiv.bind(this))
  this._bindings.on('rssiUpdate', this.onRssiUpdate.bind(this));
  this._bindings.on('servicesDiscover', this.onServicesDiscover.bind(this));
  this._bindings.on('includedServicesDiscover', this.onIncludedServicesDiscover.bind(this));
  this._bindings.on('characteristicsDiscover', this.onCharacteristicsDiscover.bind(this));
  this._bindings.on('read', this.onRead.bind(this));
  this._bindings.on('write', this.onWrite.bind(this));
  this._bindings.on('broadcast', this.onBroadcast.bind(this));
  this._bindings.on('notify', this.onNotify.bind(this));
  this._bindings.on('descriptorsDiscover', this.onDescriptorsDiscover.bind(this));
  this._bindings.on('valueRead', this.onValueRead.bind(this));
  this._bindings.on('valueWrite', this.onValueWrite.bind(this));
  this._bindings.on('handleRead', this.onHandleRead.bind(this));
  this._bindings.on('handleWrite', this.onHandleWrite.bind(this));
  this._bindings.on('handleNotify', this.onHandleNotify.bind(this));

  this.on('warning', function(message) {
    if (this.listeners('warning').length === 1) {
      console.warn('noble: ' + message);
    }
  }.bind(this));

  //lazy init bindings on first new listener, should be on stateChange
  this.on('newListener', function(event) {
    if (event === 'stateChange' && !this.initialized) {
      this.initialized = true;

      process.nextTick(function() {
        this._bindings.init();
      }.bind(this));
    }
  }.bind(this));

  //or lazy init bindings if someone attempts to get state first
  Object.defineProperties(this, {
    state: {
      get: function () {
        if (!this.initialized) {
          this.initialized = true;

          this._bindings.init();
        }
        return this._state;
      }
    }
  });

}

util.inherits(Noble, events.EventEmitter);

Noble.prototype.onStateChange = function(state) {
  debug('stateChange ' + state);

  this._state = state;

  this.emit('stateChange', state);
};

Noble.prototype.onAddressChange = function(address) {
  debug('addressChange ' + address);

  this.address = address;
};

Noble.prototype.startScanning = function(serviceUuids, allowDuplicates, callback) {
  debug("startScanning");
  var scan = function(state) {
    if (state !== 'poweredOn') {
      var error = new Error('Could not start scanning, state is ' + state + ' (not poweredOn)');

      if (typeof callback === 'function') {
        callback(error);
      } else {
        throw error;
      }
    } else {
      if (callback) {
        this.once('scanStart', function(filterDuplicates) {
          callback(null, filterDuplicates);
        });
      }

      this._discoveredPeripheralUUids = [];
      this._allowDuplicates = allowDuplicates;

      this._bindings.startScanning(serviceUuids, allowDuplicates);
    }
  };

  //if bindings still not init, do it now
  if (!this.initialized) {
    this.initialized = true;

    this._bindings.init();

    this.once('stateChange', scan.bind(this));
  }else{
    scan.call(this, this._state);
  }
};

Noble.prototype.onScanStart = function(filterDuplicates) {
  debug('scanStart');
  this.emit('scanStart', filterDuplicates);
};

Noble.prototype.stopScanning = function(callback) {
  debug("stopScanning");
  if (callback) {
    this.once('scanStop', callback);
  }
  if (this._bindings && this.initialized) {
    this._bindings.stopScanning();
  }
};

Noble.prototype.onScanStop = function() {
  debug('scanStop');
  this.emit('scanStop');
};

Noble.prototype.onDiscover = function(uuid, address, addressType, connectable, advertisement, rssi) {
  debug("onDiscover");
  var peripheral = this._peripherals[uuid];

  if (!peripheral) {
    peripheral = new Peripheral(this, uuid, address, addressType, connectable, advertisement, rssi);

    this._peripherals[uuid] = peripheral;
    this._services[uuid] = {};
    this._characteristics[uuid] = {};
    this._descriptors[uuid] = {};
  } else {
    // "or" the advertisment data with existing
    for (var i in advertisement) {
      if (advertisement[i] !== undefined) {
        peripheral.advertisement[i] = advertisement[i];
      }
    }

    peripheral.connectable = connectable;
    peripheral.rssi = rssi;
  }

  var previouslyDiscoverd = (this._discoveredPeripheralUUids.indexOf(uuid) !== -1);

  if (!previouslyDiscoverd) {
    this._discoveredPeripheralUUids.push(uuid);
  }

  if (this._allowDuplicates || !previouslyDiscoverd) {
    this.emit('discover', peripheral);
  }
};

Noble.prototype.connect = function(peripheralUuid) {
  debug("connect");
  this._bindings.connect(peripheralUuid);
};

Noble.prototype.onConnect = function(peripheralUuid, error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData) {
  debug("onConnect");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.state = error ? 'error' : 'connected';
    peripheral.emit('connect', error, status, role, addressType, address, interval, latency, supervisionTimeout, masterClockAccuracy, rawData);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' connected!');
  }
};

Noble.prototype.pair = function (peripheralUuid, smpRequestBuffer, passkeyOpt, passkeyVal) {
  this._bindings.pair(peripheralUuid, smpRequestBuffer, passkeyOpt, passkeyVal)
}

Noble.prototype.onPair = function (peripheralUuid, failReason, authType, assocModel) {
  debug("onPair " + JSON.stringify({peripheralUuid:peripheralUuid, failReason:failReason, authType:authType, assocModel:assocModel}));
  var peripheral = this._peripherals[peripheralUuid]
  if (peripheral) {
    debug('Pairing ' + failReason)
    peripheral.emit('pairResult', failReason, authType, assocModel)
  } else {
    console.warn('unknown peripheral ' + peripheralUuid + ' paired!')
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' paired!')
  }
}

Noble.prototype.onPairingResponse = function (peripheralUuid, pairingResponse) {
  debug("onPairingResponse " + JSON.stringify({peripheralUuid:peripheralUuid, pairingResponse:pairingResponse}));
  var peripheral = this._peripherals[peripheralUuid]
  if (peripheral) {
    peripheral.emit('pairingResponse', pairingResponse);
  } else {
    console.warn('unknown peripheral ' + peripheralUuid + ' paired!')
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' paired!')
  }
}

Noble.prototype.onEdiv = function (peripheralUuid, ediv, rand, ltk) {
  debug("onEdiv");
  var peripheral = this._peripherals[peripheralUuid]

  if (peripheral) {
    debug('EDIV ' + ediv)
    peripheral.emit('ltkEdiv', ediv, rand, ltk)
  } else {
    console.warn('unknown peripheral ' + peripheralUuid + ' paired!')
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' paired!')
  }
}

Noble.prototype.readRemoteVersionInformation = function(peripheralUuid) {
  debug("readRemoteVersionInformation: ", peripheralUuid);
  this._bindings.readRemoteVersionInformation(peripheralUuid);
};

Noble.prototype.leReadRemoteFeatures = function(peripheralUuid) {
  debug("leReadRemoteFeatures: ", peripheralUuid);
  this._bindings.leReadRemoteFeatures(peripheralUuid);
};

Noble.prototype.disconnect = function(peripheralUuid) {
  debug("disconnect");
  this._bindings.disconnect(peripheralUuid);
};

Noble.prototype.onDisconnect = function(peripheralUuid) {
  debug("onDisconnect");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral._clearTimeouts();
    peripheral._clearListeners();
    peripheral.state = 'disconnected';
    peripheral.emit('disconnect');
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' disconnected!');
  }
};

Noble.prototype.onDiscoverRemoteVersionInfo = function (uuid, status, handle, version, subversion, manufacturer_name, raw) {
	debug("onReadRemoteVersionInfo { " + JSON.stringify({
		uuid:uuid,
		status:status,
		handle:handle,
    version:version,
		subversion:subversion,
		manufacturer_name:manufacturer_name
  }));
  var peripheral = this._peripherals[uuid];

  if (peripheral) {
    peripheral.versionInfo = new VersionInfo(raw, version, subversion, manufacturer_name);
    peripheral.emit('discoverRemoteVersionInfo', peripheral.versionInfo);
  } else {
    console.log('unknown peripheral ' + uuid + ' onReadRemoteVersionInfo!');
    this.emit('warning', 'unknown peripheral ' + uuid + ' onReadRemoteVersionInfo!');
  }
};

Noble.prototype.onDiscoverFeatures = function (uuid, status, handle, leFeaturesRaw) {
	debug("onLeReadRemoteFeaturesComplete { " + JSON.stringify({
		uuid:uuid,
		status:status,
		handle:handle,
    leFeaturesRaw:leFeaturesRaw})
  );
  var peripheral = this._peripherals[uuid];

  if (peripheral) {
    peripheral.leFeatures = new LeFeatures(leFeaturesRaw);
    peripheral.emit('discoverFeatures', peripheral.leFeatures);
  } else {
    console.log('unknown peripheral ' + uuid + ' onLeReadRemoteFeaturesComplete!');
    this.emit('warning', 'unknown peripheral ' + uuid + ' onLeReadRemoteFeaturesComplete!');
  }
};


Noble.prototype.updateRssi = function(peripheralUuid) {
  debug("updateRssi");
  this._bindings.updateRssi(peripheralUuid);
};

Noble.prototype.onRssiUpdate = function(peripheralUuid, rssi) {
  debug("onRssiUpdate");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.rssi = rssi;

    peripheral.emit('rssiUpdate', rssi);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' RSSI update!');
  }
};

Noble.prototype.discoverServices = function(peripheralUuid, uuids) {
  debug("discoverServices");
  this._bindings.discoverServices(peripheralUuid, uuids);
};

Noble.prototype.onServicesDiscover = function(peripheralUuid, serviceUuids) {
  debug("onServicesDiscover");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    var services = [];

    for (var i = 0; i < serviceUuids.length; i++) {
      var serviceUuid = serviceUuids[i];
      var service = new Service(this, peripheralUuid, serviceUuid);

      this._services[peripheralUuid][serviceUuid] = service;
      this._characteristics[peripheralUuid][serviceUuid] = {};
      this._descriptors[peripheralUuid][serviceUuid] = {};

      services.push(service);
    }

    peripheral.services = services;

    peripheral.emit('servicesDiscover', services);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' services discover!');
  }
};

Noble.prototype.discoverIncludedServices = function(peripheralUuid, serviceUuid, serviceUuids) {
  debug("discoverIncludedServices");
  this._bindings.discoverIncludedServices(peripheralUuid, serviceUuid, serviceUuids);
};

Noble.prototype.onIncludedServicesDiscover = function(peripheralUuid, serviceUuid, includedServiceUuids) {
  debug("onIncludedServicesDiscover");
  var service = this._services[peripheralUuid][serviceUuid];

  if (service) {
    service.includedServiceUuids = includedServiceUuids;

    service.emit('includedServicesDiscover', includedServiceUuids);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ' included services discover!');
  }
};

Noble.prototype.discoverCharacteristics = function(peripheralUuid, serviceUuid, characteristicUuids) {
  debug("discoverCharacteristics");
  this._bindings.discoverCharacteristics(peripheralUuid, serviceUuid, characteristicUuids);
};

Noble.prototype.onCharacteristicsDiscover = function(peripheralUuid, serviceUuid, characteristics) {
  debug("onCharacteristicsDiscover");
  var service = this._services[peripheralUuid][serviceUuid];

  if (service) {
    var characteristics_ = [];
    var characteristics_uuids_ = [];

    for (var i = 0; i < characteristics.length; i++) {
      var characteristicUuid = characteristics[i].uuid;

      var characteristic = new Characteristic(
                                this,
                                peripheralUuid,
                                serviceUuid,
                                characteristicUuid,
                                characteristics[i].properties
                            );

      this._characteristics[peripheralUuid][serviceUuid][characteristicUuid] = characteristic;
      this._descriptors[peripheralUuid][serviceUuid][characteristicUuid] = {};

      characteristics_.push(characteristic);
      characteristics_uuids_.push(characteristicUuid);
    }
    debug('characteristics from', service.uuid, '\n', characteristics_uuids_);
    service.characteristics = characteristics_;

    service.emit('characteristicsDiscover', characteristics_);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ' characteristics discover!');
  }
};

Noble.prototype.read = function(peripheralUuid, serviceUuid, characteristicUuid) {
  debug("read");
   this._bindings.read(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onRead = function (peripheralUuid, serviceUuid, characteristicUuid, data, isNotification, isSecurityError) {
  debug("onRead");
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid]

  if (characteristic) {
    characteristic.emit('data', data, isNotification, isSecurityError);
    characteristic.emit('read', data, isNotification, isSecurityError); // for backwards compatbility
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' read!');
  }
};

Noble.prototype.write = function(peripheralUuid, serviceUuid, characteristicUuid, data, withoutResponse) {
  debug("write");
   this._bindings.write(peripheralUuid, serviceUuid, characteristicUuid, data, withoutResponse);
};

Noble.prototype.onWrite = function (peripheralUuid, serviceUuid, characteristicUuid, error, isSecurityError) {
  debug("onWrite");
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('write', error, isSecurityError);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' write!');
  }
};

Noble.prototype.broadcast = function(peripheralUuid, serviceUuid, characteristicUuid, broadcast) {
  debug("broadcast");
   this._bindings.broadcast(peripheralUuid, serviceUuid, characteristicUuid, broadcast);
};

Noble.prototype.onBroadcast = function(peripheralUuid, serviceUuid, characteristicUuid, state) {
  debug("onBroadcast");
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    characteristic.emit('broadcast', state);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' broadcast!');
  }
};

Noble.prototype.notify = function(peripheralUuid, serviceUuid, characteristicUuid, notify) {
  debug("notify");
   this._bindings.notify(peripheralUuid, serviceUuid, characteristicUuid, notify);
};

Noble.prototype.onNotify = function (peripheralUuid, serviceUuid, characteristicUuid, state, isSecurityError) {
  debug("onNotify");
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid]

  if (characteristic) {
    characteristic.emit('notify', state, isSecurityError)
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' notify!');
  }
};

Noble.prototype.discoverDescriptors = function(peripheralUuid, serviceUuid, characteristicUuid) {
  debug("discoverDescriptors");
  this._bindings.discoverDescriptors(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onDescriptorsDiscover = function(peripheralUuid, serviceUuid, characteristicUuid, descriptors) {
  debug("onDescriptorDiscover");
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  if (characteristic) {
    var descriptors_ = [];

    for (var i = 0; i < descriptors.length; i++) {
      var descriptorUuid = descriptors[i];

      var descriptor = new Descriptor(
                            this,
                            peripheralUuid,
                            serviceUuid,
                            characteristicUuid,
                            descriptorUuid
                        );

      this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid] = descriptor;

      descriptors_.push(descriptor);
    }

    characteristic.descriptors = descriptors_;

    characteristic.emit('descriptorsDiscover', descriptors_);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ' descriptors discover!');
  }
};

Noble.prototype.readValue = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  debug("readValue");
  this._bindings.readValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
};

Noble.prototype.onValueRead = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  debug("onValueRead");
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  if (descriptor) {
    descriptor.emit('valueRead', data);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ', ' + descriptorUuid + ' value read!');
  }
};

Noble.prototype.writeValue = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  debug("writeValue");
  this._bindings.writeValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
};

Noble.prototype.onValueWrite = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  debug("onValueWrite");
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  if (descriptor) {
    descriptor.emit('valueWrite');
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ', ' + serviceUuid + ', ' + characteristicUuid + ', ' + descriptorUuid + ' value write!');
  }
};

Noble.prototype.readHandle = function(peripheralUuid, handle) {
  debug("readhandle");
  this._bindings.readHandle(peripheralUuid, handle);
};

Noble.prototype.onHandleRead = function(peripheralUuid, handle, data) {
  debug("onHandleRead");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleRead' + handle, data);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' handle read!');
  }
};

Noble.prototype.writeHandle = function(peripheralUuid, handle, data, withoutResponse) {
  debug("writeHandle");
  this._bindings.writeHandle(peripheralUuid, handle, data, withoutResponse);
};

Noble.prototype.onHandleWrite = function(peripheralUuid, handle) {
  debug("onHandleWrite");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleWrite' + handle);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' handle write!');
  }
};

Noble.prototype.onHandleNotify = function(peripheralUuid, handle, data) {
  debug("onHandleNotify");
  var peripheral = this._peripherals[peripheralUuid];

  if (peripheral) {
    peripheral.emit('handleNotify', handle, data);
  } else {
    this.emit('warning', 'unknown peripheral ' + peripheralUuid + ' handle notify!');
  }
};

module.exports = Noble;
