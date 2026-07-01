// SVG 卦象绘制：六爻图、八卦符号。
// 用 SVG 而非 Canvas：可缩放、可被 CSS 样式化、矢量清晰。
// 阳爻：一长横 ▬▬▬▬▬；阴爻：两短横 ▬▬ ▬▬；变爻加红色标记线。

// 生成六爻 SVG 字符串。binaryCode 6 位（自下而上），size 为画布像素。
export function hexagramSvg(binaryCode, { size = 120, changingPositions = [] } = {}) {
  if (!/^[01]{6}$/.test(binaryCode)) return '';
  const lines = [];
  const lineH = size / 7;        // 6 爻 + 间隔
  const strokeW = lineH * 0.55;
  const breakW = size * 0.28;    // 阴爻断开长度
  const half = (size - breakW) / 2;

  // 自下而上：i=0 为最底（y 最大）
  for (let i = 0; i < 6; i++) {
    const y = size - (i + 1) * lineH;
    const isYang = binaryCode[i] === '1';
    const isChanging = changingPositions.includes(i + 1);
    if (isYang) {
      lines.push(`<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    } else {
      lines.push(`<line x1="0" y1="${y}" x2="${half}" y2="${y}" stroke-width="${strokeW}"/>`);
      lines.push(`<line x1="${size - half}" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    }
    if (isChanging) {
      lines.push(`<line x1="0" y1="${y - lineH * 0.4}" x2="${size}" y2="${y - lineH * 0.4}" stroke="red" stroke-width="2"/>`);
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="hexagram-svg">
    <g stroke="#3e2723" stroke-linecap="round">${lines.join('')}</g>
  </svg>`;
}

// 生成八卦符号 SVG。binaryCode 3 位（自下而上）。
export function trigramSvg(binaryCode, { size = 64 } = {}) {
  if (!/^[01]{3}$/.test(binaryCode)) return '';
  const lines = [];
  const lineH = size / 4;
  const strokeW = lineH * 0.6;
  const breakW = size * 0.30;
  const half = (size - breakW) / 2;
  for (let i = 0; i < 3; i++) {
    const y = size - (i + 1) * lineH;
    if (binaryCode[i] === '1') {
      lines.push(`<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    } else {
      lines.push(`<line x1="0" y1="${y}" x2="${half}" y2="${y}" stroke-width="${strokeW}"/>`);
      lines.push(`<line x1="${size - half}" y1="${y}" x2="${size}" y2="${y}" stroke-width="${strokeW}"/>`);
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="trigram-svg">
    <g stroke="#3e2723" stroke-linecap="round">${lines.join('')}</g>
  </svg>`;
}
