import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCommentaryCatalog } from '../js/commentary-catalog.js';

const manifest = {
  schemaVersion: 1,
  releaseReady: false,
  requiredAuthorities: ['source-a'],
  requiredAnchors: ['judgement'],
  reviewersPerRecord: 2,
};
const sources = {
  authorities: [{
    id: 'source-a', author: '甲', dynasty: '古', work: '书', edition: '底本',
    editionStatus: 'pending', digitalIndex: 'https://example.test/source',
  }],
};

function completeDocuments() {
  return Array.from({ length: 64 }, (_, value) => ({
    binaryCode: value.toString(2).padStart(6, '0'),
    authorities: {
      'source-a': {
        anchors: {
          judgement: {
            status: 'verified', text: '注文', volume: '卷一', locator: '一页',
            sourceUrl: 'https://example.test/page', reviewers: ['甲', '乙'],
          },
        },
      },
    },
  }));
}

test('未完成内容保持发布门禁关闭，但来源目录可独立校验', () => {
  const result = validateCommentaryCatalog(manifest, sources);
  assert.equal(result.valid, true);
  assert.equal(result.canRelease, false);
  assert.match(result.warnings[0], /入口必须保持关闭/);
});

test('发布状态要求底本已登记且六十四卦全部双人校对', () => {
  const readyManifest = { ...manifest, releaseReady: true };
  const pending = validateCommentaryCatalog(readyManifest, sources, completeDocuments());
  assert.equal(pending.canRelease, false);
  assert.match(pending.errors.join('\n'), /底本尚未完成/);

  const verifiedSources = { authorities: [{ ...sources.authorities[0], editionStatus: 'verified' }] };
  const complete = validateCommentaryCatalog(readyManifest, verifiedSources, completeDocuments());
  assert.equal(complete.canRelease, true);
});

test('缺项、空原文与单人校对会阻断发布', () => {
  const readyManifest = { ...manifest, releaseReady: true };
  const verifiedSources = { authorities: [{ ...sources.authorities[0], editionStatus: 'verified' }] };
  const documents = completeDocuments();
  documents[0].authorities['source-a'].anchors.judgement = {
    status: 'verified', text: '', volume: '', locator: '', sourceUrl: '', reviewers: ['甲'],
  };
  const result = validateCommentaryCatalog(readyManifest, verifiedSources, documents);
  assert.equal(result.canRelease, false);
  assert.match(result.errors.join('\n'), /text 不能为空/);
  assert.match(result.errors.join('\n'), /校对者不足/);
});
