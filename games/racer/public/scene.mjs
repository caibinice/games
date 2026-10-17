import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, levelInfo, JET_DURATION } from './engine.mjs';

const ASSETS = '/games/racer/assets/';
export async function createScene(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 470);
  const sky = new THREE.Color('#b8d5dd');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 90, 320);
  scene.add(new THREE.HemisphereLight(0xe0f7ff, 0x38454b, 2.4));
  const sun = new THREE.DirectionalLight(0xffdfb8, 3.7);
  sun.position.set(-25, 35, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 30,
    bottom: -18,
    near: 1,
    far: 100,
  });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const materials = new Set(),
    geometries = new Set(),
    textures = new Set();
  function mat(color, metalness = 0, roughness = 0.8, emissive = 0) {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive: emissive ? color : 0,
      emissiveIntensity: emissive,
    });
    materials.add(m);
    return m;
  }
  const asphalt = mat(0x283740),
    concrete = mat(0x8d9c9e),
    line = mat(0xe6e1c8),
    glass = mat(0x9ec7cd, 0.65, 0.2),
    steel = mat(0x455a62, 0.6, 0.32),
    amber = mat(0xffa35e, 0.2, 0.4),
    cyan = mat(0x8effed, 0.2, 0.35, 1.5);
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.add(box);
  function cube(w, h, d, m, x = 0, y = 0, z = 0, parent = scene) {
    const o = new THREE.Mesh(box, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  cube(900, 0.2, 600, mat(0x5a9aa8, 0.4, 0.25), 0, -5, -210);
  cube(12, 0.6, 480, asphalt, 0, -0.35, -200);
  for (const side of [-1, 1]) {
    cube(0.35, 0.7, 480, concrete, side * 5.9, 0.15, -200);
    cube(0.07, 0.08, 480, cyan, side * 5.7, 0.52, -200);
    cube(0.08, 0.12, 480, line, side * 5.1, 0.015, -200);
  }
  const marks = new THREE.InstancedMesh(box, line, 100);
  marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  marks.frustumCulled = false;
  scene.add(marks);
  const matrix = new THREE.Matrix4();
  const posts = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? -1 : 1,
      z = -i * 20;
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(side * 7, 0, z);
    cube(0.13, 7, 0.13, steel, 0, 3.3, 0, group);
    cube(2.2, 0.12, 0.15, steel, -side * 0.9, 6.8, 0, group);
    cube(1.6, 0.04, 0.22, cyan, -side * 0.9, 6.72, 0, group);
    posts.push(group);
  }
  // Shared geometry/materials keep the roadside skyline inexpensive on phones.
  const buildings = [];
  for (let i = 0; i < 76; i++) {
    const side = i % 2 ? -1 : 1,
      h = 5 + ((i * 13) % 28),
      w = 4 + ((i * 7) % 8),
      x = side * (14 + ((i * 11) % 42)),
      z = -i * 6;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    cube(w, h, 7, i % 3 === 0 ? glass : concrete, 0, h / 2 - 3, 0, group);
    cube(w + 0.2, 0.18, 7.2, steel, 0, h - 3, 0, group);
    for (let row = 2; row < h - 2; row += 3)
      cube(w + 0.03, 0.18, 7.04, i % 4 === 0 ? cyan : glass, 0, row - 3, 0, group);
    buildings.push(group);
  }
  const cityByMaterial = new Map();
  for (const [index, group] of buildings.entries()) {
    for (const child of group.children) {
      const instances = cityByMaterial.get(child.material) || [];
      instances.push({
        index,
        x: group.position.x + child.position.x,
        y: child.position.y,
        scale: child.scale.clone(),
      });
      cityByMaterial.set(child.material, instances);
    }
    scene.remove(group);
  }
  const cityBatches = [...cityByMaterial].map(([material, instances]) => {
    const mesh = new THREE.InstancedMesh(box, material, instances.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, instances };
  });
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(15, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffebc5 }),
  );
  sunDisc.position.set(-100, 45, -310);
  scene.add(sunDisc);
  const loader = new GLTFLoader();
  const [playerGLTF, ...trafficGLTF] = await Promise.all(
    ['jet-r.glb', 'sedan.glb', 'suv.glb', 'truck.glb'].map((f) => loader.loadAsync(ASSETS + f)),
  );
  const player = new THREE.Group();
  scene.add(player);
  player.add(playerGLTF.scene);
  const paint = [];
  player.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material.name === 'JET_R_Paint') {
        o.material = o.material.clone();
        paint.push(o.material);
      }
    }
  });
  const traffic = trafficGLTF.map((g) => {
    const root = g.scene,
      bounds = new THREE.Box3().setFromObject(root),
      size = bounds.getSize(new THREE.Vector3());
    root.scale.setScalar(1.8 / size.x);
    root.position.y = -bounds.min.y * root.scale.x;
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return root;
  });
  const shadowTexCanvas = document.createElement('canvas');
  shadowTexCanvas.width = 64;
  shadowTexCanvas.height = 64;
  const ctx = shadowTexCanvas.getContext('2d'),
    gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#000a');
  gradient.addColorStop(1, '#0000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(shadowTexCanvas);
  textures.add(tex);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  scene.add(shadow);
  const models = new Map(),
    pool = new Map();
  const coinGeo = new THREE.TorusGeometry(0.34, 0.09, 6, 12);
  geometries.add(coinGeo);
  function makeObject(o) {
    const group = new THREE.Group();
    if (o.type === 'traffic') group.add(traffic[o.variant % traffic.length].clone(true));
    if (o.type === 'barrier') {
      cube(2.6, 0.7, 0.7, amber, 0, 0.35, 0, group);
      for (const x of [-0.85, 0, 0.85]) {
        const stripe = cube(0.22, 0.73, 0.72, line, x, 0.35, 0, group);
        stripe.rotation.z = -0.45;
      }
    }
    if (o.type === 'gate') {
      for (const side of [-1, 1]) cube(0.18, 4, 0.2, steel, side * 1.35, 2, 0, group);
      cube(2.9, 0.5, 0.4, amber, 0, 3.5, 0, group);
      cube(2.4, 0.07, 0.43, cyan, 0, 3.5, 0.01, group);
    }
    if (o.type === 'coin') {
      const coin = new THREE.Mesh(coinGeo, mat(0xffcd65, 0.75, 0.22, 0.3));
      coin.position.y = 0.8;
      group.add(coin);
    }
    if (o.type === 'energy') {
      const e = cube(0.5, 0.9, 0.5, cyan, 0, 0.9, 0, group);
      e.rotation.z = 0.4;
    }
    scene.add(group);
    return group;
  }
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  geometries.add(puffGeo);
  const puffMat = new THREE.MeshBasicMaterial({
    color: 0xeefaff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  materials.add(puffMat);
  const puffs = Array.from({ length: 36 }, () => {
    const p = new THREE.Mesh(puffGeo, puffMat.clone());
    p.visible = false;
    scene.add(p);
    return { p, life: 0 };
  });
  let puffIndex = 0,
    puffClock = 0;
  const speedGeo = new THREE.BufferGeometry(),
    speedArray = new Float32Array(48 * 6);
  for (let i = 0; i < 48; i++) {
    const a = i * 6,
      x = (i % 2 ? -1 : 1) * (6 + (i % 7)),
      y = 1 + ((i * 7) % 11),
      z = -((i * 13) % 140);
    speedArray.set([x, y, z, x, y, z + 3], a);
  }
  speedGeo.setAttribute('position', new THREE.BufferAttribute(speedArray, 3));
  geometries.add(speedGeo);
  const speedLines = new THREE.LineSegments(
    speedGeo,
    new THREE.LineBasicMaterial({ color: 0xe4ffff, transparent: true, opacity: 0 }),
  );
  scene.add(speedLines);
  let width = 0,
    height = 0,
    prev = 0,
    hitShake = 0,
    landing = 0,
    lastDistance = 0,
    chapter = -1;
  function resize() {
    const w = canvas.clientWidth || 1,
      h = canvas.clientHeight || 1;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function update(g, now) {
    resize();
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
    prev = now;
    const info = levelInfo(g.level),
      moving = g.status === 'running';
    if (info.chapter !== chapter) {
      chapter = info.chapter;
      const color = [0xb8d5dd, 0x9c848c, 0x172c46][chapter];
      sky.setHex(color);
      scene.fog.color.copy(sky);
      sun.intensity = chapter === 2 ? 1.5 : 3.7;
      renderer.toneMappingExposure = chapter === 2 ? 1.6 : 1.2;
    }
    const travel = g.distance;
    for (let i = 0; i < 100; i++) {
      matrix.makeScale(0.1, 0.025, 4);
      matrix.setPosition(i < 50 ? -1.6 : 1.6, 0.015, -(i % 50) * 10 + (travel % 10));
      marks.setMatrixAt(i, matrix);
    }
    marks.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < posts.length; i++) posts[i].position.z = -i * 20 + (travel % 40);
    for (const { mesh, instances } of cityBatches) {
      for (const [i, instance] of instances.entries()) {
        const z = (-(((instance.index * 6 - travel * 0.85) % 456) + 456) % 456) + 35;
        matrix.makeScale(instance.scale.x, instance.scale.y, instance.scale.z);
        matrix.setPosition(instance.x, instance.y, z);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const present = new Set();
    for (const o of g.objects) {
      if (o.passed || o.z - travel > 280) continue;
      present.add(o.id);
      let m = models.get(o.id);
      if (!m) {
        const key = o.type + (o.variant ?? '');
        m = pool.get(key)?.pop() || makeObject(o);
        m.userData.pool = key;
        models.set(o.id, m);
      }
      m.visible = true;
      m.position.set(o.x, 0, -(o.z - travel));
      if (['coin', 'energy'].includes(o.type)) m.rotation.y = now * 0.0018;
    }
    for (const [id, m] of models)
      if (!present.has(id)) {
        m.visible = false;
        const list = pool.get(m.userData.pool) || [];
        list.push(m);
        pool.set(m.userData.pool, list);
        models.delete(id);
      }
    for (const ev of g.events) {
      if (ev.type === 'hit') hitShake = 0.6;
      if (ev.type === 'land') landing = 0.32;
    }
    g.events = [];
    hitShake = Math.max(0, hitShake - dt);
    landing = Math.max(0, landing - dt);
    player.position.set(g.x, g.height + Math.sin(now * 0.008) * 0.015, 0);
    player.rotation.set(
      0,
      (LANES[g.lane] - g.x) * -0.04,
      g.jet > 0 ? g.roll : (LANES[g.lane] - g.x) * -0.025,
    );
    player.visible = g.invulnerable <= 0 || Math.floor(now / 85) % 2 === 0;
    shadow.position.x = g.x;
    shadow.material.opacity = 1 - g.height * 0.13;
    shadow.scale.setScalar(1 + g.height * 0.15);
    if (moving && g.jet > 0) {
      puffClock += dt;
      while (puffClock > 0.025) {
        puffClock -= 0.025;
        const slot = puffs[puffIndex++ % puffs.length];
        slot.life = 0.55;
        slot.p.visible = true;
        slot.p.position.set(
          g.x + (puffIndex % 2 ? -0.68 : 0.68),
          g.height - 0.2,
          ((puffIndex % 3) - 1) * 1.05,
        );
        slot.p.scale.setScalar(0.15);
      }
    }
    for (const slot of puffs)
      if (slot.life > 0) {
        slot.life -= dt;
        slot.p.visible = slot.life > 0;
        slot.p.position.y -= dt * 6;
        slot.p.position.z += dt * (moving ? g.speed * 0.6 : 0);
        slot.p.scale.setScalar(0.15 + (1 - slot.life / 0.55) * 0.65);
        slot.p.material.opacity = Math.max(0, slot.life / 0.55) * 0.6;
      }
    const targetFov = 58 + g.boost * 8;
    camera.fov += (targetFov - camera.fov) * 0.06;
    camera.updateProjectionMatrix();
    camera.position.set(
      g.x * 0.2 + (hitShake ? Math.sin(now * 0.045) * hitShake * 0.18 : 0),
      5.1 + g.height * 0.23 - landing * 0.8,
      10.5 + g.boost * 0.8,
    );
    camera.lookAt(g.x * 0.38, 1.2 + g.height * 0.28, -17);
    speedLines.material.opacity = g.boost ? 0.36 : Math.max(0, (g.speed - 34) * 0.01);
    if (moving) {
      const arr = speedGeo.attributes.position;
      for (let i = 0; i < 48; i++) {
        const off = i * 6,
          delta = g.speed * dt * 2;
        speedArray[off + 2] += delta;
        speedArray[off + 5] += delta;
        if (speedArray[off + 2] > 10) {
          speedArray[off + 2] = -140;
          speedArray[off + 5] = -137;
        }
      }
      arr.needsUpdate = true;
    }
    renderer.render(scene, camera);
    canvas.dataset.drawCalls = renderer.info.render.calls;
    lastDistance = g.distance;
  }
  return {
    update,
    setColor(color) {
      for (const m of paint) m.color.set(color);
    },
    dispose() {
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        if (o.geometry) geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          materials.add(m);
          for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
        }
      });
      for (const x of geometries) x.dispose();
      for (const x of materials) x.dispose();
      for (const x of textures) x.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
