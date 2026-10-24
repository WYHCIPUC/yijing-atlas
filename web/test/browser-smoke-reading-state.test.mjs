import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../scripts/browser-smoke.mjs', import.meta.url), 'utf8');
const helper = source.match(/^async function assertReadingStage\([\s\S]*?^}/m)?.[0];
assert.ok(helper, 'Browser acceptance must expose its actual reading-state assertion.');

function harness(initial, onObservation = () => {}) {
  const state = { stage: 'quick', open: true, modal: 'false', deepLink: false,
    width: 768, opacity: 1, ...initial };
  let observations = 0;
  const panel = {
    classList: { contains: () => state.open },
    getAttribute: () => state.modal,
  };
  const page = {
    document: {
      body: { get dataset() { return { readingStage: state.stage }; } },
      querySelector: () => panel,
    },
    location: {
      get href() { return `http://127.0.0.1/${state.deepLink ? '?hex=111111' : ''}`; },
      get search() { return state.deepLink ? '?hex=111111' : ''; },
    },
    get innerWidth() { return state.width; },
    matchMedia: () => ({ matches: state.width <= 900 }),
    getComputedStyle: () => ({ opacity: String(state.opacity) }),
    URL,
  };
  const context = vm.createContext({
    client: { evaluate: async expression => vm.runInNewContext(expression, page) },
    waitFor: async (check, message) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        observations += 1;
        onObservation(state, observations);
        if (await check()) return;
      }
      throw new Error(message);
    },
  });
  vm.runInContext(helper, context);
  return { state, observations: () => observations,
    run: (stage, modal = null) => vm.runInContext(`assertReadingStage(client, ${JSON.stringify(stage)}, { modal: ${JSON.stringify(modal)} })`, context) };
}

test('viewport acknowledgement before media change waits for coherent quick-reading modality', async () => {
  const probe = harness({}, (state, observation) => {
    if (observation === 3) state.modal = 'true';
  });
  await probe.run('quick', true);
  assert.ok(probe.observations() >= 3, 'Must observe the media-change result, not only the unchanged quick stage.');
});

test('deep reading waits for its panel and URL to agree with the stage', async () => {
  const probe = harness({ stage: 'deep', modal: 'true', open: false }, (state, observation) => {
    if (observation === 2) { state.open = true; state.deepLink = true; }
  });
  await probe.run('deep', true);
});

test('a permanently incorrect modal still fails with actual viewport and expected state', async () => {
  await assert.rejects(harness({}).run('quick', true), error => {
    assert.match(error.message, /quick/);
    assert.match(error.message, /768/);
    assert.match(error.message, /false/);
    return true;
  });
});

test('an inconsistent open panel or deep link cannot pass a quick-reading assertion', async () => {
  await assert.rejects(harness({ modal: 'true', open: false }).run('quick', true));
  await assert.rejects(harness({ modal: 'true', deepLink: true }).run('quick', true));
});

test('closed reading requires both the panel and deep link to be cleared', async () => {
  await assert.rejects(harness({ stage: 'none', open: true, deepLink: true }).run('none'));
  await harness({ stage: 'none', open: false, deepLink: false }).run('none');
});

test('visible-state convergence does not skip the existing readable-content assertion', async () => {
  await assert.rejects(harness({ modal: 'true', opacity: 0 }).run('quick', true), /透明度/);
  await harness({ modal: 'true' }).run('quick', true);
});
