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

    this._setupDpr();
    this._initSimulation();
    this._bindEvents();
    this._startRenderLoop();
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
      if (this.autoRotate) this.rotation += 0.0002;
      this._render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _render() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    const focus = this.hoveredNode || this.activeNode;
    const focusRels = focus ? new Set([focus.id, ...this._relationTargets(focus.id)]) : null;

    // 边
    const nodeById = new Map(this.graph.nodes.map(n => [n.id, n]));
    for (const e of this.graph.edges) {
      const s = nodeById.get(e.source), t = nodeById.get(e.target);
      if (!s || !t) continue;
      const sp = this._worldToScreen(s.x, s.y);
      const tp = this._worldToScreen(t.x, t.y);
      const isActive = focusRels && focusRels.has(e.source) && focusRels.has(e.target) &&
        (e.source === focus.id || e.target === focus.id);
      ctx.strokeStyle = isActive ? COLORS.edgeActive : COLORS.edge;
      ctx.lineWidth = isActive ? 1.5 : 0.4;
      ctx.globalAlpha = isActive ? 0.85 : (focus ? 0.15 : 1);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tp.x, tp.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 节点
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y);
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      const r = isFocus ? 7 : (isRel ? 4.5 : 2.5 + Math.min(n.degree * 0.15, 1.5));

      if (isFocus || isRel) {
        const glowR = isFocus ? 20 : 12;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, COLORS.glow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isFocus ? COLORS.starActive : (isRel ? COLORS.starHover : COLORS.star);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (isFocus) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '14px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, p.x, p.y - 16);
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
