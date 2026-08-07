import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const runFile = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');
const distDirectory = path.join(projectRoot, 'dist');
const buildDirectory = path.join(distDirectory, '.sea-build');
const executableName = `yijing-atlas-v${packageJson.version}-windows-x64.exe`;
const executablePath = path.join(distDirectory, executableName);
const checksumPath = path.join(distDirectory, 'SHA256SUMS.txt');
const blobPath = path.join(buildDirectory, 'sea-prep.blob');
const configPath = path.join(buildDirectory, 'sea-config.json');
const launcherPath = path.join(projectRoot, 'scripts', 'desktop-launcher.cjs');
const postjectPath = path.join(projectRoot, 'node_modules', 'postject', 'dist', 'cli.js');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

await mkdir(distDirectory, { recursive: true });
await rm(executablePath, { force: true });
await rm(checksumPath, { force: true });
await rm(buildDirectory, { force: true, recursive: true });
await mkdir(buildDirectory, { recursive: true });

try {
  const webRoot = path.join(projectRoot, 'web');
  const assets = Object.fromEntries((await listFiles(webRoot)).map((filePath) => [
    path.relative(webRoot, filePath).replaceAll('\\', '/'),
    filePath,
  ]));

  await writeFile(configPath, JSON.stringify({
    main: launcherPath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets,
  }, null, 2), 'utf8');

  await runFile(process.execPath, ['--experimental-sea-config', configPath], {
    cwd: projectRoot,
    windowsHide: true,
  });
  await copyFile(process.execPath, executablePath);
  await runFile(process.execPath, [
    postjectPath,
    executablePath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ], {
    cwd: projectRoot,
    windowsHide: true,
  });
} finally {
  await rm(buildDirectory, { force: true, recursive: true });
}

const executable = await readFile(executablePath);
const checksum = createHash('sha256').update(executable).digest('hex');
await writeFile(checksumPath, `${checksum}  ${executableName}\n`, 'utf8');

console.log(`Windows executable: ${path.relative(projectRoot, executablePath)}`);
console.log(`SHA-256: ${checksum}`);
