import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(join(webRoot, 'index.html'), 'utf8');
const guard = readFileSync(join(webRoot, 'js', 'protocol-guard.js'), 'utf8');

function executeGuard(location) {
  let redirectedTo = null;
  vm.runInNewContext(guard, {
    URL,
    window: {
      location: {
        ...location,
        replace(url) { redirectedTo = url; },
      },
    },
  });
  return redirectedTo;
}

test('文件协议入口在加载样式和模块前转向本地 HTTP 服务', () => {
  const scriptPosition = index.indexOf('<script src="js/protocol-guard.js"></script>');
  assert.ok(scriptPosition > 0);
  assert.ok(scriptPosition < index.indexOf('<link rel="stylesheet"'));
  assert.equal(
    executeGuard({ protocol: 'file:', search: '?hex=110011', hash: '#detail-lines' }),
    'http://127.0.0.1:3030/?hex=110011#detail-lines',
  );
});

test('HTTP 页面不会发生额外跳转', () => {
  assert.equal(executeGuard({ protocol: 'http:', search: '', hash: '' }), null);
});
