import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANES, ITEMS, OBSTACLES, levelInfo } from './engine.mjs';
import { createEnvironment } from './environment.mjs';
import { visualPose, frameSize } from './presentation.mjs';
import { createPickupFactory } from './pickups.mjs';
import { createGhostMaterial, createNitroExhaust, GHOST_BODY_ALPHA } from './effects.mjs';

const ASSETS = '/games/racer/assets/';
export async function createScene(canvas, { mobile = false } = {}) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(60, 1, 0.1, 470),
    sky = new T.Color();
  scene.background = sky;
  scene.fog = new T.Fog(sky, 100, 340);
  const ambient = new T.HemisphereLight(0xe0f7ff, 0x34433e, 2.1);
  scene.add(ambient);
  const sun = new T.DirectionalLight(0xffdfb8, 3.4);
  sun.position.set(-25, 35, -28);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 32,
    bottom: -18,
    near: 1,
    far: 100,
  });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const materials = new Set(),
    geometries = new Set(),
    textures = new Set();
  const material = (color, metalness = 0, roughness = 0.8, emissive = 0) => {
    const m = new T.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive: emissive ? color : 0,
      emissiveIntensity: emissive,
    });
    materials.add(m);
    return m;
  };
  const asphalt = material(0x384849),
    rail = material(0xa8b5b1),
    line = material(0xe6e1c8),
    steel = material(0x455a62, 0.6, 0.32),
    amber = material(0xffa35e, 0.2, 0.4),
    cyan = material(0x8effed, 0.2, 0.35, 1.4),
    groundMat = material(0x739c52),
    rubber = material(0x17212a),
    truckMat = [material(0x58768a, 0.35, 0.45), material(0xb58b66, 0.3, 0.5)];
  const box = new T.BoxGeometry(1, 1, 1),
    wheelGeo = new T.CylinderGeometry(0.55, 0.55, 0.3, 10).rotateZ(Math.PI / 2);
  geometries.add(box);
  geometries.add(wheelGeo);
  function cube(w, h, d, m, x = 0, y = 0, z = 0, parent = scene) {
    const o = new T.Mesh(box, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.receiveShadow = !mobile;
    parent.add(o);
    return o;
  }
  cube(900, 0.3, 700, groundMat, 0, -0.72, -240);
  cube(12, 0.6, 480, asphalt, 0, -0.35, -200);
  for (const side of [-1, 1]) {
    cube(0.3, 0.6, 480, rail, side * 5.9, 0.08, -200);
    cube(0.06, 0.06, 480, cyan, side * 5.7, 0.41, -200);
    cube(0.08, 0.035, 480, line, side * 5.1, 0.015, -200);
  }
  const matrix = new T.Matrix4(),
    q = new T.Quaternion(),
    position = new T.Vector3(),
    scale = new T.Vector3(),
    upAxis = new T.Vector3(0, 1, 0);
  const marks = new T.InstancedMesh(box, line, 100);
  marks.frustumCulled = false;
  marks.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scene.add(marks);
  // One instanced batch per road furniture material, not a draw call per lamp.
  const posts = new T.InstancedMesh(box, steel, 48),
    lights = new T.InstancedMesh(box, cyan, 24);
  posts.frustumCulled = lights.frustumCulled = false;
  scene.add(posts, lights);
  const environment = createEnvironment(scene, { mobile });
  const sunDisc = new T.Mesh(
    new T.SphereGeometry(15, 16, 10),
    new T.MeshBasicMaterial({ color: 0xffebc5 }),
  );
  sunDisc.position.set(-100, 45, -310);
  scene.add(sunDisc);
  const loader = new GLTFLoader();
  let gltfs;
  try {
    gltfs = await Promise.all(
      [mobile ? 'xiaomi-mobile.glb' : 'xiaomi-desktop.glb', 'sedan.glb', 'suv.glb'].map((f) =>
        loader.loadAsync(ASSETS + f),
      ),
    );
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  const player = new T.Group(),
    vehicle = gltfs[0].scene;
  scene.add(player);
  vehicle.rotation.y = Math.PI;
  vehicle.position.y = -0.65;
  player.add(vehicle);
  const paint = [],
    wheels = [],
    originalMaterials = new Map(),
    vehicleMeshes = [],
    clones = new Map();
  vehicle.traverse((o) => {
    if (o.name.startsWith('vehicle-wheel-')) wheels.push(o);
    if (!o.isMesh) return;
    o.castShadow = !mobile;
    o.receiveShadow = !mobile;
    function clone(m) {
      if (clones.has(m)) return clones.get(m);
      const c = m.clone();
      clones.set(m, c);
      materials.add(c);
      originalMaterials.set(c, {
        opacity: c.opacity,
        transparent: c.transparent,
        depthWrite: c.depthWrite,
        emissive: c.emissive?.clone(),
        emissiveIntensity: c.emissiveIntensity,
      });
      if (c.name === 'xiaomi-paint') paint.push(c);
      return c;
    }
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
    vehicleMeshes.push({ mesh: o, material: o.material });
  });
  const nozzle = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.15, 0.12, 10), steel, 4);
  for (let i = 0; i < 4; i++) {
    matrix.makeTranslation(i % 2 ? -0.73 : 0.73, -0.52, i < 2 ? -1.4 : 1.4);
    nozzle.setMatrixAt(i, matrix);
  }
  player.add(nozzle);
  const ghostMaterial = createGhostMaterial(),
    exhaust = createNitroExhaust({ mobile });
  materials.add(ghostMaterial);
  scene.add(exhaust.points);
  const traffic = gltfs.slice(1).map((g) => {
    const root = g.scene,
      bounds = new T.Box3().setFromObject(root),
      size = bounds.getSize(new T.Vector3()),
      center = bounds.getCenter(new T.Vector3()),
      s = 1.8 / size.x;
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -bounds.min.y * s, -center.z * s);
    const group = new T.Group();
    group.add(root);
    group.rotation.y = Math.PI;
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    return group;
  });
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d'),
    gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#000a');
  gradient.addColorStop(1, '#0000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const shadowTexture = new T.CanvasTexture(shadowCanvas);
  textures.add(shadowTexture);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(4.3, 6.4),
    new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  scene.add(shadow);
  const models = new Map(),
    pool = new Map(),
    coinGeo = new T.TorusGeometry(0.34, 0.09, 5, 12),
    coinMaterial = material(0xffcd65, 0.7, 0.24, 0.3),
    coins = new T.InstancedMesh(coinGeo, coinMaterial, 160);
  coins.frustumCulled = false;
  coins.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scene.add(coins);
  const makePickup = createPickupFactory();
  function makeObject(o) {
    const group = ITEMS[o.type] ? makePickup(o.type) : new T.Group();
    if (o.type === 'traffic') group.add(traffic[o.variant % traffic.length].clone(true));
    if (o.type === 'truck') {
      cube(2.3, 0.35, 22, steel, 0, 0.85, 0, group);
      cube(2.28, 3.9, 17.8, truckMat[o.variant % 2], 0, 2.95, 1.6, group);
      cube(2.2, 2.4, 3.3, rail, 0, 1.9, -9.3, group);
      cube(1.9, 0.85, 0.07, steel, 0, 2.45, -10.98, group);
      const wheels = new T.InstancedMesh(wheelGeo, rubber, 12);
      for (let i = 0; i < 12; i++) {
        matrix.makeTranslation(
          i % 2 ? -1.14 : 1.14,
          0.55,
          [-9, -7, 4, 6.5, 8.5, 10][Math.floor(i / 2)],
        );
        wheels.setMatrixAt(i, matrix);
      }
      group.add(wheels);
      cube(1.8, 0.12, 0.08, amber, 0, 1.25, 10.57, group);
      // Tall cargo silhouette intentionally extends well above the jump apex.
      cube(2.05, 0.14, 17.3, rail, 0, 4.96, 1.6, group);
    }
    if (o.type === 'barrier') {
      cube(2.65, 0.85, 1.2, amber, 0, 0.425, 0, group);
      for (const x of [-0.85, 0, 0.85]) {
        const stripe = cube(0.22, 0.87, 1.22, line, x, 0.425, 0, group);
        stripe.rotation.z = -0.45;
      }
    }
    if (o.type === 'gate') {
      for (const side of [-1, 1]) cube(0.15, 3.1, 1.4, steel, side * 1.4, 1.55, 0, group);
      cube(2.95, 0.58, 1.4, amber, 0, 2.9, 0, group);
      cube(2.5, 0.09, 1.43, cyan, 0, 2.82, 0.01, group);
    }
    scene.add(group);
    return group;
  }
  // Static traffic formations share one instanced batch per prototype primitive.
  // A long truck's twelve wheels stay in one batch even across multiple trucks.
  const obstacleBatches = new Map(),
    instanceTransform = new T.Matrix4(),
    wheelTransform = new T.Matrix4();
  function obstacleBatch(o) {
    const key = o.type + (['truck', 'traffic'].includes(o.type) ? o.variant % 2 : '');
    if (obstacleBatches.has(key)) return obstacleBatches.get(key);
    const prototype = makeObject(o),
      parts = [];
    prototype.updateMatrixWorld(true);
    prototype.traverse((node) => {
      if (!node.isMesh) return;
      const transforms = [];
      if (node.isInstancedMesh) {
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, wheelTransform);
          transforms.push(new T.Matrix4().multiplyMatrices(node.matrixWorld, wheelTransform));
        }
      } else transforms.push(node.matrixWorld.clone());
      const mesh = new T.InstancedMesh(node.geometry, node.material, 64 * transforms.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.count = 0;
      mesh.receiveShadow = !mobile;
      mesh.castShadow = false;
      scene.add(mesh);
      parts.push({ mesh, transforms });
      if (node.isInstancedMesh) node.dispose();
    });
    scene.remove(prototype);
    obstacleBatches.set(key, parts);
    return parts;
  }
  // No mesh/material creation when a new formation first approaches the player.
  for (const type of Object.keys(OBSTACLES))
    for (let variant = 0; variant < (['truck', 'traffic'].includes(type) ? 2 : 1); variant++)
      obstacleBatch({ type, variant });
  for (const type of Object.keys(ITEMS)) {
    const m = makeObject({ type });
    m.visible = false;
    m.userData.pool = type;
    pool.set(type, [m]);
  }
  const particleCount = mobile ? 24 : 40,
    particlePositions = new Float32Array(particleCount * 3),
    particleSizes = new Float32Array(particleCount),
    particleAlpha = new Float32Array(particleCount),
    particleGeometry = new T.BufferGeometry();
  particleGeometry.setAttribute('position', new T.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('size', new T.BufferAttribute(particleSizes, 1));
  particleGeometry.setAttribute('alpha', new T.BufferAttribute(particleAlpha, 1));
  const particleMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      'attribute float size;attribute float alpha;varying float vAlpha;void main(){vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*210.0/max(1.0,-p.z);gl_Position=projectionMatrix*p;}',
    fragmentShader:
      'varying float vAlpha;void main(){float d=length(gl_PointCoord-vec2(.5))*2.0;float a=(1.0-smoothstep(.05,1.0,d))*vAlpha*.65;if(a<.01)discard;gl_FragColor=vec4(.91,.97,1.0,a);}',
  });
  const particles = new T.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);
  const puffs = Array.from({ length: particleCount }, () => ({
    life: 0,
    p: new T.Vector3(),
    v: new T.Vector3(),
  }));
  let puffIndex = 0,
    puffClock = 0;
  const speedGeo = new T.BufferGeometry(),
    speedArray = new Float32Array(36 * 6);
  for (let i = 0; i < 36; i++) {
    const x = (i % 2 ? -1 : 1) * (6 + (i % 7)),
      y = 1 + ((i * 7) % 11),
      z = -((i * 13) % 140);
    speedArray.set([x, y, z, x, y, z + 4], i * 6);
  }
  speedGeo.setAttribute('position', new T.BufferAttribute(speedArray, 3));
  const speedLines = new T.LineSegments(
    speedGeo,
    new T.LineBasicMaterial({ color: 0xe4ffff, transparent: true, opacity: 0 }),
  );
  scene.add(speedLines);
  let resizeCount = 0,
    telemetryAt = 0,
    width = 0,
    height = 0,
    prev = 0,
    shake = 0,
    landing = 0,
    themeId = '',
    previousGame = null;
  function recycle() {
    for (const m of models.values()) {
      m.visible = false;
      const list = pool.get(m.userData.pool) || [];
      list.push(m);
      pool.set(m.userData.pool, list);
    }
    models.clear();
    for (const puff of puffs) puff.life = 0;
    exhaust.clear();
  }
  function resize() {
    const next = frameSize(canvas.clientWidth, canvas.clientHeight, { width, height });
    if (next.changed) {
      width = next.width;
      height = next.height;
      resizeCount++;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
  function update(g, now, remainder = 0) {
    resize();
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
    prev = now;
    if (previousGame !== g) {
      recycle();
      previousGame = g;
    }
    const info = levelInfo(g.level),
      pose = visualPose(g, remainder),
      moving = g.status === 'running',
      ghost = g.effects.ghost > 0;
    if (themeId !== info.theme.id) {
      themeId = info.theme.id;
      sky.setHex(info.theme.sky);
      scene.fog.color.setHex(info.theme.fog);
      groundMat.color.setHex(info.theme.ground);
      asphalt.color.setHex(info.theme.road);
      rail.color.setHex(info.theme.rail);
      cyan.color.setHex(info.theme.accent);
      cyan.emissive.setHex(info.theme.accent);
      sun.color.setHex(info.theme.sun);
      sun.intensity = info.theme.light;
      sunDisc.material.color.setHex(info.theme.sun);
      renderer.toneMappingExposure = themeId === 'city' ? 1.5 : 1.16;
      canvas.dataset.theme = themeId;
    }
    environment.update(info, pose.distance, now);
    for (let i = 0; i < 100; i++) {
      matrix.makeScale(0.1, 0.025, 4);
      matrix.setPosition(i < 50 ? -1.6 : 1.6, 0.015, -(i % 50) * 10 + (pose.distance % 10));
      marks.setMatrixAt(i, matrix);
    }
    marks.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1,
        z = -i * 20 + (pose.distance % 40);
      matrix.makeScale(0.13, 7, 0.13);
      matrix.setPosition(side * 7, 3.3, z);
      posts.setMatrixAt(i * 2, matrix);
      matrix.makeScale(2.2, 0.12, 0.15);
      matrix.setPosition(side * 6.1, 6.8, z);
      posts.setMatrixAt(i * 2 + 1, matrix);
      matrix.makeScale(1.6, 0.04, 0.22);
      matrix.setPosition(side * 6.1, 6.72, z);
      lights.setMatrixAt(i, matrix);
    }
    posts.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    const present = new Set();
    for (const parts of obstacleBatches.values()) for (const p of parts) p.mesh.count = 0;
    let coinCount = 0;
    for (const o of g.objects) {
      if (o.passed || o.z - pose.distance > 300) continue;
      if (o.type === 'coin') {
        if (coinCount < 160) {
          position.set(o.x, 0.85 + Math.sin(now * 0.003 + o.id) * 0.08, -(o.z - pose.distance));
          q.setFromAxisAngle(upAxis, now * 0.0018);
          scale.setScalar(1);
          matrix.compose(position, q, scale);
          coins.setMatrixAt(coinCount++, matrix);
        }
        continue;
      }
      if (OBSTACLES[o.type]) {
        const parts = obstacleBatch(o);
        matrix.makeTranslation(o.x, 0, -(o.z - pose.distance));
        for (const { mesh, transforms } of parts) {
          for (const transform of transforms) {
            instanceTransform.multiplyMatrices(matrix, transform);
            mesh.setMatrixAt(mesh.count++, instanceTransform);
          }
        }
        continue;
      }
      present.add(o.id);
      let m = models.get(o.id);
      if (!m) {
        const key = o.type + (o.variant ?? '');
        m = pool.get(key)?.pop() || makeObject(o);
        m.userData.pool = key;
        models.set(o.id, m);
      }
      m.visible = true;
      m.position.set(
        o.x,
        ITEMS[o.type] ? Math.sin(now * 0.003 + o.id) * 0.15 : 0,
        -(o.z - pose.distance),
      );
      if (ITEMS[o.type]) m.rotation.y = Math.sin(now * 0.001) * 0.28;
    }
    coins.count = coinCount;
    for (const parts of obstacleBatches.values())
      for (const { mesh } of parts) {
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
    coins.instanceMatrix.needsUpdate = true;
    for (const [id, m] of models)
      if (!present.has(id)) {
        m.visible = false;
        const list = pool.get(m.userData.pool) || [];
        list.push(m);
        pool.set(m.userData.pool, list);
        models.delete(id);
      }
    for (const ev of g.events) {
      if (ev.type === 'hit' && !mobile) shake = 0.12;
      if (ev.type === 'land' && !mobile) landing = 0.12;
    }
    g.events = [];
    shake = Math.max(0, shake - dt);
    landing = Math.max(0, landing - dt);
    player.position.set(pose.x, 0.65 + pose.height, 0);
    const steer = LANES[g.lane] - pose.x;
    player.rotation.set(0, -steer * 0.025, g.jet > 0 ? pose.roll : -steer * 0.025);
    // Keep the whole vehicle visible: old invulnerability blink looked like missing frames.
    player.visible = true;
    ghostMaterial.uniforms.time.value = now / 1000;
    for (const { mesh, material: normal } of vehicleMeshes) {
      mesh.material = ghost ? ghostMaterial : normal;
      mesh.castShadow = !mobile && !ghost;
    }
    nozzle.visible = !ghost;
    for (const [m, base] of originalMaterials) {
      if (!m.emissive) continue;
      if (g.invulnerable > 0 && !ghost) {
        m.emissive.setHex(0xbb653f);
        m.emissiveIntensity = 0.12;
      } else {
        m.emissive.copy(base.emissive);
        m.emissiveIntensity = base.emissiveIntensity;
      }
    }
    if (moving)
      for (const wheel of wheels)
        wheel.rotation.x = (wheel.rotation.x - (g.speed * dt) / 0.36) % (Math.PI * 2);
    shadow.position.x = pose.x;
    shadow.material.opacity = (1 - pose.height * 0.13) * (ghost ? 0.08 : 1);
    shadow.scale.setScalar(1 + pose.height * 0.15);
    player.updateMatrixWorld(true);
    exhaust.update(dt, !!g.boost && moving, player.matrixWorld, player.quaternion, moving);
    if (moving && g.jet > 0) {
      puffClock += dt;
      while (puffClock > 0.025) {
        puffClock -= 0.025;
        const i = puffIndex++ % particleCount,
          p = puffs[i];
        p.life = 0.55;
        p.p
          .set(i % 2 ? -0.73 : 0.73, -0.52, i % 4 < 2 ? -1.4 : 1.4)
          .applyMatrix4(player.matrixWorld);
        p.v.set(((i % 3) - 1) * 0.5, -7, 0).applyQuaternion(player.quaternion);
      }
    }
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      if (p.life > 0) {
        p.life -= dt;
        p.p.addScaledVector(p.v, dt);
        p.p.z += dt * (moving ? g.speed * 0.65 : 0);
        particlePositions[i * 3] = p.p.x;
        particlePositions[i * 3 + 1] = p.p.y;
        particlePositions[i * 3 + 2] = p.p.z;
        particleSizes[i] = 0.2 + (1 - p.life / 0.55) * 1.3;
        particleAlpha[i] = Math.max(0, p.life / 0.55);
      } else particleAlpha[i] = 0;
    }
    for (const a of Object.values(particleGeometry.attributes)) a.needsUpdate = true;
    camera.fov += (60 + g.boost * 9 - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
    camera.position.set(
      pose.x * 0.18 + (shake ? Math.sin(now * 0.045) * shake * 0.2 : 0),
      5.45 + pose.height * 0.2 - landing * 0.7,
      11.5 + g.boost * 0.8,
    );
    camera.lookAt(pose.x * 0.35, 1.1 + pose.height * 0.25, -18);
    speedLines.material.opacity = g.boost ? 0.38 : 0.06;
    if (moving) {
      for (let i = 0; i < 36; i++) {
        const off = i * 6;
        speedArray[off + 2] += g.speed * dt * 2;
        speedArray[off + 5] += g.speed * dt * 2;
        if (speedArray[off + 2] > 10) {
          speedArray[off + 2] = -140;
          speedArray[off + 5] = -136;
        }
      }
      speedGeo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
    if (now - telemetryAt > 100) {
      telemetryAt = now;
      Object.assign(canvas.dataset, {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        model: mobile ? 'parking-mobile' : 'parking-desktop',
        pixelRatio: renderer.getPixelRatio(),
        shadows: String(renderer.shadowMap.enabled),
        ghostOpacity: ghost ? GHOST_BODY_ALPHA : 1,
        ghostStyle: ghost ? 'rim-shimmer' : 'normal',
        exhaustParticles: exhaust.active,
        exhaustBudget: exhaust.count,
        playerVisible: String(player.visible),
        renderX: pose.x,
        resizeCount,
        programs: renderer.info.programs.length,
        geometries: renderer.info.memory.geometries,
      });
    }
  }
  // Precompile every map, object and normal/ghost material variant before enabling Start.
  resize();
  await renderer.compileAsync(scene, camera);
  for (const { mesh } of vehicleMeshes) mesh.material = ghostMaterial;
  await renderer.compileAsync(scene, camera);
  for (const { mesh, material: normal } of vehicleMeshes) mesh.material = normal;
  // Upload every geometry/texture once in the loading screen, not during the first turn/pickup.
  const warmState = [];
  scene.traverse((o) => {
    warmState.push([o, o.visible, o.frustumCulled, o.isInstancedMesh ? o.count : null]);
    o.visible = true;
    o.frustumCulled = false;
    if (o.isInstancedMesh && o.count === 0) o.count = 1;
  });
  camera.position.set(0, 5.45, 11.5);
  camera.lookAt(0, 1.1, -18);
  renderer.setViewport(0, 0, 1, 1);
  renderer.render(scene, camera);
  renderer.setViewport(0, 0, width, height);
  for (const [o, visible, culled, count] of warmState) {
    o.visible = visible;
    o.frustumCulled = culled;
    if (count !== null) o.count = count;
  }
  canvas.dataset.prewarmed = 'true';
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
          for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
        }
      });
      for (const v of geometries) v.dispose();
      for (const v of materials) v.dispose();
      for (const v of textures) v.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
