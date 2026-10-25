import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingState, transitionReading, shouldRecordDeepRead } from '../js/reading-state.js';

test('聚焦和快读不产生正式深读，深读只在有效进入时记录', () => {
  const initial = createReadingState();
  const focused = transitionReading(initial, { type: 'focus', code: '001011' });
  const quick = transitionReading(focused, { type: 'quick' });
  const deep = transitionReading(quick, { type: 'deep' });
  assert.equal(focused.focusedCode, '001011');
  assert.equal(focused.readingCode, null);
  assert.equal(quick.stage, 'quick');
  assert.equal(quick.readingCode, '001011');
  assert.equal(shouldRecordDeepRead(initial, focused), false);
  assert.equal(shouldRecordDeepRead(focused, quick), false);
  assert.equal(shouldRecordDeepRead(quick, deep), true);
  assert.equal(shouldRecordDeepRead(deep, transitionReading(deep, { type: 'deep' })), false);
  assert.equal(initial.focusedCode, null, '旧状态不被覆写');
});

test('逐层返回保留卦码和章节，最后返回全景', () => {
  let state = transitionReading(createReadingState(), { type: 'deep', code: '111111' });
  state = transitionReading(state, { type: 'section', section: 'lines' });
  state = transitionReading(state, { type: 'back' });
  assert.equal(state.stage, 'quick');
  assert.equal(state.section, 'lines');
  state = transitionReading(state, { type: 'back' });
  assert.equal(state.stage, 'none');
  assert.equal(state.focusedCode, '111111');
  assert.equal(state.readingCode, null);
  state = transitionReading(state, { type: 'back' });
  assert.equal(state.focusedCode, null);
});

test('无效编码和章节不污染状态；不同卦重新从概览开始', () => {
  const state = transitionReading(createReadingState(), { type: 'deep', code: '000000' });
  for (const code of ['', '11111', '222222', null]) {
    assert.deepEqual(transitionReading(state, { type: 'focus', code }), state);
  }
  assert.deepEqual(transitionReading(state, { type: 'section', section: 'bad' }), state);
  const lines = transitionReading(state, { type: 'section', section: 'lines' });
  const related = transitionReading(lines, { type: 'deep', code: '111111' });
  assert.equal(related.section, 'overview');
  assert.equal(shouldRecordDeepRead(lines, related), true);
  assert.equal(transitionReading(createReadingState(), { type: 'quick' }).stage, 'none');
});
