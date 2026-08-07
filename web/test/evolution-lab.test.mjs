import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyEvolutionPreset,
  changedEvolutionPositions,
  createEvolutionFrames,
  createEvolutionState,
  currentEvolutionCode,
  evolutionSnapshot,
  redoEvolution,
  resetEvolution,
  toggleEvolutionLine,
  undoEvolution,
} from '../js/evolution-state.js';

test('逐爻变化保持自下而上的位序并记录历史', () => {
  let state = createEvolutionState('111111');
  state = toggleEvolutionLine(state, 1);
  assert.equal(currentEvolutionCode(state), '011111');
  state = toggleEvolutionLine(state, 6);
  assert.equal(currentEvolutionCode(state), '011110');
  assert.deepEqual(changedEvolutionPositions(state.baseCode, currentEvolutionCode(state)), [1, 6]);
  assert.equal(state.steps.length, 3);
});

test('撤销、重做和新分支会正确维护历史', () => {
  let state = toggleEvolutionLine(createEvolutionState('111111'), 1);
  state = toggleEvolutionLine(state, 2);
  state = undoEvolution(state);
  assert.equal(currentEvolutionCode(state), '011111');
  assert.equal(evolutionSnapshot(state).canRedo, true);
  state = redoEvolution(state);
  assert.equal(currentEvolutionCode(state), '001111');
  state = undoEvolution(state);
  state = toggleEvolutionLine(state, 3);
  assert.equal(currentEvolutionCode(state), '010111');
  assert.equal(evolutionSnapshot(state).canRedo, false);
  assert.equal(state.steps.length, 3);
});

test('错综互预设始终从原卦计算', () => {
  const base = createEvolutionState('111000');
  assert.equal(currentEvolutionCode(applyEvolutionPreset(base, 'opposite')), '000111');
  assert.equal(currentEvolutionCode(applyEvolutionPreset(base, 'reversed')), '000111');
  assert.equal(currentEvolutionCode(applyEvolutionPreset(base, 'interlocking')), '110100');

  const edited = toggleEvolutionLine(base, 1);
  assert.equal(currentEvolutionCode(applyEvolutionPreset(edited, 'interlocking')), '110100');
});

test('重置可撤销，快照解析结果卦和控制状态', () => {
  const hexagrams = [
    { binaryCode: '111111', name: '乾' },
    { binaryCode: '011111', name: '姤' },
  ];
  let state = toggleEvolutionLine(createEvolutionState('111111'), 1);
  const changed = evolutionSnapshot(state, hexagrams);
  assert.equal(changed.currentHexagram.name, '姤');
  assert.deepEqual(changed.changedPositions, [1]);
  assert.equal(changed.canUndo, true);

  state = resetEvolution(state);
  assert.equal(currentEvolutionCode(state), '111111');
  assert.equal(currentEvolutionCode(undoEvolution(state)), '011111');
});

test('历史边界操作保持状态稳定，未知结果安全回退', () => {
  const initial = createEvolutionState('111111');
  assert.equal(undoEvolution(initial), initial);
  assert.equal(redoEvolution(initial), initial);
  assert.equal(resetEvolution(initial), initial);
  assert.equal(applyEvolutionPreset(initial, 'reversed'), initial);
  assert.equal(evolutionSnapshot(initial).currentHexagram, null);
});

test('演示帧按初爻到上爻依次生成且包含起止卦', () => {
  assert.deepEqual(createEvolutionFrames('111111', '010110'), [
    '111111',
    '011111',
    '010111',
    '010110',
  ]);
  assert.deepEqual(createEvolutionFrames('101010', '101010'), ['101010']);
});

test('无效卦码、爻位、预设和状态会被拒绝', () => {
  assert.throws(() => createEvolutionState('111'), /6 位/);
  assert.throws(() => toggleEvolutionLine(createEvolutionState('111111'), 0), /1-6/);
  assert.throws(() => applyEvolutionPreset(createEvolutionState('111111'), 'unknown'), /未知演变预设/);
  assert.throws(() => currentEvolutionCode(null), /无效的演变状态/);
  assert.throws(() => currentEvolutionCode({}), /无效的演变状态/);
  assert.throws(() => currentEvolutionCode({ baseCode: '111111', steps: [], cursor: 0 }), /游标越界/);
  assert.throws(() => currentEvolutionCode({ baseCode: '111111', steps: [], cursor: 0.5 }), /无效的演变状态/);
  assert.throws(() => changedEvolutionPositions('111111', '00000x'), /6 位/);
  assert.throws(() => createEvolutionFrames('111111', '01010x'), /6 位/);
});
