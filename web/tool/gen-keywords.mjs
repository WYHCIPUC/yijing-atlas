// 为每个卦生成分层关键词，输出 web/data/hexagram-keywords.json
// 关键词分 4 级：L0 卦名 / L1 卦辞核心 / L2 大象要旨 / L3 代表爻辞
import { readFileSync, writeFileSync } from 'fs';

const hex = JSON.parse(readFileSync('data/hexagrams.json', 'utf8'));

// 清理标点和断词，去掉爻题前缀（初九/九二/六二/九五/六五/上九/上六/用九/用六）
function clean(s) {
  return (s || '')
    .replace(/[，。、；：！？\s]/g, '')
    .replace(/^[^：]*：/, '')
    .replace(/^(初九|九二|九三|九四|九五|上九|初六|六二|六三|六四|六五|上六|用九|用六)/, '');
}

// 智能截取：优先在自然语义边界断开，取前 N 字
function take(s, n) {
  const c = clean(s);
  if (c.length <= n) return c;
  return c.slice(0, n);
}

function extractKeywords(h) {
  const kws = [{ text: h.name, level: 0 }];
  // L1: 卦辞核心（去卦名前缀，取前4字）
  const j = clean(h.judgement).replace(new RegExp('^' + h.name), '');
  if (j) kws.push({ text: take(j, 4), level: 1 });
  // L2: 大象要旨（"君子以"后取4字，或整体取4字）
  let img = '';
  const m = h.image.match(/君子以(.+)/);
  if (m) img = take(m[1], 4);
  else img = take(h.image, 4);
  if (img) kws.push({ text: img, level: 2 });
  // L3: 九五/六五 爻辞核心（取4字）
  const yao5 = h.lines.find(y => y.position === 5);
  if (yao5 && yao5.text) {
    const t = take(clean(yao5.text), 4);
    if (t && t.length >= 2) kws.push({ text: t, level: 3 });
  }
  // L3: 九二/六二 爻辞核心（取4字）
  const yao2 = h.lines.find(y => y.position === 2);
  if (yao2 && yao2.text) {
    const t = take(clean(yao2.text), 4);
    if (t && t.length >= 2) kws.push({ text: t, level: 3 });
  }
  return kws;
}

const result = {};
for (const h of hex) {
  result[h.binaryCode] = extractKeywords(h);
}

writeFileSync('data/hexagram-keywords.json', JSON.stringify(result, null, 2));
console.log('已生成 hexagram-keywords.json，' + Object.keys(result).length + ' 卦');
// 抽样验证
for (const name of ['乾', '坤', '泰', '既济', '未济']) {
  const h = hex.find(x => x.name === name);
  console.log('  ' + name + ': ' + result[h.binaryCode].map(k => 'L' + k.level + '=' + k.text).join(' | '));
}
