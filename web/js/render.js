// 渲染层：把领域数据渲染为 HTML。纯函数，输入数据 + 挂载点。
import { hexagramSvg, trigramSvg } from './svg-painter.js';
import { yaoLabel, allRelations } from './hexagram-utils.js';

// HTML 转义，防注入
function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 由二进制码查卦名（关系 chip 显示用）
function codeToName(code, hexagrams) {
  const h = hexagrams.find(x => x.binaryCode === code);
  return h ? h.name : '?';
}

// 64 卦总览网格。onPick(code) 为点击回调。
export function renderHexagramList(hexagrams, mountEl, onPick) {
  const cards = hexagrams.map((h) => `
    <div class="hex-card" data-code="${esc(h.binaryCode)}">
      ${hexagramSvg(h.binaryCode, { size: 56 })}
      <div class="hex-name">${h.number}.${esc(h.name)}</div>
      <div class="hex-full">${esc(h.fullName)}</div>
    </div>
  `).join('');
  mountEl.innerHTML = `<div class="hex-grid">${cards}</div>`;
  mountEl.querySelectorAll('.hex-card').forEach((card) => {
    card.addEventListener('click', () => onPick(card.dataset.code));
  });
}

// 长卷阅读式详情：渲染到指定挂载点。
// hex - 卦对象；mountEl - 挂载点；hexagrams - 全部卦（用于关系查名）；onPickRelation - 关系chip点击回调
export function renderHexagramDetail(hex, mountEl, hexagrams, onPickRelation) {
  const lines = [...hex.lines].reverse()
    .map((y) => {
      const label = yaoLabel(y.position, y.isYang);
      const textHtml = y.text
        ? `<div class="original-text">${esc(y.text)}</div>`
        : `<div class="original-text" style="color:#999">（经文待补）</div>`;
      const xiangHtml = y.xiang ? `<div class="note-text">象曰：${esc(y.xiang)}</div>` : '';
      const noteHtml = y.note ? `<div class="note-text">${esc(y.note)}</div>` : '';
      return `<div class="yao-item"><span class="yao-label">${esc(label)}</span>${textHtml}${xiangHtml}${noteHtml}</div>`;
    }).join('');

  const section = (title, body) =>
    body ? `<h3 class="section-title">${esc(title)}</h3>${body}` : '';

  const rels = allRelations(hex.binaryCode);
  const relChip = (label, code) =>
    `<span class="relation-chip" data-code="${esc(code)}">${esc(label)}→${esc(codeToName(code, hexagrams))}</span>`;
  const relHtml = `
    <h3 class="section-title">它如何变</h3>
    <div class="relation-chips">
      ${relChip('错', rels.opposite)}
      ${relChip('综', rels.reversed)}
      ${relChip('互', rels.interlocking)}
    </div>
    <div class="relation-chips">${rels.changing.map((c,i) => relChip('第'+(i+1)+'爻变', c)).join('')}</div>
  `;

  mountEl.innerHTML = `
    <div class="detail-header">
      ${hexagramSvg(hex.binaryCode, { size: 160 })}
      <h1>${esc(hex.name)} · ${esc(hex.fullName)}</h1>
      <div class="subtitle">第 ${hex.number} 卦 · ${esc(hex.binaryCode)} · 下${esc(hex.trigramLower)} 上${esc(hex.trigramUpper)}</div>
    </div>
    ${section('卦辞', `<div class="original-text">${esc(hex.judgement)}</div>${hex.judgementNote ? `<div class="note-text">${esc(hex.judgementNote)}</div>` : ''}`)}
    ${section('彖传', `<div class="original-text">${esc(hex.tuan)}</div>${hex.tuanNote ? `<div class="note-text">${esc(hex.tuanNote)}</div>` : ''}`)}
    ${section('大象', `<div class="original-text">${esc(hex.image)}</div>${hex.imageNote ? `<div class="note-text">${esc(hex.imageNote)}</div>` : ''}`)}
    ${relHtml}
    <h3 class="section-title">六爻</h3>
    <div class="yao-list">${lines}</div>
    ${hex.useNine ? section('用九', `<div class="original-text">${esc(hex.useNine)}</div>`) : ''}
    ${hex.useSix ? section('用六', `<div class="original-text">${esc(hex.useSix)}</div>`) : ''}
    ${section('序卦传', `<div class="original-text">${esc(hex.orderRemark)}</div>`)}
  `;

  if (onPickRelation) {
    mountEl.querySelectorAll('.relation-chip').forEach(chip => {
      chip.addEventListener('click', () => onPickRelation(chip.dataset.code));
    });
  }
}

// 八卦基础页
export function renderTrigrams(trigrams, mountEl) {
  const cards = trigrams.map((t) => `
    <div class="tri-card">
      ${trigramSvg(t.binaryCode, { size: 48 })}
      <div class="tri-name">${esc(t.name)}</div>
      <div class="tri-nature">${esc(t.nature)}</div>
    </div>
  `).join('');

  const rows = trigrams.map((t) => `
    <tr>
      <td>${esc(t.name)}</td>
      <td>${esc(t.nature)}</td>
      <td>${esc(t.attribute)}</td>
      <td>${esc(t.direction)}</td>
      <td>${esc(t.familyMember)}</td>
    </tr>`).join('');

  mountEl.innerHTML = `
    <h3>先天八卦</h3>
    <div class="tri-grid">${cards}</div>
    <h3>属性详表</h3>
    <table class="tri-table">
      <thead><tr><th>卦</th><th>自然</th><th>德性</th><th>方位</th><th>家人</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
