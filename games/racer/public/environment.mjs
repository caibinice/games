import * as T from 'three';
import { THEMES } from './tracks.mjs';

// Instanced roadside scenery: map changes alter silhouettes, not just sky colour.
export function createEnvironment(scene, { mobile = false } = {}) {
  const box = new T.BoxGeometry(1, 1, 1),
    cone = new T.ConeGeometry(1, 1, 7),
    trunk = new T.CylinderGeometry(0.8, 1, 1, 6),
    rock = new T.IcosahedronGeometry(1, 1),
    roof = new T.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
    volcano = new T.CylinderGeometry(0.22, 1, 1, 8),
    crater = new T.TorusGeometry(0.65, 0.1, 6, 16).rotateX(Math.PI / 2);
  const matrix = new T.Matrix4(),
    quat = new T.Quaternion(),
    axis = new T.Vector3(0, 1, 0),
    pos = new T.Vector3(),
    scale = new T.Vector3();
  const material = (color, emission = 0) =>
    new T.MeshStandardMaterial({
      color,
      roughness: 0.9,
      emissive: emission ? color : 0,
      emissiveIntensity: emission,
    });
  const maps = THEMES.map((theme, themeIndex) => {
    const group = new T.Group();
    group.visible = false;
    scene.add(group);
    const defs = new Map();
    const bark = material(theme.id === 'snow' ? 0x818c96 : 0x665246),
      leaf = material(theme.id === 'forest' ? 0x294d3c : theme.id === 'snow' ? 0xc3d4d6 : 0x63824d),
      leafTop = material(
        theme.id === 'forest' ? 0x486d43 : theme.id === 'snow' ? 0xeff3f2 : 0x91a867,
      ),
      hill = material(theme.id === 'snow' ? 0xc7d8e4 : theme.id === 'lava' ? 0x42383e : 0x71925a),
      hillTop = material(
        theme.id === 'snow' ? 0xf5f5ed : theme.id === 'lava' ? 0xb45332 : 0x90a46c,
      ),
      wall = material(theme.id === 'city' ? 0x617c8d : 0xbdb69a),
      roofMat = material(theme.id === 'city' ? 0x304d64 : 0x925a43),
      windows = material(theme.id === 'city' ? 0x85dcd9 : 0x8fb6ba, theme.id === 'city' ? 0.9 : 0),
      glow = material(theme.accent, 1.4),
      dark = material(0x374245);
    function add(geo, mat, x, y, z, sx, sy, sz, rotation = 0) {
      const key = geo.uuid + mat.uuid;
      let b = defs.get(key);
      if (!b) {
        b = { geo, mat, items: [] };
        defs.set(key, b);
      }
      b.items.push({ x, y, z, sx, sy, sz, rotation });
    }
    function tree(x, z, h = 7, snow = false) {
      add(trunk, bark, x, h * 0.25 - 0.7, z, 0.35, h * 0.5, 0.35);
      for (let k = 0; k < 3; k++)
        add(
          cone,
          k === 2 ? leafTop : leaf,
          x,
          h * (0.48 + k * 0.18) - 0.7,
          z,
          h * (0.24 - k * 0.045),
          h * 0.48,
          h * (0.24 - k * 0.045),
        );
      if (snow) add(cone, hillTop, x, h * 0.82 - 0.7, z, h * 0.17, h * 0.35, h * 0.17);
    }
    for (let i = 0; i < 84; i++) {
      const side = i % 2 ? -1 : 1,
        z = -((i * 13) % 420),
        x = side * (11 + ((i * 17) % 57));
      if (theme.id === 'forest') tree(x, z, 7 + ((i * 7) % 8));
      if (theme.id === 'snow') {
        if (i % 3 === 0) tree(x, z, 6 + (i % 5), true);
        else
          add(rock, i % 2 ? hill : hillTop, x, -0.4, z, 2 + (i % 4), 1 + (i % 3), 2 + (i % 3), i);
      }
      if (theme.id === 'grassland') {
        if (i % 4 === 0) tree(x, z, 5 + (i % 4));
        if (i % 7 === 0) {
          // windmill tower and crossed blades
          add(trunk, wall, x, 4, z, 0.8, 9, 0.8);
          add(box, glow, x, 7.5, z, 6, 0.16, 0.15, 0);
          add(box, wall, x, 7.5, z, 0.15, 6, 0.15, 0);
        }
        if (i % 3 === 0) add(rock, hill, x * 1.6, -1, z, 11 + (i % 7), 5 + (i % 5), 13 + (i % 6));
      }
      if (theme.id === 'city') {
        const h = 8 + ((i * 13) % 30),
          w = 4 + ((i * 7) % 6);
        add(box, wall, x, h / 2 - 0.7, z, w, h, 7);
        add(box, roofMat, x, h - 0.6, z, w + 0.2, 0.2, 7.2);
        for (let r = 2; r < h - 1; r += 3) add(box, windows, x, r - 0.7, z, w + 0.04, 0.22, 7.06);
      }
      if (theme.id === 'suburb') {
        const h = 3 + (i % 3),
          w = 4 + (i % 3);
        add(box, wall, x, h / 2 - 0.7, z, w, h, 5);
        add(roof, roofMat, x, h + 0.5, z, w * 0.8, 2, w * 0.8);
        add(box, windows, x, h * 0.55 - 0.7, z + 2.52, w * 0.6, 0.8, 0.06);
        if (i % 3 === 0) tree(x + side * 5, z, 5);
      }
      if (theme.id === 'lava') {
        add(rock, hill, x, -0.2, z, 2 + (i % 4), 1.5 + (i % 3), 2 + (i % 4), i);
        if (i % 4 === 0) add(box, glow, x, -0.4, z, 0.7, 0.08, 12 + (i % 10), i * 0.63);
      }
    }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? -1 : 1,
        x = side * (48 + ((i * 7) % 65)),
        z = -((i * 31) % 440),
        h = 15 + ((i * 11) % 35);
      if (theme.id === 'snow') {
        add(cone, hill, x, h / 2 - 1, z, h * 0.7, h, h * 0.65, i * 0.3);
        add(cone, hillTop, x, h * 0.83 - 1, z, h * 0.25, h * 0.35, h * 0.24, i * 0.3);
      } else if (theme.id === 'lava') {
        add(volcano, hill, x, h / 2 - 1, z, h * 0.8, h, h * 0.7, i * 0.4);
        add(crater, glow, x, h - 1, z, h * 0.27, 1, h * 0.24);
      } else if (theme.id === 'forest' || theme.id === 'grassland' || theme.id === 'suburb')
        add(rock, hill, x, -4, z, 25 + (i % 15), 13 + (i % 9), 30 + (i % 10), i * 0.3);
    }
    const batches = [...defs.values()].map(({ geo, mat, items }) => {
      const mesh = new T.InstancedMesh(geo, mat, items.length);
      mesh.frustumCulled = false;
      mesh.receiveShadow = !mobile;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      group.add(mesh);
      return { mesh, items };
    });
    const count = theme.id === 'snow' ? (mobile ? 100 : 180) : theme.id === 'lava' ? 70 : 0;
    let weather = null;
    if (count) {
      const points = new Float32Array(count * 3);
      for (let i = 0; i < count; i++)
        points.set([((i * 13) % 80) - 40, ((i * 7) % 23) + 2, -((i * 19) % 180)], i * 3);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(points, 3));
      weather = new T.Points(
        geometry,
        new T.PointsMaterial({
          color: theme.id === 'lava' ? 0xffba79 : 0xf1fcff,
          size: theme.id === 'lava' ? 0.11 : 0.12,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      );
      group.add(weather);
    }
    return { group, batches, weather, themeIndex };
  });
  let current = -1;
  return {
    update(info, distance, now) {
      const next = THEMES.indexOf(info.theme);
      if (current !== next) {
        for (let i = 0; i < maps.length; i++) maps[i].group.visible = i === next;
        current = next;
      }
      const map = maps[current];
      for (const { mesh, items } of map.batches) {
        for (let i = 0; i < items.length; i++) {
          const o = items[i],
            z = -((((-o.z - distance * 0.9) % 440) + 440) % 440) + 28;
          pos.set(o.x, o.y, z);
          scale.set(o.sx, o.sy, o.sz);
          quat.setFromAxisAngle(axis, o.rotation);
          matrix.compose(pos, quat, scale);
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (map.weather) {
        const a = map.weather.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const speed = info.theme.id === 'lava' ? -2 : 3;
          a.array[i * 3 + 1] = ((((i * 7 - now * 0.001 * speed) % 24) + 24) % 24) + 1;
        }
        a.needsUpdate = true;
      }
    },
  };
}
