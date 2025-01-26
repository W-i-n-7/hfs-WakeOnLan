const fs = require('fs');
const path = require('path');

exports.version = 1.0
exports.apiRequired = 10.3
exports.description = "Allows you to turn on other computers in your network remotely using HFS on your home-server"
exports.repo = "W-i-n-7/hfs-wol"
exports.preview = ["https://raw.githubusercontent.com/W-i-n-7/hfs-wol/refs/heads/main/imgs/settings.png"]

exports.config = {
    broadcastIP: {
      type: 'string',
      label: 'Broadcast IP',
      defaultValue: '192.168.0.255',
      helperText: 'Change this according to your network.'
    },
    password: {
      type: 'string',
      label: 'Password',
      defaultValue: 'CHANGEME',
      helperText: 'Password required to send Wake-On-LAN packet.\nIf the password is wrong or not present, It will function like any other url.\nthis is done by adding ?auth=YOUR_PASSWORD to the end of the url'
    },
    passwordEnabled: {
      type: 'boolean',
      label: 'Password protection',
      defaultValue: true,
      helperText: 'If turned off anybody can turn on your devices. (if url is known)'
    },
    url: {
      type: 'string',
      label: 'URL that will be used to wake devices.',
      defaultValue: '/wol',
      helperText: 'Usage: go to /wol?auth=YOUR_PASSWORD'
    },
    macs: {
      type: 'array',
      label: 'Devices',
      helperText: 'Mac addresses are not visible anywhere outside of the Admin-panel, Not even with the password.',
      fields: {
        name: {
          type: 'string',
          label: 'Name'
        },
        mac: {
          type: 'string',
          label: 'Mac'
        }
      }
    }



    // dev1mac: {
    //   type: 'string',
    //   label: 'Device 1: MAC'
    // },
    // dev2mac: {
    //   type: 'string',
    //   label: 'Device 2: MAC',
    //   showIf: values => values.dev2en
    // },
    // dev1url: {
    //   type: 'string',
    //   label: 'Device 1: url',
    //   defaultValue: '/wake1',
    //   helperText: 'URL when accessed will send Wake-On-LAN'
    // },
    // dev2url: {
    //   type: 'string',
    //   label: 'Device 2: url',
    //   defaultValue: '/wake2',
    //   helperText: 'URL when accessed will send Wake-On-LAN',
    //   showIf: values => values.dev2en
    // },
    // dev2en: {
    //   type: 'boolean',
    //   label: 'Device 2 enabled'
    // },
    // consoleLog: {
    //   type: 'boolean',
    //   label: 'Log to console',
    //   helperText: 'eg \"Wake-on-LAN successful!\"'
    // }
}



exports.init = async api => {
  exports.middleware = ctx => {
    if (ctx.path === api.getConfig('url'))
    {
      if (decodeURIComponent(ctx.query.auth) === api.getConfig('password') || !api.getConfig('passwordEnabled'))
      {
        if (ctx.query.getDevices) {
          ctx.body = api.getConfig('macs').map(item => item.name)
          return ctx.stop?.() || true
        }
        if (!ctx.query.device) {
          try {
            const data = fs.readFileSync(path.resolve(__dirname, 'plugin.html'), 'utf8');
            ctx.body = data
          } catch (err) {
            ctx.body = 'Error reading file. Use ?device=1 manually.'
            console.error(err);
          }
          
          return ctx.stop?.() || true
        }

        ctx.body = 'Sending Wake-On-LAN'
        ctx.status = 200

        try {
          const macAddress = api.getConfig('macs').map(item => item.mac)[ctx.query.device - 1]
          wake(macAddress, {
            address: api.getConfig('broadcastIP'),
            num_packets: 1,
            interval: 100,
            port: 9
          }, (err) => {
            if (err) console.error('Wake-on-LAN failed:', macAddress, err);
            else console.log('Wake-on-LAN successful:', macAddress);
          });
        }
        catch {
          ctx.status = 500
        }

        return ctx.stop?.() || true
      }
    }

    // if (ctx.path === api.getConfig('dev1url'))
    // {
    //   if (ctx.query.auth === api.getConfig('password') || !api.getConfig('passwordEnabled'))
    //   {
    //       ctx.body = "Sending Wake-On-LAN"

    //       wake(api.getConfig('dev1mac'), {
    //         address: api.getConfig('broadcastIP'),
    //         num_packets: 1,
    //         interval: 100,
    //         port: 9
    //       }, (err) => {
    //         // if (api.getConfig('consoleLog')) {
    //         //   if (err) console.error('Wake-on-LAN failed:', api.getConfig('dev1mac'), err);
    //         //   else console.log('Wake-on-LAN successful:', api.getConfig('dev1mac'));
    //         // }
    //       });

    //       return ctx.stop?.() || true
    //   }
    // }
  }
}









// --- I DID NOT WRITE ANYTHING BELOW ---
// https://github.com/agnat/node_wake_on_lan
// I used AI to make this code not require npm 

const dgram = require('dgram');
const net = require('net');
const Buffer = require('buffer').Buffer;

const allocBuffer = Buffer.alloc ? 
  function allocBuffer(s) { return Buffer.alloc(s); } :
  function allocBuffer(s) { return new Buffer(s); };

const macBytes = 6;

function createMagicPacket(mac) {
  let macBuffer = allocBuffer(macBytes);
  
  if (mac.length === 2 * macBytes + (macBytes - 1)) {
    mac = mac.replace(new RegExp(mac[2], 'g'), '');
  }
  
  if (mac.length !== 2 * macBytes || !/^[0-9A-Fa-f]{12}$/.test(mac)) {
    throw new Error(`Malformed MAC address: '${mac}'`);
  }

  for (let i = 0; i < macBytes; i++) {
    macBuffer[i] = parseInt(mac.substring(2 * i, 2 * i + 2), 16);
  }

  const numMacs = 16;
  const buffer = allocBuffer((1 + numMacs) * macBytes);

  for (let i = 0; i < macBytes; i++) {
    buffer[i] = 0xFF;
  }

  for (let i = 0; i < numMacs; i++) {
    macBuffer.copy(buffer, (i + 1) * macBytes, 0, macBuffer.length);
  }

  return buffer;
}

function wake(mac, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = undefined;
  }
  
  const address = opts?.address || '255.255.255.255';
  const numPackets = opts?.num_packets || 3;
  const interval = opts?.interval || 100;
  const port = opts?.port || 9;
  const magicPacket = createMagicPacket(mac);

  const socket = dgram.createSocket(net.isIPv6(address) ? 'udp6' : 'udp4');
  let i = 0;
  let timerId;

  function postWrite(error) {
    if (error || i === numPackets) {
      try {
        socket.close();
      } catch (ex) {
        error = error || ex;
      }
      if (timerId) clearTimeout(timerId);
      if (callback) callback(error);
    }
  }

  socket.on('error', postWrite);

  function sendWoL() {
    i++;
    socket.send(magicPacket, 0, magicPacket.length, port, address, postWrite);
    if (i < numPackets) {
      timerId = setTimeout(sendWoL, interval);
    } else {
      timerId = undefined;
    }
  }

  socket.once('listening', () => {
    socket.setBroadcast(true);
  });

  sendWoL();
}
