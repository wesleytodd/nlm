'use strict';
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const cp = require('child_process');
const execFile = promisify(cp.execFile);
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');
const CONFIG = require('./config');
const MARKER = CONFIG.MARKER;

module.exports.cli = async (argv) => {
  const args = yargs(hideBin(argv)).argv;
  try {
    const addr = await ensureProxyUp();
    const out = await execNpm([
      '--registry', `${addr.proto}://${addr.host}:${addr.port}`,
      ...args._
    ]);
    console.log(out.stdout);
  } catch (e) {
    // @TODO handle errors more explicitly
    console.error(e);
    process.exit(1);
  }
};

function ensureProxyUp () {
  return new Promise(async (resolve, reject) => {
    await fs.promises.mkdir(CONFIG.LOGS, { recursive: true });
    const out = fs.openSync(path.join(CONFIG.LOGS, 'out.log'), 'w');
    const err = fs.openSync(path.join(CONFIG.LOGS, 'err.log'), 'w');

    cp.spawn(process.execPath, [path.join(__dirname, 'proxy.js')], {
      detached: true,
      stdio: [ 'ignore', out, err ]
    }).unref();
    fs.closeSync(out);
    fs.closeSync(err);

    let timedout = false;
    const timer = setTimeout(() => {
      timedout = true;
    }, 10000);
    timer.unref();

    let proxyAddr;
    while (!proxyAddr) {
      if (timedout) {
        return reject(new Error(`Proxy failed to start, see ${CONFIG.storage}/[out|err].log`));
      }
      try {
        const _proxyAddr = await fs.promises.readFile(MARKER);
        if (_proxyAddr) {
          proxyAddr = JSON.parse(_proxyAddr);
          clearTimeout(timer);
          return resolve(proxyAddr);
        }
      } catch (e) {
        // ignore if file not exists or if partial write
        if (e.code === 'ENOENT' || e.name === 'SyntaxError') {
          continue;
        }
        reject(e);
      }
    }

  });
}

async function execNpm (args, opts) {
  const node = process.env.npm_node_execpath || process.execPath;
  let npm = process.env.npm_execpath || path.join(path.dirname(node), 'npm');
  if (npm.endsWith('npx-cli.js')) {
    npm = path.join(path.dirname(npm), 'npm-cli.js');
  }
  return execFile(node, [npm, ...args], opts);
}
