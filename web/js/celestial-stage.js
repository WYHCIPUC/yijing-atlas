import * as THREE from '../lib/vendor/three.module.min.js';

const MODE_SCENES = Object.freeze({
  explore: { accent: 0xd8b66f, secondary: 0x6f8cc8, cameraZ: 9.2, energy: 1, drift: 1 },
  almanac: { accent: 0x88c9b8, secondary: 0xd2a55d, cameraZ: 10.2, energy: 0.72, drift: 0.55 },
  learning: { accent: 0xe0ba72, secondary: 0x815b36, cameraZ: 10.8, energy: 0.78, drift: 0.42 },
  review: { accent: 0x75bfa5, secondary: 0xd2b16c, cameraZ: 10.4, energy: 0.86, drift: 0.62 },
  quiz: { accent: 0xc86d5e, secondary: 0xe0bc72, cameraZ: 9.8, energy: 1.15, drift: 0.82 },
  divination: { accent: 0xa889d2, secondary: 0xd1a75f, cameraZ: 9.5, energy: 1.08, drift: 0.7 },
});

const TRIGRAM_CODES = ['111', '110', '101', '100', '000', '001', '010', '011'];
const RELATION_COLORS = Object.freeze({
  opposite: 0xe2bd72,
  reversed: 0xb89ace,
  interlocking: 0x8fbacb,
  changing: 0xe2a477,
});

function createRandom(seed = 0x5f3759df) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function chooseCelestialFps({ reducedMotion, hidden, mode = 'explore', lowPower = false }) {
  if (hidden || reducedMotion) return 0;
  if (lowPower) return mode === 'explore' ? 20 : 12;
  return mode === 'explore' ? 45 : 24;
}

export function getHexagramSpatialProfile(code) {
  if (typeof code !== 'string' || !/^[01]{6}$/.test(code)) return null;
  const yangCount = [...code].filter(bit => bit === '1').length;
  const latitude = (yangCount / 6 - 0.5) * 1.4;
  return {
    angle: Number.parseInt(code, 2) / 63 * Math.PI * 2,
    yangCount,
    yinCount: 6 - yangCount,
    latitude,
    latitudeRadius: Math.sqrt(Math.max(0.1, 1.2 ** 2 - latitude ** 2)),
  };
}

export function writeQuadraticArc(positions, start, end, arcHeight = 0.45) {
  const segmentCount = Math.max(1, Math.floor(positions.length / 3) - 1);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.max(0.0001, Math.hypot(deltaX, deltaY));
  const bend = Math.min(0.72, Math.max(0.18, distance * 0.18));
  const controlX = (start.x + end.x) * 0.5 - deltaY / distance * bend;
  const controlY = (start.y + end.y) * 0.5 + deltaX / distance * bend;
  const controlZ = Math.max(start.z, end.z) + arcHeight;
  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount;
    const inverse = 1 - progress;
    const offset = index * 3;
    positions[offset] = inverse * inverse * start.x + 2 * inverse * progress * controlX + progress * progress * end.x;
    positions[offset + 1] = inverse * inverse * start.y + 2 * inverse * progress * controlY + progress * progress * end.y;
    positions[offset + 2] = inverse * inverse * start.z + 2 * inverse * progress * controlZ + progress * progress * end.z;
  }
  return positions;
}

function createStarField(count, radius, random, color, size) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(color);
  for (let index = 0; index < count; index += 1) {
    const distance = radius * (0.38 + random() * 0.62);
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = distance * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = distance * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = distance * Math.cos(phi);
    const luminance = 0.42 + random() * 0.58;
    colors[index * 3] = baseColor.r * luminance;
    colors[index * 3 + 1] = baseColor.g * luminance;
    colors[index * 3 + 2] = baseColor.b * luminance;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function createTrigram(code, material) {
  const group = new THREE.Group();
  [...code].forEach((bit, index) => {
    const y = (index - 1) * 0.115;
    if (bit === '1') {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.025), material);
      line.position.y = y;
      group.add(line);
      return;
    }
    [-0.14, 0.14].forEach((x) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.025), material);
      line.position.set(x, y, 0);
      group.add(line);
    });
  });
  return group;
}

function createNebulaMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(MODE_SCENES.explore.accent) },
      uSecondary: { value: new THREE.Color(MODE_SCENES.explore.secondary) },
      uIntensity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uAccent;
      uniform vec3 uSecondary;

      float field(vec3 p) {
        float a = sin(p.x * 5.0 + uTime * 0.035);
        float b = sin(p.y * 7.0 - uTime * 0.028);
        float c = sin((p.x + p.z) * 9.0 + uTime * 0.021);
        float d = sin(length(p.xy) * 13.0 - uTime * 0.018);
        return (a + b + c + d) * 0.125 + 0.5;
      }

      void main() {
        float haze = smoothstep(0.24, 0.82, field(vWorld));
        float horizon = pow(1.0 - abs(vWorld.y), 2.4);
        float polar = pow(max(0.0, vWorld.z), 4.0);
        vec3 color = mix(vec3(0.005, 0.009, 0.022), uSecondary * 0.24, haze);
        color += uAccent * horizon * 0.075 * uIntensity;
        color += uSecondary * polar * 0.045;
        gl_FragColor = vec4(color, 0.56);
      }
    `,
  });
}

function createSelectionWaveMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(MODE_SCENES.explore.accent) },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uOpacity;

      void main() {
        float distanceFromCenter = distance(vUv, vec2(0.5));
        float radius = mix(0.08, 0.48, uProgress);
        float primary = 1.0 - smoothstep(0.012, 0.03, abs(distanceFromCenter - radius));
        float echoRadius = max(0.03, radius - 0.11);
        float echo = 1.0 - smoothstep(0.008, 0.024, abs(distanceFromCenter - echoRadius));
        float falloff = smoothstep(0.72, 0.3, distanceFromCenter);
        float alpha = (primary + echo * 0.38) * falloff * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

export function initCelestialStage(canvas, options = {}) {
  if (!canvas) return { available: false, setMode() {}, setRelationState() {}, syncView() {}, focusHexagram() {}, selectHexagram() {}, clearSelection() {}, pause() {}, resume() {}, renderOnce() {}, destroy() {} };
  const windowRef = options.windowRef || window;
  const documentRef = options.documentRef || document;
  const motionPreference = windowRef.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = windowRef.matchMedia('(hover: none), (pointer: coarse)');
  const navigatorRef = options.navigatorRef || windowRef.navigator || {};
  const lowPower = Number(navigatorRef.deviceMemory || 8) <= 4 || (navigatorRef.hardwareConcurrency || 8) <= 4;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowPower, powerPreference: 'high-performance' });
  } catch {
    documentRef.body.classList.add('celestial-fallback');
    return { available: false, setMode() {}, setRelationState() {}, syncView() {}, focusHexagram() {}, selectHexagram() {}, clearSelection() {}, pause() {}, resume() {}, renderOnce() {}, destroy() {} };
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 0, MODE_SCENES.explore.cameraZ);
  const random = createRandom();
  const root = new THREE.Group();
  const armillary = new THREE.Group();
  const orbiters = new THREE.Group();
  const armillaryPitch = new THREE.Group();
  const armillaryYaw = new THREE.Group();
  const networkShell = new THREE.Group();
  const networkPitch = new THREE.Group();
  const networkYaw = new THREE.Group();
  const selectionGroup = new THREE.Group();
  const focusLongitude = new THREE.Group();
  scene.add(root, networkShell, selectionGroup);
  root.add(armillaryPitch);
  armillaryPitch.add(armillaryYaw);
  armillaryYaw.add(armillary, orbiters);
  networkShell.add(networkPitch);
  networkPitch.add(networkYaw);

  const nebulaMaterial = createNebulaMaterial();
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(27, 32, 20), nebulaMaterial);
  scene.add(nebula);

  const farStars = createStarField(lowPower ? 560 : 1100, 22, random, 0xb8c8ee, lowPower ? 0.025 : 0.032);
  const goldDust = createStarField(lowPower ? 180 : 430, 9, random, 0xe2bc72, 0.022);
  scene.add(farStars);
  armillaryYaw.add(goldDust);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.accent,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  [
    [3.15, 0.02, 0.22, 0.05],
    [3.48, 0.012, Math.PI / 2.35, 0.38],
    [3.78, 0.009, Math.PI / 3.1, -0.42],
    [4.2, 0.007, Math.PI / 2, 0.9],
  ].forEach(([radius, tube, x, y]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, lowPower ? 80 : 160), ringMaterial);
    ring.rotation.set(x, y, 0);
    armillary.add(ring);
  });

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.accent,
    transparent: true,
    opacity: 0.11,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, lowPower ? 1 : 2), coreMaterial);
  const innerCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3d99c,
    transparent: true,
    opacity: 0.07,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.58, 1),
    innerCoreMaterial,
  );
  networkYaw.add(core, innerCore);

  const focusOrbitMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.secondary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const focusMeridian = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, lowPower ? 0.008 : 0.012, 6, lowPower ? 56 : 96),
    focusOrbitMaterial,
  );
  focusMeridian.rotation.x = Math.PI / 2;
  const focusLatitudeMaterial = focusOrbitMaterial.clone();
  const focusLatitude = new THREE.Mesh(
    new THREE.TorusGeometry(1, lowPower ? 0.007 : 0.01, 6, lowPower ? 48 : 80),
    focusLatitudeMaterial,
  );
  focusLatitude.rotation.x = Math.PI / 2;
  const focusMarkerMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.accent,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const focusMarker = new THREE.Mesh(new THREE.SphereGeometry(lowPower ? 0.035 : 0.045, 8, 6), focusMarkerMaterial);
  focusLongitude.add(focusMeridian, focusMarker);
  networkYaw.add(focusLongitude, focusLatitude);

  const tetherSegmentCount = lowPower ? 16 : 28;
  const tetherPositions = new Float32Array((tetherSegmentCount + 1) * 3);
  const tetherGeometry = new THREE.BufferGeometry();
  tetherGeometry.setAttribute('position', new THREE.BufferAttribute(tetherPositions, 3));
  const tetherMaterial = new THREE.LineBasicMaterial({
    color: MODE_SCENES.explore.secondary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const focusTether = new THREE.Line(tetherGeometry, tetherMaterial);
  focusTether.frustumCulled = false;
  focusTether.visible = false;
  const tetherParticleCount = lowPower ? 3 : 6;
  const tetherParticlePositions = new Float32Array(tetherParticleCount * 3);
  const tetherParticleGeometry = new THREE.BufferGeometry();
  tetherParticleGeometry.setAttribute('position', new THREE.BufferAttribute(tetherParticlePositions, 3));
  const tetherParticleMaterial = new THREE.PointsMaterial({
    color: MODE_SCENES.explore.accent,
    size: lowPower ? 0.045 : 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tetherParticles = new THREE.Points(tetherParticleGeometry, tetherParticleMaterial);
  tetherParticles.frustumCulled = false;
  tetherParticles.visible = false;
  scene.add(focusTether, tetherParticles);

  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.accent,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const selectionHalo = new THREE.Mesh(new THREE.RingGeometry(1.24, 1.29, lowPower ? 64 : 112), selectionMaterial);
  selectionHalo.visible = false;
  const selectionEchoMaterial = selectionMaterial.clone();
  const selectionEcho = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.055, lowPower ? 48 : 96), selectionEchoMaterial);
  selectionEcho.visible = false;

  const rayPositions = new Float32Array(6 * 2 * 3);
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const offset = index * 6;
    const outerRadius = 1.64 + random() * 0.3;
    rayPositions[offset] = Math.cos(angle) * 1.08;
    rayPositions[offset + 1] = Math.sin(angle) * 1.08;
    rayPositions[offset + 2] = 0;
    rayPositions[offset + 3] = Math.cos(angle) * outerRadius;
    rayPositions[offset + 4] = Math.sin(angle) * outerRadius;
    rayPositions[offset + 5] = (random() - 0.5) * 0.14;
  }
  const selectionRayGeometry = new THREE.BufferGeometry();
  selectionRayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
  const selectionRayMaterial = new THREE.LineBasicMaterial({
    color: MODE_SCENES.explore.secondary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const selectionRays = new THREE.LineSegments(selectionRayGeometry, selectionRayMaterial);
  selectionRays.visible = false;

  const burstCount = lowPower ? 10 : 20;
  const burstPositions = new Float32Array(burstCount * 3);
  for (let index = 0; index < burstCount; index += 1) {
    const angle = index / burstCount * Math.PI * 2 + (random() - 0.5) * 0.16;
    const radius = 1.1 + random() * 0.5;
    burstPositions[index * 3] = Math.cos(angle) * radius;
    burstPositions[index * 3 + 1] = Math.sin(angle) * radius;
    burstPositions[index * 3 + 2] = (random() - 0.5) * 0.32;
  }
  const selectionBurstGeometry = new THREE.BufferGeometry();
  selectionBurstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
  const selectionBurstMaterial = new THREE.PointsMaterial({
    color: MODE_SCENES.explore.accent,
    size: lowPower ? 0.055 : 0.07,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const selectionBurst = new THREE.Points(selectionBurstGeometry, selectionBurstMaterial);
  selectionBurst.visible = false;
  const selectionWaveMaterial = createSelectionWaveMaterial();
  const selectionWave = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), selectionWaveMaterial);
  selectionWave.visible = false;
  selectionGroup.add(selectionWave, selectionHalo, selectionEcho, selectionRays, selectionBurst);

  const trigramMaterial = new THREE.MeshBasicMaterial({
    color: MODE_SCENES.explore.accent,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
  });
  TRIGRAM_CODES.forEach((code, index) => {
    const angle = index / TRIGRAM_CODES.length * Math.PI * 2 - Math.PI / 2;
    const trigram = createTrigram(code, trigramMaterial);
    trigram.position.set(Math.cos(angle) * 4.7, Math.sin(angle) * 4.7, Math.sin(angle * 2) * 0.35);
    trigram.rotation.z = angle + Math.PI / 2;
    trigram.scale.setScalar(0.72);
    orbiters.add(trigram);
  });

  const modeState = {
    name: 'explore',
    config: MODE_SCENES.explore,
    accent: new THREE.Color(MODE_SCENES.explore.accent),
    secondary: new THREE.Color(MODE_SCENES.explore.secondary),
    targetAccent: new THREE.Color(MODE_SCENES.explore.accent),
    targetSecondary: new THREE.Color(MODE_SCENES.explore.secondary),
  };
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const interaction = {
    focus: 0,
    targetFocus: 0,
    angle: 0,
    targetAngle: 0,
    latitude: 0,
    targetLatitude: 0,
    latitudeRadius: 1.2,
    targetLatitudeRadius: 1.2,
  };
  const relationVisual = {
    targetStrength: 0,
    strength: 0,
    pulse: 0,
    color: new THREE.Color(RELATION_COLORS.opposite),
    targetColor: new THREE.Color(RELATION_COLORS.opposite),
  };
  const sharedView = {
    yaw: 0,
    pitch: 0,
    scale: 1,
    centerX: windowRef.innerWidth / 2,
    centerY: windowRef.innerHeight / 2,
    radius: Math.min(windowRef.innerWidth, windowRef.innerHeight) * 0.2,
    targetYaw: 0,
    targetPitch: 0,
    targetScale: 1,
    targetCenterX: windowRef.innerWidth / 2,
    targetCenterY: windowRef.innerHeight / 2,
    targetRadius: Math.min(windowRef.innerWidth, windowRef.innerHeight) * 0.2,
    layoutMode: 'project',
    layoutBlend: 0,
    targetLayoutBlend: 0,
    initialized: false,
  };
  const selection = {
    active: false,
    code: null,
    profile: null,
    pulse: 0,
    x: sharedView.centerX,
    y: sharedView.centerY,
    depth: 1,
    hasAnchor: false,
  };
  const focusAnchor = {
    code: null,
    x: sharedView.centerX,
    y: sharedView.centerY,
    depth: 1,
    hasAnchor: false,
  };
  const screenProbe = new THREE.Vector3();
  const screenDirection = new THREE.Vector3();
  const layoutAnchor = new THREE.Vector3();
  const selectionAnchor = new THREE.Vector3();
  const tetherAnchor = new THREE.Vector3();
  const pauseReasons = new Set();
  let animationFrame = null;
  let lastRenderAt = 0;
  let destroyed = false;
  let contextLost = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dprCap = lowPower ? 1 : 1.5;
    renderer.setPixelRatio(Math.min(windowRef.devicePixelRatio || 1, dprCap));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function screenToWorld(x, y, target) {
    const rect = canvas.getBoundingClientRect();
    const normalizedX = ((x - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const normalizedY = -((y - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    screenProbe.set(normalizedX, normalizedY, 0.5).unproject(camera);
    screenDirection.copy(screenProbe).sub(camera.position).normalize();
    const distance = -camera.position.z / Math.min(-0.0001, screenDirection.z);
    return target.copy(camera.position).addScaledVector(screenDirection, distance);
  }

  function updateInteractionAnchor(target, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    target.x = point.x;
    target.y = point.y;
    target.depth = Number.isFinite(point.depthFactor) ? point.depthFactor : 1;
    target.hasAnchor = true;
  }

  function applySpatialProfile(profile) {
    if (!profile) return;
    interaction.targetAngle = profile.angle;
    interaction.targetLatitude = profile.latitude;
    interaction.targetLatitudeRadius = profile.latitudeRadius;
  }

  function restoreSelectionProfile() {
    if (!selection.active || !selection.profile) return false;
    applySpatialProfile(selection.profile);
    interaction.targetFocus = modeState.name === 'explore' ? 0.72 : 0;
    return true;
  }

  function renderOnce(time = performance.now()) {
    if (destroyed || contextLost) return;
    const seconds = time * 0.001;
    const config = modeState.config;
    modeState.accent.lerp(modeState.targetAccent, 0.045);
    modeState.secondary.lerp(modeState.targetSecondary, 0.045);
    relationVisual.strength += (relationVisual.targetStrength - relationVisual.strength) * 0.1;
    relationVisual.color.lerp(relationVisual.targetColor, 0.09);
    relationVisual.pulse *= motionPreference.matches ? 0 : 0.93;
    ringMaterial.color.copy(modeState.accent).lerp(relationVisual.color, relationVisual.strength * 0.46);
    trigramMaterial.color.copy(modeState.accent);
    selectionMaterial.color.copy(modeState.accent);
    selectionEchoMaterial.color.copy(modeState.secondary);
    selectionRayMaterial.color.copy(modeState.secondary);
    selectionBurstMaterial.color.copy(modeState.accent);
    selectionWaveMaterial.uniforms.uColor.value.copy(modeState.accent);
    focusOrbitMaterial.color.copy(modeState.secondary);
    focusLatitudeMaterial.color.copy(modeState.accent);
    focusMarkerMaterial.color.copy(modeState.accent);
    tetherMaterial.color.copy(modeState.secondary).lerp(relationVisual.color, relationVisual.strength * 0.58);
    tetherParticleMaterial.color.copy(modeState.accent).lerp(relationVisual.color, relationVisual.strength * 0.48);
    coreMaterial.color.copy(modeState.secondary).lerp(modeState.accent, 0.36).lerp(relationVisual.color, relationVisual.strength * 0.32);
    innerCoreMaterial.color.copy(modeState.accent).lerp(modeState.secondary, 0.2);
    nebulaMaterial.uniforms.uAccent.value.copy(modeState.accent);
    nebulaMaterial.uniforms.uSecondary.value.copy(modeState.secondary);
    nebulaMaterial.uniforms.uIntensity.value += (config.energy - nebulaMaterial.uniforms.uIntensity.value) * 0.04;
    nebulaMaterial.uniforms.uTime.value = seconds;

    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;
    interaction.focus += (interaction.targetFocus - interaction.focus) * 0.075;
    interaction.angle += (interaction.targetAngle - interaction.angle) * 0.06;
    interaction.latitude += (interaction.targetLatitude - interaction.latitude) * 0.08;
    interaction.latitudeRadius += (interaction.targetLatitudeRadius - interaction.latitudeRadius) * 0.08;
    sharedView.yaw += (sharedView.targetYaw - sharedView.yaw) * 0.16;
    sharedView.pitch += (sharedView.targetPitch - sharedView.pitch) * 0.16;
    sharedView.scale += (sharedView.targetScale - sharedView.scale) * 0.16;
    sharedView.layoutBlend += (sharedView.targetLayoutBlend - sharedView.layoutBlend) * 0.12;
    // 主体球壳必须与星群同心，不做会暴露双层画布的滞后追赶。
    sharedView.centerX = sharedView.targetCenterX;
    sharedView.centerY = sharedView.targetCenterY;
    sharedView.radius = sharedView.targetRadius;
    camera.position.x += (pointer.x * 0.1 - camera.position.x) * 0.032;
    camera.position.y += (-pointer.y * 0.07 - camera.position.y) * 0.032;
    camera.position.z += (config.cameraZ - camera.position.z) * 0.025;
    camera.lookAt(0, 0, 0);

    const drift = config.drift;
    screenToWorld(sharedView.centerX, sharedView.centerY, layoutAnchor);
    // Canvas 星群、网络球壳与浑天轨道共用同一屏幕锚点；禁止不同步的追赶造成视觉偏心。
    root.position.copy(layoutAnchor);
    networkShell.position.copy(layoutAnchor);
    const canvasRect = canvas.getBoundingClientRect();
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
    const worldPerPixel = visibleHeight / Math.max(1, canvasRect.height);
    const shellScale = Math.max(0.22, sharedView.radius * worldPerPixel / 1.05);
    const shellEase = 0.34;
    const relationPulseScale = 1 + relationVisual.pulse * 0.055;
    networkShell.scale.x += (shellScale * relationPulseScale - networkShell.scale.x) * shellEase;
    networkShell.scale.y += (shellScale * relationPulseScale - networkShell.scale.y) * shellEase;
    const layoutDepth = 1 - sharedView.layoutBlend * 0.82;
    networkShell.scale.z += (shellScale * relationPulseScale * layoutDepth - networkShell.scale.z) * shellEase;
    // 外轨尺度从同一个星群包围半径推导，保持“星团—网络壳—轨道”是一套天体系统。
    const orbitScale = Math.max(0.32, Math.min(1.55,
      shellScale / 2.45 * Math.pow(sharedView.scale, 0.12)));
    root.scale.x += (orbitScale - root.scale.x) * 0.16;
    root.scale.y += (orbitScale - root.scale.y) * 0.16;
    root.scale.z += (orbitScale - root.scale.z) * 0.16;
    armillaryPitch.scale.z += (layoutDepth - armillaryPitch.scale.z) * 0.1;
    networkPitch.rotation.x = sharedView.pitch;
    networkYaw.rotation.y = -sharedView.yaw;
    armillaryPitch.rotation.x = sharedView.pitch;
    armillaryYaw.rotation.y = -sharedView.yaw;
    armillary.rotation.z = seconds * 0.006 * drift + interaction.angle * 0.018;
    orbiters.rotation.z = -seconds * 0.004 * drift - interaction.angle * 0.025;
    const detailFade = Math.max(0.5, Math.min(1, 1 - Math.max(0, sharedView.scale - 1) * 0.3));
    ringMaterial.opacity = 0.14 * detailFade * (1 - sharedView.layoutBlend * 0.68);
    trigramMaterial.opacity = (0.55 + interaction.focus * 0.22) * detailFade;
    goldDust.material.opacity = (0.58 + interaction.focus * 0.12) * (0.72 + detailFade * 0.28) * (1 - sharedView.layoutBlend * 0.42);
    const classicShellFade = 1 - sharedView.layoutBlend * 0.88;
    coreMaterial.opacity = (0.11 + interaction.focus * 0.055) * (0.68 + detailFade * 0.32) * classicShellFade;
    innerCoreMaterial.opacity = (0.06 + interaction.focus * 0.035) * detailFade * classicShellFade;
    const focusPresence = interaction.focus * detailFade;
    focusLongitude.rotation.y = interaction.angle;
    focusLatitude.position.y = interaction.latitude;
    focusLatitude.scale.setScalar(interaction.latitudeRadius);
    const markerPhase = motionPreference.matches ? interaction.angle : seconds * 0.34;
    focusMarker.position.set(Math.cos(markerPhase) * 1.2, 0, Math.sin(markerPhase) * 1.2);
    focusOrbitMaterial.opacity = focusPresence * 0.34;
    focusLatitudeMaterial.opacity = focusPresence * 0.28;
    focusMarkerMaterial.opacity = focusPresence * 0.78;

    const activeAnchor = focusAnchor.hasAnchor ? focusAnchor : (selection.active && selection.hasAnchor ? selection : null);
    if (activeAnchor && focusPresence > 0.015) {
      screenToWorld(activeAnchor.x, activeAnchor.y, tetherAnchor);
      writeQuadraticArc(tetherPositions, layoutAnchor, tetherAnchor, 0.28 + Math.abs(activeAnchor.depth - 1) * 0.48);
      tetherGeometry.attributes.position.needsUpdate = true;
      for (let index = 0; index < tetherParticleCount; index += 1) {
        const progress = motionPreference.matches
          ? (index + 1) / (tetherParticleCount + 1)
          : (seconds * 0.19 * config.energy + index / tetherParticleCount) % 1;
        const scaled = progress * tetherSegmentCount;
        const lowerIndex = Math.min(tetherSegmentCount - 1, Math.floor(scaled));
        const localProgress = scaled - lowerIndex;
        const lowerOffset = lowerIndex * 3;
        const upperOffset = lowerOffset + 3;
        const particleOffset = index * 3;
        tetherParticlePositions[particleOffset] = tetherPositions[lowerOffset] + (tetherPositions[upperOffset] - tetherPositions[lowerOffset]) * localProgress;
        tetherParticlePositions[particleOffset + 1] = tetherPositions[lowerOffset + 1] + (tetherPositions[upperOffset + 1] - tetherPositions[lowerOffset + 1]) * localProgress;
        tetherParticlePositions[particleOffset + 2] = tetherPositions[lowerOffset + 2] + (tetherPositions[upperOffset + 2] - tetherPositions[lowerOffset + 2]) * localProgress;
      }
      tetherParticleGeometry.attributes.position.needsUpdate = true;
      focusTether.visible = true;
      tetherParticles.visible = true;
      tetherMaterial.opacity = focusPresence * (selection.active ? 0.48 : 0.34);
      tetherParticleMaterial.opacity = focusPresence * (selection.active ? 0.9 : 0.68);
    } else {
      focusTether.visible = false;
      tetherParticles.visible = false;
      tetherMaterial.opacity = 0;
      tetherParticleMaterial.opacity = 0;
    }
    if (selection.hasAnchor) {
      screenToWorld(selection.x, selection.y, selectionAnchor);
      selectionGroup.position.copy(selectionAnchor);
      selectionGroup.scale.setScalar(worldPerPixel * 30 / 1.24);
    }
    if (selection.pulse > 0.004) {
      selection.pulse *= 0.935;
      const pulseProgress = 1 - selection.pulse;
      const burstEnergy = Math.sin(pulseProgress * Math.PI);
      selectionHalo.visible = true;
      selectionEcho.visible = true;
      selectionRays.visible = true;
      selectionBurst.visible = true;
      selectionWave.visible = true;
      selectionMaterial.opacity = selection.pulse * 0.72;
      selectionEchoMaterial.opacity = selection.pulse * 0.42;
      selectionRayMaterial.opacity = burstEnergy * 0.52;
      selectionBurstMaterial.opacity = burstEnergy * 0.86;
      selectionWaveMaterial.uniforms.uProgress.value = pulseProgress;
      selectionWaveMaterial.uniforms.uOpacity.value = burstEnergy * 0.72;
      selectionHalo.scale.setScalar(1 + pulseProgress * 3.8);
      selectionEcho.scale.setScalar(1 + pulseProgress * 2.45);
      selectionRays.scale.setScalar(1 + pulseProgress * 2.15);
      selectionBurst.scale.setScalar(1 + pulseProgress * 3.35);
      selectionWave.scale.setScalar(0.85 + pulseProgress * 1.55);
      selectionHalo.rotation.z = interaction.angle;
      selectionEcho.rotation.z = -interaction.angle * 0.68 - pulseProgress * 0.42;
      selectionRays.rotation.z = interaction.angle + pulseProgress * 0.34;
      selectionBurst.rotation.z = -interaction.angle * 0.35 - pulseProgress * 0.7;
      coreMaterial.opacity += selection.pulse * 0.12;
    } else {
      selection.pulse = 0;
      selectionHalo.visible = false;
      selectionEcho.visible = false;
      selectionRays.visible = false;
      selectionBurst.visible = false;
      selectionWave.visible = false;
      selectionMaterial.opacity = 0;
      selectionEchoMaterial.opacity = 0;
      selectionRayMaterial.opacity = 0;
      selectionBurstMaterial.opacity = 0;
      selectionWaveMaterial.uniforms.uOpacity.value = 0;
    }
    farStars.rotation.y = seconds * 0.0025;
    goldDust.rotation.z = -seconds * 0.006;
    renderer.render(scene, camera);
  }

  function tick(time) {
    animationFrame = null;
    const fps = chooseCelestialFps({
      reducedMotion: motionPreference.matches,
      hidden: documentRef.hidden || pauseReasons.size > 0,
      mode: modeState.name,
      lowPower,
    });
    if (!fps) return;
    if (time - lastRenderAt >= 1000 / fps) {
      lastRenderAt = time;
      renderOnce(time);
    }
    animationFrame = windowRef.requestAnimationFrame(tick);
  }

  function start() {
    if (animationFrame !== null || destroyed || contextLost || motionPreference.matches || documentRef.hidden || pauseReasons.size) return;
    animationFrame = windowRef.requestAnimationFrame(tick);
  }

  function stop() {
    if (animationFrame === null) return;
    windowRef.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function onPointerMove(event) {
    if (coarsePointer.matches || motionPreference.matches) return;
    pointer.targetX = event.clientX / Math.max(1, windowRef.innerWidth) * 2 - 1;
    pointer.targetY = event.clientY / Math.max(1, windowRef.innerHeight) * 2 - 1;
  }

  function onVisibility() {
    if (documentRef.hidden) stop();
    else start();
  }

  function onMotionPreference() {
    if (motionPreference.matches) {
      stop();
      renderOnce();
    } else start();
  }

  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    stop();
    documentRef.body.classList.add('celestial-context-lost');
  }

  function onContextRestored() {
    contextLost = false;
    documentRef.body.classList.remove('celestial-context-lost');
    resize();
    start();
  }

  windowRef.addEventListener('resize', resize);
  windowRef.addEventListener('pointermove', onPointerMove, { passive: true });
  documentRef.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', onMotionPreference);
  else motionPreference.addListener?.(onMotionPreference);
  resize();
  start();

  return {
    available: true,
    setMode(mode) {
      modeState.name = MODE_SCENES[mode] ? mode : 'explore';
      modeState.config = MODE_SCENES[modeState.name];
      modeState.targetAccent.setHex(modeState.config.accent);
      modeState.targetSecondary.setHex(modeState.config.secondary);
      if (modeState.name !== 'explore') interaction.targetFocus = 0;
      else if (focusAnchor.hasAnchor) interaction.targetFocus = 1;
      else restoreSelectionProfile();
      canvas.dataset.scene = modeState.name;
      renderOnce();
      start();
    },
    setRelationState(state) {
      const type = Object.hasOwn(RELATION_COLORS, state?.type) ? state.type : 'opposite';
      const targetCount = Array.isArray(state?.targets) ? state.targets.length : 0;
      relationVisual.targetColor.setHex(RELATION_COLORS[type]);
      relationVisual.targetStrength = state?.code ? Math.min(1, 0.28 + targetCount * 0.16) : 0;
      relationVisual.pulse = motionPreference.matches ? 0 : 1;
      renderOnce();
      start();
    },
    syncView(view) {
      if (!view) return;
      if (Number.isFinite(view.yaw)) sharedView.targetYaw = view.yaw;
      if (Number.isFinite(view.pitch)) sharedView.targetPitch = view.pitch;
      if (Number.isFinite(view.scale)) sharedView.targetScale = view.scale;
      if (Number.isFinite(view.centerX)) sharedView.targetCenterX = view.centerX;
      if (Number.isFinite(view.centerY)) sharedView.targetCenterY = view.centerY;
      if (Number.isFinite(view.radius)) sharedView.targetRadius = Math.max(1, view.radius);
      if (typeof view.layoutMode === 'string') {
        sharedView.layoutMode = view.layoutMode;
        sharedView.targetLayoutBlend = view.layoutMode === 'project' ? 0 : 1;
      }
      if (selection.active && view.activeCode === selection.code && Number.isFinite(view.activeX) && Number.isFinite(view.activeY)) {
        updateInteractionAnchor(selection, { x: view.activeX, y: view.activeY, depthFactor: view.activeDepth });
      }
      if (focusAnchor.hasAnchor && view.hoverCode === focusAnchor.code && Number.isFinite(view.hoverX) && Number.isFinite(view.hoverY)) {
        updateInteractionAnchor(focusAnchor, { x: view.hoverX, y: view.hoverY, depthFactor: view.hoverDepth });
      }
      if (!sharedView.initialized) {
        sharedView.yaw = sharedView.targetYaw;
        sharedView.pitch = sharedView.targetPitch;
        sharedView.scale = sharedView.targetScale;
        sharedView.centerX = sharedView.targetCenterX;
        sharedView.centerY = sharedView.targetCenterY;
        sharedView.radius = sharedView.targetRadius;
        sharedView.layoutBlend = sharedView.targetLayoutBlend;
        sharedView.initialized = true;
      }
      if (motionPreference.matches) renderOnce();
      else start();
    },
    focusHexagram(code, point) {
      const profile = getHexagramSpatialProfile(code);
      if (profile) {
        focusAnchor.code = code;
        updateInteractionAnchor(focusAnchor, point);
        applySpatialProfile(profile);
        interaction.targetFocus = modeState.name === 'explore' ? 1 : 0;
      } else {
        focusAnchor.code = null;
        focusAnchor.hasAnchor = false;
        if (!restoreSelectionProfile()) interaction.targetFocus = 0;
      }
      renderOnce();
      start();
    },
    selectHexagram(code, point) {
      const profile = getHexagramSpatialProfile(code);
      if (!profile) return;
      selection.active = true;
      selection.code = code;
      selection.profile = profile;
      interaction.targetFocus = modeState.name === 'explore' ? 0.84 : 0;
      applySpatialProfile(profile);
      updateInteractionAnchor(selection, point);
      selection.pulse = motionPreference.matches ? 0 : 1;
      renderOnce();
      start();
    },
    clearSelection() {
      selection.active = false;
      selection.code = null;
      selection.profile = null;
      selection.pulse = 0;
      selection.hasAnchor = false;
      if (!focusAnchor.hasAnchor) interaction.targetFocus = 0;
      renderOnce();
      start();
    },
    pause(reason = 'manual') {
      pauseReasons.add(reason);
      stop();
    },
    resume(reason = 'manual') {
      pauseReasons.delete(reason);
      if (motionPreference.matches) renderOnce();
      else start();
    },
    renderOnce,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      windowRef.removeEventListener('resize', resize);
      windowRef.removeEventListener('pointermove', onPointerMove);
      documentRef.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (motionPreference.removeEventListener) motionPreference.removeEventListener('change', onMotionPreference);
      else motionPreference.removeListener?.(onMotionPreference);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
