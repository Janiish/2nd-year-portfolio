import * as THREE from 'three';
import * as S from './shaders.js';

const SUN_DIR = new THREE.Vector3(-0.9, 0.35, 0.55).normalize();
const EARTH_R = 2;
const TAU = Math.PI * 2;

const SATELLITES = [
  { name: 'CARTOSAT-3', color: 0xff9a3c, r: 2.55, tilt: [1.25, 0, 0.35], speed: 0.3, phase: 0.6, primary: true },
  { name: 'GSAT-30', color: 0x38d9f5, r: 3.95, tilt: [0.1, 0, -0.06], speed: 0.06, phase: 2.2 },
  { name: 'RISAT-2B', color: 0x8b5cf6, r: 2.95, tilt: [0.55, 0, -0.6], speed: 0.2, phase: 4.0 },
  { name: 'OCEANSAT-3', color: 0x5eead4, r: 3.35, tilt: [-0.4, 0, 0.9], speed: 0.14, phase: 1.0 },
];

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePoints({ count, minR, maxR, sizeRange, palette, pixelRatio, flatten = 1 }) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = minR + Math.random() * (maxR - minR);
    const u = Math.random() * 2 - 1;
    const th = Math.random() * TAU;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(th), r * u * flatten, r * s * Math.sin(th)], i * 3);
    tmp.set(palette[(Math.random() * palette.length) | 0]);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
    const big = Math.random() < 0.03 ? 2.2 : 1;
    size[i] = (sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])) * big;
    phase[i] = Math.random() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: S.starsVertex,
    fragmentShader: S.starsFragment,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

function makeSatellite(color, glowTex) {
  const sat = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25e, metalness: 0.9, roughness: 0.32, emissive: 0x1a0d00 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1b3b8f, metalness: 0.7, roughness: 0.22, emissive: 0x0b1c5c, emissiveIntensity: 0.8,
  });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0xbfc7d5, metalness: 0.8, roughness: 0.4 });

  sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.11), gold));
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 6), strutMat);
  sat.add(strut);
  const panelGeo = new THREE.BoxGeometry(0.004, 0.17, 0.085);
  [-1, 1].forEach((side) => {
    const p = new THREE.Mesh(panelGeo, panelMat);
    p.position.y = side * 0.16;
    sat.add(p);
  });
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.03, 16, 1, true), strutMat);
  dish.material.side = THREE.DoubleSide;
  dish.rotation.z = Math.PI / 2;
  dish.position.x = -0.055;
  sat.add(dish);

  const beacon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  beacon.scale.setScalar(0.42);
  sat.add(beacon);
  sat.userData.beacon = beacon;
  sat.scale.setScalar(1.15);
  return sat;
}

function makeOrbitLine(radius, color) {
  const seg = 256;
  const pos = new Float32Array((seg + 1) * 3);
  const ang = new Float32Array(seg + 1);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    pos.set([Math.cos(a) * radius, 0, Math.sin(a) * radius], i * 3);
    ang[i] = a;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAngle', new THREE.BufferAttribute(ang, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: S.orbitVertex,
    fragmentShader: S.orbitFragment,
    uniforms: {
      uAngle: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Line(geo, mat);
}

/**
 * Creates the interactive space scene (Earth, satellites, moon, stars, nebula).
 * @param {HTMLCanvasElement} canvas
 * @param {{ onFrame?: (info: object) => void }} opts
 */
export function createSpaceScene(canvas, opts = {}) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x03040b, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, 0, 9);

  const glowTex = makeGlowTexture();

  // ── Lights (for standard-material satellites) ─────────────
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(20);
  scene.add(sun, new THREE.AmbientLight(0x6b7cff, 0.35));

  // ── Background: nebula + stars ────────────────────────────
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(300, 48, 32),
    new THREE.ShaderMaterial({ vertexShader: S.nebulaVertex, fragmentShader: S.nebulaFragment, side: THREE.BackSide, depthWrite: false })
  );
  scene.add(nebula);

  const stars = makePoints({
    count: isMobile ? 3500 : 7000,
    minR: 80,
    maxR: 250,
    sizeRange: [1.0, 3.2],
    palette: ['#ffffff', '#cfe3ff', '#a9c8ff', '#ffe9c7', '#ffd2a1', '#d8ccff'],
    pixelRatio,
  });
  scene.add(stars);

  // ── Earth system ──────────────────────────────────────────
  const earthGroup = new THREE.Group(); // moved by scroll
  scene.add(earthGroup);
  const tiltGroup = new THREE.Group(); // pointer tilt
  earthGroup.add(tiltGroup);

  const axial = new THREE.Group();
  axial.rotation.z = THREE.MathUtils.degToRad(23.4);
  tiltGroup.add(axial);

  const sharedUniforms = { uSunDir: { value: SUN_DIR }, uTime: { value: 0 } };
  const seg = isMobile ? 96 : 160;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, seg, seg),
    new THREE.ShaderMaterial({ vertexShader: S.sphereVertex, fragmentShader: S.earthFragment, uniforms: sharedUniforms })
  );
  earth.rotation.y = 2.4;
  axial.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.012, seg, seg),
    new THREE.ShaderMaterial({
      vertexShader: S.sphereVertex,
      fragmentShader: S.cloudFragment,
      uniforms: sharedUniforms,
      transparent: true,
      depthWrite: false,
    })
  );
  axial.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.16, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: S.atmosphereVertex,
      fragmentShader: S.atmosphereFragment,
      uniforms: { uSunDir: { value: SUN_DIR }, uColor: { value: new THREE.Color(0.3, 0.62, 1.0) } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  tiltGroup.add(atmosphere);

  // Orbital debris / dust
  const debris = makePoints({
    count: isMobile ? 600 : 1300,
    minR: 2.5,
    maxR: 5,
    sizeRange: [0.8, 2.0],
    palette: ['#38d9f5', '#7dd3fc', '#a78bfa', '#ffffff'],
    pixelRatio,
    flatten: 0.35,
  });
  debris.rotation.z = 0.25;
  tiltGroup.add(debris);

  // Satellites & orbit trails
  const sats = SATELLITES.map((cfg) => {
    const plane = new THREE.Group();
    plane.rotation.set(...cfg.tilt);
    const line = makeOrbitLine(cfg.r, cfg.color);
    const mesh = makeSatellite(cfg.color, glowTex);
    plane.add(line, mesh);
    tiltGroup.add(plane);
    return { ...cfg, plane, line, mesh, angle: cfg.phase };
  });
  const primary = sats.find((s) => s.primary);

  // Moon
  const moonPivot = new THREE.Group();
  moonPivot.rotation.set(0.25, 0, 0.12);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 48, 48),
    new THREE.ShaderMaterial({ vertexShader: S.sphereVertex, fragmentShader: S.moonFragment, uniforms: sharedUniforms })
  );
  moon.position.set(6.2, 0, 0);
  moonPivot.add(moon);
  earthGroup.add(moonPivot);

  // ── State ──────────────────────────────────────────────────
  const target = { x: 2.7, y: 0, z: 0, s: 1, rotY: 0 };
  const current = { x: 2.7, y: 0, z: -30, s: 0.2, rotY: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let spinVelocity = 0;
  let introStart = -1;
  let time = 0;
  let labelVisibility = 1;

  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const earthWorld = new THREE.Vector3();
  const clock = new THREE.Clock();
  const speedMul = reduceMotion ? 0.25 : 1;

  function isOccluded(point, center, radius) {
    const dir = tmpV2.copy(point).sub(camera.position);
    const dist = dir.length();
    dir.divideScalar(dist);
    const oc = camera.position.clone().sub(center);
    const b = oc.dot(dir);
    const c = oc.lengthSq() - radius * radius;
    const disc = b * b - c;
    if (disc <= 0) return false;
    const t = -b - Math.sqrt(disc);
    return t > 0 && t < dist;
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    sharedUniforms.uTime.value = time;
    stars.material.uniforms.uTime.value = time;
    debris.material.uniforms.uTime.value = time;

    // Intro fly-in
    let intro = 1;
    if (introStart >= 0) intro = easeOutExpo(Math.min((time - introStart) / 2.4, 1));
    else intro = 0;

    // Smoothly follow scroll target
    current.x = damp(current.x, target.x, 2.6, dt);
    current.y = damp(current.y, target.y, 2.6, dt);
    current.z = damp(current.z, target.z, 2.6, dt);
    current.s = damp(current.s, target.s, 2.6, dt);
    earthGroup.position.set(current.x, current.y, THREE.MathUtils.lerp(-40, current.z, intro));
    earthGroup.scale.setScalar(current.s * THREE.MathUtils.lerp(0.4, 1, intro));

    // Spin (base + drag inertia + scroll)
    spinVelocity = damp(spinVelocity, 0, 1.6, dt);
    const spin = (0.045 * speedMul + spinVelocity) * dt;
    earth.rotation.y += spin;
    clouds.rotation.y += spin * 1.15;
    debris.rotation.y += dt * 0.02 * speedMul + spinVelocity * dt * 0.3;
    moonPivot.rotation.y += dt * 0.05 * speedMul;
    moon.rotation.y += dt * 0.05;

    // Pointer parallax
    pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 3, dt);
    tiltGroup.rotation.x = 0.18 + pointer.sy * 0.12;
    tiltGroup.rotation.y = pointer.sx * 0.18;
    camera.position.x = pointer.sx * 0.45;
    camera.position.y = -pointer.sy * 0.3;
    camera.lookAt(0, 0, 0);

    // Satellites
    for (const s of sats) {
      s.angle += s.speed * dt * speedMul;
      const a = s.angle;
      s.mesh.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
      s.mesh.rotation.y = -a;
      s.line.material.uniforms.uAngle.value = a % TAU;
      s.mesh.userData.beacon.material.opacity = 0.65 + 0.35 * Math.sin(time * 4 + s.phase);
    }
    stars.rotation.y += dt * 0.003;

    renderer.render(scene, camera);

    // Telemetry + HUD label for the primary satellite
    if (opts.onFrame) {
      primary.mesh.getWorldPosition(tmpV);
      earthGroup.getWorldPosition(earthWorld);
      const occluded = isOccluded(tmpV, earthWorld, EARTH_R * earthGroup.scale.x * 1.01);
      const local = earth.worldToLocal(tmpV.clone());
      const r = local.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(local.y / r));
      const lon = THREE.MathUtils.radToDeg(Math.atan2(-local.z, local.x));
      const ndc = tmpV.clone().project(camera);
      labelVisibility = damp(labelVisibility, occluded || intro < 0.9 ? 0 : 1, 6, dt);
      opts.onFrame({
        name: primary.name,
        screenX: (ndc.x * 0.5 + 0.5) * window.innerWidth,
        screenY: (-ndc.y * 0.5 + 0.5) * window.innerHeight,
        visibility: labelVisibility,
        lat,
        lon,
        altKm: 509.2 + Math.sin(time * 0.35) * 3.4,
        velKmS: 7.61 + Math.sin(time * 0.5) * 0.02,
      });
    }
  }

  renderer.setAnimationLoop(frame);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // Compile shaders up-front so the intro doesn't stutter
  renderer.compile(scene, camera);

  return {
    intro() {
      introStart = time;
    },
    setTarget(t) {
      Object.assign(target, t);
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    addSpin(v) {
      spinVelocity = THREE.MathUtils.clamp(spinVelocity + v, -4, 4);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
