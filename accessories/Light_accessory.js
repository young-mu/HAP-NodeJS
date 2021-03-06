var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var sendSMS = function (status) {
    var http = require('http');
    var crypto = require('crypto');

    var api_key = '9f4d4b469b084aeb94c901c5427c484c';
    var secret_key = '35deef8c8c2942daaac5f46b78286ad2';
    var timestap = new Date().getTime().toString();

    var hash = crypto.createHash('md5');
    hash.update(api_key + secret_key + timestap);
    var signStr = hash.digest('hex');

    var jsonStr = JSON.stringify({
        'apiKey': api_key,
        'time': timestap,
        'sign': signStr
    });

    var authorization = Buffer.from(jsonStr).toString('base64');

    var body = JSON.stringify({
        messageSign: 'RuffSiri',
        mobile: '18521081550',
        needReceipt: 0,
        templateId: 1370,
        templateParameter: {
            'param1': 'Ruff',
            'param2': 'LED',
            'param3': status
        }
    });

    var options = {
        host: 'open.home.komect.com',
        path: '/api/v1/sms/send',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization,
        }
    };

    var req = http.request(options, function (res) {
        res.setEncoding('utf-8');
        res.on('data', function (data) {
            console.log('BODY: ' + data.toString());
        });
    });

    req.end(body);
};

var sendCommandToRuff = function (method) {
    var net = require('net');

    var host = '192.168.31.101';
    var port = 7777;

    var client = new net.Socket();

    client.connect(port, host, function () {
        var id = 'led-b';
        var content = JSON.stringify({
            'id': id,
            'method': method
        });
        console.log('id: ' + id + ', method: ' + method);
        client.write(content);
    });

    client.on('data', function (data) {
        var ret = data.toString();
        if (ret[0] === 'Y') {
            console.log('Control succesfully');
            sendSMS(ret[1] === 'Y' ? '打开' : '关闭');
        } else if (ret[0] === 'N') {
            console.log('Control failed');
        }

        client.destroy();
    });
};

var LightController = {
  name: "Simple Light", //name of accessory
  pincode: "031-45-154",
  username: "FA:3C:ED:5A:1A:1A", // MAC like address used by HomeKit to differentiate accessories. 
  manufacturer: "HAP-NodeJS", //manufacturer (optional)
  model: "v1.0", //model (optional)
  serialNumber: "A12S345KGB", //serial number (optional)

  power: false, //curent power status
  brightness: 100, //current brightness
  hue: 0, //current hue
  saturation: 0, //current saturation

  outputLogs: true, //output logs

  setPower: function(status) { //set power of accessory
    console.log(status);
    if (this.outputLogs) {
        console.log("Turning the '%s' %s", this.name, status ? "on" : "off");
    }

    sendCommandToRuff(status ? 'turnOn' : 'turnOff');

    this.power = status;
  },

  getPower: function() { //get power of accessory
    if(this.outputLogs) console.log("'%s' is %s.", this.name, this.power ? "on" : "off");
    return this.power;
  },

  setBrightness: function(brightness) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' brightness to %s", this.name, brightness);
    this.brightness = brightness;
  },

  getBrightness: function() { //get brightness
    if(this.outputLogs) console.log("'%s' brightness is %s", this.name, this.brightness);
    return this.brightness;
  },

  setSaturation: function(saturation) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' saturation to %s", this.name, saturation);
    this.saturation = saturation;
  },

  getSaturation: function() { //get brightness
    if(this.outputLogs) console.log("'%s' saturation is %s", this.name, this.saturation);
    return this.saturation;
  },

  setHue: function(hue) { //set brightness
    if(this.outputLogs) console.log("Setting '%s' hue to %s", this.name, hue);
    this.hue = hue;
  },

  getHue: function() { //get hue
    if(this.outputLogs) console.log("'%s' hue is %s", this.name, this.hue);
    return this.hue;
  },

  identify: function() { //identify the accessory
    if(this.outputLogs) console.log("Identify the '%s'", this.name);
  }
}

// Generate a consistent UUID for our light Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "light".
var lightUUID = uuid.generate('hap-nodejs:accessories:light' + LightController.name);

// This is the Accessory that we'll return to HAP-NodeJS that represents our light.
var lightAccessory = exports.accessory = new Accessory(LightController.name, lightUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
lightAccessory.username = LightController.username;
lightAccessory.pincode = LightController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
lightAccessory
  .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, LightController.manufacturer)
    .setCharacteristic(Characteristic.Model, LightController.model)
    .setCharacteristic(Characteristic.SerialNumber, LightController.serialNumber);

// listen for the "identify" event for this Accessory
lightAccessory.on('identify', function(paired, callback) {
  LightController.identify();
  callback();
});

// Add the actual Lightbulb Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
lightAccessory
  .addService(Service.Lightbulb, LightController.name) // services exposed to the user should have "names" like "Light" for this case
  .getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    LightController.setPower(value);

    // Our light is synchronous - this value has been successfully set
    // Invoke the callback when you finished processing the request
    // If it's going to take more than 1s to finish the request, try to invoke the callback
    // after getting the request instead of after finishing it. This avoids blocking other
    // requests from HomeKit.
    callback();
  })
  // We want to intercept requests for our current power state so we can query the hardware itself instead of
  // allowing HAP-NodeJS to return the cached Characteristic.value.
  .on('get', function(callback) {
    callback(null, LightController.getPower());
  });

// To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
// Please use Characteristic.updateValue
// 
// lightAccessory
//   .getService(Service.Lightbulb)
//   .getCharacteristic(Characteristic.On)
//   .updateValue(true);

// also add an "optional" Characteristic for Brightness
lightAccessory
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Brightness)
  .on('set', function(value, callback) {
    LightController.setBrightness(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, LightController.getBrightness());
  });

// also add an "optional" Characteristic for Saturation
lightAccessory
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Saturation)
  .on('set', function(value, callback) {
    LightController.setSaturation(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, LightController.getSaturation());
  });

// also add an "optional" Characteristic for Hue
lightAccessory
  .getService(Service.Lightbulb)
  .addCharacteristic(Characteristic.Hue)
  .on('set', function(value, callback) {
    LightController.setHue(value);
    callback();
  })
  .on('get', function(callback) {
    callback(null, LightController.getHue());
  });
