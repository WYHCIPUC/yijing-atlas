const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;

function safeText(value) {
  return String(value || '').trim();
}

function seededRandom(seedText) {
  let seed = [...seedText].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function buildHexagramRows(binaryCode) {
  if (!/^[01]{6}$/.test(binaryCode)) throw new TypeError('分享卡片需要六位阴阳码');
  return binaryCode.split('').reverse().map((bit, index) => ({
    position: 6 - index,
    isYang: bit === '1',
  }));
}

export function createShareCardModel(hexagram, url) {
  if (!hexagram || !/^[01]{6}$/.test(hexagram.binaryCode)) throw new TypeError('卦象数据不完整');
  return {
    number: hexagram.number,
    name: safeText(hexagram.name),
    fullName: safeText(hexagram.fullName),
    binaryCode: hexagram.binaryCode,
    rows: buildHexagramRows(hexagram.binaryCode),
    judgement: safeText(hexagram.judgement),
    judgementNote: safeText(hexagram.judgementNote),
    image: safeText(hexagram.image),
    scenario: safeText(hexagram.scenario),
    url: safeText(url),
  };
}

export function wrapCanvasText(ctx, text, maxWidth, maxLines = Number.POSITIVE_INFINITY) {
  const lines = [];
  let current = '';
  for (const char of safeText(text)) {
    const candidate = current + char;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && lines.join('').length < safeText(text).length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[，。；：、]$/, '')}…`;
  }
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapCanvasText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawHexagram(ctx, rows, centerX, topY) {
  const width = 292;
  const thickness = 24;
  const gap = 34;
  rows.forEach((row, index) => {
    const y = topY + index * 47;
    ctx.fillStyle = index === 0 ? '#f0d9a5' : '#d8b978';
    if (row.isYang) {
      roundedRect(ctx, centerX - width / 2, y, width, thickness, 8);
      ctx.fill();
    } else {
      const segment = (width - gap) / 2;
      roundedRect(ctx, centerX - width / 2, y, segment, thickness, 8);
      ctx.fill();
      roundedRect(ctx, centerX + gap / 2, y, segment, thickness, 8);
      ctx.fill();
    }
  });
}

function drawBackground(ctx, code) {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, '#08111f');
  gradient.addColorStop(0.55, '#101a2d');
  gradient.addColorStop(1, '#171426');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const random = seededRandom(code);
  for (let index = 0; index < 92; index += 1) {
    const x = 48 + random() * (CARD_WIDTH - 96);
    const y = 48 + random() * (CARD_HEIGHT - 96);
    const radius = 0.7 + random() * 2.1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232,208,154,${0.08 + random() * 0.34})`;
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(201,169,106,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(540, 395, 286, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(540, 395, 246, 0, Math.PI * 2);
  ctx.stroke();
}

export function createShareCardCanvas(hexagram, url, documentRef = globalThis.document) {
  const model = createShareCardModel(hexagram, url);
  const canvas = documentRef.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法生成分享图片');

  drawBackground(ctx, model.binaryCode);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#e8d09a';
  ctx.font = '600 34px "Noto Serif SC", "Songti SC", serif';
  ctx.fillText('易 象 图 谱', 78, 92);
  ctx.fillStyle = 'rgba(232,208,154,0.52)';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('YIJING ATLAS · 传统文化学习卡', 78, 126);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,208,154,0.72)';
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.fillText(`第 ${model.number} 卦`, 540, 222);
  drawHexagram(ctx, model.rows, 540, 274);
  ctx.fillStyle = '#f4dfae';
  ctx.font = '400 118px "STKaiti", "KaiTi", "Noto Serif SC", serif';
  ctx.fillText(model.name, 540, 642);
  ctx.fillStyle = '#c8ad79';
  ctx.font = '30px "Noto Serif SC", serif';
  ctx.fillText(`${model.fullName} · ${model.binaryCode}`, 540, 694);

  ctx.textAlign = 'left';
  roundedRect(ctx, 70, 752, 940, 186, 26);
  ctx.fillStyle = 'rgba(201,169,106,0.075)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,169,106,0.28)';
  ctx.stroke();
  ctx.fillStyle = '#c9a96a';
  ctx.font = '600 22px "Noto Sans SC", sans-serif';
  ctx.fillText('当 下 处 境', 106, 798);
  ctx.fillStyle = '#e8dcc1';
  ctx.font = '30px "Noto Serif SC", serif';
  drawWrappedText(ctx, model.scenario || model.judgementNote, 106, 848, 868, 44, 2);

  ctx.fillStyle = '#c9a96a';
  ctx.font = '600 22px "Noto Sans SC", sans-serif';
  ctx.fillText('卦 辞', 82, 986);
  ctx.fillStyle = '#f0dfbd';
  ctx.font = '34px "STKaiti", "KaiTi", "Noto Serif SC", serif';
  const judgementBottom = drawWrappedText(ctx, model.judgement, 82, 1038, 916, 46, 2);

  ctx.fillStyle = '#c9a96a';
  ctx.font = '600 22px "Noto Sans SC", sans-serif';
  ctx.fillText('大 象', 82, judgementBottom + 38);
  ctx.fillStyle = '#e8dcc1';
  ctx.font = '30px "Noto Serif SC", serif';
  drawWrappedText(ctx, model.image, 82, judgementBottom + 84, 916, 42, 2);

  ctx.strokeStyle = 'rgba(201,169,106,0.2)';
  ctx.beginPath();
  ctx.moveTo(78, 1320);
  ctx.lineTo(1002, 1320);
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,220,193,0.62)';
  ctx.font = '21px "Noto Sans SC", sans-serif';
  ctx.fillText('以卦观势，以理观心 · 内容仅供文化学习与自我反思', 78, 1364);
  ctx.textAlign = 'right';
  ctx.fillText(model.url.length > 62 ? `${model.url.slice(0, 59)}…` : model.url, 1002, 1398);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('分享图片生成失败'));
    }, 'image/png');
  });
}

export async function deliverShareImage({
  blob,
  filename,
  title,
  text,
  navigatorRef = globalThis.navigator,
  documentRef = globalThis.document,
  urlRef = globalThis.URL,
  FileCtor = globalThis.File,
}) {
  if (navigatorRef.share && FileCtor) {
    const file = new FileCtor([blob], filename, { type: 'image/png' });
    const shareData = { files: [file], title, text };
    if (navigatorRef.canShare?.(shareData)) {
      await navigatorRef.share(shareData);
      return { mode: 'share', filename };
    }
  }

  const objectUrl = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  return { mode: 'download', filename };
}

export async function generateHexagramShareImage(hexagram, url) {
  const canvas = createShareCardCanvas(hexagram, url);
  const previewUrl = canvas.toDataURL('image/png');
  const blob = await canvasToBlob(canvas);
  const filename = `易象图谱-第${hexagram.number}卦-${hexagram.name}.png`;
  return {
    blob,
    previewUrl,
    filename,
    title: `${hexagram.name} · ${hexagram.fullName}`,
    text: `我在“易象图谱”中读到第 ${hexagram.number} 卦：${hexagram.name}。${url}`,
  };
}

export async function shareHexagramImage(hexagram, url) {
  return deliverShareImage(await generateHexagramShareImage(hexagram, url));
}
