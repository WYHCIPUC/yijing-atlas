// 易象图谱入口：模式切换器 + 星图 + 详情抽屉。
import { loadAllData, buildHexagramIndex, searchHexagrams } from './data-loader.js';
import { buildRelationGraph } from './star-relations.js';
import { StarMap } from './star-map.js';
import { renderHexagramDetail } from './render.js';
import { hexagramSvg } from './svg-painter.js';
import { loadReviewCards, initAllCards, getDueCards, getDueCount, saveReview, getMastery } from './review-engine.js';
import { generateQuestion, checkAnswer, addWrong, recordResult, loadStats, generateAlmanacQuestion } from './quiz-engine.js';
import { castHexagram, getReading } from './divination-engine.js';
import { yaoLabel } from './hexagram-utils.js';
import { playHexagramSound, initAudio } from './audio-engine.js';
import { castByNumber, castByTime, analyzeTiYong } from './meihua-engine.js';
import { renderAlmanacPage } from './almanac-page.js';

const reviewCards = loadReviewCards();

const state = { hexagrams: [], trigrams: [], index: null, starMap: null, currentDetail: null };

// === 今日卦 ===
// 按今年第N天对64取模推算今日卦，每天一卦循环
function getDailyHexagram(hexagrams) {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / 86400000);
  const idx = dayOfYear % 64;
  return hexagrams[idx];
}

// 选取一句核心爻辞作为今日箴言
function getDailyVerse(hex) {
  // 优先九五/六五，其次卦辞
  const yao5 = hex.lines.find(y => y.position === 5);
  if (yao5 && yao5.text) {
    const text = yao5.text.replace(/^[^：]*：/, '').replace(/。$/, '');
    return { text, src: `${hex.name}·${yao5.position === 5 ? (yao5.isYang ? '九五' : '六五') : ''}` };
  }
  const j = hex.judgement.replace(/^[^：]*：/, '').replace(/。$/, '');
  return { text: j, src: `${hex.name}·卦辞` };
}

function showDailyHexagram() {
  const hex = getDailyHexagram(state.hexagrams);
  if (!hex) return;
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  document.getElementById('daily-date').textContent = dateStr;
  document.getElementById('daily-hex-svg').innerHTML = hexagramSvg(hex.binaryCode, { size: 100 });
  document.getElementById('daily-hex-name').textContent = hex.name;
  document.getElementById('daily-hex-full').textContent = hex.fullName;
  const verse = getDailyVerse(hex);
  document.getElementById('daily-verse').textContent = `「${verse.text}」`;
  document.getElementById('daily-verse-src').textContent = `—— ${verse.src}`;
  // 进入星图按钮：淡出欢迎层，星图聚焦今日卦
  document.getElementById('daily-enter').addEventListener('click', () => {
    document.getElementById('daily-overlay').classList.add('hidden');
    // 短暂延迟后聚焦今日卦
    setTimeout(() => {
      if (state.starMap) state.starMap.focusStar(hex.binaryCode);
    }, 300);
  });
}

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('star-canvas');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search');

function openDetail(code, fromCode = null) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  renderHexagramDetail(hex, panelContent, state.hexagrams, (relCode) => {
    openDetail(relCode, code); // 关系跳转：记录从哪来
  });
  panel.classList.add('open');
  // 播放卦象音律
  try { playHexagramSound(code); } catch (e) {}
  // 记录漫游轨迹
  if (fromCode && state.starMap) state.starMap.addTrail(fromCode, code);
  state.currentDetail = code;
  state.starMap && state.starMap.focusStar(code);
}

function closeDetail() {
  panel.classList.remove('open');
  state.currentDetail = null;
}

function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  state.starMap && state.starMap.setMode(mode);
  if (mode === 'explore') {
    state.starMap && state.starMap.setReviewDue(null);
    closeDetail();
  } else if (mode === 'review') {
    // 复习模式：初始化复习卡，高亮待复习卦
    initAllCards(reviewCards, state.hexagrams.map(h => h.binaryCode));
    const dueCodes = getDueCards(reviewCards);
    state.starMap && state.starMap.setReviewDue(dueCodes);
    showReviewPanel(dueCodes);
  } else if (mode === 'quiz') {
    // 测验模式
    state.starMap && state.starMap.setReviewDue(null);
    startQuiz();
  } else if (mode === 'divination') {
    state.starMap && state.starMap.setReviewDue(null);
    showDivinationPanel();
  } else if (mode === 'guaxu') {
    state.starMap && state.starMap.setReviewDue(null);
    showGuaxuPanel();
  } else if (mode === 'almanac') {
    state.starMap && state.starMap.setReviewDue(null);
    renderAlmanacPage(panelContent, state);
    panel.classList.add('open');
  } else {
    panelContent.innerHTML = `<div style="padding:60px;text-align:center;color:#7a6a4a">
      <h2 style="color:#a08850;margin-bottom:12px">此模块待开发</h2>
    </div>`;
    panel.classList.add('open');
  }
}

// 复习模式面板：显示待复习列表 + 翻转卡片
function showReviewPanel(dueCodes) {
  const dueHex = dueCodes.map(c => state.index.byCode.get(c)).filter(Boolean);
  panelContent.innerHTML = `
    <div style="padding:36px 26px">
      <h2 style="color:#e8d09a;font-size:1.4rem;margin-bottom:8px">复习</h2>
      <p style="color:#a89878;font-size:0.88rem;margin-bottom:20px">
        今日待复习 <strong style="color:#e8d09a">${dueHex.length}</strong> 卦。
        点击星图上脉冲闪烁的卦开始复习。
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${dueHex.slice(0, 20).map(h => `<span class="relation-chip" data-code="${h.binaryCode}">${h.name}</span>`).join('')}
      </div>
      ${dueHex.length === 0 ? '<p style="color:#888;margin-top:20px">今日无待复习卦。明天再来！</p>' : ''}
    </div>
  `;
  panel.classList.add('open');
  // chip 点击进入翻转卡片复习
  panelContent.querySelectorAll('.relation-chip').forEach(chip => {
    chip.addEventListener('click', () => startReviewCard(chip.dataset.code));
  });
}

// 翻转卡片复习某卦
function startReviewCard(code) {
  const hex = state.index.byCode.get(code);
  if (!hex) return;
  panelContent.innerHTML = `
    <div class="flip-card" id="flip-card">
      <div class="flip-card-inner" id="flip-inner">
        <div class="flip-card-front">
          <div style="color:#888;font-size:0.78rem;margin-bottom:12px">回忆一下这卦</div>
          <div style="font-size:0.9rem;color:#a89878;margin-bottom:8px">第 ${hex.number} 卦 · 下${hex.trigramLower} 上${hex.trigramUpper}</div>
          <div style="color:#5a6680;font-size:0.82rem;margin-top:24px">点击翻转看答案</div>
        </div>
        <div class="flip-card-back">
          ${hexagramSvg(hex.binaryCode, { size: 80 })}
          <div style="font-size:1.6rem;color:#e8d09a;font-family:'Ma Shan Zheng',serif;margin:8px 0">${hex.name} · ${hex.fullName}</div>
          <div style="color:#c9a96a;font-size:0.92rem;line-height:1.7">${hex.judgement || ''}</div>
        </div>
      </div>
    </div>
    <div class="review-rating" id="review-rating" style="display:none">
      <p style="color:#888;font-size:0.82rem;text-align:center;margin-bottom:14px">你记得吗？</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="rate-btn rate-forgot" data-rate="0">忘了</button>
        <button class="rate-btn rate-fuzzy" data-rate="1">模糊</button>
        <button class="rate-btn rate-remember" data-rate="2">记得</button>
      </div>
    </div>
  `;
  // 翻转交互
  const flipCard = document.getElementById('flip-card');
  const flipInner = document.getElementById('flip-inner');
  const rating = document.getElementById('review-rating');
  let flipped = false;
  flipCard.addEventListener('click', () => {
    if (!flipped) {
      flipInner.classList.add('flipped');
      rating.style.display = 'block';
      flipped = true;
    }
  });
  // 评分
  rating.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rate = parseInt(btn.dataset.rate);
      saveReview(reviewCards, code, rate);
      // 返回复习列表
      const dueCodes = getDueCards(reviewCards);
      state.starMap && state.starMap.setReviewDue(dueCodes);
      showReviewPanel(dueCodes);
    });
  });
}

// 测验模式：出题 + 候选选择 + 判题反馈
let currentQuiz = null;
function startQuiz() {
  // 混合出题：80% 卦象题，20% 黄历术语题
  if (state.almanacTerms && state.almanacTerms.length >= 4 && Math.random() < 0.2) {
    currentQuiz = generateAlmanacQuestion(state.almanacTerms);
  } else {
    currentQuiz = generateQuestion(state.hexagrams);
  }
  if (!currentQuiz) { currentQuiz = generateQuestion(state.hexagrams); }
  const isAlmanac = currentQuiz.type === 'almanac';
  const answerHex = isAlmanac ? null : state.index.byCode.get(currentQuiz.answer);
  const stats = loadStats();
  // 选项渲染：卦象题用 binaryCode 查名，术语题用 {text,code}
  const optHtml = isAlmanac
    ? currentQuiz.candidates.map(c => `<button class="quiz-option" data-code="${c.code}">${c.text}</button>`).join('')
    : currentQuiz.candidates.map(c => {
        const h = state.index.byCode.get(c);
        return `<button class="quiz-option" data-code="${c}">${h.name} · ${h.fullName}</button>`;
      }).join('');
  panelContent.innerHTML = `
    <div style="padding:36px 26px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="color:#e8d09a;font-size:1.4rem">测验</h2>
        <span style="color:#888;font-size:0.8rem">正确率 ${stats.correct}/${stats.total}</span>
      </div>
      <div style="background:rgba(201,169,106,0.08);border-radius:8px;padding:20px;margin-bottom:20px;text-align:center">
        <p style="color:#e8d09a;font-size:1.1rem;line-height:1.7">${currentQuiz.question}</p>
      </div>
      <p style="color:#888;font-size:0.8rem;margin-bottom:12px">选择你的答案：</p>
      <div class="quiz-options" id="quiz-options">
        ${optHtml}
      </div>
      <div id="quiz-feedback" style="margin-top:20px"></div>
    </div>
  `;
  panel.classList.add('open');
  // 绑定选项
  panelContent.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const picked = btn.dataset.code;
      const correct = checkAnswer(currentQuiz, picked);
      recordResult(correct);
      if (!correct) addWrong(currentQuiz.targetCode);
      // 高亮对错
      panelContent.querySelectorAll('.quiz-option').forEach(b => {
        if (b.dataset.code === currentQuiz.answer) b.classList.add('quiz-correct');
        else if (b.dataset.code === picked) b.classList.add('quiz-wrong');
        b.disabled = true;
      });
      const fb = document.getElementById('quiz-feedback');
      const answerName = isAlmanac ? (currentQuiz.answerText || '—') : (answerHex ? answerHex.name : '—');
      fb.innerHTML = `
        <p style="text-align:center;font-size:1rem;margin-bottom:12px">
          ${correct ? '<span style="color:#34e89e">✓ 正确！</span>' : '<span style="color:#e94560">✗ 正确答案是「'+answerName+'」</span>'}
        </p>
        <button class="quiz-next" id="quiz-next">下一题 →</button>
      `;
      document.getElementById('quiz-next').addEventListener('click', () => startQuiz());
    });
  });
}

// 占筮模式：金钱卦起卦
function showDivinationPanel() {
  panelContent.innerHTML = `
    <div style="padding:36px 26px;text-align:center">
      <h2 style="color:#e8d09a;font-size:1.4rem;margin-bottom:16px">占筮</h2>
      <div class="divine-tabs">
        <button class="divine-tab active" data-sub="coin">金钱卦</button>
        <button class="divine-tab" data-sub="meihua">梅花易数</button>
      </div>
      <div id="divine-body"></div>
    </div>
  `;
  panel.classList.add('open');
  // 子模式切换
  panelContent.querySelectorAll('.divine-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panelContent.querySelectorAll('.divine-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.sub === 'coin') showCoinDivination();
      else showMeihuaDivination();
    });
  });
  showCoinDivination();
}

// 金钱卦子模式
function showCoinDivination() {
  const body = document.getElementById('divine-body');
  body.innerHTML = `
    <p style="color:#a89878;font-size:0.85rem;margin:20px 0;line-height:1.7">
      三枚铜钱掷六次。<br>心中默念所问之事，静心凝神。
    </p>
    <button class="divine-btn" id="coin-btn">☯ 掷卦</button>
    <div id="coin-result" style="margin-top:20px"></div>
  `;
  document.getElementById('coin-btn').addEventListener('click', () => {
    performDivination(document.getElementById('coin-result'));
  });
}

// 梅花易数子模式
function showMeihuaDivination() {
  const body = document.getElementById('divine-body');
  const now = new Date();
  body.innerHTML = `
    <p style="color:#a89878;font-size:0.82rem;margin:16px 0;line-height:1.6">
      邵康节所传，以数起卦，体用断吉凶。
    </p>
    <div style="margin-bottom:16px">
      <p style="color:#888;font-size:0.8rem;margin-bottom:8px">数字起卦（输入两个数）</p>
      <div style="display:flex;gap:10px;justify-content:center;align-items:center">
        <input type="number" id="mh-upper" class="mh-input" placeholder="上数" value="${Math.floor(Math.random()*99)+1}">
        <span style="color:#888">·</span>
        <input type="number" id="mh-lower" class="mh-input" placeholder="下数" value="${Math.floor(Math.random()*99)+1}">
        <button class="mh-btn" id="mh-cast">起卦</button>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <button class="mh-btn" id="mh-time">🕐 以当前时间起卦</button>
    </div>
    <div id="mh-result"></div>
  `;
  document.getElementById('mh-cast').addEventListener('click', () => {
    const u = parseInt(document.getElementById('mh-upper').value) || 1;
    const l = parseInt(document.getElementById('mh-lower').value) || 1;
    performMeihua(castByNumber(u, l));
  });
  document.getElementById('mh-time').addEventListener('click', () => {
    performMeihua(castByTime(now));
  });
}

// 执行梅花易数断卦并显示
function performMeihua(cast) {
  const primaryHex = state.index.byCode.get(cast.primaryCode);
  const changedHex = state.index.byCode.get(cast.changedCode);
  const ty = analyzeTiYong(cast);
  // 星图高亮
  state.starMap && state.starMap.focusStar(cast.primaryCode);
  // 关系颜色
  const relColors = {
    yongshengti: '#34e89e', tikeyong: '#c9a96a', bihe: '#8d6e63',
    tishengyong: '#e0a060', yongketi: '#e94560',
  };
  const relColor = relColors[ty.relation] || '#888';
  document.getElementById('mh-result').innerHTML = `
    <div style="background:rgba(201,169,106,0.08);border-radius:8px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-around;align-items:center;margin-bottom:8px">
        <div style="text-align:center">
          <div style="color:#e8d09a;font-size:1.3rem;font-family:'Ma Shan Zheng',serif">${primaryHex.name}</div>
          <div style="color:#888;font-size:0.72rem">${primaryHex.fullName}</div>
          <div style="color:#666;font-size:0.68rem">本卦</div>
        </div>
        <span style="color:#666;font-size:1.2rem">→</span>
        <div style="text-align:center">
          <div style="color:#34e89e;font-size:1.3rem;font-family:'Ma Shan Zheng',serif">${changedHex.name}</div>
          <div style="color:#888;font-size:0.72rem">${changedHex.fullName}</div>
          <div style="color:#666;font-size:0.68rem">变卦（第${cast.changingPos}爻动）</div>
        </div>
      </div>
    </div>
    <div style="background:${relColor}15;border:1px solid ${relColor}40;border-radius:8px;padding:16px;margin-bottom:12px">
      <p style="color:#888;font-size:0.75rem;margin-bottom:8px">体用分析（${cast.source}）</p>
      <div style="display:flex;justify-content:space-around;margin-bottom:10px">
        <div style="text-align:center">
          <div style="color:${relColor};font-size:1rem;font-weight:bold">体（${ty.bodyPos}）</div>
          <div style="color:#c9a96a;font-size:0.85rem">${ty.bodyWuxingName}</div>
        </div>
        <div style="text-align:center">
          <div style="color:#888;font-size:1rem">用（${ty.usePos}）</div>
          <div style="color:#a89878;font-size:0.85rem">${ty.useWuxingName}</div>
        </div>
      </div>
      <p style="color:${relColor};font-size:0.95rem;text-align:center;font-weight:600;margin-bottom:6px">${ty.relationName}</p>
      <p style="color:#bbb;font-size:0.85rem;line-height:1.7">${ty.verdict}</p>
    </div>
    <p style="color:#666;font-size:0.72rem;text-align:center;margin-top:8px">
      动爻：第${cast.changingPos}爻 ·
      ${primaryHex.lines[cast.changingPos-1] ? primaryHex.lines[cast.changingPos-1].text : ''}
    </p>
  `;
}

function performDivination(targetEl) {
  const cast = castHexagram();
  const primaryHex = state.index.byCode.get(cast.primaryCode);
  const changedHex = cast.hasChange ? state.index.byCode.get(cast.changedCode) : null;
  const reading = getReading(cast, primaryHex, changedHex);

  // 在星图上高亮本卦和变卦
  state.starMap && state.starMap.focusStar(cast.primaryCode);
  const el = targetEl || document.getElementById('divine-result');

  const yaosHtml = cast.yaos.map((y, i) => {
    const label = yaoLabel(i + 1, y.isYang);
    const dot = y.isYang ? '▬' : '▬ ▬';
    const changeMark = y.changing ? ' <span style="color:#e94560">○变</span>' : '';
    return `<div style="color:${y.changing?'#e94560':'#c9a96a'};font-size:1rem;margin:2px 0">${dot} ${label}${changeMark} (${y.name})</div>`;
  }).reverse().join('');

  el.innerHTML = `
    <div style="background:rgba(201,169,106,0.08);border-radius:8px;padding:20px;margin-bottom:16px">
      ${yaosHtml}
    </div>
    <div style="margin-bottom:16px">
      <span style="color:#e8d09a;font-size:1.2rem">${primaryHex.name}（${primaryHex.fullName}）</span>
      ${cast.hasChange ? `<span style="color:#888;margin:0 8px">→</span><span style="color:#34e89e;font-size:1.2rem">${changedHex.name}（${changedHex.fullName}）</span>` : ''}
    </div>
    <div style="background:rgba(52,232,158,0.05);border-radius:8px;padding:16px;margin-bottom:12px">
      <p style="color:#888;font-size:0.78rem;margin-bottom:8px">${reading.rule}</p>
      ${reading.readings.map(r => `
        <p style="color:#a89878;font-size:0.8rem;margin-bottom:4px">${r.src}</p>
        <p style="color:#e8d09a;font-size:1rem;line-height:1.8;margin-bottom:10px">${r.text}</p>
      `).join('')}
    </div>
    <button class="divine-btn" id="divine-again" style="font-size:0.88rem;padding:8px 24px">再掷一卦</button>
  `;
  document.getElementById('divine-again').addEventListener('click', () => performDivination(el));
}

// 卦序长河：64卦按周易顺序排成时间线，序卦传串讲
function showGuaxuPanel() {
  const sorted = [...state.hexagrams].sort((a, b) => a.number - b.number);
  panelContent.innerHTML = `
    <div style="padding:36px 22px">
      <h2 style="color:#e8d09a;font-size:1.4rem;margin-bottom:8px">卦序长河</h2>
      <p style="color:#a89878;font-size:0.85rem;margin-bottom:24px;line-height:1.7">
        序卦传述说六十四卦的演化逻辑——从天地创生，到万物萌发，再到既济未济的循环。
        点击任一卦进入星图。
      </p>
      <div class="guaxu-river">
        ${sorted.map(h => `
          <div class="guaxu-node" data-code="${h.binaryCode}">
            <div class="guaxu-num">${h.number}</div>
            <div class="guaxu-name">${h.name}</div>
            <div class="guaxu-remark">${h.orderRemark ? h.orderRemark.slice(0, 12) : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  panel.classList.add('open');
  panelContent.querySelectorAll('.guaxu-node').forEach(node => {
    node.addEventListener('click', () => {
      // 切回探索模式并打开详情
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'explore'));
      state.starMap && state.starMap.setMode('explore');
      openDetail(node.dataset.code);
    });
  });
}

async function init() {
  try {
    const data = await loadAllData();
    state.hexagrams = data.hexagrams;
    state.trigrams = data.trigrams;
    state.almanacTerms = data.almanacTerms;
    state.almanacYiji = data.almanacYiji;
    state.index = buildHexagramIndex(data.hexagrams);

    const graph = buildRelationGraph(data.hexagrams);
    state.starMap = new StarMap(canvas, graph, {
      onPick: (code) => openDetail(code),
      onHover: (code) => {},
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    searchInput.addEventListener('input', (e) => {
      const kw = e.target.value.trim();
      if (!kw) return;
      const results = searchHexagrams(state.hexagrams, kw);
      if (results.length > 0) {
        state.starMap.focusStar(results[0].binaryCode);
      }
    });
    window.addEventListener('resize', () => state.starMap && state.starMap.resize());

    // 缩放控件
    const zoomLevel = document.getElementById('zoom-level');
    const updateZoom = () => { if (zoomLevel) zoomLevel.textContent = state.starMap.getZoomPercent() + '%'; };
    document.getElementById('zoom-in').addEventListener('click', () => { state.starMap.zoomBy(1.25); updateZoom(); });
    document.getElementById('zoom-out').addEventListener('click', () => { state.starMap.zoomBy(0.8); updateZoom(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { state.starMap.zoomReset(); updateZoom(); });
    document.getElementById('trail-clear').addEventListener('click', () => { state.starMap.clearTrail(); state.starMap.clearFocus(); });
    // 滚轮缩放也实时更新百分比
    canvas.addEventListener('wheel', () => setTimeout(updateZoom, 50), { passive: true });

    loadingEl.style.display = 'none';
    // 显示今日卦首页
    showDailyHexagram();
  } catch (e) {
    loadingEl.innerHTML = `⚠ 数据加载失败：${e.message}`;
    loadingEl.classList.remove('loading-screen');
    loadingEl.classList.add('error-screen');
    console.error(e);
  }
}

init();
