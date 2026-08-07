import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'web');
const args = new Set(process.argv.slice(2));
const checksOnly = args.has('--checks-only');
const testsOnly = args.has('--tests-only');
const includeSmoke = args.has('--include-smoke');

function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path, extensions);
    return extensions.has(extname(entry.name)) ? [path] : [];
  });
}

function runChecks() {
  const syntaxFiles = [
    join(webRoot, 'sw.js'),
    ...collectFiles(join(webRoot, 'js'), new Set(['.js', '.mjs'])),
    ...collectFiles(join(webRoot, 'tool'), new Set(['.js', '.mjs'])),
    ...collectFiles(join(root, 'scripts'), new Set(['.js', '.mjs'])),
  ];

  for (const file of syntaxFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    const source = readFileSync(file, 'utf8');
    if (/\t/.test(source)) throw new Error(`${file} 含制表符缩进`);
    if (/ +$/m.test(source)) throw new Error(`${file} 含行尾空格`);
  }
  console.log(`✓ JavaScript 语法与格式检查：${syntaxFiles.length} 个文件`);

  const dataFiles = [
    ...collectFiles(join(webRoot, 'data'), new Set(['.json'])),
    join(webRoot, 'manifest.webmanifest'),
    join(root, 'package.json'),
  ];
  for (const file of dataFiles) JSON.parse(readFileSync(file, 'utf8'));
  console.log(`✓ JSON 可解析：${dataFiles.length} 个文件`);

  execFileSync(process.execPath, [join(root, 'scripts', 'validate-commentaries.mjs')], { stdio: 'inherit' });

  const forbiddenTracked = ['.pdf', '.pem', '.key', '.p12'];
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = tracked.filter((file) => forbiddenTracked.includes(extname(file).toLowerCase()));
  if (forbidden.length) throw new Error(`版本库含禁止发布的文件：${forbidden.join(', ')}`);
  console.log('✓ 当前版本树不含 PDF、证书或私钥文件');
}

function runTest(file, cwd = root) {
  const result = spawnSync(process.execPath, [file], {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} 失败（退出码 ${result.status}）`);
}

function runTests() {
  const webTests = collectFiles(join(webRoot, 'test'), new Set(['.mjs']))
    .filter((file) => file.endsWith('.test.mjs'));
  const almanacTests = collectFiles(join(root, 'test', 'almanac'), new Set(['.mjs']))
    .filter((file) => file.endsWith('.test.mjs'))
    .filter((file) => includeSmoke || !file.endsWith('render-smoke.test.mjs'));

  for (const file of webTests) runTest(file, root);
  for (const file of almanacTests) runTest(file, webRoot);
  console.log(`✓ 测试脚本通过：${webTests.length + almanacTests.length} 个`);
}

try {
  if (!testsOnly) runChecks();
  if (!checksOnly) runTests();
  console.log('\n质量检查全部通过');
} catch (error) {
  console.error(`\n质量检查失败：${error.message}`);
  process.exit(1);
}
