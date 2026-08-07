import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');
const executablePath = path.join(
  projectRoot,
  'dist',
  `yijing-atlas-v${packageJson.version}-windows-x64.exe`,
);
const port = 31337;
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(executablePath, ['--no-open', `--port=${port}`], {
  stdio: 'ignore',
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) {
        return response;
      }
    } catch {
      // The executable may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Windows executable did not start its HTTP server.');
}

try {
  const homeResponse = await waitForServer();
  const home = await homeResponse.text();
  const dataResponse = await fetch(`${baseUrl}/data/hexagrams.json`);
  const scriptResponse = await fetch(`${baseUrl}/js/main.js`);
  const headResponse = await fetch(`${baseUrl}/styles/main.css`, { method: 'HEAD' });
  const missingResponse = await fetch(`${baseUrl}/not-found.txt`);

  if (!home.includes('<title>') || !dataResponse.ok || !scriptResponse.ok || !headResponse.ok) {
    throw new Error('Windows executable returned incomplete application assets.');
  }
  if (missingResponse.status !== 404) {
    throw new Error(`Expected 404 for a missing asset, received ${missingResponse.status}.`);
  }

  console.log('Windows executable smoke test passed.');
  console.log(`home=${homeResponse.status} data=${dataResponse.status} script=${scriptResponse.status} head=${headResponse.status} missing=${missingResponse.status}`);
} finally {
  child.kill();
}
