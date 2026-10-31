// The citadel at Kessit Deep, a test of how far buildings made in code can go: a carved stone tower in three
// stages (pilasters, cornices, niches with robed statues, an octagonal drum and dome), a concrete annex cut by
// black slots, landing pads on hanging drums, chrome ducts, stacked containers, two cranes, and two robed stone
// colossi at the door. Metres, ground at y = 0, the door facing +z. Built from primitives in a scratch group,
// then merged into one mesh per material (about ten draw calls) so it stays cheap on a phone.
import * as THREE from 'three';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {lin, rng} from './util.js';
import {canvasTex, blotch, ribbed} from './textures.js';
import {figure} from './hangar/figures.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);

// Cream stone in courses of blocks (16 m of wall per tile), and the annex's large cast panels.
const stoneTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rng(21); g.fillStyle = '#cdbfa5'; g.fillRect(0, 0, w, h);
  blotch(g, r, 70, w, h, '70,58,44', 0.05, 0.18, 10, 70); blotch(g, r, 30, w, h, '240,230,210', 0.05, 0.12, 20, 60);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,32,24' : '250,240,225'},0.07)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  for (let y = 0, row = 0; y < h; y += 32, row++) {
    g.fillStyle = 'rgba(60,48,36,0.45)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,248,235,0.12)'; g.fillRect(0, y + 2, w, 1);
    for (let x = (row % 2) * 32; x < w; x += 64) { g.fillStyle = 'rgba(60,48,36,0.35)'; g.fillRect(x, y, 2, 32); }
  }
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, l = 30 + r() * 220, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(50,40,30,0.22)'); gr.addColorStop(1, 'rgba(50,40,30,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 6, l); }
}, [1, 1]);
// Carved stone for the statues: the same stone without the courses, more weathered.
const carvedTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rng(23); g.fillStyle = '#bcae94'; g.fillRect(0, 0, w, h);
  blotch(g, r, 90, w, h, '60,50,38', 0.06, 0.2, 8, 60); blotch(g, r, 30, w, h, '235,225,205', 0.05, 0.12, 15, 50);
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,32,24' : '250,240,225'},0.08)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h, l = 30 + r() * 160, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(45,36,26,0.3)'); gr.addColorStop(1, 'rgba(45,36,26,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 5, l); }
}, [1, 1]);
const panelTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rng(22); g.fillStyle = '#c4b79e'; g.fillRect(0, 0, w, h);
  blotch(g, r, 50, w, h, '80,66,50', 0.04, 0.14, 20, 100);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,32,24' : '250,240,225'},0.05)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  for (let y = 0; y < h; y += 128) { g.fillStyle = 'rgba(50,40,30,0.5)'; g.fillRect(0, y, w, 3); }
  for (let x = 0; x < w; x += 256) { g.fillStyle = 'rgba(50,40,30,0.5)'; g.fillRect(x, 0, 3, h); }
  for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, l = 60 + r() * 300, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(40,32,24,0.25)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; g.fillRect(x, y, 3 + r() * 8, l); }
}, [1, 1]);
// A landing pad seen from above: blue-grey with white rings.
const padTex = () => canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#b8ab92'; g.fillRect(0, 0, w, w); const c = w / 2, ring = (rad, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.stroke(); };
  g.fillStyle = '#5d6a72'; g.beginPath(); g.arc(c, c, 118, 0, Math.PI * 2); g.fill();
  ring(104, 5, '#dfe4e2'); ring(70, 3, 'rgba(223,228,226,0.8)'); ring(30, 3, 'rgba(223,228,226,0.8)');
  g.fillStyle = 'rgba(30,34,38,0.35)'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(c + Math.cos(a) * 88 - 3, c + Math.sin(a) * 88 - 3, 6, 6); }
});

// Box-projected UVs from citadel-space positions, one tile per `scale` metres, for walls of any shape.
function projectUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[2 * i] = u / scale; uv[2 * i + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function buildCitadel() {
  const M = {
    stone: new THREE.MeshStandardMaterial({map: stoneTex(), color: lin(0xd8d2c8), roughness: 0.92, metalness: 0}),
    carved: new THREE.MeshStandardMaterial({map: carvedTex(), color: lin(0xd0cac0), roughness: 0.95, metalness: 0}),
    panel: new THREE.MeshStandardMaterial({map: panelTex(), color: lin(0xd8d2c8), roughness: 0.9, metalness: 0}),
    dark: new THREE.MeshBasicMaterial({color: 0x070605}),
    chrome: new THREE.MeshStandardMaterial({color: lin(0xf2f2f4), roughness: 0.28, metalness: 0.7}), // the sky is black: mostly lit, a little mirror
    crate: new THREE.MeshStandardMaterial({map: ribbed([1, 1], true), vertexColors: true, roughness: 0.75, metalness: 0.3}),
    crane: new THREE.MeshStandardMaterial({color: lin(0x7a4a2c), roughness: 0.7, metalness: 0.4}),
    pad: new THREE.MeshStandardMaterial({map: padTex(), roughness: 0.85, metalness: 0}),
    glow: new THREE.MeshBasicMaterial({color: lin(0xffa050).multiplyScalar(0.8), toneMapped: false}),
    red: new THREE.MeshBasicMaterial({color: lin(0xff3020).multiplyScalar(1.5), toneMapped: false}),
  };
  // Light thrown back from the bright ground below, so walls in shadow keep their shape.
  for (const m of [M.stone, M.carved, M.panel]) { m.emissiveMap = m.map; m.emissive = lin(0x2c2a26); }
  const tmp = new THREE.Group(), r = rng(1234);
  const mesh = (geo, mat, x = 0, y = 0, z = 0, ry = 0, parent = tmp) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  // A box from y0 to y1.
  const block = (mat, x, z, w, d, y0, y1, ry = 0) => mesh(new THREE.BoxGeometry(w, y1 - y0, d), mat, x, (y0 + y1) / 2, z, ry);
  // Something on the face of a square stage of half-size s: side 0..3 = +z, +x, -z, -x; u along the face, proud by out.
  const onFace = (m, side, s, u, out) => { const a = side * Math.PI / 2; m.position.x = Math.sin(a) * (s + out) + Math.cos(a) * u; m.position.z = Math.cos(a) * (s + out) - Math.sin(a) * u; m.rotation.y = a; return m; };
  // A moulding run round a square (sides 4) or octagonal (8) stage of half-size s: profile [[out, y], ...] bottom up.
  const moulding = (mat, profile, s, y, sides = 4, x = 0, z = 0) => {
    const k = 1 / Math.cos(Math.PI / sides), pts = profile.map(([o, yy]) => new THREE.Vector2((s + o) * k, yy));
    const g = new THREE.LatheGeometry(pts, sides, Math.PI / sides).toNonIndexed(); g.computeVertexNormals();
    return mesh(g, mat, x, y, z);
  };
  const CORNICE = [[0, 0], [0.4, 0], [0.4, 0.5], [0.9, 0.8], [1.4, 1.5], [2.4, 2.0], [2.9, 2.0], [2.9, 2.9], [3.2, 2.9], [3.2, 3.4], [0, 3.4]];
  const BAND = [[0, 0], [1.2, 0], [1.2, 1.2], [0.6, 1.8], [0.6, 2.4], [0, 2.6]];
  // A statue: a robed, hooded figure in stone (the hangar's figures, scaled up and recut in stone).
  const statue = (h, x, y, z, ry, opts = {}) => { const f = figure({look: 'pilgrim', h, seed: r(), ...opts}); f.root.position.set(x, y, z); f.root.rotation.y = ry; tmp.add(f.root); return f; };
  // A niche: a dark arched recess with a statue standing in it.
  const niche = (side, s, u, y0, w, h, sh) => {
    onFace(block(M.dark, 0, 0, w, 0.3, y0, y0 + h), side, s, u, 0.12);
    const arch = new THREE.CylinderGeometry(w / 2, w / 2, 0.3, 16, 1, false, -Math.PI / 2, Math.PI); arch.rotateX(Math.PI / 2);
    onFace(mesh(arch, M.dark, 0, y0 + h), side, s, u, 0.12);
    onFace(block(M.stone, 0, 0, w * 0.8, 1.6, y0, y0 + 1.2), side, s, u, 0.8);
    onFace(statue(sh, 0, y0 + 1.2, 0, 0).root, side, s, u, 1.1);
  };
  const pilaster = (side, s, u, y0, y1, w = 3.2) => {
    onFace(block(M.stone, 0, 0, w, 1.2, y0, y1), side, s, u, 0.6);
    onFace(block(M.stone, 0, 0, w + 1.4, 2.2, y1 - 2.4, y1), side, s, u, 0.9);
    onFace(block(M.stone, 0, 0, w + 1, 2, y0, y0 + 1.6), side, s, u, 0.8);
  };
  const faces = [0, 2, 3]; // the annex covers the +x side

  // The tower. Plinth.
  block(M.stone, 0, 0, 60, 60, -40, 20); moulding(M.stone, BAND, 30, 4); moulding(M.stone, CORNICE, 30, 17);
  // Stage one: pilasters, three niches a face with statues, slit windows above, the cornice.
  block(M.stone, 0, 0, 46, 46, 20, 92); moulding(M.stone, BAND, 23, 20);
  for (const sd of faces) {
    for (const u of [-17, -6, 6, 17]) pilaster(sd, 23, u, 22, 88);
    for (const u of [-11.5, 0, 11.5]) { niche(sd, 23, u, 28, 6, 15, 9); onFace(block(M.dark, 0, 0, 2.2, 0.3, 58, 74), sd, 23, u, 0.12); }
  }
  moulding(M.stone, CORNICE, 23, 88);
  // Statues on the corners of the ledge.
  for (const [x, z] of [[-21, -21], [-21, 21], [21, 21]]) statue(11, x, 91.4, z, Math.atan2(x, z), {look: 'wright'});
  // Stage two.
  block(M.stone, 0, 0, 36, 36, 92, 142); moulding(M.stone, BAND, 18, 92);
  for (const sd of faces) {
    for (const u of [-13, 0, 13]) pilaster(sd, 18, u, 94, 138, 2.8);
    for (const u of [-6.5, 6.5]) { niche(sd, 18, u, 98, 5, 12, 7.5); onFace(block(M.dark, 0, 0, 1.8, 0.3, 120, 133), sd, 18, u, 0.12); }
  }
  moulding(M.stone, CORNICE, 18, 138);
  // Stage three: an octagonal drum with tall windows, a dome, a lantern and a mast.
  const R8 = 13 / Math.cos(Math.PI / 8);
  mesh(new THREE.CylinderGeometry(R8, R8, 30, 8, 1, false, Math.PI / 8).toNonIndexed(), M.stone, 0, 157, 0).geometry.computeVertexNormals();
  moulding(M.stone, BAND, 13, 142, 8); moulding(M.stone, CORNICE, 13, 169, 8);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; mesh(new THREE.BoxGeometry(2.4, 14, 0.3), M.dark, Math.sin(a) * 13.1, 156, Math.cos(a) * 13.1, a); }
  mesh(new THREE.SphereGeometry(12, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.stone, 0, 172, 0).scale.set(1, 1.35, 1);
  block(M.stone, 0, 0, 5, 5, 186, 196); mesh(new THREE.ConeGeometry(4, 6, 4, 1, false, Math.PI / 4), M.stone, 0, 199, 0);
  mesh(new THREE.CylinderGeometry(0.4, 0.6, 22, 6), M.crane, 0, 213, 0); block(M.red, 0, 0, 1.4, 1.4, 223.5, 225);
  // The door, and the colossi either side of it on their pedestals.
  onFace(block(M.dark, 0, 0, 16, 0.3, 0, 24), 0, 30, 0, 0.12);
  { const a = new THREE.CylinderGeometry(8, 8, 0.3, 20, 1, false, -Math.PI / 2, Math.PI); a.rotateX(Math.PI / 2); onFace(mesh(a, M.dark, 0, 24), 0, 30, 0, 0.12); }
  for (const x of [-22, 22]) { block(M.stone, x, 46, 16, 16, -4, 6); moulding(M.stone, BAND, 8, 4, 4, x, 46); statue(48, x, 6, 46, 0, {look: 'wright', staff: x > 0, hunch: 0.06}); }

  // The annex: a block of cast concrete, black slots with lit windows, a stepped tower behind, a roof deck.
  block(M.panel, 59, 0, 66, 56, -30, 104); block(M.panel, 59, 0, 70, 60, 104, 106);
  for (const x of [38, 58, 78]) { block(M.dark, x, 28.12, 7, 0.3, 8, 98); for (let y = 16; y < 96; y += 11) block(M.glow, x + (r() - 0.5) * 3, 28.3, 2.5 + r() * 2, 0.3, y, y + 0.6); }
  for (const z of [-14, 14]) { block(M.dark, 92.12, z, 0.3, 7, 8, 98); for (let y = 20; y < 96; y += 13) block(M.glow, 92.3, z + (r() - 0.5) * 3, 0.3, 3, y, y + 0.6); }
  block(M.panel, 49, -16, 42, 24, 106, 150); block(M.panel, 49, -16, 45, 27, 150, 152); block(M.dark, 49, -3.88, 8, 0.3, 108, 148);
  for (let y = 112; y < 146; y += 9) block(M.glow, 49, -3.7, 3, 0.3, y, y + 0.6);
  // Containers on the deck, stacked one to four high.
  const CRATE = [0x6e3a24, 0x4a5560, 0xa89a80, 0x4a3426, 0x8a8478, 0x5a3020];
  for (const x of [35, 48, 61, 74]) for (let z = 4; z < 27; z += 2.8) {
    const n = 1 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) { const c = block(M.crate, x + (r() - 0.5) * 0.6, z, 12.2, 2.5, 106 + k * 2.6, 106 + k * 2.6 + 2.55); c.userData.col = lin(CRATE[Math.floor(r() * CRATE.length)]); }
  }
  // Cranes: lattice masts and jibs from thin beams.
  const beam = (mat, a, b, t) => { const d = new V3().subVectors(b, a), m = mesh(new THREE.BoxGeometry(t, d.length(), t), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); };
  const lattice = (a, b, w, t, step) => { // a square truss from a to b
    const d = new V3().subVectors(b, a), L = d.length(), dir = d.clone().normalize(), s1 = new V3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new V3(1, 0, 0) : UP).normalize().multiplyScalar(w / 2), s2 = new V3().crossVectors(dir, s1).normalize().multiplyScalar(w / 2);
    const corners = [s1.clone().add(s2), s1.clone().sub(s2), s1.clone().negate().sub(s2), s1.clone().negate().add(s2)];
    for (const c of corners) beam(M.crane, a.clone().add(c), b.clone().add(c), t);
    for (let x = 0; x < L - 0.1; x += step) for (let k = 0; k < 4; k++) {
      const p = a.clone().addScaledVector(dir, x), q = a.clone().addScaledVector(dir, Math.min(L, x + step));
      beam(M.crane, p.clone().add(corners[k]), q.clone().add(corners[(k + 1) % 4]), t * 0.7);
      beam(M.crane, q.clone().add(corners[k]), q.clone().add(corners[(k + 1) % 4]), t * 0.7);
    }
  };
  const crane = (x, y, z, h, jib, ang) => {
    const top = new V3(x, y + h, z), dir = new V3(Math.cos(ang), 0, Math.sin(ang));
    lattice(new V3(x, y, z), top, 2.4, 0.35, 4);
    lattice(top.clone().addScaledVector(dir, -10), top.clone().addScaledVector(dir, jib), 1.8, 0.3, 4);
    beam(M.crane, top, top.clone().add(new V3(0, 6, 0)), 0.5);
    beam(M.crane, top.clone().add(new V3(0, 6, 0)), top.clone().addScaledVector(dir, jib * 0.7), 0.15);
    beam(M.crane, top.clone().add(new V3(0, 6, 0)), top.clone().addScaledVector(dir, -9), 0.15);
    block(M.panel, x - Math.cos(ang) * 9, z - Math.sin(ang) * 9, 4, 4, y + h - 3, y + h - 0.6);
    const hook = top.clone().addScaledVector(dir, jib * 0.6); beam(M.crane, hook, hook.clone().add(new V3(0, -18, 0)), 0.08);
    block(M.red, x, z, 0.9, 0.9, y + h + 6, y + h + 7);
  };
  crane(86, 106, 22, 34, 38, Math.PI * 0.85); crane(36, 152, -20, 26, 30, -Math.PI * 0.2);

  // Landing pads on drums hanging off the annex's far end, joined by a slab.
  block(M.panel, 108, -2, 34, 62, 96, 104);
  for (const [x, z, rad, top, bottom] of [[106, -18, 13, 114, 44], [110, 15, 12, 111, 52], [127, -1, 10, 108, 60], [88, -36, 11, 118, 62]]) {
    mesh(new THREE.CylinderGeometry(rad, rad, top - bottom, 32), M.panel, x, (top + bottom) / 2, z);
    mesh(new THREE.CylinderGeometry(rad * 0.45, rad * 0.6, 16, 20), M.panel, x, bottom - 8, z);
    mesh(new THREE.CylinderGeometry(rad + 0.8, rad + 0.8, 1.2, 40), M.pad, x, top + 0.6, z);
    const out = Math.atan2(x - 70, z);
    for (let k = 0; k < 3; k++) { const p = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.6, 14), M.dark, x + Math.sin(out) * (rad + 0.1), bottom + 10 + k * 9, z + Math.cos(out) * (rad + 0.1)); p.rotation.set(Math.PI / 2, 0, 0); p.rotateOnWorldAxis(UP, out); }
    const ma = out + 0.6; mesh(new THREE.CylinderGeometry(0.15, 0.2, 12, 5), M.crane, x + Math.sin(ma) * (rad - 0.5), top + 7, z + Math.cos(ma) * (rad - 0.5));
    block(M.red, x + Math.sin(ma) * (rad - 0.5), z + Math.cos(ma) * (rad - 0.5), 0.7, 0.7, top + 13, top + 13.7);
  }

  // Chrome ducts: straight runs with collars at the joints and every so often along them.
  const pipe = (pts, rad, every) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = new V3(...pts[i]), b = new V3(...pts[i + 1]), d = new V3().subVectors(b, a), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
      const run = mesh(new THREE.CylinderGeometry(rad, rad, L, 20, 1, true), M.chrome); run.position.copy(a).addScaledVector(d, 0.5); run.quaternion.copy(q);
      for (let x = 0; x <= L + 0.01; x += Math.min(every, L)) {
        const c = mesh(new THREE.LatheGeometry([[rad * 1.02, -1.2], [rad * 1.35, -0.5], [rad * 1.35, 0.5], [rad * 1.02, 1.2]].map(([u, v]) => new THREE.Vector2(u, v)), 20), M.chrome);
        c.position.copy(a).addScaledVector(d, x / L); c.quaternion.copy(q);
      }
    }
    for (const p of pts) mesh(new THREE.SphereGeometry(rad * 1.04, 16, 10), M.chrome, ...p);
  };
  pipe([[31, -2, 33], [31, 100, 33], [104, 100, 33], [106, 100, 26.5]], 3, 14);
  pipe([[36, 107, 3], [62, 151, 3]], 2.4, 10); pipe([[36, 107, 0], [52, 135, 0], [52, 150.5, -2]], 1.5, 9);
  pipe([[22, 128, 8], [36, 107, 3]], 2.4, 10);
  pipe([[-25, -2, 31.5], [-25, 80, 31.5], [-24.6, 86, 24]], 1.4, 12);

  // Merge into one mesh per material, in citadel space.
  tmp.updateMatrixWorld(true);
  const buckets = new Map(), STONE_LIKE = new Set([M.stone, M.carved, M.panel]);
  tmp.traverse(m => {
    if (!m.isMesh) return;
    let mat = m.material;
    if (!Object.values(M).includes(mat)) mat = mat.isMeshBasicMaterial ? (mat.color.getHex() < 0x202020 ? M.dark : M.glow) : M.carved; // statues: carved stone, shadowed faces, the staff's lamp
    let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (STONE_LIKE.has(mat)) projectUV(g, mat === M.panel ? 32 : 16);
    else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (mat === M.crate) { const c = m.userData.col || new THREE.Color(1, 1, 1), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    g.clearGroups();
    if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, list] of buckets) {
    const g = BufferGeometryUtils.mergeBufferGeometries(list); list.forEach(x => x.dispose());
    const m = new THREE.Mesh(g, mat); m.receiveShadow = mat.isMeshStandardMaterial; out.add(m);
  }
  return out;
}
