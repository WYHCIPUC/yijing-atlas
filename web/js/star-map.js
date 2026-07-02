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
    this.yaw = 0;          // 偏航（左右转）
    this.pitch = 0;        // 俯仰（上下看）
    this.autoRotate = true;
    this.mode = 'explore';
    this.time = 0;
    this.meteors = [];
    this.nextMeteorAt = 150;
    this.appearProgress = 0;
    this.keywords = null;
    this.keywordLayouts = null;
    // 相机焦点：点击星后"飞入"该星，以其为中心看 360°
    this.cameraTarget = null;  // {x,y,z} 目标相机焦点，null=以球心为焦点
    this.cameraPos = { x: 0, y: 0, z: 0 };  // 当前相机焦点（平滑过渡用）

    this._setupDpr();
    this._loadKeywords();       // 异步加载关键词，构建星云布局
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

  // 异步加载关键词数据，为每个卦预计算星云内关键词的散布布局
  async _loadKeywords() {
    try {
      const res = await fetch('data/hexagram-keywords.json');
      if (!res.ok) return;
      this.keywords = await res.json();
      // 为每卦的每个关键词分配星云内的相对偏移（围绕卦星中心散布）
      // level 越低（越重要）越靠近中心，字号越大
      this.keywordLayouts = {};
      for (const code of Object.keys(this.keywords)) {
        const kws = this.keywords[code];
        const layout = kws.map((kw, i) => {
          // 按层级确定半径：L0 在中心，L1 近，L2 中，L3 远
          const baseR = [0, 14, 24, 34][kw.level] || 30;
          // 角度：均匀散布 + 微随机，避免堆叠
          const ang = (i / kws.length) * Math.PI * 2 + (kw.text.charCodeAt(0) % 7) * 0.4;
          const r = baseR + (kw.text.charCodeAt(0) % 5);
          return {
            text: kw.text,
            level: kw.level,
            dx: Math.cos(ang) * r,
            dy: Math.sin(ang) * r,
            // 微振荡相位（关键词轻微浮动）
            phase: kw.text.charCodeAt(0) * 0.7,
          };
        });
        this.keywordLayouts[code] = layout;
      }
    } catch (e) {
      console.warn('关键词数据加载失败，退化为普通光晕点', e);
    }
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
          twinkleSpeed: Math.random() * 0.04 + 0.002,  // 频率范围扩大4倍，差异更明显
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleAmp: 0.35 + Math.random() * 0.45,
          pulseSpeed: 0.0008 + Math.random() * 0.004,   // 脉冲频率差异更大
          pulseOffset: Math.random() * Math.PI * 2,
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

  // 三维球状布局：64 卦分布在球面/球体内，上下卦映射到球坐标经纬度
  _initLayout() {
    const ballR = this.anchorR; // 球半径
    for (const n of this.graph.nodes) {
      const lower = n.binaryCode.slice(0, 3);
      const upper = n.binaryCode.slice(3, 6);
      n.isPure = lower === upper;
      // 球坐标：下卦决定经度，上卦决定纬度
      const lowerAng = TRIGRAM_ANGLE[lower]; // -π/2 ~ π
      const upperAng = TRIGRAM_ANGLE[upper];
      const lon = lowerAng;                           // 经度（下卦方位）
      const lat = (upperAng / Math.PI) * Math.PI / 2; // 纬度（上卦方位映射到 ±π/2）
      // 半径：纯卦在球面（最外），普通卦在球内（有体积感）
      const r = n.isPure ? ballR : (ballR * (0.55 + Math.random() * 0.4));
      // 球坐标 → 三维笛卡尔目标
      const cosLat = Math.cos(lat);
      n.targetX = this.cx + r * cosLat * Math.cos(lon);
      n.targetY = this.cy + r * cosLat * Math.sin(lon);
      n.targetZ = r * Math.sin(lat); // z 目标（球状分布的关键）
      // 初始位置
      n.x = this.cx + (Math.random() - 0.5) * 100;
      n.y = this.cy + (Math.random() - 0.5) * 100;
      n.vx = 0; n.vy = 0;
      // z 轴：以球坐标 z 为基准，加缓慢振荡
      n._zBase = n.targetZ;
      n.z = n._zBase;
      n.zAmp = 25 + Math.random() * 35;
      n.zPhase = Math.random() * Math.PI * 2;
      n.zSpeed = 0.003 + Math.random() * 0.004;
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

  // 真 3D 透视投影：双轴旋转(yaw/pitch) + 相机焦点偏移
  _worldToScreen(wx, wy, wz = 0) {
    // 减去相机焦点（点击星后以该星为中心）
    const ox = wx - this.cx - this.cameraPos.x;
    const oy = wy - this.cy - this.cameraPos.y;
    const oz = wz - this.cameraPos.z;
    // 先绕 Y 轴旋转（yaw 偏航：左右看）
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x1 = ox * cy - oz * sy;
    const z1 = ox * sy + oz * cy;
    let y1 = oy;
    // 再绕 X 轴旋转（pitch 俯仰：上下看）
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;
    // 透视投影
    const perspective = 700;
    const dz = z2 + perspective;
    const scale = perspective / Math.max(perspective * 0.2, dz);
    return {
      x: x1 * scale * this.view.scale + this.cx + this.view.x,
      y: y2 * scale * this.view.scale + this.cy + this.view.y,
      scale,
      depthFactor: scale,
    };
  }

  _nodeAt(sx, sy) {
    const baseR = Math.max(8, 10 * this.view.scale);
    // 从近到远遍历（近的优先命中）
    let best = null, bestDist = Infinity;
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y, n.z);
      const r = baseR * (0.6 + p.depthFactor * 0.6); // 近的星命中范围大
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < r && p.depthFactor > bestDist) { best = n; bestDist = p.depthFactor; }
    }
    return best;
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
        this.dragStart = { x: sx, y: sy, yaw: this.yaw, pitch: this.pitch };
        this.autoRotate = false; // 拖拽时暂停自转，松手可恢复
      }
    });
    c.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (this.isDragging) {
        // 双轴自由旋转：左右拖改 yaw，上下拖改 pitch
        const dx = sx - this.dragStart.x;
        const dy = sy - this.dragStart.y;
        this.yaw = this.dragStart.yaw + dx * 0.006;
        this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.dragStart.pitch + dy * 0.006));
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
      this.view.scale = Math.max(0.3, Math.min(4, this.view.scale * factor));
    }, { passive: false });
    // 双击空白退出焦点，回到球心
    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = this._nodeAt(sx, sy);
      if (!node) this.clearFocus();
    });
  }

  _startRenderLoop() {
    const loop = () => {
      this.time += 1;
      if (this.autoRotate) this.yaw += 0.0006;
      if (this.appearProgress < 1) this.appearProgress = Math.min(1, this.appearProgress + 0.006);
      // 相机焦点平滑过渡（点击星后飞入）
      if (this.cameraTarget) {
        this.cameraPos.x += (this.cameraTarget.x - this.cameraPos.x) * 0.06;
        this.cameraPos.y += (this.cameraTarget.y - this.cameraPos.y) * 0.06;
        this.cameraPos.z += (this.cameraTarget.z - this.cameraPos.z) * 0.06;
      } else {
        this.cameraPos.x += (0 - this.cameraPos.x) * 0.06;
        this.cameraPos.y += (0 - this.cameraPos.y) * 0.06;
        this.cameraPos.z += (0 - this.cameraPos.z) * 0.06;
      }
      // z 轴：球状结构基准 + 缓慢振荡漂浮
      for (const n of this.graph.nodes) {
        n.z = n._zBase + Math.sin(this.time * n.zSpeed + n.zPhase) * n.zAmp;
      }
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

    // 第三层：远景星点（每颗星完全独立的明灭节奏 + 偶发亮脉冲）
    for (const s of this.bgStars) {
      // 三频叠加，频率差异大，确保不同步
      const tw1 = Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      const tw2 = Math.sin(t * s.twinkleSpeed * 3.3 + s.twinklePhase * 2.1);
      const tw3 = Math.sin(t * s.twinkleSpeed * 0.4 + s.twinklePhase * 0.7);
      let alpha = s.baseAlpha * (1 - s.twinkleAmp + s.twinkleAmp * (0.3 * tw1 + 0.25 * tw2 + 0.2 * tw3 + 0.25));
      // 偶发亮脉冲：每颗星独立周期
      const pulsePhase = (t * s.pulseSpeed + s.pulseOffset) % (Math.PI * 2);
      const pulseStrength = Math.pow(Math.max(0, Math.cos(pulsePhase)), 14);
      alpha = Math.min(1, alpha + s.baseAlpha * pulseStrength * 1.5);
      let r, g, b;
      if (s.hue === 'warm') { r = 220; g = 170; b = 130; }
      else if (s.hue === 'cool') { r = 170; g = 195; b = 230; }
      else { r = 215; g = 200; b = 165; }
      // 亮脉冲时画一个小光晕
      if (pulseStrength > 0.3) {
        const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        gr.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (1 + pulseStrength * 0.5), 0, Math.PI * 2);
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
      const sp = this._worldToScreen(s.x, s.y, s.z);
      const tp = this._worldToScreen(tn.x, tn.y, tn.z);
      const avgDepth = (sp.depthFactor + tp.depthFactor) / 2; // 边的平均深度
      const isActive = focusRels && focusRels.has(e.source) && focusRels.has(e.target) &&
        (e.source === focus.id || e.target === focus.id);
      if (isActive) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(201,169,106,${0.16 * avgDepth})`;
        ctx.lineWidth = 4 * (0.6 + avgDepth * 0.6);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        grad.addColorStop(0, `rgba(245,230,192,${0.9 * avgDepth})`);
        grad.addColorStop(0.5, `rgba(216,184,120,${0.65 * avgDepth})`);
        grad.addColorStop(1, `rgba(245,230,192,${0.9 * avgDepth})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2 * (0.6 + avgDepth * 0.6);
        ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -t * 0.4;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const baseA = focus ? 0.02 : 0.04;
        const pulse = baseA + 0.012 * Math.sin(t * 0.008 + e.source.charCodeAt(0) * 0.3);
        ctx.strokeStyle = `rgba(120,105,75,${pulse * avgDepth})`;
        ctx.lineWidth = 0.4 * (0.6 + avgDepth * 0.6);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      }
    }

    // 第五层：卦星（光晕 + 入场动画 + 伪3D深度）—— 按 z 排序，远先画
    ctx.globalCompositeOperation = 'lighter';
    const sortedNodes = [...this.graph.nodes].sort((a, b) => a.z - b.z);
    for (const n of sortedNodes) {
      const delay = (n.number - 1) / 64 * 0.5;
      const localP = Math.max(0, Math.min(1, (this.appearProgress - delay) / 0.4));
      if (localP <= 0) continue;
      const ease = localP * localP * (3 - 2 * localP);
      const p = this._worldToScreen(n.x, n.y, n.z);
      const depth = p.depthFactor; // 0.5(远) ~ 1.6(近)
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      // 多频明灭：慢呼吸 + 快闪烁，每颗星独立节奏
      const seed = n.binaryCode.charCodeAt(0) + n.binaryCode.charCodeAt(3);
      const tw1 = Math.sin(t * 0.022 + seed);
      const tw2 = Math.sin(t * 0.055 + seed * 1.7);
      const breathe = 0.78 + 0.14 * tw1 + 0.08 * tw2;
      // 偶发亮脉冲：卦象偶尔明显亮一下（如恒星耀斑）
      const hexPulse = Math.pow(Math.max(0, Math.cos(t * 0.012 + seed * 2.3)), 14);
      const glowBoost = 1 + hexPulse * 0.6; // 脉冲时光晕放大
      const brightBoost = 1 + hexPulse * 0.5; // 脉冲时亮度提升
      const degFactor = Math.min(n.degree / 13, 1);
      // 大小、亮度、光晕均按深度缩放：近大亮，远小暗；脉冲时光晕放大
      const depthScale = 0.45 + depth * 0.6; // 深度缩放因子
      const depthAlpha = (0.4 + depth * 0.6) * brightBoost;  // 深度透明度 × 脉冲增亮
      const baseR = n.isPure ? 5 : (isFocus ? 6.5 : (isRel ? 4.5 : 1.8 + degFactor * 3));
      const r = baseR * breathe * ease * depthScale * glowBoost;

      // 外光晕（按深度缩放，脉冲时放大）
      const haloR = (isFocus ? 60 : (isRel ? 38 : (n.isPure ? 26 : 16 + degFactor * 24))) * ease * depthScale * glowBoost;
      const haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      const da = (a) => a * depthAlpha; // 深度调暗 × 脉冲增亮
      if (isFocus) {
        haloGrad.addColorStop(0, `rgba(245,230,192,${da(0.35)})`);
        haloGrad.addColorStop(0.2, `rgba(232,208,154,${da(0.18)})`);
        haloGrad.addColorStop(0.5, `rgba(201,169,106,${da(0.06)})`);
      } else if (isRel) {
        haloGrad.addColorStop(0, `rgba(232,208,154,${da(0.28)})`);
        haloGrad.addColorStop(0.25, `rgba(201,169,106,${da(0.12)})`);
      } else if (n.isPure) {
        haloGrad.addColorStop(0, `rgba(212,165,116,${da(0.22)})`);
        haloGrad.addColorStop(0.3, `rgba(160,136,80,${da(0.06)})`);
      } else {
        haloGrad.addColorStop(0, `rgba(216,184,120,${da(0.16 + degFactor * 0.14)})`);
        haloGrad.addColorStop(0.3, `rgba(160,136,80,${da(0.04)})`);
      }
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 亮核光晕（按深度缩放）
      const coreGlowR = r * 3;
      const cgGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreGlowR);
      const coreA = da(isFocus ? 0.9 : (isRel ? 0.7 : (n.isPure ? 0.65 : 0.5 + degFactor * 0.3)));
      cgGrad.addColorStop(0, `rgba(255,248,220,${coreA})`);
      cgGrad.addColorStop(0.4, `rgba(232,208,154,${coreA * 0.4})`);
      cgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cgGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreGlowR, 0, Math.PI * 2);
      ctx.fill();

      // 实心核（按深度调透明度）
      const coreAlpha = depthAlpha;
      const coreColor = isFocus ? `rgba(255,252,240,${coreAlpha})` : (isRel ? `rgba(252,240,205,${coreAlpha})` : (n.isPure ? `rgba(245,220,160,${0.95 * coreAlpha})` : `rgba(232,208,154,${(0.85 + degFactor * 0.15) * coreAlpha})`));
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // ★ 关键词星云（LOD：需明显放大才显示关键词文字，默认只看光晕）
      const lod = this.view.scale * depthScale; // 细节层次系数
      if (this.keywordLayouts && this.keywordLayouts[n.id] && lod > 1.6) {
        const kwAlpha = Math.min(1, (lod - 1.6) / 0.8) * ease * (0.5 + depth * 0.5);
        const layout = this.keywordLayouts[n.id];
        for (const kw of layout) {
          // 关键词微浮动
          const floatX = Math.sin(this.time * 0.01 + kw.phase) * 1.5;
          const floatY = Math.cos(this.time * 0.012 + kw.phase) * 1.5;
          const kx = p.x + (kw.dx + floatX) * depthScale;
          const ky = p.y + (kw.dy + floatY) * depthScale;
          // 字号按层级和深度
          const fontSizes = [0, 13, 10, 8]; // L0 不在这里画（卦名另画）
          if (kw.level === 0) continue; // 卦名由后面的标签层处理
          const fs = fontSizes[kw.level] * depthScale * (0.7 + lod * 0.3);
          ctx.font = `${fs}px "ZCOOL XiaoWei", "Ma Shan Zheng", "STKaiti", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // L1 卦辞核心最亮，L3 爻辞最暗
          const levelAlpha = kw.level === 1 ? kwAlpha : (kw.level === 2 ? kwAlpha * 0.75 : kwAlpha * 0.55);
          const levelColor = kw.level === 1 ? `rgba(232,208,154,${levelAlpha})` : (kw.level === 2 ? `rgba(200,175,120,${levelAlpha})` : `rgba(160,140,95,${levelAlpha})`);
          ctx.fillStyle = levelColor;
          ctx.fillText(kw.text, kx, ky);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // 卦名标签：8 纯卦常显书法大字 + focus 星显示（带 z 深度）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.graph.nodes) {
      if (!n.isPure) continue;
      const delay = (n.number - 1) / 64 * 0.5;
      const localP = Math.max(0, Math.min(1, (this.appearProgress - delay) / 0.4));
      if (localP <= 0) continue;
      const p = this._worldToScreen(n.x, n.y, n.z);
      const isFocus = focus && n.id === focus.id;
      const fontSize = (isFocus ? 34 : 26) * (0.6 + p.depthFactor * 0.5);
      const baseA = isFocus ? 1 : (0.5 + 0.15 * Math.sin(this.time * 0.01 + n.binaryCode.charCodeAt(0)));
      const alpha = isFocus ? baseA : baseA * (0.5 + p.depthFactor * 0.5);
      ctx.font = `${fontSize}px "Ma Shan Zheng", "ZCOOL XiaoWei", "STKaiti", "KaiTi", serif`;
      ctx.fillStyle = isFocus ? 'rgba(255,240,200,1)' : `rgba(212,165,116,${alpha})`;
      ctx.fillText(n.name, p.x, p.y - 36 * (0.6 + p.depthFactor * 0.5));
    }
    // focus 星若非纯卦，也显示其名（较小）
    if (focus && !focus.isPure) {
      const p = this._worldToScreen(focus.x, focus.y, focus.z);
      const fs = 24 * (0.6 + p.depthFactor * 0.5);
      ctx.font = `${fs}px "Ma Shan Zheng", "ZCOOL XiaoWei", "STKaiti", "KaiTi", serif`;
      ctx.fillStyle = 'rgba(255,240,200,1)';
      ctx.fillText(focus.name, p.x, p.y - 42 * (0.6 + p.depthFactor * 0.5));
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
    // 设置相机焦点：飞入该星位置，以其为中心看 360° 景象
    this.cameraTarget = { x: node.x - this.cx, y: node.y - this.cy, z: node.z };
  }

  // 退出焦点，回到球心俯瞰
  clearFocus() {
    this.cameraTarget = null;
    this.activeNode = null;
    this.autoRotate = true;
  }

  setMode(mode) { this.mode = mode; }

  resize() {
    this._setupDpr();
    this.simulation.force('xA', forceX(d => d.targetX).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.force('yA', forceY(d => d.targetY).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.alpha(0.3).restart();
  }
}
