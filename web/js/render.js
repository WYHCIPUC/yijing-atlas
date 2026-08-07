// 渲染层：把领域数据渲染为 HTML。纯函数，输入数据 + 挂载点。
import { hexagramSvg, trigramSvg } from './svg-painter.js';
import { yaoLabel, allRelations } from './hexagram-utils.js';
import { showEvolutionLab } from './evolution-lab.js';
import { showRelationAnimation } from './relation-animation.js';
import { isPlainObject, readJson, writeJson } from './storage.js';

// HTML 转义，防注入
function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 八卦二进制码 → 名称/自然属性映射
const TRIGRAM_NAMES = {
  '111': { name: '乾', nature: '天' },
  '110': { name: '兑', nature: '泽' },
  '101': { name: '离', nature: '火' },
  '100': { name: '震', nature: '雷' },
  '011': { name: '巽', nature: '风' },
  '010': { name: '坎', nature: '水' },
  '001': { name: '艮', nature: '山' },
  '000': { name: '坤', nature: '地' },
};

// 把二进制码转成八卦标签，如 "111" → "乾(天)"；未知码原样返回
function trigramLabel(code) {
  const t = TRIGRAM_NAMES[code];
  return t ? `${t.name}(${t.nature})` : code;
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

  const section = (title, body, className = '') =>
    body ? `<section class="detail-section ${className}">
      <h3 class="section-title">${esc(title)}</h3>
      ${body}
    </section>` : '';

  const rels = allRelations(hex.binaryCode);
  const relChip = (label, code) =>
    `<button type="button" class="relation-chip" data-code="${esc(code)}">${esc(label)}→${esc(codeToName(code, hexagrams))}</button>`;
  // 关系说明 + 演示按钮
  const relExplain = (type, name, desc, code) =>
    `<div class="rel-explain">
      <span class="rel-type rel-${type}">${name}</span>
      <span class="rel-desc">${desc}</span>
      <button class="rel-demo-btn" type="button" data-rel="${type}" data-code="${esc(code)}" aria-haspopup="dialog" aria-label="演示${name}变化">演示</button>
    </div>`;
  const changingRelation = (code, index) => `
    <span class="rel-changing-item">
      ${relChip(`第${index + 1}爻`, code)}
      <button class="rel-demo-btn" type="button" data-rel="changing" data-code="${esc(code)}" aria-haspopup="dialog" aria-label="演示第${index + 1}爻变卦">演示</button>
    </span>`;
  const relHtml = `
    <section class="detail-section relation-section">
    <h3 class="section-title">它如何变</h3>
    <div class="rel-list">
      ${relExplain('opposite', '错卦', `阴阳全换。${esc(hex.name)}之对极为「${esc(codeToName(rels.opposite, hexagrams))}」。`, rels.opposite)}
      ${relExplain('reversed', '综卦', `上下倒转。${esc(hex.name)}倒看为「${esc(codeToName(rels.reversed, hexagrams))}」。`, rels.reversed)}
      ${relExplain('interlocking', '互卦', `取2-3-4/3-4-5爻。${esc(hex.name)}内含「${esc(codeToName(rels.interlocking, hexagrams))}」。`, rels.interlocking)}
    </div>
    <p class="rel-changing-hint">点击卦名跳转 · 点击「演示」观看变化动画</p>
    <div class="relation-chips">
      ${relChip('错→', rels.opposite)}
      ${relChip('综→', rels.reversed)}
      ${relChip('互→', rels.interlocking)}
    </div>
    <p class="rel-changing-hint">变卦（动爻）：</p>
    <div class="relation-chips">${rels.changing.map(changingRelation).join('')}</div>
    <div class="evolution-launch-card">
      <div>
        <strong>自己动手推演</strong>
        <span>切换任意爻，实时查看结果卦与变化说明。</span>
      </div>
      <button type="button" class="evolution-launch">进入演变实验室</button>
    </div>
    </section>
  `;

  mountEl.innerHTML = `
    <div class="detail-header">
      <div class="detail-symbol">${hexagramSvg(hex.binaryCode, { size: 140 })}</div>
      <div class="detail-heading-copy">
        <div class="detail-kicker">第 ${hex.number} 卦 · ${esc(hex.binaryCode)}</div>
        <h1 tabindex="-1">${esc(hex.name)} · ${esc(hex.fullName)}</h1>
        <div class="subtitle">下${esc(trigramLabel(hex.trigramLower))} · 上${esc(trigramLabel(hex.trigramUpper))}</div>
        <div class="detail-actions">
          <button type="button" class="text-button share-hexagram" data-code="${esc(hex.binaryCode)}">生成分享图片</button>
          <span class="share-status" role="status" aria-live="polite"></span>
        </div>
      </div>
    </div>
    ${hex.scenario ? section('今日处境', `<div class="scenario-text">${esc(hex.scenario)}</div>`) : ''}
    ${section('卦辞', `<div class="original-text">${esc(hex.judgement)}</div>${hex.judgementNote ? `<div class="note-text">${esc(hex.judgementNote)}</div>` : ''}`)}
    ${section('彖传', `<div class="original-text">${esc(hex.tuan)}</div>${hex.tuanNote ? `<div class="note-text">${esc(hex.tuanNote)}</div>` : ''}`)}
    ${section('大象', `<div class="original-text">${esc(hex.image)}</div>${hex.imageNote ? `<div class="note-text">${esc(hex.imageNote)}</div>` : ''}`)}
    ${relHtml}
    <section class="detail-section yao-section">
      <h3 class="section-title yao-collapse-toggle" id="yao-toggle">六爻<span class="toggle-arrow">▶</span></h3>
      <div class="yao-list yao-collapse-body" id="yao-body">${lines}</div>
    </section>
    ${hex.useNine ? section('用九', `<div class="original-text">${esc(hex.useNine)}</div>`) : ''}
    ${hex.useSix ? section('用六', `<div class="original-text">${esc(hex.useSix)}</div>`) : ''}
    ${section('序卦传', `<div class="original-text">${esc(hex.orderRemark)}</div>`)}
    <section class="detail-section notes-section">
      <h3 class="section-title">我的笔记</h3>
      <textarea class="note-input" id="note-input" placeholder="写下你对这一卦的理解…" data-code="${esc(hex.binaryCode)}"></textarea>
      <button class="note-save" id="note-save">保存笔记</button>
    </section>
  `;

  // 六爻折叠交互
  const yaoToggle = mountEl.querySelector('#yao-toggle');
  const yaoBody = mountEl.querySelector('#yao-body');
  if (yaoToggle && yaoBody) {
    yaoToggle.addEventListener('click', () => {
      yaoToggle.classList.toggle('open');
      yaoBody.classList.toggle('open');
    });
  }

  if (onPickRelation) {
    mountEl.querySelectorAll('.relation-chip').forEach(chip => {
      chip.addEventListener('click', () => onPickRelation(chip.dataset.code));
    });
  }

  // 关系演示按钮：弹出阴阳流变动画
  mountEl.querySelectorAll('.rel-demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const relType = btn.dataset.rel;
      const toCode = btn.dataset.code;
      const toName = codeToName(toCode, hexagrams);
      const toHex = hexagrams.find(h => h.binaryCode === toCode);
      showRelationAnimation(hex.binaryCode, toCode, relType, hex.name, toName, hex, toHex);
    });
  });

  mountEl.querySelector('.evolution-launch')?.addEventListener('click', () => {
    showEvolutionLab(hex, hexagrams, onPickRelation);
  });

  // 个人笔记：加载已有笔记 + 绑定保存
  const noteInput = mountEl.querySelector('#note-input');
  const noteSave = mountEl.querySelector('#note-save');
  if (noteInput && noteSave) {
    const notes = readJson('yijing-notes', {}, isPlainObject);
    noteInput.value = typeof notes[hex.binaryCode] === 'string' ? notes[hex.binaryCode] : '';
    noteSave.addEventListener('click', () => {
      const currentNotes = readJson('yijing-notes', {}, isPlainObject);
      currentNotes[hex.binaryCode] = noteInput.value;
      if (writeJson('yijing-notes', currentNotes).ok) {
        noteSave.textContent = '已保存 ✓';
        setTimeout(() => { noteSave.textContent = '保存笔记'; }, 1500);
      } else {
        noteSave.textContent = '保存失败';
      }
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
