var Service;
var Characteristic;
var exec = require('child_process').exec;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-garagedoor-command', 'GarageCommand', GarageCmdAccessory);
};

function setIntervalX(callback, delay, repetitions) {
  var x = 0;
  var intervalID = setInterval(function () {
    callback();
    if (++x === repetitions) {
      clearInterval(intervalID);
    }
  }, delay);
}

function GarageCmdAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.openCommand = config.open;
  this.closeCommand = config.close;
  this.stateCommand = config.state;
  this.statusUpdateDelay = config.status_update_delay || 15;
}

GarageCmdAccessory.prototype.setState = function(isClosed, callback) {
  var accessory = this;
  var state = isClosed ? 'close' : 'open';
  var prop = state + 'Command';
  var command = accessory[prop];
  accessory.log('Commnand to run: ' + command);

  exec(
    command,
    {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 200*1024,
      killSignal: 'SIGTERM',
      cwd: null,
      env: null
    },
    function (err, stdout, stderr) {
      if (err) {
        accessory.log('Error: ' + err);
        callback(err || new Error('Error setting ' + accessory.name + ' to ' + state));
      } else {
        accessory.log('Set ' + accessory.name + ' to ' + state);
        setIntervalX(() => accessory.getState(), 60000, 10);
        accessory.timer = setTimeout(function() {
          if (stdout.indexOf('OPENING') > -1) {
            accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
          } else if (stdout.indexOf('CLOSING') > -1) {
            accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
          }
       }, accessory.statusUpdateDelay * 1000);
       callback(null);
     }
  });
};

GarageCmdAccessory.prototype.getState = function(callback) {
  var accessory = this;
  var command = accessory.stateCommand;

  exec(command, function (err, stdout, stderr) {
    if (err) {
      accessory.log('Error: ' + err);
      callback(err || new Error('Error getting state of ' + accessory.name));
    } else {
      var state = stdout.toString('utf-8').trim();
      accessory.log('State of ' + accessory.name + ' is: ' + state);
      callback(null, Characteristic.CurrentDoorState[state]);
    }
  });
};

GarageCmdAccessory.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();
  this.garageDoorService = new Service.GarageDoorOpener(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Garage Command')
  .setCharacteristic(Characteristic.Model, 'Homebridge Plugin')
  .setCharacteristic(Characteristic.SerialNumber, '001');

  this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
  .on('set', this.setState.bind(this));

  if (this.stateCommand) {
    this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
    .on('get', this.getState.bind(this));
    this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
    .on('get', this.getState.bind(this));
  }

  return [this.informationService, this.garageDoorService];
};
