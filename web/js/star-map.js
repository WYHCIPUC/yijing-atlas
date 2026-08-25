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

const LABEL_COLLISION_GAP = 7;
const MIN_NORMAL_LABEL_FONT_SIZE = 12;

function labelBoxesOverlap(a, b, gap) {
  return !(
    a.right + gap <= b.left
    || b.right + gap <= a.left
    || a.bottom + gap <= b.top
    || b.bottom + gap <= a.top
  );
}

// 先按交互状态、纯卦、可见性、重要度与景深选取标签，再反向绘制，
// 让高优先级标签最后落笔。排序末尾固定使用原始顺序，避免同分标签闪烁。
export function layoutStarNameLabels(ctx, nodes, {
  hoveredNode = null,
  activeNode = null,
  focusVisible = null,
  appearProgress = 1,
  time = 0,
  collisionGap = LABEL_COLLISION_GAP,
} = {}) {
  const focus = hoveredNode || activeNode;
  const candidates = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const isHovered = hoveredNode?.id === node.id;
    const isActive = activeNode?.id === node.id;
    const delay = (node.number - 1) / 64 * 0.5;
    const localProgress = Math.max(0, Math.min(1, (appearProgress - delay) / 0.4));
    if ((!isHovered && !isActive && localProgress <= 0) || !node._screen) continue;

    const screen = node._screen;
    const isFocus = focus?.id === node.id;
    const isHidden = focusVisible && !focusVisible.has(node.id);
    const nameVisibility = isHidden ? 0.1 : 1;
    const depthScale = 0.6 + screen.depthFactor * 0.5;
    const fontSize = node.isPure
      ? (isFocus ? 38 : 30) * depthScale
      : Math.max(MIN_NORMAL_LABEL_FONT_SIZE, (isFocus ? 20 : 14) * depthScale);
    const fontFamily = node.isPure
      ? '"Ma Shan Zheng", "ZCOOL XiaoWei", "STKaiti", "KaiTi", serif'
      : '"ZCOOL XiaoWei", "STKaiti", "KaiTi", serif';
    const font = `${fontSize}px ${fontFamily}`;
    const x = screen.x;
    const y = screen.y - (node.isPure ? 40 : 22) * depthScale;

    ctx.font = font;
    const metrics = ctx.measureText(node.name);
    const measuredWidth = Number.isFinite(metrics.width) ? metrics.width : 0;
    const measuredHeight = Number.isFinite(metrics.actualBoundingBoxAscent)
      && Number.isFinite(metrics.actualBoundingBoxDescent)
      ? metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      : fontSize;
    const width = Math.max(1, measuredWidth);
    const height = Math.max(fontSize, measuredHeight);

    let priorityTier = isHidden ? 0 : 1;
    if (node.isPure) priorityTier = 2;
    if (isActive) priorityTier = 3;
    if (isHovered) priorityTier = 4;

    const importance = (Number(node.degree) || 0) + screen.depthFactor * 4;
    const alpha = node.isPure
      ? (isFocus
        ? 1
        : (0.6 + 0.15 * Math.sin(time * 0.01 + node.binaryCode.charCodeAt(0)))
          * (0.6 + screen.depthFactor * 0.4) * nameVisibility)
      : (isFocus ? 1 : (0.4 + screen.depthFactor * 0.4) * nameVisibility);

    candidates.push({
      node,
      text: node.name,
      x,
      y,
      font,
      fontSize,
      fillStyle: isFocus
        ? 'rgba(255,240,200,1)'
        : (node.isPure
          ? `rgba(212,165,116,${alpha})`
          : `rgba(180,160,110,${alpha})`),
      forceVisible: isHovered || isActive || node.isPure,
      priorityTier,
      importance,
      sourceIndex: index,
      box: {
        left: x - width / 2,
        right: x + width / 2,
        top: y - height / 2,
        bottom: y + height / 2,
      },
    });
  }

  candidates.sort((a, b) => (
    b.priorityTier - a.priorityTier
    || b.importance - a.importance
    || a.sourceIndex - b.sourceIndex
  ));

  const occupied = [];
  const visible = [];
  for (const candidate of candidates) {
    const collides = occupied.some(box => labelBoxesOverlap(candidate.box, box, collisionGap));
    if (collides && !candidate.forceVisible) continue;
    occupied.push(candidate.box);
    visible.push(candidate);
  }

  return visible.reverse();
}

export function chooseRenderFps({ reducedMotion, isDragging, cameraDistance, mode = 'explore' }) {
  if (reducedMotion) return 10;
  if (isDragging || cameraDistance > 0.5) return 60;
  return mode === 'explore' ? 30 : 15;
}

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
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionPreference.matches;
    this.autoRotate = !this.reducedMotion;
    this.isPaused = false;
    this.pauseReasons = new Set();
    this.animationFrame = null;
    this.frameCount = 0;
    this.lastRenderAt = 0;
    this.frameStep = 1;
    this.mode = 'explore';
    this.time = 0;
    this.meteors = [];
    this.nextMeteorAt = 150;
    this.appearProgress = 0;
    this.keywords = null;
    this.keywordLayouts = null;
    this.trail = [];          // 关系漫游旅行轨迹：[{from, to}] 序列
    // 相机焦点：点击星后"飞入"该星，以其为中心看 360°
    this.cameraTarget = null;  // {x,y,z} 目标相机焦点，null=以球心为焦点
    this.cameraPos = { x: 0, y: 0, z: 0 };  // 当前相机焦点（平滑过渡用）

    this._setupDpr();
    this._preRenderGlows();     // 预渲染光晕贴图（性能关键）
    this._loadKeywords();       // 异步加载关键词，构建星云布局
    this._initBackground();
    this._initLayout();
    this._bindEvents();
    this._startRenderLoop();
  }

  _setupDpr() {
    const rect = this.canvas.getBoundingClientRect();
    const cssPixelArea = Math.max(1, rect.width * rect.height);
    const areaLimitedDpr = Math.max(0.85, Math.sqrt(5_000_000 / cssPixelArea));
    const dpr = Math.min(window.devicePixelRatio || 1, 2, areaLimitedDpr);
    this.dpr = dpr;
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

  // 预渲染光晕贴图到离屏 canvas（避免每帧 createRadialGradient，性能关键）
  // 生成两张：halo（外光晕，柔和弥散）和 core（亮核，集中）
  _preRenderGlows() {
    const size = 128;
    // 外光晕贴图（白金色径向渐变，渲染时用 globalAlpha + drawImage 缩放控制）
    this.glowHalo = document.createElement('canvas');
    this.glowHalo.width = this.glowHalo.height = size;
    const hc = this.glowHalo.getContext('2d');
    const hg = hc.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    hg.addColorStop(0, 'rgba(255,248,220,1)');
    hg.addColorStop(0.15, 'rgba(245,230,192,0.6)');
    hg.addColorStop(0.4, 'rgba(216,184,120,0.18)');
    hg.addColorStop(0.7, 'rgba(138,122,90,0.04)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    hc.fillStyle = hg;
    hc.fillRect(0, 0, size, size);
    // 亮核贴图（更集中明亮）
    this.glowCore = document.createElement('canvas');
    this.glowCore.width = this.glowCore.height = size;
    const cc = this.glowCore.getContext('2d');
    const cg = cc.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    cg.addColorStop(0, 'rgba(255,252,240,1)');
    cg.addColorStop(0.3, 'rgba(245,230,192,0.5)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    cc.fillStyle = cg;
    cc.fillRect(0, 0, size, size);
  }

  // 用预渲染贴图绘制光晕（替代每帧 createRadialGradient）
  _drawGlow(ctx, tex, x, y, radius, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(tex, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
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

  // 背景星 + 星云（预渲染到离屏 canvas，性能优化）
  _initBackground() {
    const area = this.width * this.height;
    // 减少数量（预渲染后视觉密度足够）
    const layers = [
      { count: Math.floor(area / 900), rMin: 0.3, rMax: 0.8, aMin: 0.08, aMax: 0.25 },
      { count: Math.floor(area / 5000), rMin: 0.6, rMax: 1.3, aMin: 0.2, aMax: 0.5 },
      { count: Math.floor(area / 22000), rMin: 1.0, rMax: 1.8, aMin: 0.4, aMax: 0.72 },
    ];
    // 分两组（奇偶），各自预渲染，每组整体呼吸（保留一定闪烁差异）
    this.bgStarLayers = [null, null];
    for (let grp = 0; grp < 2; grp++) {
      const cv = document.createElement('canvas');
      cv.width = this.width; cv.height = this.height;
      const cc = cv.getContext('2d');
      let idx = 0;
      for (const layer of layers) {
        for (let i = 0; i < layer.count; i++) {
          if (idx % 2 !== grp) { idx++; continue; }
          idx++;
          const roll = Math.random();
          const hue = roll < 0.12 ? 'warm' : (roll < 0.22 ? 'cool' : 'gold');
          let r, g, b;
          if (hue === 'warm') { r = 220; g = 170; b = 130; }
          else if (hue === 'cool') { r = 170; g = 195; b = 230; }
          else { r = 215; g = 200; b = 165; }
          const alpha = layer.aMin + Math.random() * (layer.aMax - layer.aMin);
          const radius = layer.rMin + Math.random() * (layer.rMax - layer.rMin);
          const x = Math.random() * this.width, y = Math.random() * this.height;
          // 较亮的星画小光晕
          if (radius > 1.0) {
            const gr = cc.createRadialGradient(x, y, 0, x, y, radius * 4);
            gr.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            cc.fillStyle = gr;
            cc.beginPath(); cc.arc(x, y, radius * 4, 0, Math.PI * 2); cc.fill();
          }
          cc.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          cc.beginPath(); cc.arc(x, y, radius, 0, Math.PI * 2); cc.fill();
        }
      }
      this.bgStarLayers[grp] = cv;
    }
    this.bgStarPhase = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2];
    this.nebulae = [
      { bx: this.width * 0.28, by: this.height * 0.42, dr: 40, ds: 0.0003, dp: 0, r: this.width * 0.28, color: 'rgba(80, 65, 120, 0.05)' },
      { bx: this.width * 0.72, by: this.height * 0.58, dr: 55, ds: 0.0002, dp: 1.5, r: this.width * 0.32, color: 'rgba(120, 95, 55, 0.045)' },
      { bx: this.width * 0.5, by: this.height * 0.18, dr: 35, ds: 0.0004, dp: 3, r: this.width * 0.22, color: 'rgba(55, 75, 115, 0.04)' },
      { bx: this.width * 0.6, by: this.height * 0.85, dr: 45, ds: 0.00025, dp: 4.5, r: this.width * 0.26, color: 'rgba(95, 75, 100, 0.035)' },
    ];

    // 深空底色与星云变化极慢，合并为静态图层，避免每帧创建 5 个大渐变。
    this.backgroundLayer = document.createElement('canvas');
    this.backgroundLayer.width = this.width;
    this.backgroundLayer.height = this.height;
    const bg = this.backgroundLayer.getContext('2d');
    const bgGrad = bg.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.width, this.height) * 0.75);
    bgGrad.addColorStop(0, '#111a30');
    bgGrad.addColorStop(0.5, '#0a0f1e');
    bgGrad.addColorStop(1, '#05070f');
    bg.fillStyle = bgGrad;
    bg.fillRect(0, 0, this.width, this.height);
    for (const neb of this.nebulae) {
      const ng = bg.createRadialGradient(neb.bx, neb.by, 0, neb.bx, neb.by, neb.r);
      ng.addColorStop(0, neb.color);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      bg.fillStyle = ng;
      bg.beginPath();
      bg.arc(neb.bx, neb.by, neb.r, 0, Math.PI * 2);
      bg.fill();
    }
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
    this.nodeById = new Map(this.graph.nodes.map((n) => [n.id, n]));
    const nodeIndexById = new Map(this.graph.nodes.map((n, i) => [n.id, i]));
    const links = this.graph.edges
      .filter(e => e.types.includes('opposite') || e.types.includes('reversed'))
      .map(e => ({ source: nodeIndexById.get(e.source), target: nodeIndexById.get(e.target), weight: e.weight }));

    this.simulation = forceSimulation(this.graph.nodes)
      .force('charge', forceManyBody().strength(-50))
      .force('link', forceLink(links).id(d => d.index).distance(80).strength(0.06))
      .force('xA', forceX(d => d.targetX).strength(d => d.isPure ? 0.9 : 0.18))
      .force('yA', forceY(d => d.targetY).strength(d => d.isPure ? 0.9 : 0.18))
      .force('center', forceCenter(this.cx, this.cy))
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
    // 命中检测：找距离最近且在命中半径内的星（近的优先）
    const baseR = Math.max(14, 16 * this.view.scale); // 加大基础命中半径
    let best = null, bestScore = -Infinity;
    for (const n of this.graph.nodes) {
      const p = this._worldToScreen(n.x, n.y, n.z);
      const r = baseR * (0.5 + p.depthFactor * 0.8); // 近的星命中范围更大
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < r) {
        // 综合评分：距离越近 + 深度越近（越在前方）= 优先
        const score = (1 - d / r) * p.depthFactor;
        if (score > bestScore) { best = n; bestScore = score; }
      }
    }
    return best;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = this._nodeAt(sx, sy);
      if (node) {
        this.callbacks.onPick && this.callbacks.onPick(node.id);
      } else {
        c.setPointerCapture?.(e.pointerId);
        this.isDragging = true;
        this.dragStart = { x: sx, y: sy, yaw: this.yaw, pitch: this.pitch };
        this.autoRotate = false; // 拖拽时暂停自转，松手可恢复
      }
    });
    c.addEventListener('pointermove', (e) => {
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
    const stopDragging = (event) => {
      this.isDragging = false;
      if (event?.pointerId !== undefined) c.releasePointerCapture?.(event.pointerId);
    };
    c.addEventListener('pointerup', stopDragging);
    c.addEventListener('pointercancel', stopDragging);
    c.addEventListener('pointerleave', () => { this.hoveredNode = null; });
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
    c.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 0.18 : 0.08;
      if (event.key === 'ArrowLeft') this.yaw -= step;
      else if (event.key === 'ArrowRight') this.yaw += step;
      else if (event.key === 'ArrowUp') this.pitch = Math.max(-Math.PI / 2.2, this.pitch - step);
      else if (event.key === 'ArrowDown') this.pitch = Math.min(Math.PI / 2.2, this.pitch + step);
      else if (event.key === '+' || event.key === '=') this.zoomBy(1.15);
      else if (event.key === '-') this.zoomBy(0.87);
      else if (event.key === 'Home') this.zoomReset();
      else if (event.key === 'Escape') this.clearFocus();
      else return;
      event.preventDefault();
      this.autoRotate = false;
    });
    this.handleVisibilityChange = () => {
      if (document.hidden) this.pause('visibility');
      else this.resume('visibility');
    };
    this.handleMotionPreferenceChange = (event) => {
      this.reducedMotion = event.matches;
      if (this.reducedMotion) {
        this.autoRotate = false;
        this.meteors = [];
        this.appearProgress = 1;
        if (this.cameraTarget) this.cameraPos = { ...this.cameraTarget };
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.motionPreference.addEventListener) {
      this.motionPreference.addEventListener('change', this.handleMotionPreferenceChange);
    } else {
      this.motionPreference.addListener?.(this.handleMotionPreferenceChange);
    }
  }

  _startRenderLoop() {
    this.renderLoop = (timestamp) => {
      this.animationFrame = null;
      if (this.isPaused) return;
      this.frameCount += 1;

      const target = this.cameraTarget || { x: 0, y: 0, z: 0 };
      const cameraDistance = Math.hypot(
        target.x - this.cameraPos.x,
        target.y - this.cameraPos.y,
        target.z - this.cameraPos.z,
      );
      const targetFps = chooseRenderFps({
        reducedMotion: this.reducedMotion,
        isDragging: this.isDragging,
        cameraDistance,
        mode: this.mode,
      });
      const minFrameMs = 1000 / targetFps;
      const elapsed = this.lastRenderAt ? timestamp - this.lastRenderAt : minFrameMs;
      if (elapsed < minFrameMs - 1) {
        this.animationFrame = requestAnimationFrame(this.renderLoop);
        return;
      }
      this.lastRenderAt = timestamp;
      const deltaMs = Math.min(50, elapsed);
      this.frameStep = deltaMs / (1000 / 60);
      this.time += this.frameStep;
      if (this.autoRotate) this.yaw += 0.0006 * this.frameStep;
      if (this.reducedMotion) this.appearProgress = 1;
      else if (this.appearProgress < 1) this.appearProgress = Math.min(1, this.appearProgress + deltaMs / 900);
      // 相机焦点平滑过渡（点击星后飞入）
      const cameraEase = this.reducedMotion ? 1 : 1 - Math.pow(0.94, this.frameStep);
      this.cameraPos.x += (target.x - this.cameraPos.x) * cameraEase;
      this.cameraPos.y += (target.y - this.cameraPos.y) * cameraEase;
      this.cameraPos.z += (target.z - this.cameraPos.z) * cameraEase;
      // z 轴：球状结构基准 + 缓慢振荡漂浮
      for (const n of this.graph.nodes) {
        n.z = this.reducedMotion ? n._zBase : n._zBase + Math.sin(this.time * n.zSpeed + n.zPhase) * n.zAmp;
      }
      if (!this.reducedMotion) this._updateMeteors(this.frameStep);
      this._render();
      this.animationFrame = requestAnimationFrame(this.renderLoop);
    };
    this.resume('startup');
  }

  pause(reason = 'manual') {
    this.pauseReasons.add(reason);
    this.isPaused = true;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.simulation?.stop?.();
    if (this.canvas?.dataset) this.canvas.dataset.animationActive = 'false';
  }

  resume(reason = 'manual') {
    this.pauseReasons.delete(reason);
    if (document.hidden) this.pauseReasons.add('visibility');
    if (this.pauseReasons.size > 0) {
      this.isPaused = true;
      if (this.canvas?.dataset) this.canvas.dataset.animationActive = 'false';
      return;
    }
    if (!this.isPaused && this.animationFrame !== null) return;
    this.isPaused = false;
    this.lastRenderAt = 0;
    this.simulation?.restart?.();
    if (this.canvas?.dataset) this.canvas.dataset.animationActive = 'true';
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  _updateMeteors(step = 1) {
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
      m.x += Math.cos(m.angle) * m.speed * step;
      m.y += Math.sin(m.angle) * m.speed * step;
      m.life += step;
    }
    this.meteors = this.meteors.filter(m => m.life < m.maxLife && m.x < this.width + 100 && m.y < this.height + 100);
  }

  _render() {
    const ctx = this.ctx;
    const t = this.reducedMotion ? 0 : this.time;

    // 强制清屏 + 重置 Canvas 状态（防止缩放时虚影/拖影）
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    // 第一、二层：预渲染的深空底色与星云。
    ctx.drawImage(this.backgroundLayer, 0, 0);

    // 第三层：远景星点（预渲染图层 drawImage，两组各自呼吸——性能优化）
    // 从每帧绘制数千星点 → 每帧仅 2 次 drawImage，性能提升数十倍
    for (let grp = 0; grp < 2; grp++) {
      const breath = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.012 + this.bgStarPhase[grp]));
      ctx.globalAlpha = breath;
      ctx.drawImage(this.bgStarLayers[grp], 0, 0);
    }
    ctx.globalAlpha = 1;

    // 流星
    this._renderMeteors(ctx);

    // 每帧只投影一次节点；边、星体和标签共享结果。
    for (const n of this.graph.nodes) n._screen = this._worldToScreen(n.x, n.y, n.z);

    // 关系漫游轨迹层（金色路径，渐显动画）
    if (this.trail.length > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const seg of this.trail) {
        const s = this.nodeById.get(seg.from), e = this.nodeById.get(seg.to);
        if (!s || !e) continue;
        seg.t = Math.min(1, seg.t + 0.04 * this.frameStep); // 渐显进度
        const sp = s._screen;
        const tp = e._screen;
        // 金色轨迹线，带流光
        const alpha = seg.t * 0.6;
        ctx.strokeStyle = `rgba(232, 208, 154, ${alpha * 0.3})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.strokeStyle = `rgba(245, 230, 192, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t * 0.3;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // 第四层：关系边
    const focus = this.hoveredNode || this.activeNode;
    const focusRels = focus ? new Set([focus.id, ...this._relationTargets(focus.id)]) : null;
    for (const e of this.graph.edges) {
      const s = this.nodeById.get(e.source), tn = this.nodeById.get(e.target);
      if (!s || !tn) continue;
      const sp = s._screen;
      const tp = tn._screen;
      const avgDepth = (sp.depthFactor + tp.depthFactor) / 2;
      // 判断这条边是否与 focus 卦相关（任一端是 focus，且另一端在关系集里）
      const involvesFocus = focus && (e.source === focus.id || e.target === focus.id);
      const isActive = involvesFocus && focusRels && focusRels.has(e.source) && focusRels.has(e.target);
      if (isActive) {
        // 激活连线：按关系类型用不同颜色和样式
        ctx.globalCompositeOperation = 'lighter';
        // 底层柔光
        const relType = e.types[0];
        const lineColor = relType === 'opposite' ? 'rgba(201,169,106,' : (relType === 'reversed' ? 'rgba(180,150,200,' : (relType === 'interlocking' ? 'rgba(150,180,200,' : 'rgba(200,180,140,'));
        ctx.strokeStyle = lineColor + (0.14 * avgDepth) + ')';
        ctx.lineWidth = 5 * (0.6 + avgDepth * 0.6);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        // 上层流动线
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        const brightColor = relType === 'opposite' ? '245,230,192' : (relType === 'reversed' ? '220,200,235' : (relType === 'interlocking' ? '200,225,240' : '232,210,170'));
        grad.addColorStop(0, `rgba(${brightColor},${0.85 * avgDepth})`);
        grad.addColorStop(0.5, `rgba(${brightColor},${0.5 * avgDepth})`);
        grad.addColorStop(1, `rgba(${brightColor},${0.85 * avgDepth})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3 * (0.6 + avgDepth * 0.6);
        // 不同关系用不同虚线节奏
        if (relType === 'opposite') ctx.setLineDash([5, 6]);
        else if (relType === 'reversed') ctx.setLineDash([8, 4]);
        else if (relType === 'interlocking') ctx.setLineDash([2, 5]);
        else ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -t * 0.5;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        // 连线中点标注关系类型
        const relLabel = relType === 'opposite' ? '错' : (relType === 'reversed' ? '综' : (relType === 'interlocking' ? '互' : '变'));
        const midX = (sp.x + tp.x) / 2, midY = (sp.y + tp.y) / 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${11 * (0.7 + avgDepth * 0.4)}px "ZCOOL XiaoWei", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 标签背景（小圆角暗底，提高可读性）
        const lblW = 20, lblH = 16;
        ctx.fillStyle = 'rgba(10,14,26,0.7)';
        ctx.beginPath();
        ctx.arc(midX, midY, lblH * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${brightColor},${0.6 * avgDepth})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(midX, midY, lblH * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        // 关系文字
        ctx.fillStyle = `rgba(${brightColor},${0.95 * avgDepth})`;
        ctx.fillText(relLabel, midX, midY);
      } else {
        // 非激活边：极淡，focus 模式下隐藏
        const baseA = focus ? 0 : 0.035;
        const pulse = baseA + 0.01 * Math.sin(t * 0.008 + e.source.charCodeAt(0) * 0.3);
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
      const p = n._screen;
      const depth = p.depthFactor; // 0.5(远) ~ 1.6(近)
      const isFocus = focus && n.id === focus.id;
      const isRel = focusRels && focusRels.has(n.id) && !isFocus;
      // focus 模式：非关系卦淡入星空背景（大幅降低可见度）
      const isHidden = this.focusVisible && !this.focusVisible.has(n.id);
      const visibility = isHidden ? 0.08 : 1; // 非关系卦只剩 8% 可见度
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
      const depthAlpha = (0.4 + depth * 0.6) * brightBoost * visibility;  // 深度透明度 × 脉冲增亮 × focus可见度
      const baseR = n.isPure ? 5 : (isFocus ? 6.5 : (isRel ? 4.5 : 1.8 + degFactor * 3));
      const r = baseR * breathe * ease * depthScale * glowBoost;

      // 外光晕（用预渲染贴图，性能优化）—— drawImage 替代 createRadialGradient
      const haloR = (isFocus ? 60 : (isRel ? 38 : (n.isPure ? 26 : 16 + degFactor * 24))) * ease * depthScale * glowBoost;
      const da = (a) => a * depthAlpha; // 深度调暗 × 脉冲增亮
      const haloA = isFocus ? da(0.5) : (isRel ? da(0.42) : (n.isPure ? da(0.34) : da(0.22 + degFactor * 0.16)));
      this._drawGlow(ctx, this.glowHalo, p.x, p.y, haloR, haloA);

      // 亮核光晕（用预渲染贴图）
      const coreGlowR = r * 3.2;
      const coreA = da(isFocus ? 0.95 : (isRel ? 0.75 : (n.isPure ? 0.68 : 0.52 + degFactor * 0.3)));
      this._drawGlow(ctx, this.glowCore, p.x, p.y, coreGlowR, coreA);

      // 实心核（按深度调透明度）
      const coreAlpha = depthAlpha;
      const coreColor = isFocus ? `rgba(255,252,240,${coreAlpha})` : (isRel ? `rgba(252,240,205,${coreAlpha})` : (n.isPure ? `rgba(245,220,160,${0.95 * coreAlpha})` : `rgba(232,208,154,${(0.85 + degFactor * 0.15) * coreAlpha})`));
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 复习模式：待复习卦金色脉冲环
      if (this.reviewDueSet && this.reviewDueSet.has(n.id)) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
        const ringR = r + 8 + pulse * 8;
        ctx.strokeStyle = `rgba(232, 208, 154, ${0.4 + pulse * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringR * depthScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ★ 关键词小星团（LOD：需明显放大才显示，每个关键词是发光星点 + 文字）
      const lod = this.view.scale * depthScale;
      if (this.keywordLayouts && this.keywordLayouts[n.id] && lod > 1.4) {
        const kwAlpha = Math.min(1, (lod - 1.4) / 0.7) * ease * (0.5 + depth * 0.5);
        const layout = this.keywordLayouts[n.id];
        const twinkle = 0.7 + 0.3 * Math.sin(t * 0.03 + n.binaryCode.charCodeAt(1));
        for (const kw of layout) {
          if (kw.level === 0) continue; // 卦名由标签层处理
          // 关键词星点位置（带微浮动）
          const floatX = Math.sin(t * 0.01 + kw.phase) * 1.5;
          const floatY = Math.cos(t * 0.012 + kw.phase) * 1.5;
          const kx = p.x + (kw.dx + floatX) * depthScale;
          const ky = p.y + (kw.dy + floatY) * depthScale;
          // 关键词发光星点（用预渲染贴图）
          const starR = (kw.level === 1 ? 8 : (kw.level === 2 ? 6 : 5)) * depthScale;
          const starA = (kw.level === 1 ? 0.7 : (kw.level === 2 ? 0.55 : 0.42)) * kwAlpha * twinkle;
          this._drawGlow(ctx, this.glowCore, kx, ky, starR, starA);
          // 关键词实心小点
          const dotR = (kw.level === 1 ? 2 : 1.5) * depthScale;
          ctx.globalAlpha = starA;
          ctx.fillStyle = kw.level === 1 ? '#e8d09a' : (kw.level === 2 ? '#c9a96a' : '#a89878');
          ctx.beginPath();
          ctx.arc(kx, ky, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // 关键词文字标签（在星点旁）
          const fs = (kw.level === 1 ? 11 : (kw.level === 2 ? 9 : 8)) * depthScale * (0.7 + lod * 0.2);
          ctx.font = `${fs}px "ZCOOL XiaoWei", "Ma Shan Zheng", "STKaiti", serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = kw.level === 1 ? `rgba(232,208,154,${kwAlpha})` : (kw.level === 2 ? `rgba(200,175,120,${kwAlpha * 0.85})` : `rgba(160,140,95,${kwAlpha * 0.7})`);
          ctx.fillText(kw.text, kx + dotR + 3, ky);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // 卦名标签：交互标签与 8 纯卦强制保留，普通标签按优先级防碰撞。
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nameLabels = layoutStarNameLabels(ctx, this.graph.nodes, {
      hoveredNode: this.hoveredNode,
      activeNode: this.activeNode,
      focusVisible: this.focusVisible,
      appearProgress: this.appearProgress,
      time: t,
    });
    for (const label of nameLabels) {
      ctx.font = label.font;
      ctx.fillStyle = label.fillStyle;
      ctx.fillText(label.text, label.x, label.y);
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
    // 计算所有关系目标（错综互变），focus 模式只显示这些
    const rels = allRelations(code);
    this.focusVisible = new Set([code, rels.opposite, rels.reversed, rels.interlocking, ...rels.changing]);
    // 相机飞入该星位置，居中显示
    this.cameraTarget = { x: node.x - this.cx, y: node.y - this.cy, z: node.z };
  }

  // 退出焦点，回到球心俯瞰
  clearFocus() {
    this.cameraTarget = null;
    this.activeNode = null;
    this.focusVisible = null;
    this.autoRotate = !this.reducedMotion;
  }

  setMode(mode) { this.mode = mode; }

  // 设置待复习卦列表（复习模式状态层）
  setReviewDue(codes) {
    this.reviewDueSet = codes ? new Set(codes) : null;
  }

  // === 关系漫游轨迹 ===
  // 添加一段轨迹（从 fromCode 到 toCode）
  addTrail(fromCode, toCode) {
    if (fromCode && toCode && fromCode !== toCode) {
      this.trail.push({ from: fromCode, to: toCode, t: 0 }); // t=动画进度
      if (this.trail.length > 48) this.trail.splice(0, this.trail.length - 48);
    }
  }
  clearTrail() { this.trail = []; }

  // 缩放控制（供 UI 按钮调用）
  zoomBy(factor) {
    this.view.scale = Math.max(0.3, Math.min(4, this.view.scale * factor));
  }
  zoomReset() {
    this.view.scale = 1;
  }
  getZoomPercent() {
    return Math.round(this.view.scale * 100);
  }

  destroy() {
    this.pause('destroy');
    this.simulation.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.motionPreference.removeEventListener) {
      this.motionPreference.removeEventListener('change', this.handleMotionPreferenceChange);
    } else {
      this.motionPreference.removeListener?.(this.handleMotionPreferenceChange);
    }
  }

  resize() {
    const previous = { width: this.width, height: this.height, cx: this.cx, cy: this.cy, anchorR: this.anchorR };
    this._setupDpr();
    const scale = previous.anchorR ? this.anchorR / previous.anchorR : 1;
    for (const node of this.graph.nodes) {
      node.x = this.cx + (node.x - previous.cx) * scale;
      node.y = this.cy + (node.y - previous.cy) * scale;
      node.targetX = this.cx + (node.targetX - previous.cx) * scale;
      node.targetY = this.cy + (node.targetY - previous.cy) * scale;
      node._zBase *= scale;
      node.z *= scale;
      node.zAmp *= scale;
    }
    this._initBackground();
    this.simulation.force('xA', forceX(d => d.targetX).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.force('yA', forceY(d => d.targetY).strength(d => d.isPure ? 1 : 0.25));
    this.simulation.force('center', forceCenter(this.cx, this.cy));
    this.simulation.alpha(0.3).restart();
  }
}
