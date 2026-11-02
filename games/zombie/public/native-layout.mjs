// Read-only native RectTransform geometry adapter. Does not create background screenshots.
export function resolveNativeLayout(
  page,
  { width = 750, height = 1334, activeOverrides = {} } = {},
) {
  const nodes = new Map(page.nodes.map((n) => [n.rectId, n])),
    cache = new Map();
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  function resolve(id) {
    if (cache.has(id)) return cache.get(id);
    const n = nodes.get(id),
      r = n.rect,
      parent = nodes.has(n.parentRectId) ? resolve(n.parentRectId) : null,
      piv = r.m_Pivot,
      amin = r.m_AnchorMin,
      amax = r.m_AnchorMax,
      pos = r.m_AnchoredPosition,
      scale = r.m_LocalScale,
      q = r.m_LocalRotation;
    const w = parent ? (amax.x - amin.x) * parent.width + r.m_SizeDelta.x : width,
      h = parent ? (amax.y - amin.y) * parent.height + r.m_SizeDelta.y : height;
    const x = parent
      ? -parent.pivot.x * parent.width + parent.width * (amin.x + (amax.x - amin.x) * piv.x) + pos.x
      : width * piv.x;
    const y = parent
      ? -parent.pivot.y * parent.height +
        parent.height * (amin.y + (amax.y - amin.y) * piv.y) +
        pos.y
      : height * piv.y;
    const a = 2 * Math.atan2(q.z, q.w),
      cos = Math.cos(a),
      sin = Math.sin(a),
      local = [cos * scale.x, sin * scale.x, -sin * scale.y, cos * scale.y, x, y],
      m = parent ? mul(parent.matrix, local) : local;
    const e = m[4] - m[0] * piv.x * w + m[2] * (1 - piv.y) * h,
      f = height - m[5] + m[1] * piv.x * w - m[3] * (1 - piv.y) * h,
      cssMatrix = [m[0], -m[1], -m[2], m[3], e, f];
    const active = (activeOverrides[n.path] ?? n.active) && (parent?.active ?? true),
      v = {
        ...n,
        width: w,
        height: h,
        pivot: piv,
        matrix: m,
        active,
        css: {
          width: w + 'px',
          height: h + 'px',
          transformOrigin: '0 0',
          transform: 'matrix(' + cssMatrix.join(',') + ')',
        },
        cssMatrix,
      };
    cache.set(id, v);
    return v;
  }
  return page.nodes.map((n) => resolve(n.rectId));
}
