'use strict';
const path = require('path');
const STORAGE = path.join(__dirname, '.storage');
const LOGS = path.join(STORAGE, '.nlm');
const MARKER = path.join(STORAGE, '.nlm', 'proxy-addr.json');

module.exports = {
  LOGS,
  MARKER,
  listen: '0.0.0.0:1234',
  storage: STORAGE,
  web: {
    enable: false
  },
  uplinks: {
    reg: {
      url: 'https://registry.npmjs.org',
      maxage: '60m'
    }
  },
  packages: {
    '**': {
      proxy: 'reg',
      access: '$all'
    }
  },
  logs: [{
    type: 'stdout',
    format: 'pretty',
    level: 'http'
  }]
};
