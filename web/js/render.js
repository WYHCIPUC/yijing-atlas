// 渲染层：把领域数据渲染为 HTML。纯函数，输入数据 + 挂载点。
import { hexagramSvg, trigramSvg } from './svg-painter.js';
import { yaoLabel } from './hexagram-utils.js';

// HTML 转义，防注入
function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// 卦象详情
export function renderHexagramDetail(hex, mountEl) {
  // 自上而下展示（上九→初九），符合阅读习惯
  const lines = [...hex.lines].reverse()
    .map((y) => {
      if (!y.text && !y.xiang) {
        return `<div class="yao yao-empty"><span class="yao-label">${esc(yaoLabel(y.position, y.isYang))}</span>（经文待补）</div>`;
      }
      return `
        <details class="yao">
          <summary><span class="yao-label">${esc(yaoLabel(y.position, y.isYang))}</span> ${esc(y.text)}</summary>
          ${y.xiang ? `<div class="yao-xiang">象曰：${esc(y.xiang)}</div>` : ''}
        </details>`;
    }).join('');

  const section = (title, body) =>
    body ? `<section class="hex-section"><h4>${esc(title)}</h4><p>${esc(body)}</p></section>` : '';

  mountEl.innerHTML = `
    <div class="detail-view">
      <div class="detail-header">
        ${hexagramSvg(hex.binaryCode, { size: 140 })}
        <h2>${hex.number}.${esc(hex.name)} · ${esc(hex.fullName)}</h2>
      </div>
      ${section('卦辞', hex.judgement)}
      ${section('彖传', hex.tuan)}
      ${section('大象', hex.image)}
      <hr/>
      <div class="yao-list">${lines}</div>
      ${section('用九', hex.useNine)}
      ${section('用六', hex.useSix)}
      <hr/>
      ${section('序卦传', hex.orderRemark)}
    </div>`;
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
