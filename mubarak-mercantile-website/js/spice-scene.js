// ============================================================
// MUBARAK MERCANTILE — Hero 3D spice scene (vanilla Three.js)
//
// Reusable building blocks:
//   - HeroSpiceScene        : full hero scene (chili + flakes + particles)
//   - SpiceParticleField    : golden spice particle drift
//   - initHeroScene()       : capability check -> live scene or poster
//
// ASSET PLACEHOLDER: the hero chili is generated procedurally.
// Replace with a scanned/photographed GLB of the real product
// when brand assets are available (see createChiliMesh).
// ============================================================

import * as THREE from './vendor/three.module.js';

const ENTRY_DURATION = 1200; // ms — chili + particles fade/float in over 1.2s

/* ------------------------------------------------------------
 * Capability detection
 * ---------------------------------------------------------- */

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isCoarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches;
}

/* ------------------------------------------------------------
 * Procedural textures (canvas)
 * ---------------------------------------------------------- */

function makeChiliTextures() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#A81E0F';
  ctx.fillRect(0, 0, 512, 512);

  // Longitudinal streaks — the wrinkled look of a dried chili
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const w = 2 + Math.random() * 8;
    const light = Math.random() > 0.5;
    ctx.fillStyle = light
      ? `rgba(201,58,34,${0.05 + Math.random() * 0.10})`
      : `rgba(126,20,8,${0.05 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * 6, y);
    for (let y = 512; y >= 0; y -= 32) ctx.lineTo(x + w + Math.sin(y * 0.02 + i) * 6, y);
    ctx.closePath();
    ctx.fill();
  }

  // Soft tonal blotches
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 20 + Math.random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() > 0.4 ? 'rgba(110,16,6,0.10)' : 'rgba(226,90,58,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // Bump map — grayscale wrinkle streaks
  const b = document.createElement('canvas');
  b.width = b.height = 256;
  const bctx = b.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 256;
    bctx.strokeStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${0.05 + Math.random() * 0.1})`
      : `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
    bctx.lineWidth = 1 + Math.random() * 3;
    bctx.beginPath();
    bctx.moveTo(x, 0);
    bctx.bezierCurveTo(x + 8, 85, x - 8, 170, x + 4, 256);
    bctx.stroke();
  }
  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeGlowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------
 * Procedural dried red chili
 * ---------------------------------------------------------- */

function createChiliGeometry() {
  // Gentle S-curve: stem at top, tip at bottom
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.00, 1.02, 0.00),
    new THREE.Vector3(0.10, 0.62, 0.06),
    new THREE.Vector3(-0.05, 0.10, -0.05),
    new THREE.Vector3(0.09, -0.45, 0.05),
    new THREE.Vector3(0.00, -0.98, 0.00),
  ]);

  const tubularSegments = 72;
  const radialSegments = 28;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Shoulder fullness just below the stem, long taper to the tip
  const radiusAt = (t) => {
    const rise = Math.sin(Math.min(t * 3.0, 1) * Math.PI * 0.5);
    const taper = Math.pow(1 - t, 0.72);
    return Math.max(0.004, 0.155 * (0.30 + 0.70 * rise) * (0.25 + 0.75 * taper));
  };

  const up = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up);
    if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const r = radiusAt(t);

    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      // Dried-chili wrinkles: longitudinal ridges + fine noise
      const wrinkle = 1
        + 0.055 * Math.sin(a * 9 + t * 22) * Math.sin(t * Math.PI)
        + 0.03 * Math.sin(a * 17 - t * 34)
        + 0.02 * Math.sin(a * 5 + t * 60);
      const rr = r * wrinkle;
      positions.push(
        center.x + (Math.cos(a) * normal.x + Math.sin(a) * binormal.x) * rr,
        center.y + (Math.cos(a) * normal.y + Math.sin(a) * binormal.y) * rr,
        center.z + (Math.cos(a) * normal.z + Math.sin(a) * binormal.z) * rr
      );
      uvs.push(j / radialSegments, t);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createChiliMesh(THREE) {
  const { map, bump } = makeChiliTextures();
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.7,
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.04,
    transparent: true,
  });
  material.userData.baseOpacity = 1;

  const chili = new THREE.Mesh(createChiliGeometry(), material);

  // Stem
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.96, 0),
    new THREE.Vector3(0.02, 1.12, 0.01),
    new THREE.Vector3(0.09, 1.24, 0.03),
    new THREE.Vector3(0.05, 1.36, 0.0),
  ]);
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x5A6B3A, roughness: 0.7, transparent: true,
  });
  stemMat.userData.baseOpacity = 1;
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.026, 8), stemMat);

  // Calyx (green cap where stem meets body)
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x4A5A2E, roughness: 0.65, transparent: true,
  });
  calyxMat.userData.baseOpacity = 1;
  const calyx = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.15, 10), calyxMat);
  calyx.position.set(0, 1.0, 0);

  const group = new THREE.Group();
  group.add(chili, stem, calyx);
  return { group, fadeMaterials: [material, stemMat, calyxMat] };
}

/* ------------------------------------------------------------
 * SpiceParticleField — golden spice dust drifting upward
 * ---------------------------------------------------------- */

export class SpiceParticleField {
  constructor(THREE, { count = 260, color = 0xE8A317, bounds = { x: 2.4, y: 3.6, z: 1.6 } } = {}) {
    this.THREE = THREE;
    this.bounds = bounds;
    const positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    this.phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * bounds.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * bounds.y * 0.5 + 0.2;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * bounds.z;
      this.speeds[i] = 0.05 + Math.random() * 0.12;
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.PointsMaterial({
      color,
      size: 0.045,
      map: makeGlowSprite(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.material.userData.baseOpacity = 0.75;

    this.points = new THREE.Points(geo, this.material);
  }

  update(t, dt) {
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.speeds[i] * dt;
      const x = pos.getX(i) + Math.sin(t * 0.6 + this.phases[i]) * 0.15 * dt;
      if (y > this.bounds.y * 0.5 + 0.4) y = -this.bounds.y * 0.5 + 0.2;
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  setOpacity(o) {
    this.material.opacity = o;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.map.dispose();
    this.material.dispose();
  }
}

/* ------------------------------------------------------------
 * HeroSpiceScene — full hero scene
 * ---------------------------------------------------------- */

export class HeroSpiceScene {
  constructor(container, THREE) {
    this.container = container;
    this.THREE = THREE;
    this.disposed = false;
    this.running = false;
    this.visible = true;
    this.reducedMotion = prefersReducedMotion();
    this.pointer = { x: 0, y: 0 };
    this.startTime = performance.now();
    this.last = this.startTime;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 560;

    // Renderer — DPR capped (lower on mobile/low-power)
    const dprCap = isCoarsePointer() ? 1.5 : 2;
    this.renderer = new THREE.WebGLRenderer({
      canvas: container.querySelector('canvas'),
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 20);
    this.camera.position.set(0, 0.15, 4.4);

    // Warm studio lighting
    this.scene.add(new THREE.HemisphereLight(0xFFF1DC, 0x2A120A, 0.6));
    const key = new THREE.DirectionalLight(0xFFDFB0, 1.8);
    key.position.set(3.2, 4.2, 2.6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xB42318, 1.0);
    rim.position.set(-3.5, 1.2, -2.8);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xFFE9C9, 0.35);
    fill.position.set(-2, -1, 3);
    this.scene.add(fill);

    // Root group carries the entry animation; spinner rotates the chili
    this.root = new THREE.Group();
    this.spinner = new THREE.Group();
    this.root.add(this.spinner);
    this.scene.add(this.root);

    const { group: chiliGroup, fadeMaterials } = createChiliMesh(THREE);
    this.spinner.add(chiliGroup);
    this.fadeMats = fadeMaterials;

    // Sparse chili flakes drifting around the chili
    this.flakes = new THREE.Group();
    const flakeGeo = new THREE.TetrahedronGeometry(0.022);
    const flakeColors = [0xB42318, 0xC93A22, 0xE8A317];
    const flakeMats = flakeColors.map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: true });
      m.userData.baseOpacity = 0.95;
      return m;
    });
    for (let i = 0; i < 34; i++) {
      const f = new THREE.Mesh(flakeGeo, flakeMats[i % flakeMats.length]);
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.55 + Math.random() * 0.75;
      f.position.set(
        Math.cos(ang) * rad,
        -1.1 + Math.random() * 2.4,
        Math.sin(ang) * rad * 0.7
      );
      f.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      f.userData = {
        baseY: f.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        rot: (Math.random() - 0.5) * 0.6,
      };
      this.flakes.add(f);
    }
    this.spinner.add(this.flakes);
    this.fadeMats.push(...flakeMats);

    // Golden spice particles
    this.particles = new SpiceParticleField(THREE);
    this.root.add(this.particles.points);
    this.fadeMats.push(this.particles.material);

    // Soft fake contact shadow (no shadow maps — keeps the scene cheap)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({
        map: makeContactShadowTexture(),
        transparent: true,
        depthWrite: false,
      })
    );
    shadow.material.userData.baseOpacity = 1;
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.35;
    this.root.add(shadow);
    this.fadeMats.push(shadow.material);

    // Events
    this._onPointer = (e) => {
      const r = this.container.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    this._onResize = () => this.resize();
    this._onVisibility = () => this.setRunning(this.visible && !document.hidden);
    this._onContextLost = (e) => {
      e.preventDefault();
      this.dispose();
      showPosterFallback(this.container);
    };

    window.addEventListener('pointermove', this._onPointer, { passive: true });
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);

    this._io = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0].isIntersecting;
        this.setRunning(this.visible && !document.hidden);
      },
      { threshold: 0.05 }
    );
    this._io.observe(this.container);

    this.resize();
  }

  resize() {
    if (this.disposed) return;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 560;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setRunning(run) {
    if (this.disposed || this.reducedMotion) return;
    if (run === this.running) return;
    this.running = run;
    if (run) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  start() {
    if (this.reducedMotion) {
      // Static, fully-formed frame — no motion
      this.applyEntry(1);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.setRunning(this.visible && !document.hidden);
  }

  applyEntry(e) {
    const ease = 1 - Math.pow(1 - e, 3);
    this.root.position.y = (1 - ease) * 0.45;
    this.root.scale.setScalar(0.93 + 0.07 * ease);
    for (const m of this.fadeMats) m.opacity = (m.userData.baseOpacity ?? 1) * ease;
  }

  tick = (now) => {
    if (this.disposed || !this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const t = now / 1000;

    // Entry: fade + float into position over 1.2s
    const e = Math.min((now - this.startTime) / ENTRY_DURATION, 1);
    this.applyEntry(e);

    // Very slow rotation
    this.spinner.rotation.y += dt * 0.28;
    this.spinner.rotation.x = Math.sin(t * 0.25) * 0.06;

    // Flakes bob and tumble
    for (const f of this.flakes.children) {
      const u = f.userData;
      f.position.y = u.baseY + Math.sin(t * u.speed + u.phase) * 0.12;
      f.rotation.x += dt * u.rot;
      f.rotation.y += dt * u.rot * 0.7;
    }

    this.particles.update(t, dt);

    // Subtle camera parallax from mouse movement
    const px = this.pointer.x * 0.3;
    const py = 0.15 + this.pointer.y * 0.18;
    this.camera.position.x += (px - this.camera.position.x) * 0.045;
    this.camera.position.y += (py - this.camera.position.y) * 0.045;
    this.camera.lookAt(0, -0.05, 0);

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this._io.disconnect();
    window.removeEventListener('pointermove', this._onPointer);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.particles.dispose();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

/* ------------------------------------------------------------
 * Poster fallback — mobile / no-WebGL / reduced motion
 *
 * ASSET PLACEHOLDER: this stylized SVG poster stands in for a
 * high-quality hero photograph of the real product. Replace
 * `poster` markup in index.html with a compressed WebP/AVIF
 * image (or a 5-7s looping video) from Mubarak Mercantile.
 * ---------------------------------------------------------- */

export function showPosterFallback(container) {
  const loading = container.querySelector('.scene-loading');
  if (loading) loading.remove();

  const fallback = container.querySelector('.scene-fallback');
  if (!fallback) return;

  // Generated gold/chili particle field for the poster
  let dots = '';
  for (let i = 0; i < 90; i++) {
    const x = 30 + Math.random() * 340;
    const y = 30 + Math.random() * 340;
    const r = 0.8 + Math.random() * 2.2;
    const o = 0.25 + Math.random() * 0.6;
    const gold = Math.random() > 0.22;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${gold ? '#E8A317' : '#C93A22'}" opacity="${o.toFixed(2)}"/>`;
  }

  fallback.innerHTML = `
  <svg viewBox="0 0 400 400" role="img" aria-label="Dried red chili with drifting spice particles — Mubarak Mercantile" preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id="pbg" cx="50%" cy="42%" r="78%">
        <stop offset="0%" stop-color="#3A241A"/>
        <stop offset="55%" stop-color="#26140D"/>
        <stop offset="100%" stop-color="#181512"/>
      </radialGradient>
      <linearGradient id="pchili" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#C93A22"/>
        <stop offset="45%" stop-color="#B42318"/>
        <stop offset="100%" stop-color="#7E1408"/>
      </linearGradient>
      <filter id="psoft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>
    </defs>
    <rect width="400" height="400" fill="url(#pbg)"/>
    <ellipse cx="200" cy="205" rx="150" ry="170" fill="#E8A317" opacity="0.09" filter="url(#psoft)"/>
    <g>
      <path d="M205 78 C 235 95 250 130 243 168 C 236 208 210 250 188 292 C 178 312 168 330 158 338 C 150 344 142 340 144 330 C 148 308 158 272 162 236 C 167 196 168 150 178 112 C 184 90 192 80 205 78 Z" fill="url(#pchili)"/>
      <path d="M218 100 C 230 118 238 146 233 178" stroke="#E86A4A" stroke-width="5" fill="none" opacity="0.5" stroke-linecap="round"/>
      <path d="M196 92 C 214 110 224 140 220 176" stroke="#7E1408" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>
      <path d="M186 130 C 200 150 208 180 202 214" stroke="#7E1408" stroke-width="2.5" fill="none" opacity="0.4" stroke-linecap="round"/>
      <path d="M176 170 C 186 192 190 220 184 250" stroke="#7E1408" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/>
      <path d="M203 80 C 200 66 204 54 214 46" stroke="#5A6B3A" stroke-width="7" fill="none" stroke-linecap="round"/>
    </g>
    <g>${dots}</g>
  </svg>`;
  fallback.style.display = 'flex';
}

/* ------------------------------------------------------------
 * initHeroScene — lazy entry point (called from main.js)
 * ---------------------------------------------------------- */

export async function initHeroScene(container) {
  const useLiveScene =
    isWebGLAvailable() &&
    !isCoarsePointer() &&
    window.innerWidth >= 900 &&
    !prefersReducedMotion();

  if (useLiveScene) {
    try {
      const scene = new HeroSpiceScene(container, THREE);
      scene.start();
      const loading = container.querySelector('.scene-loading');
      if (loading) loading.classList.add('done');
      return scene;
    } catch (e) {
      console.warn('Hero 3D scene unavailable, using poster fallback.', e);
    }
  }
  showPosterFallback(container);
  return null;
}
