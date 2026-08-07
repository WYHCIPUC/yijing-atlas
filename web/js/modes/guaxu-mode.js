function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderGuaxuMode(mountEl, appState, onOpenDetail) {
  const sorted = [...appState.hexagrams].sort((a, b) => a.number - b.number);
  const items = sorted.map((hex, index) => {
    const angle = (index / 64) * 360 - 90;
    const radians = angle * Math.PI / 180;
    return {
      hex,
      angle,
      xNumber: 160 + Math.cos(radians) * 140,
      yNumber: 160 + Math.sin(radians) * 140,
      xName: 160 + Math.cos(radians) * 100,
      yName: 160 + Math.sin(radians) * 100,
    };
  });

  mountEl.innerHTML = `
    <div class="mode-panel">
      <h2 class="mode-panel-title">卦序盘</h2>
      <p class="mode-panel-sub">序卦传述说六十四卦的演化之理<br>聚焦查看，点击进入经文</p>
      <div class="guaxu-wheel-wrap">
        <svg class="guaxu-wheel" viewBox="0 0 320 320" role="img" aria-label="六十四卦卦序圆盘">
          <circle cx="160" cy="160" r="150" fill="none" stroke="rgba(201,169,106,0.1)" stroke-width="0.5"/>
          <circle cx="160" cy="160" r="108" fill="none" stroke="rgba(201,169,106,0.08)" stroke-width="0.5"/>
          <circle cx="160" cy="160" r="50" fill="rgba(201,169,106,0.04)" stroke="rgba(201,169,106,0.15)" stroke-width="0.5"/>
          <text x="160" y="155" text-anchor="middle" fill="#d4a574" font-size="11">序卦</text>
          <text x="160" y="170" text-anchor="middle" fill="#8a7a5a" font-size="8">演化之理</text>
          ${items.map((item, index) => index % 8 === 0
            ? `<line x1="${item.xName}" y1="${item.yName}" x2="160" y2="160" stroke="rgba(201,169,106,0.06)" stroke-width="0.5"/>`
            : '').join('')}
          ${items.map((item) => `
            <g class="guaxu-svg-node" data-code="${item.hex.binaryCode}" tabindex="0" role="button" aria-label="第${item.hex.number}卦 ${esc(item.hex.name)}">
              <text x="${item.xNumber}" y="${item.yNumber}" text-anchor="middle" dominant-baseline="central"
                fill="#5a6680" font-size="6" font-family="monospace"
                transform="rotate(${item.angle + 90}, ${item.xNumber}, ${item.yNumber})">${item.hex.number}</text>
              <text x="${item.xName}" y="${item.yName}" text-anchor="middle" dominant-baseline="central"
                fill="${item.hex.binaryCode.slice(0, 3) === item.hex.binaryCode.slice(3, 6) ? '#e8d09a' : '#c9a96a'}"
                font-size="${item.hex.binaryCode.slice(0, 3) === item.hex.binaryCode.slice(3, 6) ? '10' : '8'}"
                transform="rotate(${item.angle + 90}, ${item.xName}, ${item.yName})">${esc(item.hex.name)}</text>
              <circle cx="${item.xName}" cy="${item.yName}" r="8" fill="transparent"/>
            </g>
          `).join('')}
        </svg>
        <div class="guaxu-detail" aria-live="polite">
          <p>聚焦卦名查看序卦传说明</p>
        </div>
      </div>
    </div>
  `;

  const detail = mountEl.querySelector('.guaxu-detail');
  mountEl.querySelectorAll('.guaxu-svg-node').forEach((node) => {
    const hex = appState.index.byCode.get(node.dataset.code);
    const showDetail = () => {
      if (!hex) return;
      detail.innerHTML = `
        <div class="gd-name">${esc(hex.name)} · ${esc(hex.fullName)}</div>
        <div class="gd-num">第 ${hex.number} 卦</div>
        <div class="gd-remark">${esc(hex.orderRemark)}</div>
        ${hex.scenario ? `<div class="gd-scenario">${esc(hex.scenario)}</div>` : ''}
      `;
    };
    node.addEventListener('mouseenter', showDetail);
    node.addEventListener('focus', showDetail);
    node.addEventListener('click', () => onOpenDetail(node.dataset.code));
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpenDetail(node.dataset.code);
      }
    });
  });
}
