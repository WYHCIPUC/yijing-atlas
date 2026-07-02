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
  _initBackgroundStars() {
    const count = Math.floor(this.width * this.height / 2500); // 密度
    this.bgStars = [];
    for (let i = 0; i < count; i++) {
      this.bgStars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 1.1 + 0.2,          // 很小
        baseAlpha: Math.random() * 0.5 + 0.1,  // 暗淡
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        // 偶尔有微微暖色（远星红移感）
        hue: Math.random() < 0.15 ? 'warm' : (Math.random() < 0.1 ? 'cool' : 'neutral'),
      });
    }
    // 星云团块（几个柔和的暖紫/暖金色光斑，模拟银河尘埃）
    this.nebulae = [
      { x: this.width * 0.3, y: this.height * 0.4, r: 320, color: 'rgba(90, 70, 130, 0.06)' },
      { x: this.width * 0.7, y: this.height * 0.6, r: 380, color: 'rgba(130, 100, 60, 0.05)' },
      { x: this.width * 0.5, y: this.height * 0.2, r: 260, color: 'rgba(60, 80, 120, 0.05)' },
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

    // === 第三层：远景银河星点（闪烁，独立于 64 卦）===
    for (const s of this.bgStars) {
      const alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.twinklePhase));
      let color;
      if (s.hue === 'warm') color = `rgba(200, 170, 130, ${alpha})`;
      else if (s.hue === 'cool') color = `rgba(160, 180, 220, ${alpha})`;
      else color = `rgba(210, 200, 180, ${alpha})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // === 第四层：64 卦关系边（动态流光）===
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
        // 激活边：亮金色渐变 + 流动虚线
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        grad.addColorStop(0, 'rgba(232, 208, 154, 0.9)');
        grad.addColorStop(0.5, 'rgba(201, 169, 106, 0.7)');
        grad.addColorStop(1, 'rgba(232, 208, 154, 0.9)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -t * 0.5; // 流动
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // 静默边：极淡的金色，带细微流动
        const pulseAlpha = 0.08 + 0.04 * Math.sin(t * 0.01 + e.source.charCodeAt(0));
        ctx.strokeStyle = `rgba(138, 122, 90, ${focus ? pulseAlpha * 0.4 : pulseAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // === 第五层：64 卦星点（光晕 + 内核 + 呼吸）===
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      // 呼吸：每颗星不同相位
      const breathe = 0.85 + 0.15 * Math.sin(t * 0.02 + n.binaryCode.charCodeAt(0) + n.binaryCode.charCodeAt(3));
      const baseR = isFocus ? 7 : (isRel ? 4.5 : 2.5 + Math.min(n.degree * 0.15, 1.5));
      const r = baseR * breathe;

      // 外光晕（径向渐变，营造星辉）
      const glowR = isFocus ? 28 : (isRel ? 18 : 9 + Math.min(n.degree * 0.4, 4));
      const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      const glowColor = isFocus ? 'rgba(232, 208, 154, 0.5)' : (isRel ? 'rgba(201, 169, 106, 0.4)' : 'rgba(138, 122, 90, 0.28)');
      glowGrad.addColorStop(0, glowColor);
      glowGrad.addColorStop(0.4, isFocus ? 'rgba(201, 169, 106, 0.18)' : 'rgba(138, 122, 90, 0.08)');
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 内核（亮）
      const coreColor = isFocus ? '#f5e6c0' : (isRel ? '#e8d09a' : '#c9a96a');
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 高光点（最亮中心，给星点"活气"）
      if (isFocus || isRel || n.degree > 8) {
        ctx.fillStyle = isFocus ? 'rgba(255, 250, 230, 0.9)' : 'rgba(245, 230, 192, 0.6)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isFocus) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '14px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, p.x, p.y - glowR - 4);
      }
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
