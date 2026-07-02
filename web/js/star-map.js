// 结构约束的力导向 64 卦星图：8 纯卦作骨架锚点 + Canvas 渲染 + 动效。
// 卦的空间位置编码易学含义：每卦被它的上下卦锚点吸引，错卦连线穿过中心对称。
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY } from '../lib/d3-force.js';
import { allRelations } from './hexagram-utils.js';

// 先天八卦方位角（弧度），0=右(东)，顺时针。乾南=上。
// 乾(南/上) 兑(东南) 离(东) 震(东北) 巽(西南) 坎(西) 艮(西北) 坤(北/下)
const TRIGRAM_ANGLE = {
  '111': -Math.PI / 2,        // 乾 上(南)
  '110': -Math.PI / 4,        // 兑 东南
  '101': 0,                   // 离 东(右)
  '100': Math.PI / 4,         // 震 东北
  '011': -3 * Math.PI / 4,    // 巽 西南
  '010': Math.PI,             // 坎 西(左)
  '001': 3 * Math.PI / 4,     // 艮 西北
  '000': Math.PI / 2,         // 坤 下(北)
};

const COLORS = {
  star: '#8a7a5a',
  starHover: '#e8d09a',
  starActive: '#c9a96a',
  anchor: '#d4a574',
  text: '#e8d09a',
};

export class StarMap {
  constructor(canvas, graph, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graph = graph;
    this.callbacks = callbacks;

    this.view = { x: 0, y: 0, scale: 1 };
    this.hoveredNode = null;
    this.activeNode = null;
    this.isDragging = false;
    this.dragStart = null;
    this.rotation = 0;
    this.autoRotate = true;
    this.mode = 'explore';
    this.time = 0;
    this.meteors = [];
    this.nextMeteorAt = 150;
    this.appearProgress = 0;

    this._setupDpr();
    this._initBackground();
    this._initLayout();
    this._bindEvents();
    this._startRenderLoop();
  }

  _setupDpr() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    // 锚点圆半径（8 纯卦所在的圆）
    this.anchorR = Math.min(this.width, this.height) * 0.32;
  }

  // 背景星 + 星云
  _initBackground() {
    const area = this.width * this.height;
    this.bgStars = [];
    const layers = [
      { count: Math.floor(area / 350), rMin: 0.3, rMax: 0.8, aMin: 0.06, aMax: 0.22 },
      { count: Math.floor(area / 2200), rMin: 0.6, rMax: 1.3, aMin: 0.18, aMax: 0.45 },
      { count: Math.floor(area / 10000), rMin: 1.0, rMax: 1.8, aMin: 0.4, aMax: 0.72 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const roll = Math.random();
        const hue = roll < 0.12 ? 'warm' : (roll < 0.22 ? 'cool' : 'gold');
        this.bgStars.push({
          x: Math.random() * this.width, y: Math.random() * this.height,
          r: layer.rMin + Math.random() * (layer.rMax - layer.rMin),
          baseAlpha: layer.aMin + Math.random() * (layer.aMax - layer.aMin),
          twinkleSpeed: Math.random() * 0.015 + 0.003,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleAmp: 0.3 + Math.random() * 0.4,
          hue,
        });
      }
    }
    this.nebulae = [
      { bx: this.width * 0.28, by: this.height * 0.42, dr: 40, ds: 0.0003, dp: 0, r: this.width * 0.28, color: 'rgba(80, 65, 120, 0.05)' },
      { bx: this.width * 0.72, by: this.height * 0.58, dr: 55, ds: 0.0002, dp: 1.5, r: this.width * 0.32, color: 'rgba(120, 95, 55, 0.045)' },
      { bx: this.width * 0.5, by: this.height * 0.18, dr: 35, ds: 0.0004, dp: 3, r: this.width * 0.22, color: 'rgba(55, 75, 115, 0.04)' },
      { bx: this.width * 0.6, by: this.height * 0.85, dr: 45, ds: 0.00025, dp: 4.5, r: this.width * 0.26, color: 'rgba(95, 75, 100, 0.035)' },
    ];
  }

  // 结构约束布局：8 纯卦为锚点 + 其余卦被上下卦锚点吸引
  _initLayout() {
    // 标记纯卦并计算锚点目标位置
    for (const n of this.graph.nodes) {
      const lower = n.binaryCode.slice(0, 3);
      const upper = n.binaryCode.slice(3, 6);
      n.isPure = lower === upper;
      // 锚点目标（纯卦）或引力中心（普通卦：上下卦锚点的中点方向）
      if (n.isPure) {
        const ang = TRIGRAM_ANGLE[lower];
        n.targetX = this.cx + Math.cos(ang) * this.anchorR;
        n.targetY = this.cy + Math.sin(ang) * this.anchorR;
      } else {
        // 普通卦：被下卦和上卦锚点双向吸引，目标在两者之间
        const lang = TRIGRAM_ANGLE[lower];
        const uang = TRIGRAM_ANGLE[upper];
        const lx = this.cx + Math.cos(lang) * this.anchorR;
        const ly = this.cy + Math.sin(lang) * this.anchorR;
        const ux = this.cx + Math.cos(uang) * this.anchorR;
        const uy = this.cy + Math.sin(uang) * this.anchorR;
        n.targetX = (lx + ux) / 2;
        n.targetY = (ly + uy) / 2;
      }
      // 初始随机位置（从中心扩散）
      n.x = this.cx + (Math.random() - 0.5) * 100;
      n.y = this.cy + (Math.random() - 0.5) * 100;
      n.vx = 0; n.vy = 0;
    }

    // 用 d3-force：节点斥力 + 强力 X/Y 定位（拉向 targetX/Y）+ 弱连线
    const nodeById = new Map(this.graph.nodes.map((n, i) => [n.id, i]));
    const links = this.graph.edges
      .filter(e => e.types.includes('opposite') || e.types.includes('reversed'))
      .map(e => ({ source: nodeById.get(e.source), target: nodeById.get(e.target), weight: e.weight }));

    this.simulation = forceSimulation(this.graph.nodes)
      .force('charge', forceManyBody().strength(-60))
      .force('link', forceLink(links).id(d => d.index).distance(80).strength(0.08))
      .force('xA', forceX(d => d.targetX).strength(d => d.isPure ? 1 : 0.25))
      .force('yA', forceY(d => d.targetY).strength(d => d.isPure ? 1 : 0.25))
      .alphaDecay(0.015);
  }

  _worldToScreen(wx, wy) {
    const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
    const rx = (wx - this.cx) * cos - (wy - this.cy) * sin;
    const ry = (wx - this.cx) * sin + (wy - this.cy) * cos;
    return { x: rx * this.view.scale + this.cx + this.view.x, y: ry * this.view.scale + this.cy + this.view.y };
  }

  _nodeAt(sx, sy) {
    const r = Math.max(8, 10 * this.view.scale);
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      if (Math.hypot(p.x - sx, p.y - sy) < r) return n;
    }
    return null;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = this._nodeAt(sx, sy);
      if (node) {
        this.callbacks.onPick && this.callbacks.onPick(node.id);
      } else {
        this.isDragging = true;
        this.dragStart = { x: sx, y: sy, vx: this.view.x, vy: this.view.y };
      }
    });
    c.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (this.isDragging) {
        this.view.x = this.dragStart.vx + (sx - this.dragStart.x);
        this.view.y = this.dragStart.vy + (sy - this.dragStart.y);
        this.autoRotate = false;
      } else {
        const node = this._nodeAt(sx, sy);
        if (node !== this.hoveredNode) {
          this.hoveredNode = node;
          c.style.cursor = node ? 'pointer' : 'grab';
          this.callbacks.onHover && this.callbacks.onHover(node ? node.id : null);
        }
      }
    });
    c.addEventListener('mouseup', () => { this.isDragging = false; });
    c.addEventListener('mouseleave', () => { this.isDragging = false; this.hoveredNode = null; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.view.scale = Math.max(0.3, Math.min(3, this.view.scale * factor));
    }, { passive: false });
  }

  _startRenderLoop() {
    const loop = () => {
      this.time += 1;
      if (this.autoRotate) this.rotation += 0.0006;
      if (this.appearProgress < 1) this.appearProgress = Math.min(1, this.appearProgress + 0.006);
      for (const neb of this.nebulae) {
        neb.x = neb.bx + Math.cos(this.time * neb.ds + neb.dp) * neb.dr;
        neb.y = neb.by + Math.sin(this.time * neb.ds + neb.dp) * neb.dr;
      }
      this._updateMeteors();
      this._render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _updateMeteors() {
    if (this.time >= this.nextMeteorAt) {
      const fromTop = Math.random() < 0.5;
      this.meteors.push({
        x: fromTop ? Math.random() * this.width : -50,
        y: fromTop ? -50 : Math.random() * this.height * 0.6,
        angle: (fromTop ? Math.PI / 4 : Math.PI / 6) + (Math.random() - 0.5) * 0.3,
        speed: 8 + Math.random() * 6, life: 0, maxLife: 60 + Math.random() * 40, length: 80 + Math.random() * 60,
      });
      this.nextMeteorAt = this.time + 180 + Math.floor(Math.random() * 300);
    }
    for (const m of this.meteors) {
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life++;
    }
    this.meteors = this.meteors.filter(m => m.life < m.maxLife && m.x < this.width + 100 && m.y < this.height + 100);
  }

  _render() {
    const ctx = this.ctx;
    const t = this.time;

    // 第一层：深空径向渐变
    const bgGrad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.width, this.height) * 0.75);
    bgGrad.addColorStop(0, '#111a30');
    bgGrad.addColorStop(0.5, '#0a0f1e');
    bgGrad.addColorStop(1, '#05070f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 第二层：星云尘埃（漂移）
    for (const neb of this.nebulae) {
      const ng = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      ng.addColorStop(0, neb.color);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 第三层：远景星点（闪烁）
    for (const s of this.bgStars) {
      const tw = Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      const alpha = s.baseAlpha * (1 - s.twinkleAmp + s.twinkleAmp * (0.5 + 0.5 * tw));
      let r, g, b;
      if (s.hue === 'warm') { r = 220; g = 170; b = 130; }
      else if (s.hue === 'cool') { r = 170; g = 195; b = 230; }
      else { r = 215; g = 200; b = 165; }
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 流星
    this._renderMeteors(ctx);

    // 第四层：关系边
    const focus = this.hoveredNode || this.activeNode;
    const focusRels = focus ? new Set([focus.id, ...this._relationTargets(focus.id)]) : null;
    const nodeById = new Map(this.graph.nodes.map(n => [n.id, n]));
    for (const e of this.graph.edges) {
      const s = nodeById.get(e.source), tn = nodeById.get(e.target);
      if (!s || !tn) continue;
      const sp = this._worldToScreen(s.x, s.y);
      const tp = this._worldToScreen(tn.x, tn.y);
      const isActive = focusRels && focusRels.has(e.source) && focusRels.has(e.target) &&
        (e.source === focus.id || e.target === focus.id);
      if (isActive) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(201,169,106,0.16)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        grad.addColorStop(0, 'rgba(245,230,192,0.9)');
        grad.addColorStop(0.5, 'rgba(216,184,120,0.65)');
        grad.addColorStop(1, 'rgba(245,230,192,0.9)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -t * 0.4;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const baseA = focus ? 0.02 : 0.04;
        const pulse = baseA + 0.012 * Math.sin(t * 0.008 + e.source.charCodeAt(0) * 0.3);
        ctx.strokeStyle = `rgba(120,105,75,${pulse})`;
        ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      }
    }

    // 第五层：卦星（光晕 + 入场动画）
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.graph.nodes) {
      const delay = (n.number - 1) / 64 * 0.5;
      const localP = Math.max(0, Math.min(1, (this.appearProgress - delay) / 0.4));
      if (localP <= 0) continue;
      const ease = localP * localP * (3 - 2 * localP);
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      const breathe = 0.85 + 0.15 * Math.sin(t * 0.022 + n.binaryCode.charCodeAt(0) + n.binaryCode.charCodeAt(3));
      const degFactor = Math.min(n.degree / 13, 1);
      const baseR = n.isPure ? 5 : (isFocus ? 6.5 : (isRel ? 4.5 : 1.8 + degFactor * 3));
      const r = baseR * breathe * ease;

      // 外光晕
      const haloR = (isFocus ? 60 : (isRel ? 38 : (n.isPure ? 26 : 16 + degFactor * 24))) * ease;
      const haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      if (isFocus) {
        haloGrad.addColorStop(0, 'rgba(245,230,192,0.35)');
        haloGrad.addColorStop(0.2, 'rgba(232,208,154,0.18)');
        haloGrad.addColorStop(0.5, 'rgba(201,169,106,0.06)');
      } else if (isRel) {
        haloGrad.addColorStop(0, 'rgba(232,208,154,0.28)');
        haloGrad.addColorStop(0.25, 'rgba(201,169,106,0.12)');
      } else if (n.isPure) {
        haloGrad.addColorStop(0, 'rgba(212,165,116,0.22)');
        haloGrad.addColorStop(0.3, 'rgba(160,136,80,0.06)');
      } else {
        haloGrad.addColorStop(0, `rgba(216,184,120,${0.16 + degFactor * 0.14})`);
        haloGrad.addColorStop(0.3, 'rgba(160,136,80,0.04)');
      }
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 亮核光晕
      const coreGlowR = r * 3;
      const cgGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreGlowR);
      const coreA = isFocus ? 0.9 : (isRel ? 0.7 : (n.isPure ? 0.65 : 0.5 + degFactor * 0.3));
      cgGrad.addColorStop(0, `rgba(255,248,220,${coreA})`);
      cgGrad.addColorStop(0.4, `rgba(232,208,154,${coreA * 0.4})`);
      cgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cgGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreGlowR, 0, Math.PI * 2);
      ctx.fill();

      // 实心核
      const coreColor = isFocus ? 'rgba(255,252,240,1)' : (isRel ? 'rgba(252,240,205,1)' : (n.isPure ? 'rgba(245,220,160,0.95)' : `rgba(232,208,154,${0.85 + degFactor * 0.15})`));
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // 卦名标签：8 纯卦常显书法大字 + focus 星显示
    // 书法字体优先 Ma Shan Zheng（马善政体），降级 ZCOOL XiaoWei，再降级衬线
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 先画 8 纯卦的书法大字（常显，淡金，给星系命名感）
    for (const n of this.graph.nodes) {
      if (!n.isPure) continue;
      const delay = (n.number - 1) / 64 * 0.5;
      const localP = Math.max(0, Math.min(1, (this.appearProgress - delay) / 0.4));
      if (localP <= 0) continue;
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      // 纯卦字大、淡金；focus 时更亮更大
      const fontSize = isFocus ? 34 : 26;
      const alpha = isFocus ? 1 : (0.5 + 0.15 * Math.sin(this.time * 0.01 + n.binaryCode.charCodeAt(0)));
      ctx.font = `${fontSize}px "Ma Shan Zheng", "ZCOOL XiaoWei", "STKaiti", "KaiTi", serif`;
      ctx.fillStyle = isFocus ? 'rgba(255,240,200,1)' : `rgba(212,165,116,${alpha})`;
      ctx.fillText(n.name, p.x, p.y - 40);
    }
    // focus 星若非纯卦，也显示其名（较小）
    if (focus && !focus.isPure) {
      const p = this._worldToScreen(focus.x, focus.y);
      ctx.font = '24px "Ma Shan Zheng", "ZCOOL XiaoWei", "STKaiti", "KaiTi", serif';
      ctx.fillStyle = 'rgba(255,240,200,1)';
      ctx.fillText(focus.name, p.x, p.y - 45);
    }
  }

  _renderMeteors(ctx) {
    if (this.meteors.length === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.meteors) {
      const fadeIn = Math.min(1, m.life / 8);
      const fadeOut = Math.min(1, (m.maxLife - m.life) / 15);
      const alpha = fadeIn * fadeOut;
      const tx = m.x - Math.cos(m.angle) * m.length;
      const ty = m.y - Math.sin(m.angle) * m.length;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255,248,220,${alpha * 0.9})`);
      grad.addColorStop(0.3, `rgba(232,208,154,${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(201,169,106,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 6);
      hg.addColorStop(0, `rgba(255,252,240,${alpha})`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _relationTargets(code) {
    const rels = allRelations(code);
    return [rels.opposite, rels.reversed, rels.interlocking, ...rels.changing];
  }

  focusStar(code) {
    const node = this.graph.nodes.find(n => n.id === code);
    if (!node) return;
    this.activeNode = node;
    this.autoRotate = false;
    const p = this._worldToScreen(node.x, node.y);
    this.view.x += (this.cx - p.x);
    this.view.y += (this.cy - p.y);
  }

  setMode(mode) { this.mode = mode; }

  resize() {
    this._setupDpr();
    this.simulation.force('xA', forceX(d => d.targetX).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.force('yA', forceY(d => d.targetY).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.alpha(0.3).restart();
  }
}
