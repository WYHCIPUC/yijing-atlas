// Lucide static SVG paths (ISC; Feather-derived icons MIT).
// Source: https://github.com/lucide-icons/lucide/tree/main/icons
// License: ../lib/vendor/LUCIDE-LICENSE.txt
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const path = (d) => ['path', { d }];
const circle = (cx, cy, r) => ['circle', { cx, cy, r }];

const icons = new Map([
  ['search', [path('m21 21-4.34-4.34'), circle(11, 11, 8)]],
  ['orbit', [path('M20.341 6.484A10 10 0 0 1 10.266 21.85'), path('M3.659 17.516A10 10 0 0 1 13.74 2.152'), circle(12, 12, 3), circle(19, 5, 2), circle(5, 19, 2)]],
  ['book-open', [path('M12 5v16'), path('M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z')]],
  ['calendar-days', [path('M8 2v3'), path('M16 2v3'), ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], path('M3 9h18'), path('M8 13h.01'), path('M12 13h.01'), path('M16 13h.01'), path('M8 17h.01'), path('M12 17h.01'), path('M16 17h.01')]],
  ['rotate-ccw', [path('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), path('M3 3v5h5')]],
  ['rotate-cw', [path('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'), path('M21 3v5h-5')]],
  ['compass', [circle(12, 12, 10), path('m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z')]],
  ['volume-2', [path('M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z'), path('M16 9a5 5 0 0 1 0 6'), path('M19.364 18.364a9 9 0 0 0 0-12.728')]],
  ['volume-x', [path('M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z'), path('m16.5 14.5 5-5'), path('m16.5 9.5 5 5')]],
  ['sliders-horizontal', [path('M10 5H3'), path('M12 19H3'), path('M14 3v4'), path('M16 17v4'), path('M21 12h-9'), path('M21 19h-5'), path('M21 5h-7'), path('M8 10v4'), path('M8 12H3')]],
  ['x', [path('M18 6 6 18'), path('m6 6 12 12')]],
  ['arrow-left', [path('m12 19-7-7 7-7'), path('M19 12H5')]],
  ['arrow-up-right', [path('M7 7h10v10'), path('M7 17 17 7')]],
  ['chevron-down', [path('m6 9 6 6 6-6')]],
  ['plus', [path('M5 12h14'), path('M12 5v14')]],
  ['minus', [path('M5 12h14')]],
  ['maximize', [path('M8 3H5a2 2 0 0 0-2 2v3'), path('M21 8V5a2 2 0 0 0-2-2h-3'), path('M3 16v3a2 2 0 0 0 2 2h3'), path('M16 21h3a2 2 0 0 0 2-2v-3')]],
  ['waypoints', [path('m10.586 5.414-5.172 5.172'), path('m18.586 13.414-5.172 5.172'), path('M6 12h12'), circle(12, 20, 2), circle(12, 4, 2), circle(20, 12, 2), circle(4, 12, 2)]],
  ['move-vertical', [path('M12 2v20'), path('m8 18 4 4 4-4'), path('m8 6 4-4 4 4')]],
  ['layers', [path('M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'), path('M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'), path('M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17')]],
]);

export function createUIIcon(name, documentRef = document) {
  const nodes = icons.get(name);
  if (!nodes) return null;
  const svg = documentRef.createElementNS(SVG_NAMESPACE, 'svg');
  const attributes = {
    viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.65, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true', focusable: 'false', class: `ui-icon ui-icon-${name}`,
  };
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
  for (const [tagName, nodeAttributes] of nodes) {
    const node = documentRef.createElementNS(SVG_NAMESPACE, tagName);
    for (const [key, value] of Object.entries(nodeAttributes)) node.setAttribute(key, value);
    svg.appendChild(node);
  }
  return svg;
}

export function installUIIcons(root = document) {
  const hosts = [...root.querySelectorAll('[data-icon]')];
  if (root.matches?.('[data-icon]')) hosts.unshift(root);
  let installed = 0;
  for (const host of hosts) {
    const name = host.dataset.icon;
    if (host.dataset.iconRendered === name) continue;
    const svg = createUIIcon(name, host.ownerDocument);
    if (!svg) continue;
    host.replaceChildren(svg);
    host.dataset.iconRendered = name;
    installed += 1;
  }
  return installed;
}
