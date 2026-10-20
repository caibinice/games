import * as T from 'three';

export const exhaustBudget = (mobile) => (mobile ? 96 : 160);
export const GHOST_BODY_ALPHA = 0.006;

export function createGhostMaterial() {
  return new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);
      vView=-p.xyz;vLocal=position;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float time;varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;
      void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.4);
      float sheen=.78+.22*sin(vLocal.y*9.+vLocal.z*2.-time*2.4);
      float scan=pow(.5+.5*sin(vLocal.y*4.-time*1.5),18.);
      float a=${GHOST_BODY_ALPHA}+rim*(.065+.10*scan)*sheen;
      gl_FragColor=vec4(mix(vec3(.24,.65,1.),vec3(.8,1.,1.),rim),a);}`,
  });
}

// A fixed typed-array pool: two emitters, one GPU draw, no geometry per particle.
export function createNitroExhaust({ mobile = false } = {}) {
  const count = exhaustBudget(mobile),
    positions = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    ages = new Float32Array(count),
    lives = new Float32Array(count),
    velocities = new Float32Array(count * 3),
    geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute('size', new T.BufferAttribute(sizes, 1).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('age', new T.BufferAttribute(ages, 1).setUsage(T.DynamicDrawUsage));
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `attribute float size;attribute float age;varying float vAge;
      void main(){vAge=age;vec4 p=modelViewMatrix*vec4(position,1.);
      gl_PointSize=size*280./max(1.,-p.z);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float time;varying float vAge;void main(){if(vAge<=0.)discard;
      float jet=step(1.5,vAge);
      vec2 uv=(gl_PointCoord-.5)*2.;uv.x*=mix(1.4,2.8,jet);float d=length(uv);
      float core=exp(-d*d*7.);float halo=pow(max(0.,1.-d),1.4);
      vec3 color=mix(vec3(.24,.1,1.),vec3(.02,.75,1.),smoothstep(.1,.65,vAge));
      color=mix(color,vec3(.85,1.,1.),core*smoothstep(.55,1.,vAge));
      float a=(halo*.65+core*.8)*smoothstep(0.,.22,vAge);
      color=mix(color,vec3(.38,.9,1.)+core*.8,jet);
      a*=mix(1.,.8+.2*sin(time*45.+uv.y*13.),jet);
      gl_FragColor=vec4(color,a);}`,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  const p = new T.Vector3(),
    v = new T.Vector3();
  let cursor = 0,
    clock = 0,
    serial = 0,
    active = 0;
  function clear() {
    lives.fill(0);
    ages.fill(0);
    clock = 0;
    active = 0;
  }
  function update(dt, emitting, matrix, quaternion, moving = true) {
    if (emitting && moving) {
      clock += dt;
      const interval = 1 / (mobile ? 120 : 180);
      while (clock >= interval) {
        clock -= interval;
        for (const side of [-1, 1]) {
          const i = cursor++ % (count - 2),
            off = i * 3,
            seed = ++serial * 2.39996;
          lives[i] = 0.22 + (0.5 + 0.5 * Math.sin(seed * 1.7)) * 0.12;
          ages[i] = 1;
          p.set(side * 0.69, -0.24, 2.28).applyMatrix4(matrix);
          positions[off] = p.x;
          positions[off + 1] = p.y;
          positions[off + 2] = p.z;
          v.set(Math.sin(seed) * 1.35, Math.cos(seed * 1.3) * 0.9, 14 + 5 * Math.cos(seed));
          v.applyQuaternion(quaternion);
          velocities[off] = v.x;
          velocities[off + 1] = v.y;
          velocities[off + 2] = v.z;
          sizes[i] = 0.72 + (0.5 + 0.5 * Math.sin(seed * 0.8)) * 0.42;
        }
      }
    } else clock = 0;
    if (moving) material.uniforms.time.value += dt;
    active = 0;
    for (let i = 0; i < count - 2; i++) {
      if (ages[i] <= 0) continue;
      if (moving) ages[i] = Math.max(0, ages[i] - dt / lives[i]);
      if (ages[i] <= 0) continue;
      active++;
      const off = i * 3;
      if (moving) for (let k = 0; k < 3; k++) positions[off + k] += velocities[off + k] * dt;
    }
    for (let k = 0; k < 2; k++) {
      const i = count - 2 + k,
        off = i * 3;
      if (moving) ages[i] = emitting ? 2 : 0;
      if (ages[i] > 0) {
        p.set(k ? 0.69 : -0.69, -0.24, 2.8).applyMatrix4(matrix);
        positions[off] = p.x;
        positions[off + 1] = p.y;
        positions[off + 2] = p.z;
        sizes[i] = 2.0 + Math.sin(material.uniforms.time.value * 32 + k) * 0.08;
        active++;
      }
    }
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    points.visible = active > 0;
    return active;
  }
  return {
    points,
    update,
    clear,
    get active() {
      return active;
    },
    count,
  };
}
