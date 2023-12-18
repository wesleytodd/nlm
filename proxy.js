'use strict';
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const startServer = require('verdaccio').default;
const CONFIG = require('./config');
const MARKER = CONFIG.MARKER;
const TIMER = 1000 * 60 * 10;

async function ensureProxyUp () {
  let proxyAddr;
  try {
    const _proxyAddr = await fs.readFile(MARKER);
    proxyAddr = JSON.parse(_proxyAddr);
  } catch (e) {
    // ignore if file not exists
    if (e.code !== 'ENOENT') {
      console.error(e);
    }
  }

  // Check if it is live
  if (proxyAddr) {
    try {
      if ((await checkUp(proxyAddr)) === true) {
        return proxyAddr;
      }
      // Remove bad marker file
      await fs.rm(MARKER);
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        // ignore
      } else {
        console.error(e);
        return;
      }
    }
  }

  // Start server
  const { server, addr } = await startVerdaccio(CONFIG);

  if (TIMER) {
    let timer;
    function restartTimer () {
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        server.close(async () => {
          await fs.rm(MARKER);
          process.exit(0);
        });
      }, TIMER);
    }

    // Reset timer if still in use
    server.on('request', (req, res) => {
      restartTimer();
    });
    restartTimer();
  }

  return { server, addr };
}

function startVerdaccio (config) {
  return new Promise(async (resolve, reject) => {
    config.storage = path.resolve(__dirname, config.storage || 'storage');
    startServer(config, config.listen, config.storage, '1.0.0', 'verdaccio', (server, addr) => {
      server.listen(addr.port || addr.path, addr.host, async (err) => {
        if (err) {
          return reject(err);
        }
        await fs.writeFile(MARKER, JSON.stringify(addr, null, 2), 'utf8');
        resolve({ server, addr });
      });
    });
  })
}

function checkUp (addr) {
  return new Promise((resolve, reject) => {
    http.request({
      host: addr.host,
      port: addr.port,
      path: '/english-days',
      method: 'GET',
      headers: {
        accept: '*',
        'accept-encoding': 'identity',
        host: `${addr.host}:${addr.port}`,
        connection: 'close',
        'if-none-match': ''
      }
    })
      .on('error', (err) => {
        reject(err);
      })
      .on('response', (res) => {
        res.statusCode === 200 ? resolve(true) : reject(new Error(`Non 200 response: ${res.statusCode}`));
      })
      .end();
  });
}

ensureProxyUp()
  .then(({ addr }) => {
    console.log(`Listening on ${addr.proto}://${addr.host}:${addr.port}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
