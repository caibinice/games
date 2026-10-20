import * as T from 'three';

// Distinct silhouettes remain readable even before the player can read a label.
export const PICKUP_DESIGNS = {
  energy: { shape: 'fuel-can', color: 0x22e6ae, label: 'N₂', name: '氮气油桶' },
  reverse: { shape: 'horned-devil', color: 0xb46bff, label: '↔', name: '黑色魔鬼' },
  fullSpeed: { shape: 'lightning', color: 0xffb524, label: 'MAX', name: '全速闪电' },
  ghost: { shape: 'phase-crystal', color: 0x8eeaff, label: '◇', name: '隐身水晶' },
  repair: { shape: 'medical-case', color: 0xff5578, label: '+', name: '维修箱' },
};

export function createPickupFactory() {
  const box = new T.BoxGeometry(1, 1, 1),
    sphere = new T.SphereGeometry(0.62, 12, 8),
    horn = new T.ConeGeometry(0.18, 0.65, 7),
    crystal = new T.OctahedronGeometry(0.78),
    ring = new T.TorusGeometry(0.91, 0.035, 5, 24),
    boltShape = new T.Shape();
  boltShape.moveTo(0.14, 0.95);
  for (const [x, y] of [
    [-0.6, -0.1],
    [-0.08, -0.1],
    [-0.25, -0.95],
    [0.64, 0.25],
    [0.12, 0.25],
  ])
    boltShape.lineTo(x, y);
  boltShape.closePath();
  const bolt = new T.ExtrudeGeometry(boltShape, { depth: 0.22, bevelEnabled: false });
  bolt.translate(0, 0, -0.11);
  const dark = new T.MeshStandardMaterial({ color: 0x16112d, metalness: 0.4, roughness: 0.3 }),
    white = new T.MeshStandardMaterial({
      color: 0xf6ffff,
      emissive: 0xa5d9e8,
      emissiveIntensity: 0.35,
    }),
    colors = Object.fromEntries(
      Object.entries(PICKUP_DESIGNS).map(([key, d]) => [
        key,
        new T.MeshStandardMaterial({
          color: d.color,
          metalness: 0.35,
          roughness: 0.26,
          emissive: d.color,
          emissiveIntensity: 0.45,
        }),
      ]),
    );
  const labels = new Map();
  function label(type) {
    if (labels.has(type)) return labels.get(type);
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#071b2ed9';
    x.fillRect(4, 7, 120, 50);
    x.strokeStyle = new T.Color(PICKUP_DESIGNS[type].color).getStyle();
    x.lineWidth = 3;
    x.strokeRect(4, 7, 120, 50);
    x.fillStyle = '#ffffff';
    x.font = 'bold 34px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(PICKUP_DESIGNS[type].label, 64, 34);
    const m = new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false });
    labels.set(type, m);
    return m;
  }
  return function createPickup(type) {
    const root = new T.Group(),
      m = colors[type];
    root.userData.design = PICKUP_DESIGNS[type].shape;
    function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
      const o = new T.Mesh(geo, mat);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      root.add(o);
      return o;
    }
    function cube(mat, x, y, z, sx, sy, sz) {
      return mesh(box, mat, x, y, z, sx, sy, sz);
    }
    if (type === 'energy') {
      cube(m, 0, 1.06, 0, 1.12, 1.35, 0.64);
      cube(dark, 0.15, 1.84, 0, 0.62, 0.24, 0.34);
      cube(m, 0.15, 1.95, 0, 0.84, 0.13, 0.37);
      const cap = cube(white, -0.43, 1.81, 0, 0.25, 0.24, 0.4);
      cap.rotation.z = 0.35;
      for (const direction of [-1, 1])
        cube(dark, 0, 1.04, 0.335, 0.09, 0.88, 0.03).rotation.z = direction * 0.72;
    } else if (type === 'reverse') {
      mesh(sphere, dark, 0, 1.12, 0, 1.12, 0.95, 0.9);
      for (const s of [-1, 1]) {
        mesh(horn, m, s * 0.46, 1.78, 0).rotation.z = -s * 0.38;
        cube(m, s * 0.24, 1.22, 0.53, 0.3, 0.13, 0.08).rotation.z = -s * 0.3;
      }
      cube(white, 0, 0.88, 0.52, 0.32, 0.07, 0.06);
    } else if (type === 'fullSpeed') {
      mesh(bolt, m, 0, 1.25, 0, 1.1, 1.1, 1.4);
      mesh(bolt, white, -0.58, 1.22, -0.16, 0.45, 0.65, 0.5);
    } else if (type === 'ghost') {
      mesh(crystal, m, 0, 1.28, 0, 0.7, 1.25, 0.7);
      const halo = mesh(ring, white, 0, 1.18, 0, 0.92, 0.92, 0.92);
      halo.rotation.x = Math.PI * 0.36;
      halo.rotation.y = 0.3;
      mesh(crystal, white, 0.7, 1.9, 0, 0.14, 0.2, 0.14);
    } else if (type === 'repair') {
      cube(white, 0, 1.05, 0, 1.48, 0.95, 0.66);
      cube(m, 0, 1.64, 0, 0.65, 0.22, 0.35);
      cube(m, 0, 1.08, 0.35, 0.65, 0.22, 0.04);
      cube(m, 0, 1.08, 0.37, 0.22, 0.65, 0.04);
      for (const s of [-1, 1]) cube(m, s * 0.6, 1.05, 0, 0.15, 0.98, 0.7);
    }
    const tag = new T.Sprite(label(type));
    tag.position.set(0, 2.58, 0);
    tag.scale.set(1.3, 0.65, 1);
    root.add(tag);
    return root;
  };
}
