import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CONTENT_LAYERS,
  getHexagramContentProvenance,
  getTheoremContentProvenance,
} from '../js/content-provenance.js';

const hexagrams = JSON.parse(readFileSync(new URL('../data/hexagrams.json', import.meta.url), 'utf8'));
const theorems = JSON.parse(readFileSync(new URL('../data/theorems.json', import.meta.url), 'utf8'));

test('六十四卦原文、易传与项目导读均有明确且不混并的出处层级', () => {
  for (const hexagram of hexagrams) {
    for (const field of ['judgement', 'tuan', 'image', 'scenario', 'judgementNote', 'tuanNote', 'imageNote']) {
      const provenance = getHexagramContentProvenance(hexagram, field);
      assert.ok(provenance.edition);
      assert.ok(provenance.location.includes(hexagram.name));
      assert.ok(provenance.validationStatus);
      if (field.endsWith('Note') || field === 'scenario') {
        assert.equal(provenance.layer, CONTENT_LAYERS.guide);
        assert.equal(provenance.validationStatus, '项目自撰');
      }
    }
    hexagram.lines.forEach((line) => {
      assert.equal(getHexagramContentProvenance(hexagram, 'lineText', line.position).layer, CONTENT_LAYERS.classic);
      assert.equal(getHexagramContentProvenance(hexagram, 'lineXiang', line.position).layer, CONTENT_LAYERS.wings);
      assert.equal(getHexagramContentProvenance(hexagram, 'lineNote', line.position).layer, CONTENT_LAYERS.guide);
    });
  }
});

test('象数条目明确标为传统资料并保留流派边界', () => {
  for (const theorem of theorems) {
    const provenance = getTheoremContentProvenance(theorem);
    assert.equal(provenance.layer, CONTENT_LAYERS.imagesNumbers);
    assert.match(provenance.disputeNote, /流派/);
  }
});
