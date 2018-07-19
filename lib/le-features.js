var debug = require('debug')('le-features');


function LeFeatures(features) {
  debug("LeFeatures");
  this.LEEncryption = null;
  this.ConnectionParametersRequestProcedure = null;
  this.ExtendedRejectIndication = null;
  this.SlaveInitiatedFeaturesExchange = null;
  this.LEPing = null;
  this.LEDataPacketLengthExtension = null;
  this.LLPrivacy = null;
  this.ExtendedScannerFilterPolicies = null;
  this.LE2MPHY = null;
  this.StableModulationIndexTransmitter = null;
  this.StableModulationIndexReceiver = null;
  this.LECodedPHY = null;
  this.LEExtendedAdvertising = null;
  this.LEPeriodicAdvertising = null;
  this.ChannelSelectionAlgorithm2 = null;
  this.LEPowerClass1 = null;
  this.MinimumNumberofUsedChannelsProcedure = null;
  this.raw = null;
  if (features){
    debug("LeFeatures.raw", features.toString('hex'));
    this.parse(features);
  }
}

LeFeatures.prototype.parse = function (features) {
  debug("LeFeatures.parse");
  if (!features){
    return;
  }

  this.raw = features;
  var decoded = features.readUIntLE(0, 8);
  this.LEEncryption = (decoded >> 0) & 1;
  this.ConnectionParametersRequestProcedure = (decoded >>1 ) & 1;
  this.ExtendedRejectIndication = (decoded >> 2) & 1;
  this.SlaveInitiatedFeaturesExchange = (decoded >> 3) & 1;
  this.LEPing = (decoded >> 4) & 1;
  this.LEDataPacketLengthExtension = (decoded >> 5) & 1;
  this.LLPrivacy = (decoded >> 6) & 1;
  this.ExtendedScannerFilterPolicies = (decoded >> 7) & 1;
  this.LE2MPHY = (decoded >> 8) & 1;
  this.StableModulationIndexTransmitter = (decoded >> 9) & 1;
  this.StableModulationIndexReceiver = (decoded >> 10) & 1;
  this.LECodedPHY = (decoded >> 11) & 1;
  this.LEExtendedAdvertising = (decoded >> 12) & 1;
  this.LEPeriodicAdvertising = (decoded >> 13) & 1;
  this.ChannelSelectionAlgorithm2 = (decoded >> 14) & 1;
  this.LEPowerClass1 = (decoded >> 15) & 1;
  this.MinimumNumberofUsedChannelsProcedure = (decoded >> 16) & 1;
}

LeFeatures.prototype.toString = function LeFeaturesToString() {
  return JSON.stringify({
    LEEncryption: this.LEEncryption,
    ConnectionParametersRequestProcedure: this.ConnectionParametersRequestProcedure,
    ExtendedRejectIndication: this.ExtendedRejectIndication,
    SlaveInitiatedFeaturesExchange: this.SlaveInitiatedFeaturesExchange,
    LEPing: this.LEPing,
    LEDataPacketLengthExtension: this.LEDataPacketLengthExtension,
    LLPrivacy: this.LLPrivacy,
    ExtendedScannerFilterPolicies: this.ExtendedScannerFilterPolicies,
    LE2MPHY: this.LE2MPHY,
    StableModulationIndexTransmitter: this.StableModulationIndexTransmitter,
    StableModulationIndexReceiver: this.StableModulationIndexReceiver,
    LECodedPHY: this.LECodedPHY,
    LEExtendedAdvertising: this.LEExtendedAdvertising,
    LEPeriodicAdvertising: this.LEPeriodicAdvertising,
    ChannelSelectionAlgorithm2: this.ChannelSelectionAlgorithm2,
    LEPowerClass1: this.LEPowerClass1,
    MinimumNumberofUsedChannelsProcedure: this.MinimumNumberofUsedChannelsProcedure
  }, function (key, value)  {

    if (value == 0) {
      return undefined;
    }
    else if (value == 1){
      return true;
    }
    else {
      return value;
    }
  });
}
module.exports = LeFeatures;
