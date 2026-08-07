#!/usr/bin/env node

'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const sea = require('node:sea');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 3030;
const MAX_PORT_ATTEMPTS = 20;
const WEB_ROOT = path.resolve(__dirname, '..', 'web');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

function parseOptions(argv) {
  const options = { openBrowser: true, port: DEFAULT_PORT };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-open') {
      options.openBrowser = false;
      continue;
    }

    const portValue = argument.startsWith('--port=')
      ? argument.slice('--port='.length)
      : argument === '--port'
        ? argv[index += 1]
        : null;

    if (portValue !== null) {
      const port = Number.parseInt(portValue, 10);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`无效端口：${portValue}`);
      }
      options.port = port;
    }
  }

  return options;
}

function resolveAsset(requestUrl) {
  const url = new URL(requestUrl, `http://${HOST}`);
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const relativePath = pathname === '/'
    ? 'index.html'
    : path.posix.normalize(pathname).replace(/^\/+/, '');
  const assetPath = path.resolve(WEB_ROOT, relativePath);
  const relativeToRoot = path.relative(WEB_ROOT, assetPath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return { assetPath, relativePath: relativePath.replaceAll('\\', '/') };
}

async function loadAsset(asset) {
  if (sea.isSea()) {
    try {
      return Buffer.from(sea.getAsset(asset.relativePath));
    } catch {
      return null;
    }
  }

  try {
    const stats = await fs.promises.stat(asset.assetPath);
    if (!stats.isFile()) {
      return null;
    }
    return await fs.promises.readFile(asset.assetPath);
  } catch {
    return null;
  }
}

async function serveAsset(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const asset = resolveAsset(request.url || '/');
  if (!asset) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad Request');
    return;
  }

  const content = await loadAsset(asset);
  if (!content) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Length': content.length,
    'Content-Type': MIME_TYPES.get(path.extname(asset.relativePath).toLowerCase()) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });

  response.end(request.method === 'HEAD' ? undefined : content);
}

function openDefaultBrowser(url) {
  const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function listen(server, startPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    const tryPort = () => {
      const handleError = (error) => {
        server.off('listening', handleListening);
        if (error.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
          attempts += 1;
          port += 1;
          tryPort();
          return;
        }
        reject(error);
      };

      const handleListening = () => {
        server.off('error', handleError);
        resolve(port);
      };

      server.once('error', handleError);
      server.once('listening', handleListening);
      server.listen(port, HOST);
    };

    tryPort();
  });
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const server = http.createServer(serveAsset);
  const port = await listen(server, options.port);
  const url = `http://${HOST}:${port}/`;

  console.log('易象图谱已启动');
  console.log(`访问地址：${url}`);
  console.log('请保持此窗口开启；关闭窗口即可退出。');

  if (options.openBrowser) {
    openDefaultBrowser(url);
  }

  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});
