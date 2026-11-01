/* Home hero: one night of service as a short film in particles.
 *
 * Every scene (the waiter at table 4, the chef at the pass, the cashier, the
 * manager in the store room, the owner at home, the finale) is built from
 * CC0 models baked into point clouds (assets/particles, by
 * scripts/website/particles/bake.py) and primitives, set in a room of its own
 * (floor, walls, windows onto the city, lamps), all sampled into the same
 * number of particles, so scrolling makes one cloud stream from one scene into
 * the next. A second, still layer of particles fills the frame behind it: stars,
 * nebula, drifting bokeh and a dotted ground. The app itself appears as real
 * HTML mockups (.film-mocks), tied by a line to the device in the person's hand.
 * The pointer pushes particles aside, a click sends a ripple through them, and
 * a mouse drag turns the scene.
 *
 * The script in the page (.film-script) is the content: this file plays it as
 * subtitles. With reduced motion, no WebGL, or this file blocked, the hero is
 * the title and the script as a list. */

const root = document.querySelector('[data-film]');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

if (root && !calm && hasWebGL()) {
  Promise.all([import('/assets/vendor/three.module.min.js'), import('/film-screens.js')]).then(start).catch(() => {});
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Camera for each scene: turn of the model, camera height angle, distance,
// and the point looked at. Wide screens aim right of the action so the app
// mockup has the right of the frame; px shifts that back on portrait screens,
// where the mockup sits above the scene instead.
const VIEWS = [
  { yaw: 0.0, pitch: 0.2, dist: 12.5, x: 0, y: 0.4 },     // 0 title
  { yaw: 0.42, pitch: 0.16, dist: 7.6, x: 1.2, y: 1.15, px: -1.0 }, // 1 waiter
  { yaw: -0.3, pitch: 0.14, dist: 7.4, x: 1.0, y: 1.25, px: -0.9 },  // 2 chef
  { yaw: 0.3, pitch: 0.16, dist: 7.4, x: 1.0, y: 1.3, px: -0.9 },  // 3 cashier
  { yaw: -0.38, pitch: 0.14, dist: 7.6, x: 1.0, y: 1.2, px: -0.9 },  // 4 manager
  { yaw: 0.3, pitch: 0.12, dist: 7.8, x: 0.9, y: 1.3, px: -0.9 },  // 5 owner
  { yaw: 0.0, pitch: 0.22, dist: 13.5, x: 0, y: -0.15 },   // 6 finale
];
const SCENES = VIEWS.length;

function start([THREE, SCREENS]) {
  const V3 = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler, M4 = THREE.Matrix4, Col = THREE.Color;
  const { wifiUI, kotUI, ringUI, wordUI, G1 } = SCREENS;

  const stage = root.querySelector('.film-stage');
  const canvas = root.querySelector('.film-canvas');
  const title = root.querySelector('.film-title');
  const sub = root.querySelector('.film-sub');
  const subRole = root.querySelector('.film-role');
  const subLine = root.querySelector('.film-line');
  const rail = root.querySelector('.film-rail');
  const hint = root.querySelector('.film-hint');
  const end = root.querySelector('.film-end');
  const script = {};
  root.querySelectorAll('.film-script li').forEach((li) => {
    script[+li.dataset.scene] = { role: li.dataset.role, time: li.dataset.time, ai: li.hasAttribute('data-ai'), text: li.textContent.trim() };
  });

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return;
  }
  root.classList.add('film-live');
  renderer.setClearColor(0x0C0C0B, 1);

  const phone = window.innerWidth < 900;
  const cores = navigator.hardwareConcurrency || 4;
  const N = phone ? 48000 : cores <= 4 ? 80000 : 115000;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const rig = new THREE.Group();             // turned by the scene view, the pointer and drags
  scene.add(rig);

  // ---------------------------------------------------------------- palette
  const P = {
    body: new Col('#E4DCCD'), skin: new Col('#E9CDAF'), hair: new Col('#7E705F'), legs: new Col('#77736C'),
    white: new Col('#F4F0E8'), green: new Col('#5FE39A'), mint: new Col('#A8F0C6'), amber: new Col('#FFB547'),
    red: new Col('#FF6B5E'), steel: new Col('#8C9DB0'), dim: new Col('#5C5952'), wood: new Col('#C9A27A'),
    food: new Col('#FFB15C'), glass: new Col('#9ED9C0'), blue: new Col('#A9C4F0'),
  };

  // ---------------------------------------------------------------- sampling
  const L = new V3(0.45, 0.8, 0.55).normalize();
  const tmp = new V3(), tA = new V3(), tB = new V3(), tC = new V3(), tN = new V3(), tmpCol = new Col();

  class Shot {
    constructor() { this.parts = []; }
    mesh(geo, matrix, color, opts = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const src = g.attributes.position.array;
      const tris = new Float32Array(src.length);
      for (let i = 0; i < src.length; i += 3) {
        tmp.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(matrix);
        tris[i] = tmp.x; tris[i + 1] = tmp.y; tris[i + 2] = tmp.z;
      }
      const nt = tris.length / 9;
      const cum = new Float32Array(nt), shade = new Float32Array(nt);
      let total = 0;
      for (let t = 0; t < nt; t++) {
        tA.fromArray(tris, t * 9); tB.fromArray(tris, t * 9 + 3); tC.fromArray(tris, t * 9 + 6);
        tN.subVectors(tB, tA).cross(tmp.subVectors(tC, tA));
        const a = tN.length() / 2;
        total += a; cum[t] = total;
        tN.normalize();
        shade[t] = 0.42 + 0.58 * Math.abs(tN.dot(L));
      }
      if (total > 0) this.parts.push({ kind: 'mesh', tris, cum, shade, area: total, color, density: opts.density || 1, share: opts.share });
    }
    image(canvas, w, h, matrix, opts = {}) {
      const ctx = canvas.getContext('2d');
      const { width: W, height: H } = canvas;
      const data = ctx.getImageData(0, 0, W, H).data;
      const idx = [], cum = [];
      let total = 0;
      for (let i = 0; i < W * H; i++) {
        const a = data[i * 4 + 3] / 255;
        const lum = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
        const wgt = a * lum;
        if (wgt < 0.08) continue;
        total += wgt; idx.push(i); cum.push(total);
      }
      this.parts.push({ kind: 'image', data, W, H, idx, cum: Float32Array.from(cum), total, w, h, matrix, map: opts.map, depth: opts.depth || 0.012, gain: opts.gain || 1, share: opts.share, area: w * h, density: 1 });
    }
    points(fn, color, share) { this.parts.push({ kind: 'fn', fn, color, share }); }
    // Like points(), but fn also sets each point's colour.
    tinted(fn, share) { this.parts.push({ kind: 'fnc', fn, share }); }
    // A baked model (assets/particles/*.fsp), placed by matrix. Its weight
    // in the shot follows its baked density, scaled by its size.
    cloud(name, matrix, opts = {}) {
      const c = CLOUDS[name];
      if (!c) return false;
      const s = new V3().setFromMatrixScale(matrix).x;
      this.parts.push({
        kind: 'cloud', c, matrix, tint: opts.tint || null, gain: opts.gain || 1, share: opts.share,
        area: (c.count / 5000) * s * s, density: opts.density || 1, start: Math.floor(Math.random() * c.count),
      });
      return true;
    }

    sample(n) {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let used = 0;
      const free = [];
      this.parts.forEach((p) => {
        if (p.share != null) { p.n = Math.round(p.share * n); used += p.n; } else free.push(p);
      });
      const fw = free.reduce((s, p) => s + p.area * p.density, 0);
      free.forEach((p) => { p.n = Math.floor(((n - used) * p.area * p.density) / fw); });
      const sum = this.parts.reduce((s, p) => s + p.n, 0);
      const big = (free.length ? free : this.parts).reduce((a, b) => (b.n > a.n ? b : a));
      big.n += n - sum;
      let o = 0;
      for (const p of this.parts) {
        for (let i = 0; i < p.n && o < n; i++, o++) fillOne(p, i, pos, col, o * 3);
      }
      // Order particles roughly left to right, so a change of scene reads as a
      // flow across the frame rather than a random shuffle.
      const order = new Uint32Array(n).map((_, i) => i);
      const key = new Float32Array(n);
      for (let i = 0; i < n; i++) key[i] = pos[i * 3] * 0.8 + pos[i * 3 + 1] * 0.35 + (Math.random() - 0.5) * 1.6;
      order.sort((a, b) => key[a] - key[b]);
      const P2 = new Float32Array(n * 3), C2 = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const j = order[i];
        P2[i * 3] = pos[j * 3]; P2[i * 3 + 1] = pos[j * 3 + 1]; P2[i * 3 + 2] = pos[j * 3 + 2];
        C2[i * 3] = col[j * 3]; C2[i * 3 + 1] = col[j * 3 + 1]; C2[i * 3 + 2] = col[j * 3 + 2];
      }
      return { pos: P2, col: C2 };
    }
  }

  function search(cum, r) {
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    return lo;
  }

  function fillOne(p, i, pos, col, o) {
    const v = 0.82 + Math.random() * 0.36;
    if (p.kind === 'mesh') {
      const t = search(p.cum, Math.random() * p.area);
      let u = Math.random(), w = Math.random();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const b = t * 9, tr = p.tris;
      pos[o] = tr[b] + (tr[b + 3] - tr[b]) * u + (tr[b + 6] - tr[b]) * w;
      pos[o + 1] = tr[b + 1] + (tr[b + 4] - tr[b + 1]) * u + (tr[b + 7] - tr[b + 1]) * w;
      pos[o + 2] = tr[b + 2] + (tr[b + 5] - tr[b + 2]) * u + (tr[b + 8] - tr[b + 2]) * w;
      const s = p.shade[t] * v;
      col[o] = p.color.r * s; col[o + 1] = p.color.g * s; col[o + 2] = p.color.b * s;
    } else if (p.kind === 'image') {
      const k = p.idx[search(p.cum, Math.random() * p.total)];
      const px = (k % p.W) + Math.random(), py = Math.floor(k / p.W) + Math.random();
      const u = px / p.W, vv = py / p.H;
      if (p.map) p.map(u, vv, tmp);
      else tmp.set((u - 0.5) * p.w, (0.5 - vv) * p.h, (Math.random() - 0.5) * p.depth).applyMatrix4(p.matrix);
      pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      const g = p.gain * (0.9 + Math.random() * 0.2) / 255;
      col[o] = p.data[k * 4] * g; col[o + 1] = p.data[k * 4 + 1] * g; col[o + 2] = p.data[k * 4 + 2] * g;
    } else if (p.kind === 'cloud') {
      const c = p.c, k = (p.start + i * 7919) % c.count;
      tmp.set(
        c.pos[k * 3] + (Math.random() - 0.5) * c.step[0],
        c.pos[k * 3 + 1] + (Math.random() - 0.5) * c.step[1],
        c.pos[k * 3 + 2] + (Math.random() - 0.5) * c.step[2]).applyMatrix4(p.matrix);
      pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      const g = p.gain * v, t = p.tint;
      col[o] = c.col[k * 3] * g * (t ? t.r : 1); col[o + 1] = c.col[k * 3 + 1] * g * (t ? t.g : 1); col[o + 2] = c.col[k * 3 + 2] * g * (t ? t.b : 1);
    } else if (p.kind === 'fnc') {
      tmpCol.setRGB(1, 1, 1);
      const c = p.fn(i, tmp, tmpCol) || 1;
      pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      col[o] = tmpCol.r * c * v; col[o + 1] = tmpCol.g * c * v; col[o + 2] = tmpCol.b * c * v;
    } else {
      const c = p.fn(i, tmp) || 1;
      pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      const s = c * v;
      col[o] = p.color.r * s; col[o + 1] = p.color.g * s; col[o + 2] = p.color.b * s;
    }
  }

  // ---------------------------------------------------------------- baked models
  // Point clouds baked from CC0 models (Poly Haven props, Quaternius people) by
  // scripts/website/particles/bake.py. Six bytes a point: u8 xyz in the
  // model's box, u8 rgb.
  const CLOUDS = {};
  function parseCloud(buf, meta) {
    const dv = new DataView(buf);
    const n = dv.getUint32(4, true);
    const lo = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
    const hi = [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)];
    const q = new Uint8Array(buf, 32, n * 3), c = new Uint8Array(buf, 32 + n * 3, n * 3);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const a = i % 3;
      pos[i] = lo[a] + (q[i] / 255) * (hi[a] - lo[a]);
      col[i] = c[i] / 255;
    }
    return { count: n, pos, col, step: [0, 1, 2].map((a) => (hi[a] - lo[a]) / 255), anchors: meta.anchors || {} };
  }
  const cloudsReady = fetch('/assets/particles/manifest.json')
    .then((r) => r.json())
    .then((man) => Promise.all(Object.keys(man.clouds).map((name) =>
      fetch('/assets/particles/' + name + '.fsp').then((r) => r.arrayBuffer()).then((b) => { CLOUDS[name] = parseCloud(b, man.clouds[name]); }))))
    .catch(() => {});
  // Where a baked person's hand or head ends up once placed.
  function anchor(name, key, matrix) {
    const a = CLOUDS[name] && CLOUDS[name].anchors[key];
    return a ? new V3(a[0], a[1], a[2]).applyMatrix4(matrix) : new V3().setFromMatrixPosition(matrix).add(new V3(0, 1.3, 0.3));
  }
  const midHands = (name, m) => anchor(name, 'hand_r', m).add(anchor(name, 'hand_l', m)).multiplyScalar(0.5);

  // ---------------------------------------------------------------- modelling helpers
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) =>
    new M4().compose(new V3(x, y, z), new Q().setFromEuler(new E(rx, ry, rz)), typeof s === 'number' ? new V3(s, s, s) : new V3(s[0], s[1], s[2]));
  const mul = (a, b) => a.clone().multiply(b);
  const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

  function roundRect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function slab(w, h, d, r) {
    const g = new THREE.ExtrudeGeometry(roundRect(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -d / 2);
    return g;
  }

  function limb(S, base, a, b, r, color, density = 1.5) {
    const A = new V3(a[0], a[1], a[2]), B = new V3(b[0], b[1], b[2]);
    const len = Math.max(0.001, A.distanceTo(B));
    const q = new Q().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    const m = new M4().compose(A.clone().add(B).multiplyScalar(0.5), q, new V3(1, 1, 1));
    S.mesh(new THREE.CapsuleGeometry(r, len, 4, 14), mul(base, m), color, { density });
  }

  // A person, feet at the origin, facing +z, built from primitives. Only used
  // if the baked people fail to load.
  function person(S, base, o = {}) {
    const y0 = o.sit ? -0.43 : 0;
    const cloth = o.cloth || P.body, legs = o.legs || P.legs, dens = 1.6;
    const add = (geo, m, c, d = dens) => S.mesh(geo, mul(base, m), c, { density: d });
    [-1, 1].forEach((s) => {
      if (o.sit) {
        limb(S, base, [s * 0.09, 0.5, 0], [s * 0.1, 0.5, 0.42], 0.068, legs);
        limb(S, base, [s * 0.1, 0.5, 0.42], [s * 0.1, 0.08, 0.46], 0.052, legs);
      } else {
        limb(S, base, [s * 0.09, 0.93, 0], [s * 0.1, 0.5, 0.02], 0.07, legs);
        limb(S, base, [s * 0.1, 0.5, 0.02], [s * 0.1, 0.08, 0], 0.053, legs);
      }
    });
    add(lathe([[0, 0.9], [0.15, 0.92], [0.17, 1.0], [0.155, 1.12], [0.165, 1.26], [0.2, 1.38], [0.17, 1.45], [0.07, 1.49], [0, 1.5]]), M(0, y0, 0, 0, 0, 0, [1, 1, 0.7]), cloth);
    add(new THREE.SphereGeometry(0.105, 28, 20), M(0, 1.67 + y0, 0.01, 0, 0, 0, [0.92, 1.1, 1]), P.skin, 2);
    [-1, 1].forEach((s) => {
      limb(S, base, [s * 0.2, 1.41 + y0, 0], [s * 0.24, 1.13 + y0, 0.03], 0.05, cloth);
      limb(S, base, [s * 0.24, 1.13 + y0, 0.03], [s * 0.25, 0.87 + y0, 0.07], 0.042, cloth);
    });
  }

  // A baked person, or the primitive figure if the baked clouds did not load.
  function who(S, name, m, fallback) {
    if (!S.cloud(name, m, { density: 1.5 })) person(S, m, fallback);
  }

  function device(S, m, w, h, d, ui, share, frame = P.steel) {
    S.mesh(slab(w, h, d, Math.min(w, h) * 0.09), m, frame, { density: 0.55 });
    if (ui) S.image(ui, w * 0.92, h * 0.92, mul(m, M(0, 0, d / 2 + 0.006)), { share });
  }

  function floor(S, r, share, cx = 0, cz = 0, y = 0) {
    S.points((i, out) => {
      const rr = Math.sqrt(Math.random()) * r, a = Math.random() * Math.PI * 2;
      out.set(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr);
      return 0.55 * (1 - (rr / r) * 0.7);
    }, P.dim, share);
  }



  function receipt(S, ui, x, y, z, share, len = 0.55) {
    S.image(ui, 0.2, len, null, {
      share,
      map: (u, v, out) => {
        const a = (1 - v) * 1.35;               // curls toward the viewer as it leaves the slot
        out.set(x + (u - 0.5) * 0.2, y + Math.sin(a) * len * 0.62, z + (1 - Math.cos(a)) * len * 0.62);
      },
    });
  }

  // A logo made of particles, with depth so it reads as solid when it turns.
  function logo(S, x, y, z, size, share) {
    if (SCREENS.logoUI) S.image(SCREENS.logoUI, size, size, M(x, y, z), { share, depth: size * 0.14, gain: 0.95 });
    else S.points((i, out) => { out.set(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size, z); return 0.6; }, P.green, share);
  }

  function ring(S, canvas, cx, cy, cz, R, h, tilt, share, gain = 0.9) {
    const m = M(cx, cy, cz, tilt, 0, 0);
    S.image(canvas, 1, 1, null, {
      share, gain,
      map: (u, v, out) => { const a = u * Math.PI * 2; out.set(Math.sin(a) * R, (0.5 - v) * h, Math.cos(a) * R).applyMatrix4(m); },
    });
  }

  function dust(S, share, R = 9) {
    S.points((i, out) => {
      const r = R * (0.55 + Math.random() * 0.45), a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      out.set(r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * 0.6, r * Math.sin(b) * Math.sin(a));
      return 0.25 + Math.random() * 0.35;
    }, P.dim, share);
  }

  // ---------------------------------------------------------------- rooms
  // Dim on purpose: the room frames the people, it doesn't compete with them.
  const fade = (x, z, r) => Math.max(0, 1 - Math.hypot(x, z) / r);
  // Floorboards: dotted lines with the odd seam, fading at the edges.
  function planks(S, x0, x1, z0, z1, share, color = P.wood) {
    const rows = Math.max(1, Math.floor((z1 - z0) / 0.16));
    S.points((i, out) => {
      const x = x0 + Math.random() * (x1 - x0), z = z0 + (Math.floor(Math.random() * rows) + (Math.random() < 0.12 ? Math.random() : 0)) * 0.16;
      out.set(x, 0, z);
      return 0.42 * (0.35 + fade(x / (x1 - x0) * 2, z / (z1 - z0) * 2, 1.4));
    }, color, share);
  }
  // Checker tiles for the kitchen floor.
  function tilesFloor(S, x0, x1, z0, z1, share) {
    S.tinted((i, out, c) => {
      const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
      out.set(x, 0, z);
      const dark = (Math.floor(x / 0.3) + Math.floor(z / 0.3)) % 2 === 0;
      c.copy(dark ? P.red : P.white).multiplyScalar(dark ? 0.32 : 0.22);
      return 0.4 + fade(x / 3, z / 3, 1.4);
    }, share);
  }
  // A wall: panel seams, a dado rail and a skirting line, all faint.
  function wall(S, x0, x1, z, h, share, color = P.dim) {
    S.points((i, out) => {
      const x = x0 + Math.random() * (x1 - x0);
      const r = Math.random();
      let y;
      if (r < 0.18) y = 0.08 + (Math.random() - 0.5) * 0.02;
      else if (r < 0.36) y = 0.95 + (Math.random() - 0.5) * 0.02;
      else if (r < 0.55) { out.set(x0 + Math.round((x - x0) / 0.6) * 0.6, Math.random() * h, z); return 0.5; }
      else y = Math.random() * h;
      out.set(x, y, z);
      return r < 0.36 ? 0.85 : 0.32;
    }, color, share);
  }
  // Tiled splashback: a grid of grout lines.
  function tileWall(S, x0, x1, y0, y1, z, share) {
    S.points((i, out) => {
      const onX = Math.random() < 0.5;
      const x = onX ? x0 + Math.random() * (x1 - x0) : x0 + Math.round(Math.random() * (x1 - x0) / 0.2) * 0.2;
      const y = onX ? y0 + Math.round(Math.random() * (y1 - y0) / 0.2) * 0.2 : y0 + Math.random() * (y1 - y0);
      out.set(x, y, z);
      return 0.5;
    }, P.steel, share);
  }
  // A window onto the city: frame, glazing bars, and towers with lit windows.
  function cityWindow(S, cx, cy, z, w, h, share) {
    const towers = [];
    for (let x = -w / 2; x < w / 2;) { const bw = 0.12 + Math.random() * 0.3; towers.push([x, bw, 0.25 + Math.random() * 0.7]); x += bw + 0.02; }
    S.tinted((i, out, c) => {
      const r = Math.random();
      if (r < 0.28) {                                   // frame and bars
        const side = Math.floor(Math.random() * 5);
        const u = Math.random();
        const pts = [[-w / 2 + u * w, h / 2], [-w / 2 + u * w, -h / 2], [-w / 2, -h / 2 + u * h], [w / 2, -h / 2 + u * h], [0, -h / 2 + u * h]][side];
        out.set(cx + pts[0], cy + pts[1], z);
        c.copy(P.wood);
        return 0.55;
      }
      const [tx, tw, th] = towers[Math.floor(Math.random() * towers.length)];
      const x = tx + Math.random() * tw, top = -h / 2 + th * h;
      const lit = Math.random() < 0.55;
      const y = -h / 2 + Math.random() * (top + h / 2);
      out.set(cx + x, cy + y, z - 0.02);
      if (lit) { c.copy(Math.random() < 0.75 ? P.amber : P.blue); return 0.9; }
      c.setRGB(0.18, 0.2, 0.32);
      return 0.5;
    }, share);
  }
  // A pendant lamp: cord, shade, and a pool of warm light below it.
  function pendant(S, x, y, z, share) {
    S.mesh(lathe([[0.05, 0], [0.2, -0.22], [0.22, -0.24]], 32), M(x, y, z), P.amber, { density: 1.5 });
    S.tinted((i, out, c) => {
      const r = Math.random();
      if (r < 0.2) { out.set(x, y + Math.random() * 1.2, z); c.copy(P.dim); return 0.6; }
      const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 1.6) * 0.5;
      out.set(x + Math.cos(a) * rr, y - 0.3 - Math.random() * 0.25, z + Math.sin(a) * rr);
      c.copy(P.amber);
      return 1.1 * (1 - rr * 1.6);
    }, share);
  }
  // A shelf board for things to stand on.
  const board = (S, x, y, z, w, d = 0.3, ry = 0) => S.mesh(new THREE.BoxGeometry(w, 0.03, d), M(x, y, z, 0, ry, 0), P.wood, { density: 1.2 });
  // Where each scene's app mockup points from (the device in hand).
  const ANCHOR = [];

  // ---------------------------------------------------------------- scenes
  const BUILD = [
    // 0 · title: the mark above a slow galaxy of particles
    () => {
      const S = new Shot();
      logo(S, 0, 1.55, 0, 2.3, 0.3);
      S.points((i, out) => {
        const arm = i % 3, r = 1.0 + Math.pow(Math.random(), 0.7) * 5.2;
        const a = arm * ((Math.PI * 2) / 3) + r * 0.85 + (Math.random() - 0.5) * 0.55;
        out.set(Math.cos(a) * r, -0.6 + (Math.random() - 0.5) * 0.18 * (1 + r * 0.08), Math.sin(a) * r * 0.62);
        return 0.35 + 0.65 * (1 - r / 6.4);
      }, P.mint, 0.56);
      dust(S, 0.14);
      return S;
    },

    // 1 · waiter: table 4, two guests, the order on the waiter's phone
    () => {
      const S = new Shot();
      const T = M(-0.7, 0, 0);
      S.cloud('round_wooden_table_01', mul(T, M(0, 0, 0, 0, 0, 0, 0.76)));
      const top = 0.765;
      S.cloud('brass_pot_01', mul(T, M(0.02, top, -0.14, 0, 0, 0, 0.75)), { gain: 1.1 });
      S.cloud('carved_wooden_plate', mul(T, M(-0.3, top, 0.06)));
      S.cloud('carved_wooden_plate', mul(T, M(0.3, top, 0.02, 0, 1.2, 0)));
      S.cloud('wooden_bowl_01', mul(T, M(-0.12, top, 0.3, 0, 0, 0, 0.7)));
      S.cloud('brass_goblets', mul(T, M(0.12, top, 0.32, 0, 0.4, 0, 0.55)));
      S.cloud('food_lime_01', mul(T, M(0.28, top, -0.22, 0, 0, 0, 1.2)), { gain: 1.2 });
      const chairL = mul(T, M(-0.88, 0, 0, 0, Math.PI / 2, 0));
      const chairR = mul(T, M(0.88, 0, 0, 0, -Math.PI / 2, 0));
      S.cloud('dining_chair_02', chairL);
      S.cloud('dining_chair_02', chairR);
      who(S, 'guest_f', mul(chairL, M(0, 0, -0.06)), { sit: true, cloth: P.blue });
      who(S, 'guest_m', mul(chairR, M(0, 0, -0.06)), { sit: true, cloth: P.body });
      // The waiter, phone in both hands, half-turned to the table.
      const Wt = M(0.75, 0, 0.8, 0, -0.75, 0);
      who(S, 'waiter', Wt, { cloth: P.white });
      const ph = midHands('waiter', Wt);
      device(S, mul(M(ph.x, ph.y + 0.03, ph.z), M(0, 0, 0, -1.0, -0.75, 0)), 0.08, 0.16, 0.009, null, 0, P.green);
      ANCHOR[1] = ph.clone();
      // The dining room: boards, a panelled wall with the city outside,
      // lamps over the tables, a second table being served.
      planks(S, -4.2, 4.2, -2.6, 2.6, 0.08);
      wall(S, -4.2, 4.2, -2.6, 3.0, 0.05);
      cityWindow(S, -2.4, 1.75, -2.58, 1.7, 1.3, 0.045);
      cityWindow(S, 1.6, 1.75, -2.58, 1.7, 1.3, 0.045);
      pendant(S, -0.7, 2.45, 0, 0.018);
      pendant(S, 2.5, 2.45, -1.3, 0.014);
      S.cloud('round_wooden_table_01', M(2.5, 0, -1.3, 0, 0, 0, 0.7), { gain: 0.7 });
      S.cloud('dining_chair_02', M(1.7, 0, -1.3, 0, Math.PI / 2, 0), { gain: 0.6 });
      S.cloud('dining_chair_02', M(3.3, 0, -1.3, 0, -Math.PI / 2, 0), { gain: 0.6 });
      S.cloud('carved_wooden_plate', M(2.5, 0.71, -1.3), { gain: 0.8 });
      S.cloud('potted_plant_04', M(-3.6, 0, -2.0, 0, 0, 0, 4), { gain: 0.8 });
      dust(S, 0.02, 7);
      return S;
    },

    // 2 · chef: the pass, the kitchen display and the KOT printer
    () => {
      const S = new Shot();
      S.cloud('industrial_storage_cart', M(0, 0, 0.45, 0, 0, 0, 0.72));
      const top = 1.0;
      S.cloud('pot_enamel_01', M(-0.36, top, 0.42, 0, 0.3, 0, 1.25), { gain: 1.1 });
      S.cloud('brass_pan_01', M(0.05, top, 0.5, 0, 0.6, 0));
      S.cloud('wooden_cutting_board', M(0.33, top, 0.36, 0, -0.2, 0, 0.8));
      S.cloud('yellow_onion', M(0.42, top + 0.01, 0.42, 0, 0, 0, 1.3));
      S.cloud('yellow_onion', M(0.5, top + 0.01, 0.33, 0, 1, 0, 1.3));
      S.cloud('metal_jug', M(-0.62, top, 0.55, 0, 0, 0, 0.9));
      S.cloud('electric_stove', M(-1.25, 0, -0.35, 0, 0.45, 0, 1.05));
      [[-1.3, -0.3], [-1.05, -0.45]].forEach(([x, z], k) => S.points((i, out) => {
        const t = Math.random();
        out.set(x + Math.sin(t * 9 + k) * 0.07 * t + (Math.random() - 0.5) * 0.12, 0.95 + t * 0.9, z + (Math.random() - 0.5) * 0.12);
        return 0.7 * (1 - t);
      }, P.white, 0.014));
      who(S, 'chef', M(0, 0, -0.32), { cloth: P.white });
      // KOT printer and its ticket
      S.mesh(slab(0.3, 0.18, 0.3, 0.03), M(0.82, top + 0.1, 0.5, Math.PI / 2, 0, 0), P.dim, { density: 1.2 });
      receipt(S, kotUI(), 0.82, top + 0.2, 0.5, 0.032);
      // Kitchen display on its arm; its screen is the mockup beside the scene.
      S.mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 10, 1, true), M(1.3, 1.5, 0.0), P.steel, { density: 2 });
      device(S, M(1.3, 2.1, 0.05, -0.05, -0.35, 0), 0.9, 0.55, 0.05, null, 0, P.steel);
      S.points((i, out) => { out.set(1.3 + (Math.random() - 0.5) * 0.8, 2.1 + (Math.random() - 0.5) * 0.45, 0.09); return 0.9; }, P.green, 0.01);
      ANCHOR[2] = new V3(1.3, 2.1, 0.1);
      // The kitchen: checker floor, tiled wall, a hood over the range, a pot
      // rail with pans, a shelf of pots.
      tilesFloor(S, -3.2, 3.2, -1.8, 2.2, 0.07);
      tileWall(S, -3.2, 3.2, 0, 2.8, -1.8, 0.06);
      S.mesh(new THREE.BoxGeometry(1.2, 0.45, 0.8), M(-1.25, 2.25, -0.55), P.steel, { density: 0.8 });
      S.mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 8, 1, true), M(0.4, 2.35, -1.4, 0, 0, Math.PI / 2), P.steel, { density: 2 });
      [-0.4, 0.2, 0.75].forEach((x, k) => S.cloud('brass_pan_01', M(x, 2.1, -1.35, Math.PI / 2 - 0.1, 0, k * 0.2), { gain: 0.85 }));
      board(S, 1.9, 1.45, -1.6, 1.4);
      S.cloud('brass_pot_01', M(1.55, 1.47, -1.6, 0, 0, 0, 0.7), { gain: 0.85 });
      S.cloud('pot_enamel_01', M(2.15, 1.47, -1.6, 0, 0.6, 0), { gain: 0.85 });
      pendant(S, 0.1, 2.6, 0.5, 0.012);
      dust(S, 0.02, 7);
      return S;
    },

    // 3 · cashier: the till, the register, the card machine, Wi-Fi down
    () => {
      const S = new Shot();
      S.mesh(new THREE.BoxGeometry(2.9, 0.06, 0.8), M(0, 1.0, 0), P.wood);
      S.mesh(new THREE.BoxGeometry(2.9, 0.97, 0.05), M(0, 0.49, 0.38), P.wood, { density: 0.6 });
      S.cloud('CashRegister_01', M(-0.95, 1.03, -0.02, 0, 0.35, 0, 0.9), { gain: 1.05 });
      // Till screen, turned to face the room; its screen is the mockup.
      S.mesh(new THREE.CylinderGeometry(0.03, 0.12, 0.42, 12), M(-0.05, 1.24, -0.05), P.steel, { density: 1.5 });
      device(S, M(-0.05, 1.62, 0.0, -0.12, 0, 0), 0.8, 0.5, 0.05, null, 0, P.steel);
      S.points((i, out) => { out.set(-0.05 + (Math.random() - 0.5) * 0.72, 1.62 + (Math.random() - 0.5) * 0.42, 0.04); return 0.9; }, P.green, 0.008);
      ANCHOR[3] = new V3(-0.05, 1.62, 0.05);
      device(S, M(0.6, 1.12, 0.18, -1.0, -0.3, 0), 0.2, 0.3, 0.05, null, 0, P.dim);
      S.mesh(slab(0.28, 0.16, 0.28, 0.03), M(1.0, 1.11, -0.05, Math.PI / 2, 0, 0), P.dim, { density: 1.2 });
      receipt(S, kotUI(), 1.0, 1.2, -0.05, 0.024, 0.42);
      who(S, 'cashier', M(1.25, 0, -0.62, 0, -0.42, 0), { cloth: P.mint });
      S.cloud('bar_chair_round_01', M(-0.55, 0, 1.05, 0, 0.4, 0));
      // The counter: boards, a back wall with a lit menu board, shelves of
      // bottles and jugs, the door out to the street, lamps over the counter.
      planks(S, -3.4, 3.4, -1.6, 2.4, 0.07);
      wall(S, -3.4, 3.4, -1.6, 3.0, 0.045);
      S.tinted((i, out, c) => {
        const r = Math.random();
        if (r < 0.3) { const u = Math.random(), side = Math.floor(Math.random() * 4); const q = [[u, 0], [u, 1], [0, u], [1, u]][side]; out.set(-2.6 + q[0] * 1.4, 1.6 + q[1] * 0.9, -1.58); c.copy(P.wood); return 0.7; }
        const row = Math.floor(Math.random() * 6), x = Math.random() * (row % 2 ? 0.8 : 1.1);
        out.set(-2.45 + x, 2.35 - row * 0.13, -1.57); c.copy(row === 0 ? P.green : P.white); return row === 0 ? 1 : 0.55;
      }, 0.02);
      board(S, 1.9, 1.5, -1.45, 1.6); board(S, 1.9, 2.0, -1.45, 1.6);
      [[1.3, 1.52], [1.75, 1.52], [2.25, 1.52], [1.5, 2.02], [2.1, 2.02]].forEach(([x, y], k) => S.cloud(k % 2 ? 'metal_jug' : 'brass_goblets', M(x, y, -1.45, 0, k, 0, k % 2 ? 0.9 : 0.5), { gain: 0.8 }));
      S.points((i, out) => { const u = Math.random(), side = Math.floor(Math.random() * 3); const q = [[0, u * 2.3], [1, u * 2.3], [u, 2.3]][side]; out.set(3.0 + q[0] * 0.9, q[1], -1.55); return 0.7; }, P.wood, 0.012);
      pendant(S, -0.6, 2.6, -0.2, 0.012);
      pendant(S, 0.9, 2.6, -0.2, 0.012);
      // Wi-Fi down, bills queued, billing carries on
      S.image(wifiUI(), 0.42, 0.42, M(-1.55, 2.05, 0.1), { share: 0.022, depth: 0.04 });
      [0, 1, 2].forEach((k) => S.mesh(slab(0.2, 0.27, 0.01, 0.03), M(-1.2 + k * 0.07, 1.98 + k * 0.05, -0.05 - k * 0.04, 0, -0.3, 0.1), P.amber, { density: 1.4 }));
      dust(S, 0.02, 7);
      return S;
    },

    // 4 · manager: the store room, the stock deducted, the assistant
    () => {
      const S = new Shot();
      const SH = M(-1.25, 0, -0.5, 0, 0.35, 0);
      S.cloud('steel_frame_shelves_01', SH);
      S.cloud('wooden_crate_01', mul(SH, M(0, 0.05, 0, 0, 0, 0, 0.95)));
      S.cloud('cardboard_box_01', mul(SH, M(-0.22, 0.52, 0, 0, 0.2, 0, 0.8)));
      S.cloud('plastic_crate_01', mul(SH, M(0.25, 0.52, 0, 0, Math.PI / 2, 0, 0.9)));
      S.cloud('russian_food_cans_01', mul(SH, M(-0.2, 0.99, 0, 0, 0, 0, 1.6)));
      S.cloud('wicker_basket_01', mul(SH, M(0.2, 0.99, 0, 0, 0.3, 0, 0.9)));
      S.cloud('cardboard_box_01', mul(SH, M(0, 1.47, 0, 0, -0.3, 0, 0.7)));
      // Rice sacks on the floor, the low line
      const rice = { tint: new Col('#FFC46B'), gain: 1.15 };
      S.cloud('cement_bag', M(-0.45, 0, 0.55, 0, 0.3, 0), rice);
      S.cloud('cement_bag', M(-0.4, 0.17, 0.52, 0, -0.25, 0), rice);
      S.cloud('cement_bag', M(0.05, 0, 0.75, 0, 1.2, 0), rice);
      const Mg = M(0.6, 0, 0.45, 0, -0.55, 0);
      who(S, 'manager', Mg, { cloth: P.steel });
      const tb = midHands('manager', Mg);
      device(S, mul(M(tb.x, tb.y + 0.03, tb.z), M(0, 0, 0, -0.95, -0.55, 0)), 0.34, 0.24, 0.012, null, 0, P.steel);
      ANCHOR[4] = tb.clone();
      // The store room: more racking, stacked crates, a strip light, a
      // concrete floor and wall.
      S.cloud('steel_frame_shelves_01', M(-2.55, 0, -0.9, 0, 0.35, 0), { gain: 0.75 });
      S.cloud('cardboard_box_01', M(-2.55, 0.52, -0.9, 0, 0.5, 0, 0.8), { gain: 0.7 });
      S.cloud('wooden_crate_01', M(-2.55, 0.05, -0.9, 0, 0.35, 0, 0.95), { gain: 0.7 });
      [[1.7, 0], [1.7, 0.35], [2.3, 0], [1.95, 0.7]].forEach(([x, y], k) => S.cloud(k % 2 ? 'plastic_crate_01' : 'wooden_crate_01', M(x, y, -1.0, 0, k * 0.2, 0, k % 2 ? 1 : 0.8), { gain: 0.75 }));
      planks(S, -3.6, 3.6, -1.9, 2.4, 0.06, P.dim);
      wall(S, -3.6, 3.6, -1.9, 3.0, 0.05);
      S.points((i, out) => { out.set(-1.6 + Math.random() * 3.2, 2.7, -0.4 + (Math.random() - 0.5) * 0.06); return 1.1; }, P.white, 0.012);
      dust(S, 0.02, 7);
      return S;
    },

    // 5 · owner: at home, phone in hand, the assistant and its 43 tools
    () => {
      const S = new Shot();
      const C = M(-1.0, 0, 0, 0, 0.45, 0);
      S.cloud('ArmChair_01', C);
      const Ow = mul(C, M(0, 0.0, -0.08));
      who(S, 'owner', Ow, { sit: true, cloth: P.blue });
      const hr = anchor('owner', 'hand_r', Ow);
      device(S, mul(M(hr.x, hr.y + 0.06, hr.z), M(0, 0, 0, -0.35, 0.45, 0)), 0.08, 0.16, 0.009, null, 0, P.green);
      S.cloud('side_table_01', M(-0.05, 0, 0.75, 0, -0.3, 0));
      S.cloud('tea_set_01', M(-0.05, 0.555, 0.75, 0, -0.3, 0, 0.45));
      S.cloud('potted_plant_04', M(-2.05, 0, -0.45, 0, 0, 0, 3.2));
      S.mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 8, 1, true), M(-1.95, 0.8, 0.45), P.steel, { density: 2 });
      S.mesh(lathe([[0.12, 0], [0.22, -0.28]], 32), M(-1.95, 1.85, 0.45), P.amber, { density: 2 });
      ANCHOR[5] = new V3(hr.x, hr.y + 0.06, hr.z);
      // The flat: a full-height window over the city at night, a rug, a
      // bookshelf, the lamp's pool of light.
      cityWindow(S, 0, 1.45, -1.6, 5.4, 2.7, 0.13);
      planks(S, -3.4, 3.4, -1.6, 2.2, 0.05);
      S.points((i, out) => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.3; out.set(-0.6 + Math.cos(a) * r * 1.3, 0.005, 0.5 + Math.sin(a) * r * 0.8); return 0.45; }, P.red, 0.03);
      S.cloud('steel_frame_shelves_01', M(2.6, 0, -1.2, 0, -0.4, 0), { tint: P.wood, gain: 0.6 });
      S.points((i, out) => { const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 1.5) * 0.9; out.set(-1.95 + Math.cos(a) * rr, 0.01, 0.45 + Math.sin(a) * rr); return 0.8 * (1 - rr); }, P.amber, 0.012);
      ring(S, ringUI('SALES · TOP SELLERS · STOCK · LOW STOCK · STAFF · ATTENDANCE · PAYROLL · PURCHASES · VENDORS · TAX · PROFIT & LOSS · CASH · WASTE · EVENTS · 43 READ-ONLY TOOLS · ', G1), -0.9, 1.05, 0.2, 1.25, 0.14, 0.1, 0.06);
      dust(S, 0.02, 7);
      return S;
    },

    // 6 · finale: the mark, the name, and every role around it
    () => {
      const S = new Shot();
      logo(S, 0, 1.75, 0, 2.0, 0.19);
      S.image(wordUI(), 3.1, 0.67, M(0, 0.38, 0), { share: 0.08, depth: 0.08 });
      const cast = [['waiter', { cloth: P.white }], ['chef', { cloth: P.white }],
        ['cashier', { cloth: P.mint }], ['manager', { cloth: P.steel }], ['guest_f', { cloth: P.blue }]];
      cast.forEach(([name, o], i) => {
        const a = -0.95 + (i / (cast.length - 1)) * 1.9;
        const m = M(Math.sin(a) * 3.3, -1.25, Math.cos(a) * 1.6 - 0.4, 0, -a * 0.6, 0, 0.62);
        if (name === 'guest_f') S.cloud('ArmChair_01', m, { gain: 0.8 });
        who(S, name, name === 'guest_f' ? mul(m, M(0, 0, -0.08)) : m, name === 'guest_f' ? { sit: true, cloth: P.blue } : o);
      });
      ring(S, ringUI('WAITERS · CHEFS · CASHIERS · MANAGERS · OWNERS · ONE RECORD · ', G1), 0, -1.05, -0.3, 3.9, 0.2, 0.06, 0.1, 0.75);
      floor(S, 4.2, 0.06, 0, -0.2, -1.25);
      dust(S, 0.05);
      return S;
    },
  ];

  // ---------------------------------------------------------------- particles
  const built = new Array(SCENES).fill(null);
  const geo = new THREE.BufferGeometry();
  const aFrom = new Float32Array(N * 3), aTo = new Float32Array(N * 3), aCF = new Float32Array(N * 3), aCT = new Float32Array(N * 3);
  const aRand = new Float32Array(N), aSize = new Float32Array(N);
  for (let i = 0; i < N; i++) { aRand[i] = Math.random(); aSize[i] = 0.7 + Math.pow(Math.random(), 3) * 1.1; }
  geo.setAttribute('position', new THREE.BufferAttribute(aFrom, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(aTo, 3));
  geo.setAttribute('aCF', new THREE.BufferAttribute(aCF, 3));
  geo.setAttribute('aCT', new THREE.BufferAttribute(aCT, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));

  const U = {
    uMorph: { value: 0 }, uTime: { value: 0 }, uSize: { value: 1 }, uGain: { value: phone ? 0.95 : 0.78 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uMouseAmt: { value: 0 }, uAspect: { value: 1 },
    uBurst: { value: 0 }, uBurstAt: { value: new THREE.Vector2() }, uReveal: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aTo; attribute vec3 aCF; attribute vec3 aCT; attribute float aRand; attribute float aSize;
      uniform float uMorph, uTime, uSize, uGain, uMouseAmt, uAspect, uBurst, uReveal;
      uniform vec2 uMouse, uBurstAt;
      varying vec3 vColor; varying float vA;

      vec3 flow(vec3 p, float t) {
        return vec3(
          sin(p.y * 1.3 + t * 0.7) + sin(p.z * 2.1 - t * 0.5),
          sin(p.z * 1.7 + t * 0.6) + sin(p.x * 1.9 + t * 0.8),
          sin(p.x * 1.5 - t * 0.9) + sin(p.y * 2.3 + t * 0.4)) * 0.5;
      }

      void main() {
        // Each particle leaves a little later than the one before it, so a
        // scene change streams across the frame.
        float d = clamp(uMorph * 1.7 - aRand * 0.7, 0.0, 1.0);
        d = d * d * (3.0 - 2.0 * d);
        vec3 p = mix(position, aTo, d);
        float mid = sin(d * 3.14159);
        p += flow(p * 0.55 + aRand * 3.0, uTime * 0.6) * mid * (0.6 + aRand * 0.9);
        float sw = mid * (aRand - 0.35) * 1.4;
        p.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p.xz;
        // At rest the cloud still breathes.
        p += 0.006 * vec3(sin(uTime * 1.7 + aRand * 60.0), sin(uTime * 1.3 + aRand * 80.0), sin(uTime * 1.1 + aRand * 40.0));
        // First load: the scene condenses out of a wider cloud.
        p = mix(p * (2.2 + aRand * 2.0) + vec3(0.0, (aRand - 0.5) * 6.0, 0.0), p, uReveal);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 clip = projectionMatrix * mv;
        vec2 ndc = clip.xy / clip.w;

        // The pointer pushes particles away and stirs them round.
        vec2 dv = ndc - uMouse; dv.x *= uAspect;
        float dist = length(dv);
        vec2 dir = dv / max(dist, 1e-4);
        float f = (1.0 - smoothstep(0.0, 0.3, dist)) * uMouseAmt;
        f = f * f * (3.0 - 2.0 * f);
        // A click sends a ring outward.
        vec2 bv = ndc - uBurstAt; bv.x *= uAspect;
        float bd = length(bv);
        float ringR = (1.0 - uBurst) * 1.1;
        float b = exp(-pow((bd - ringR) * 7.0, 2.0)) * uBurst;
        vec2 bdir = bv / max(bd, 1e-4);
        float depth = -mv.z;
        // A soft dent with a stir, rather than a hard hole.
        float jitter = 0.6 + 0.8 * aRand;
        mv.xy += (dir * f * 0.2 * jitter + vec2(-dir.y, dir.x) * f * 0.28 * jitter + bdir * b * 0.6) * depth * 0.09;
        mv.z += f * 0.35 * (aRand - 0.5);
        gl_Position = projectionMatrix * mv;

        vec3 c = mix(aCF, aCT, d);
        c *= uGain * (1.0 + f * 0.65 + b * 1.2) * (0.85 + 0.3 * mid);
        vColor = c;
        vA = uReveal;
        gl_PointSize = aSize * uSize * (1.0 + f * 0.5) / depth;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = dot(q, q);
        if (r > 0.25) discard;
        float a = smoothstep(0.25, 0.0, r);
        gl_FragColor = vec4(vColor * a * vA, 1.0);
      }`,
  });
  const cloud = new THREE.Points(geo, mat);
  cloud.frustumCulled = false;
  rig.add(cloud);

  // ---------------------------------------------------------------- backdrop
  // A still layer behind the morphing one, so the frame is never empty:
  // stars, nebula bands and bokeh on a far shell, a dotted ground grid, all
  // tinted to each scene's mood.
  const TINTS = ['#3fd08a', '#ffb15c', '#9fc7ff', '#ffb15c', '#7fe0c0', '#9a7dff', '#3fd08a'].map((h) => new Col(h));
  const BG_N = phone ? 14000 : 30000;
  const bgPos = new Float32Array(BG_N * 3), bgCol = new Float32Array(BG_N * 3), bgSize = new Float32Array(BG_N), bgKind = new Float32Array(BG_N), bgRand = new Float32Array(BG_N);
  for (let i = 0; i < BG_N; i++) {
    const r = Math.random();
    let kind, x, y, z, c, sz;
    if (r < 0.34) {                                   // stars on a far dome
      const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.9), R = 45 + Math.random() * 30;
      x = Math.cos(a) * Math.sin(e) * R; y = Math.cos(e) * R * 0.7 - 4; z = Math.sin(a) * Math.sin(e) * R;
      kind = 0; c = [0.75, 0.8, 1]; sz = 0.8 + Math.random() * 1.6;
    } else if (r < 0.66) {                            // nebula: soft bands across the back
      const a = (Math.random() - 0.5) * Math.PI * 1.6, band = Math.sin(a * 2.2) * 6;
      const R = 30 + Math.random() * 12;
      x = Math.sin(a) * R; z = -Math.cos(a) * R; y = 4 + band + (Math.random() + Math.random() - 1) * 5;
      kind = 1; const w = Math.random(); c = [0.35 + 0.3 * w, 0.4, 0.6 - 0.2 * w]; sz = 2 + Math.random() * 5;
    } else if (r < 0.69) {                            // bokeh, nearer and big
      const a = Math.random() * Math.PI * 2, R = 9 + Math.random() * 14;
      x = Math.cos(a) * R; z = Math.sin(a) * R - 4; y = -1 + Math.random() * 7;
      kind = 2; c = [1, 0.85, 0.65]; sz = 14 + Math.random() * 26;
    } else {                                          // ground grid: rings and spokes
      const spoke = Math.random() < 0.35, a = spoke ? Math.floor(Math.random() * 48) / 48 * Math.PI * 2 : Math.random() * Math.PI * 2;
      const R = spoke ? 3.5 + Math.random() * 30 : 3.5 + Math.floor(Math.random() * 22) * 1.4;
      x = Math.cos(a) * R; z = Math.sin(a) * R; y = 0;
      kind = 3; const f = Math.max(0, 1 - R / 34); c = [0.3 * f, 0.75 * f, 0.5 * f]; sz = 1.1;
    }
    bgPos[i * 3] = x; bgPos[i * 3 + 1] = y; bgPos[i * 3 + 2] = z;
    bgCol[i * 3] = c[0]; bgCol[i * 3 + 1] = c[1]; bgCol[i * 3 + 2] = c[2];
    bgSize[i] = sz; bgKind[i] = kind; bgRand[i] = Math.random();
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  bgGeo.setAttribute('aCol', new THREE.BufferAttribute(bgCol, 3));
  bgGeo.setAttribute('aSize', new THREE.BufferAttribute(bgSize, 1));
  bgGeo.setAttribute('aKind', new THREE.BufferAttribute(bgKind, 1));
  bgGeo.setAttribute('aRand', new THREE.BufferAttribute(bgRand, 1));
  const BU = { uTime: U.uTime, uSize: U.uSize, uTint: { value: TINTS[0].clone() }, uGridY: { value: 0 }, uFade: U.uReveal };
  const backdrop = new THREE.Points(bgGeo, new THREE.ShaderMaterial({
    uniforms: BU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aCol; attribute float aSize; attribute float aKind; attribute float aRand;
      uniform float uTime, uSize, uGridY, uFade; uniform vec3 uTint;
      varying vec3 vColor; varying float vSoft;
      void main() {
        vec3 p = position;
        if (aKind > 2.5) p.y = uGridY - 0.01;
        if (aKind > 1.5 && aKind < 2.5) p += vec3(sin(uTime * 0.09 + aRand * 30.0) * 0.9, sin(uTime * 0.12 + aRand * 20.0) * 0.5, cos(uTime * 0.07 + aRand * 10.0) * 0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec3 c = aCol;
        if (aKind > 0.5 && aKind < 2.5) c *= uTint * (aKind > 1.5 ? 0.22 : 0.5);
        if (aKind < 0.5) c *= 0.55 + 0.45 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 40.0);
        if (aKind > 2.5) c *= 0.55;
        vColor = c * uFade;
        vSoft = aKind > 0.5 && aKind < 2.5 ? 1.0 : 0.0;
        gl_PointSize = aSize * uSize * (aKind > 2.5 ? 1.0 : 2.4) / -mv.z;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vSoft;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = dot(q, q);
        if (r > 0.25) discard;
        float a = mix(smoothstep(0.25, 0.0, r), smoothstep(0.25, 0.05, r) * 0.6, vSoft);
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
  }));
  backdrop.frustumCulled = false;
  scene.add(backdrop);
  backdrop.renderOrder = -1;

  // ---------------------------------------------------------------- the app, in HTML
  const mocks = {};
  root.querySelectorAll('.mock').forEach((el) => { mocks[+el.dataset.scene] = el; });
  const link = root.querySelector('.film-link');
  const linkLine = link.querySelector('line'), linkDot = link.querySelector('circle');
  let shownMock = -1;
  // The kitchen display's timers run for real while it is on screen.
  setInterval(() => {
    if (shownMock !== 2) return;
    mocks[2].querySelectorAll('time[data-tick]').forEach((el) => {
      const s = +el.dataset.tick + 1;
      el.dataset.tick = s;
      el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    });
  }, 1000);
  const ap = new V3();
  function placeMock() {
    const cur = morph < 0.5 ? seg : seg + 1;
    const settled = morph < 0.16 || morph > 0.84;
    const k = settled && mocks[cur] ? cur : -1;
    if (k !== shownMock) {
      if (mocks[shownMock]) mocks[shownMock].classList.remove('is-on');
      if (mocks[k]) mocks[k].classList.add('is-on');
      shownMock = k;
    }
    link.classList.toggle('is-on', k > 0 && width >= 900);
    if (k < 0) return;
    const el = mocks[k];
    // Later in each scene's scroll the app moves on: order sent, line back up.
    el.classList.toggle('is-done', t > k + 0.18);
    const w = el.offsetWidth, h = el.offsetHeight;
    if (width < 900) {
      const avail = height * 0.42;
      const sc = Math.min(1, (width - 32) / w, avail / h);
      el.style.transform = `translate(${((width - w * sc) / 2).toFixed(1)}px, ${(height * 0.11).toFixed(1)}px) scale(${sc.toFixed(3)})`;
      return;
    }
    ap.copy(ANCHOR[k] || ap.set(0, 1.3, 0)).applyMatrix4(rig.matrixWorld).project(camera);
    const ax = (ap.x * 0.5 + 0.5) * width, ay = (-ap.y * 0.5 + 0.5) * height;
    const sc = clamp(height / 900, 0.72, 1.08);
    const mw = w * sc, mh = h * sc;
    let x = Math.max(ax + 110, width * 0.56);
    x = Math.min(x, width - mw - 150);
    const y = clamp(ay - mh / 2, 80, height - mh - 170);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    linkLine.setAttribute('x1', ax.toFixed(1)); linkLine.setAttribute('y1', ay.toFixed(1));
    linkLine.setAttribute('x2', x.toFixed(1)); linkLine.setAttribute('y2', (y + mh / 2).toFixed(1));
    linkDot.setAttribute('cx', ax.toFixed(1)); linkDot.setAttribute('cy', ay.toFixed(1));
  }

  let pair = [-1, -1];
  function nearestBuilt(k) {
    for (let j = k; j >= 0; j--) if (built[j]) return j;
    for (let j = k; j < SCENES; j++) if (built[j]) return j;
    return -1;
  }
  function setPair(a, b) {
    const A = nearestBuilt(a), B = nearestBuilt(b);
    if (A < 0 || (pair[0] === A && pair[1] === B)) return;
    pair = [A, B];
    aFrom.set(built[A].pos); aCF.set(built[A].col);
    aTo.set(built[B].pos); aCT.set(built[B].col);
    ['position', 'aTo', 'aCF', 'aCT'].forEach((k) => { geo.attributes[k].needsUpdate = true; });
  }

  // ---------------------------------------------------------------- scroll → story
  let t = 0, seg = 0, morph = 0;
  function measure() {
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    t = clamp(-r.top / span) * (SCENES - 1);
    seg = Math.min(SCENES - 2, Math.floor(t));
    // Hold each scene while it is read, then stream into the next.
    morph = smooth(0.42, 0.94, t - seg);
    setPair(seg, seg + 1);
    updateText();
  }

  // Subtitles, title, rail
  let shownScene = -1, shownOn = false;
  const railButtons = [];
  for (let k = 1; k < SCENES; k++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k === SCENES - 1 ? 'Everyone' : script[k] ? script[k].role : 'Scene ' + k;
    b.addEventListener('click', () => goTo(k));
    rail.appendChild(b);
    railButtons.push(b);
  }
  function goTo(k) {
    const r = root.getBoundingClientRect();
    const top = window.scrollY + r.top;
    const span = r.height - window.innerHeight;
    window.scrollTo({ top: top + (Math.min(k + 0.08, SCENES - 1) / (SCENES - 1)) * span, behavior: 'smooth' });
  }
  function setSubtitle(k) {
    const s = script[k];
    subRole.innerHTML = '';
    subLine.innerHTML = '';
    if (!s) return;
    subRole.textContent = s.role + (s.time ? ' · ' + s.time : '');
    if (s.ai) { const ai = document.createElement('span'); ai.className = 'ai'; ai.textContent = 'AI'; subRole.appendChild(ai); }
    s.text.split(/\s+/).forEach((word, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = word;
      w.style.transitionDelay = (120 + i * 38) + 'ms';
      subLine.appendChild(w);
      subLine.appendChild(document.createTextNode(' '));
    });
  }
  function updateText() {
    const current = morph < 0.5 ? seg : seg + 1;
    const settled = morph < 0.12 || morph > 0.9;
    if (current !== shownScene) {
      shownScene = current;
      sub.classList.remove('is-on');
      setSubtitle(current);
      void sub.offsetWidth;
    }
    const on = settled && !!script[current];
    if (on !== shownOn) { shownOn = on; sub.classList.toggle('is-on', on); }
    title.classList.toggle('is-gone', t > 0.3);
    hint.classList.toggle('is-gone', t > 0.12);
    end.classList.toggle('is-on', t > SCENES - 1.25);
    railButtons.forEach((b, i) => b.setAttribute('aria-current', i + 1 === current ? 'true' : 'false'));
  }

  // ---------------------------------------------------------------- pointer
  const mouse = new THREE.Vector2(9, 9), mouseS = new THREE.Vector2(9, 9);
  let mouseAmt = 0, mouseTarget = 0, lastMove = 0;
  let par = { x: 0, y: 0 };
  const parS = { x: 0, y: 0 };
  let drag = null, dragYaw = 0, dragVel = 0, dragPitch = 0;
  function toNdc(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = toNdc(e);
    mouse.set(x, y);
    if (mouseS.x > 5) mouseS.copy(mouse);
    mouseTarget = 1; lastMove = performance.now();
    par = { x, y };
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      dragYaw += dx * 0.006; dragVel = dx * 0.006;
      dragPitch = clamp(dragPitch + dy * 0.003, -0.35, 0.45);
    }
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { mouseTarget = 0; par = { x: 0, y: 0 }; });
  canvas.classList.add('is-grab');
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toNdc(e);
    U.uBurst.value = 1;
    U.uBurstAt.value.set(x, y);
    if (e.pointerType === 'mouse') {
      drag = { x: e.clientX, y: e.clientY };
      canvas.classList.add('is-grabbing');
      canvas.setPointerCapture(e.pointerId);
    } else {
      mouse.set(x, y); mouseS.copy(mouse); mouseTarget = 1; lastMove = performance.now();
    }
  });
  const release = () => { drag = null; canvas.classList.remove('is-grabbing'); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------------------------------------------------------------- layout
  let width = 1, height = 1;
  function resize() {
    width = stage.clientWidth; height = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Lift the picture a little so the subtitles sit under it, not on it.
    camera.setViewOffset(width, height, 0, height * (width / height < 0.9 ? -0.03 : 0.07), width, height);
    camera.updateProjectionMatrix();
    U.uAspect.value = width / height;
    U.uSize.value = 2.3 * (height / 900) * dpr * 8.0 * (phone ? 1.25 : 1);
  }

  // ---------------------------------------------------------------- frame
  const look = new V3();
  let revealStart = -1;
  function frame(now) {
    const time = now / 1000;
    U.uTime.value = time;
    U.uMorph.value = morph;
    if (revealStart < 0 && built[0]) revealStart = now;
    U.uReveal.value = revealStart < 0 ? 0 : smooth(0, 1, (now - revealStart) / 2200);

    // Pointer: ease in when it moves, fade when it rests or leaves.
    if (now - lastMove > 1800) mouseTarget = 0;
    mouseAmt = lerp(mouseAmt, mouseTarget, 0.06);
    mouseS.lerp(mouse, 0.18);
    U.uMouse.value.copy(mouseS);
    U.uMouseAmt.value = mouseAmt;
    U.uBurst.value = Math.max(0, U.uBurst.value - 0.012);
    parS.x = lerp(parS.x, par.x, 0.04); parS.y = lerp(parS.y, par.y, 0.04);
    if (!drag) {
      dragYaw += dragVel; dragVel *= 0.93;
      dragYaw *= 0.985; dragPitch *= 0.985;   // drift back to the director's angle
    }

    // Camera: blend the two scenes' framing with the same easing as the particles.
    const A = VIEWS[seg], B = VIEWS[seg + 1];
    const m = smooth(0.1, 0.9, morph);
    const portrait = width / height < 0.9;
    const aspectPush = clamp(1.25 / (width / height), 1, portrait ? 2.15 : 1.8);
    const dist = lerp(A.dist, B.dist, m) * aspectPush;
    const pitch = lerp(A.pitch, B.pitch, m) + dragPitch + parS.y * 0.06;
    const ax = A.x + (portrait ? A.px || 0 : 0), bx = B.x + (portrait ? B.px || 0 : 0);
    look.set(lerp(ax, bx, m), lerp(A.y, B.y, m), 0);
    camera.position.set(look.x, look.y + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    camera.lookAt(look);
    // A slow sway keeps every scene alive; the pointer and drags add to it.
    rig.rotation.y = lerp(A.yaw, B.yaw, m) + Math.sin(time * 0.18) * 0.12 + parS.x * 0.22 + dragYaw + Math.sin(morph * Math.PI) * 0.5;

    // Backdrop: drifts on its own, takes each scene's colour.
    backdrop.rotation.y = time * 0.008;
    BU.uTint.value.copy(TINTS[seg]).lerp(TINTS[seg + 1], m);
    BU.uGridY.value = lerp(seg === SCENES - 2 ? 0 : 0, -1.25, seg + 1 === SCENES - 1 ? m : 0);

    renderer.render(scene, camera);
    placeMock();
  }

  // Only run while the film is on screen and the tab is visible.
  let running = false, visible = true, raf = 0;
  function loop(now) { if (!running) return; frame(now); raf = requestAnimationFrame(loop); }
  function setRunning(on) {
    on = on && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(loop); else cancelAnimationFrame(raf);
  }
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; setRunning(visible); }).observe(root);
  document.addEventListener('visibilitychange', () => setRunning(visible));
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', () => { resize(); measure(); });

  resize();
  measure();
  setRunning(true);

  // Build the scenes one at a time after fonts, the logo and the baked
  // models are ready, so the first frame is not held up by the last scene.
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([Promise.all([fonts, SCREENS.logoReady, cloudsReady]), new Promise((r) => setTimeout(r, 6000))]).then(() => {
    let k = 0;
    const next = () => {
      if (k >= SCENES) return;
      built[k] = BUILD[k]().sample(N);
      k++;
      pair = [-1, -1];
      setPair(seg, seg + 1);
      setTimeout(next, 16);
    };
    next();
  });
}
