// 力导向 64 卦星图：Canvas 渲染 + d3-force 物理模拟 + 交互。
import { forceSimulation, forceLink, forceManyBody, forceCenter } from '../lib/d3-force.js';
import { allRelations } from './hexagram-utils.js';

// 墨空鎏金配色
const COLORS = {
  bg: '#0a0e1a',
  star: '#8a7a5a',
  starHover: '#e8d09a',
  starActive: '#c9a96a',
  edge: 'rgba(201, 169, 106, 0.15)',
  edgeActive: '#c9a96a',
  glow: 'rgba(201, 169, 106, 0.35)',
  text: '#c9a96a',
  textDim: '#5a6680',
};

export class StarMap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ nodes: Array, edges: Array }} graph - buildRelationGraph 的输出
   * @param {Object} callbacks - { onPick(code), onHover(code|null) }
   */
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
    this.time = 0; // 用于呼吸/流动动画

    this._setupDpr();
    this._initBackgroundStars(); // 银河远景星
    this._initSimulation();
    this._bindEvents();
    this._startRenderLoop();
  }

  // 生成银河远景星点（静态背景层，独立于 64 卦，营造深邃感）
  // 多层密度：极暗微星（最多）→ 暗星 → 中星 → 偶尔亮星，模拟真实星空的层次
  _initBackgroundStars() {
    const area = this.width * this.height;
    this.bgStars = [];
    // 三层：微尘星（极多极暗）、中景星（适中）、亮远星（少量点缀）
    const layers = [
      { count: Math.floor(area / 350), rMin: 0.3, rMax: 0.8, aMin: 0.06, aMax: 0.22 },  // 微尘（更多更暗）
      { count: Math.floor(area / 2200), rMin: 0.6, rMax: 1.3, aMin: 0.18, aMax: 0.45 }, // 中景
      { count: Math.floor(area / 10000), rMin: 1.0, rMax: 1.8, aMin: 0.4, aMax: 0.72 }, // 亮远星
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const hueRoll = Math.random();
        // 偶有暖色/冷色星，多数中性偏暖白（符合金色主调）
        let hue;
        if (hueRoll < 0.12) hue = 'warm';      // 暖橙红（红巨星感）
        else if (hueRoll < 0.22) hue = 'cool';  // 冷蓝白（高温星）
        else hue = 'gold';                       // 主调金白
        this.bgStars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          r: layer.rMin + Math.random() * (layer.rMax - layer.rMin),
          baseAlpha: layer.aMin + Math.random() * (layer.aMax - layer.aMin),
          twinkleSpeed: Math.random() * 0.015 + 0.003,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleAmp: 0.3 + Math.random() * 0.4, // 闪烁幅度
          hue,
        });
      }
    }
    // 星云团块（柔和的暖紫/暖金色弥散光斑，模拟银河尘埃带）
    this.nebulae = [
      { x: this.width * 0.28, y: this.height * 0.42, r: this.width * 0.28, color: 'rgba(80, 65, 120, 0.05)' },
      { x: this.width * 0.72, y: this.height * 0.58, r: this.width * 0.32, color: 'rgba(120, 95, 55, 0.045)' },
      { x: this.width * 0.5, y: this.height * 0.18, r: this.width * 0.22, color: 'rgba(55, 75, 115, 0.04)' },
      { x: this.width * 0.6, y: this.height * 0.85, r: this.width * 0.26, color: 'rgba(95, 75, 100, 0.035)' },
    ];
  }

  _setupDpr() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  _initSimulation() {
    const nodeById = new Map(this.graph.nodes.map((n, i) => [n.id, i]));
    const links = this.graph.edges.map(e => ({
      source: nodeById.get(e.source),
      target: nodeById.get(e.target),
      weight: e.weight,
    }));

    // 初始随机位置
    this.graph.nodes.forEach(n => {
      if (n.x === undefined) {
        n.x = this.width / 2 + (Math.random() - 0.5) * 200;
        n.y = this.height / 2 + (Math.random() - 0.5) * 200;
        n.vx = 0; n.vy = 0;
      }
    });

    this.simulation = forceSimulation(this.graph.nodes)
      .force('charge', forceManyBody().strength(-180))
      .force('link', forceLink(links).id(d => d.index).distance(d => 90 - d.weight * 4).strength(0.15))
      .force('center', forceCenter(this.width / 2, this.height / 2))
      .alphaDecay(0.02);
  }

  _worldToScreen(wx, wy) {
    const cx = this.width / 2, cy = this.height / 2;
    const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
    const rx = (wx - cx) * cos - (wy - cy) * sin;
    const ry = (wx - cx) * sin + (wy - cy) * cos;
    return { x: rx * this.view.scale + cx + this.view.x, y: ry * this.view.scale + cy + this.view.y };
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
      if (this.autoRotate) this.rotation += 0.0002;
      this._render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _render() {
    const ctx = this.ctx;
    const t = this.time;

    // === 第一层：深空径向渐变背景（中心微亮，边缘深邃）===
    const bgGrad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.75
    );
    bgGrad.addColorStop(0, '#111a30');
    bgGrad.addColorStop(0.5, '#0a0f1e');
    bgGrad.addColorStop(1, '#05070f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // === 第二层：星云尘埃团块（柔和的光斑）===
    for (const neb of this.nebulae) {
      const ng = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      ng.addColorStop(0, neb.color);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // === 第三层：远景银河星点（加法混合，多层闪烁，柔和散射光晕）===
    // lighter 混合让重叠光晕自然累加变亮，营造星海"绒毛感"
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.bgStars) {
      const tw = Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      const alpha = s.baseAlpha * (1 - s.twinkleAmp + s.twinkleAmp * (0.5 + 0.5 * tw));
      let r, g, b;
      if (s.hue === 'warm') { r = 220; g = 170; b = 130; }
      else if (s.hue === 'cool') { r = 170; g = 195; b = 230; }
      else { r = 215; g = 200; b = 165; }
      // 散射光晕（大范围柔和扩散，加法混合下重叠区会自然增亮）
      const haloR = s.r * 6;
      const hgr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR);
      hgr.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
      hgr.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 0.12})`);
      hgr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hgr;
      ctx.beginPath();
      ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
      ctx.fill();
      // 内核
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // === 第四层：64 卦关系边（默认几乎隐形，激活才流动显现）===
    const focus = this.hoveredNode || this.activeNode;
    const focusRels = focus ? new Set([focus.id, ...this._relationTargets(focus.id)]) : null;
    const nodeById = new Map(this.graph.nodes.map(n => [n.id, n]));

    for (const e of this.graph.edges) {
      const s = nodeById.get(e.source), t = nodeById.get(e.target);
      if (!s || !t) continue;
      const sp = this._worldToScreen(s.x, s.y);
      const tp = this._worldToScreen(t.x, t.y);
      const isActive = focusRels && focusRels.has(e.source) && focusRels.has(e.target) &&
        (e.source === focus.id || e.target === focus.id);

      if (isActive) {
        // 激活边：lighter 混合 + 辉光感 + 流动虚线
        ctx.globalCompositeOperation = 'lighter';
        // 底层柔光（粗、淡，营造辉光）
        ctx.strokeStyle = 'rgba(201, 169, 106, 0.18)';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        // 上层流动虚线（亮）
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        grad.addColorStop(0, 'rgba(245, 230, 192, 0.9)');
        grad.addColorStop(0.5, 'rgba(216, 184, 120, 0.65)');
        grad.addColorStop(1, 'rgba(245, 230, 192, 0.9)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -t * 0.4;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // 静默边：极淡，几乎隐入背景
        const baseA = focus ? 0.02 : 0.04;
        const pulse = baseA + 0.012 * Math.sin(t * 0.008 + e.source.charCodeAt(0) * 0.3);
        ctx.strokeStyle = `rgba(120, 105, 75, ${pulse})`;
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
      }
    }

    // === 第五层：64 卦星点（加法混合光晕，柔和散射，大小分层，呼吸）===
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      const breathe = 0.88 + 0.12 * Math.sin(t * 0.018 + n.binaryCode.charCodeAt(0) + n.binaryCode.charCodeAt(3));
      const degFactor = Math.min(n.degree / 13, 1);
      const baseR = isFocus ? 6.5 : (isRel ? 4.5 : 1.8 + degFactor * 3);
      const r = baseR * breathe;

      // 外层弥散光晕（大、极柔、加法混合下重叠累加）
      const haloR = isFocus ? 60 : (isRel ? 38 : 18 + degFactor * 28);
      const haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      if (isFocus) {
        haloGrad.addColorStop(0, 'rgba(245, 230, 192, 0.35)');
        haloGrad.addColorStop(0.2, 'rgba(232, 208, 154, 0.18)');
        haloGrad.addColorStop(0.5, 'rgba(201, 169, 106, 0.06)');
      } else if (isRel) {
        haloGrad.addColorStop(0, 'rgba(232, 208, 154, 0.28)');
        haloGrad.addColorStop(0.25, 'rgba(201, 169, 106, 0.12)');
        haloGrad.addColorStop(0.6, 'rgba(160, 136, 80, 0.03)');
      } else {
        haloGrad.addColorStop(0, `rgba(216, 184, 120, ${0.16 + degFactor * 0.14})`);
        haloGrad.addColorStop(0.3, 'rgba(160, 136, 80, 0.04)');
      }
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 内层亮核光晕（更集中）
      const coreGlowR = r * 3;
      const cgGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreGlowR);
      const coreA = isFocus ? 0.9 : (isRel ? 0.7 : 0.5 + degFactor * 0.3);
      cgGrad.addColorStop(0, `rgba(255, 248, 220, ${coreA})`);
      cgGrad.addColorStop(0.4, `rgba(232, 208, 154, ${coreA * 0.4})`);
      cgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cgGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreGlowR, 0, Math.PI * 2);
      ctx.fill();

      // 实心核（最亮的星点本体）
      const coreColor = isFocus ? 'rgba(255, 252, 240, 1)' : (isRel ? 'rgba(252, 240, 205, 1)' : `rgba(232, 208, 154, ${0.85 + degFactor * 0.15})`);
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // 卦名标签（focus 态，正常混合模式，保证可读）
    if (focus) {
      const p = this._worldToScreen(focus.x, focus.y);
      ctx.fillStyle = '#f0d8a0';
      ctx.font = '15px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(focus.name, p.x, p.y - 60);
    }
  }

  _relationTargets(code) {
    const rels = allRelations(code);
    return [rels.opposite, rels.reversed, rels.interlocking, ...rels.changing];
  }

  // === 公开 API ===
  focusStar(code) {
    const node = this.graph.nodes.find(n => n.id === code);
    if (!node) return;
    this.activeNode = node;
    this.autoRotate = false;
    // 平移视图使该节点居中（节点世界坐标 → 当前应居中的屏幕位置）
    // node 的屏幕位置 = _worldToScreen(node.x, node.y)
    // 要让它落在画布中心 (width/2, height/2)，需调整 view.x/y
    const p = this._worldToScreen(node.x, node.y);
    this.view.x += (this.width / 2 - p.x);
    this.view.y += (this.height / 2 - p.y);
  }

  setMode(mode) { this.mode = mode; }

  resize() {
    this._setupDpr();
    this.simulation.force('center', forceCenter(this.width / 2, this.height / 2));
    this.simulation.alpha(0.3).restart();
  }
}
