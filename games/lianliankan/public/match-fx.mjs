/* Presentation only: the engine still owns the path, score and combo. */
const colors = [
  '#dc5172',
  '#e57b29',
  '#a17c07',
  '#6767cc',
  '#d45645',
  '#728c2c',
  '#ce4474',
  '#a68007',
  '#8851ba',
  '#28896a',
  '#db6662',
  '#a76918',
  '#638f3d',
  '#477d36',
  '#926741',
  '#bd3a92',
];
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const point = (item, grid, frame, step, cell, axis) => {
  const [start, end, size, client, startBorder] =
    axis === 'x'
      ? ['left', 'right', 'width', 'clientWidth', 'clientLeft']
      : ['top', 'bottom', 'height', 'clientHeight', 'clientTop'];
  const origin = frame[start] + frame.element[startBorder];
  const length = frame.element[client];
  if (item === -1) return Math.max(3, (grid[start] - origin) / 2);
  if (item === step.count) return Math.min(length - 3, (grid[end] - origin + length) / 2);
  return grid[start] - origin + cell[size] / 2 + item * step.pitch;
};
export function showLinkFx(svg, grid, fx, { duel = false } = {}) {
  if (
    !svg ||
    !grid?.firstElementChild ||
    !Array.isArray(fx?.path) ||
    fx.path.length < 2 ||
    fx.path.length > 4
  )
    return;
  const cols = duel ? 8 : Number(grid.style.getPropertyValue('--cols'));
  if (!Number.isInteger(cols) || cols < 2) return;
  const rows = Math.floor(grid.children.length / cols);
  if (
    !fx.path.every(
      (p) =>
        p &&
        Number.isInteger(p.x) &&
        Number.isInteger(p.y) &&
        p.x >= -1 &&
        p.x <= cols &&
        p.y >= -1 &&
        p.y <= rows,
    )
  )
    return;
  const container = svg.parentElement;
  const frame = container.getBoundingClientRect();
  const bounds = grid.getBoundingClientRect(),
    cell = grid.firstElementChild.getBoundingClientRect();
  if (!container.clientWidth || !cell.width) return;
  const xs = { count: cols, pitch: grid.children[1].getBoundingClientRect().left - cell.left };
  const ys = { count: rows, pitch: grid.children[cols].getBoundingClientRect().top - cell.top };
  const rect = { left: frame.left, top: frame.top, element: container };
  const path = fx.path.map(({ x, y }) => [
    point(x, bounds, rect, xs, cell, 'x'),
    point(y, bounds, rect, ys, cell, 'y'),
  ]);
  const combo = Math.min(99, Math.max(1, Math.trunc(fx.combo) || 1));
  const points = Math.min(99999, Math.max(0, Math.trunc(fx.points) || 0));
  const color = colors[fx.fruit - 1] || '#598b56';
  const scale = Math.max(0.62, Math.min(cell.width / 46, 1.3));
  const simple = reduced(),
    endpoints = [path[0], path.at(-1)];
  const width = container.clientWidth,
    height = container.clientHeight;
  const length = path
    .slice(1)
    .reduce((sum, [x, y], i) => sum + Math.hypot(x - path[i][0], y - path[i][1]), 0);
  if (length < 1) return;
  const labelX = Math.max(44, Math.min(width - 44, (endpoints[0][0] + endpoints[1][0]) / 2));
  const labelY = Math.max(
    23,
    Math.min(height - 12, (endpoints[0][1] + endpoints[1][1]) / 2 - 21 * scale),
  );
  const line = path.map((p) => p.join(',')).join(' ');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.dataset.linkBurst = '';
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  while (svg.children.length >= 3) svg.firstElementChild.remove();
  group.innerHTML = `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="${line}" stroke="${color}" stroke-width="${10 * scale}" opacity=".25"/>
    <polyline points="${line}" stroke="${color}" stroke-width="${6 * scale}"/>
    <polyline points="${line}" stroke="#fffdeb" stroke-width="${2.5 * scale}" stroke-dasharray="${length}" data-tracer/>
    </g>${endpoints
      .map(
        ([x, y]) =>
          `<g transform="translate(${x} ${y})"><circle data-ring r="${11 * scale}" stroke="${color}" stroke-width="2.4" fill="#fff9d8" fill-opacity=".24"/>${
            simple
              ? ''
              : Array.from({ length: combo > 2 ? 8 : 6 }, (_, i) => {
                  const a = (i * Math.PI) / 3.65 + 0.37,
                    d = (18 + (i % 3) * 5) * scale;
                  return `<path data-chip data-dx="${Math.cos(a) * d}" data-dy="${Math.sin(a) * d}" d="M0 -4 3 0 0 5 -2 1Z" fill="${i % 2 ? '#ffdc6b' : color}" stroke="#fff8e1" stroke-width=".6"/>`;
                }).join('')
          }</g>`,
      )
      .join('')}
    <g transform="translate(${labelX} ${labelY})"><g data-score><rect x="${combo > 1 ? -44 : -25}" y="-12" width="${combo > 1 ? 88 : 50}" height="23" rx="9" fill="#254337" stroke="${color}" stroke-width="2"/><text text-anchor="middle" y="4" fill="#fff7cc" font-size="11" font-weight="850" font-family="system-ui">+${points}${combo > 1 ? '  ×' + combo : ''}</text></g></g>`;
  svg.append(group);
  if (!simple) {
    group
      .querySelector('[data-tracer]')
      .animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
        duration: 85,
        fill: 'both',
        easing: 'ease-out',
      });
    for (const ring of group.querySelectorAll('[data-ring]'))
      ring.animate(
        [
          { transform: 'scale(.52)', opacity: 1 },
          { transform: 'scale(1.75)', opacity: 0 },
        ],
        { duration: 230, easing: 'ease-out', fill: 'both' },
      );
    for (const chip of group.querySelectorAll('[data-chip]'))
      chip.animate(
        [
          { transform: 'scale(.7)', opacity: 1 },
          {
            transform: `translate(${chip.dataset.dx}px,${chip.dataset.dy}px) rotate(100deg)`,
            opacity: 0,
          },
        ],
        { duration: 260, easing: 'ease-out', fill: 'both' },
      );
    group
      .querySelector('[data-score]')
      .animate(
        [
          { transform: 'translateY(8px) scale(.78)' },
          { transform: 'translateY(-3px) scale(1.06)', offset: 0.36 },
          { transform: 'translateY(-9px)' },
        ],
        { duration: 400, fill: 'both', easing: 'ease-out' },
      );
  }
  const anim = group.animate([{ opacity: 1 }, { opacity: 1, offset: 0.48 }, { opacity: 0 }], {
    duration: simple ? 240 : 440,
    fill: 'both',
  });
  anim.onfinish = () => group.remove();
}

export function playLinkMatch(ctx, combo = 1) {
  const at = ctx.currentTime,
    pitch = 1 + Math.min(7, Math.max(0, combo - 1)) * 0.045;
  for (const [delay, from, to, peak, duration, kind] of [
    [0, 240, 102, 0.08, 0.082, 'sine'],
    [0.013, 870 * pitch, 630 * pitch, 0.05, 0.09, 'triangle'],
    [0.058, 1180 * pitch, 1080 * pitch, 0.037, 0.14, 'sine'],
  ]) {
    const time = at + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = kind;
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(to, time + duration);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + duration + 0.01);
  }
}
