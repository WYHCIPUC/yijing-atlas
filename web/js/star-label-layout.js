// 所有空间文字共用一个屏幕坐标碰撞层，DOM 控件和星核也参与占位。
const textMeasurements = new WeakMap();

export function measureStarText(ctx, font, text) {
  let cache = textMeasurements.get(ctx);
  if (!cache) { cache = new Map(); textMeasurements.set(ctx, cache); }
  const key = `${font}\n${text}`;
  if (cache.has(key)) return cache.get(key);
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const result = {
    width: Math.max(1, Number(metrics.width) || 0),
    height: Math.max(1, (Number(metrics.actualBoundingBoxAscent) || 0)
      + (Number(metrics.actualBoundingBoxDescent) || 0)),
  };
  if (cache.size >= 2048) cache.clear();
  cache.set(key, result);
  return result;
}

function overlaps(a, b, gap) {
  return !(a.right + gap <= b.left || b.right + gap <= a.left
    || a.bottom + gap <= b.top || b.bottom + gap <= a.top);
}

export function placeStarLabels(candidates, {
  width = Infinity, height = Infinity, gap = 7, reservedRects = [],
} = {}) {
  const occupied = [...reservedRects];
  const visible = [];
  const ordered = [...candidates].sort((a, b) => (b.priority || 0) - (a.priority || 0)
    || (b.importance || 0) - (a.importance || 0)
    || String(a.id).localeCompare(String(b.id), 'en'));
  for (const candidate of ordered) {
    for (const point of [{ x: candidate.x, y: candidate.y }, ...(candidate.positions || [])]) {
      const box = { left: point.x - candidate.width / 2, right: point.x + candidate.width / 2,
        top: point.y - candidate.height / 2, bottom: point.y + candidate.height / 2 };
      if (box.left < gap || box.top < gap || box.right > width - gap || box.bottom > height - gap) continue;
      if (occupied.some(other => overlaps(box, other, gap))) continue;
      visible.push({ ...candidate, ...point, box });
      occupied.push(box);
      break;
    }
  }
  return visible.reverse();
}
