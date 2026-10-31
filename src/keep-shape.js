// The Keep at Harrow Rise, as solids: a monolith about 1.2 km tall on a stepped plinth, two buttresses flanking
// its gate, a long low wing, a crown and a ramp. Each solid is convex, so the same numbers serve the model
// (keep.js), collision (physics.js) and the shadows it casts on Tal's ground, on itself and on the ship (a ray
// toward the sun tested against each solid's planes in the shaders, KEEP_SHADE). No DOM: physics imports it.
//
// Keep-local frame: metres, y up, y = 0 near the highest ground under it, the gate facing +z: KEEP.turn off the
// way back to the outpost's pad, which lies 2.8 km away, so from the pad it is seen three-quarters on, with
// Veyra low in the sky beyond its shoulder and the morning sun raking across its face.
import * as THREE from 'three';
import {MOON_R, OUTPOSTS, outpostDir} from './config.js';
import {talHeight} from './tal.js';

const V3 = THREE.Vector3;
export const KEEP = {name: 'the Keep', outpost: 'harrow', dist: 2800, off: 18 * Math.PI / 180, turn: 35 * Math.PI / 180, show: 800e3};

// A solid from its corners and faces (corner indices, any winding); planes face outward.
function solid(verts, faces) {
  const v = verts.map(p => new V3(...p)), c = v.reduce((a, p) => a.add(p), new V3()).divideScalar(v.length);
  const planes = faces.map(f => {
    const n = new V3().subVectors(v[f[1]], v[f[0]]).cross(new V3().subVectors(v[f[2]], v[f[0]])).normalize();
    let d = n.dot(v[f[0]]); if (n.dot(c) > d) { n.negate(); d = -d; }
    return [n.x, n.y, n.z, d];
  });
  return {verts: v, faces, planes};
}
// A frustum: a convex plan [[x, z], ...] at y0, the same plan scaled by k about (cx, cz) at y1.
function frustum(plan, y0, y1, k, cx = 0, cz = 0) {
  const n = plan.length, verts = [...plan.map(([x, z]) => [x, y0, z]), ...plan.map(([x, z]) => [cx + (x - cx) * k, y1, cz + (z - cz) * k])];
  const faces = [plan.map((_, i) => i), plan.map((_, i) => n + i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
  return solid(verts, faces);
}
// A wedge across x0..x1: its back rises from (zb, y0) to (zb, yt), its slope runs down to (zf, y0).
function wedge(x0, x1, zb, zf, y0, yt) {
  return solid([[x0, y0, zb], [x0, y0, zf], [x0, yt, zb], [x1, y0, zb], [x1, y0, zf], [x1, yt, zb]],
    [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [0, 2, 5, 3], [1, 2, 5, 4]]);
}
// The shaft's plan: 400 m across, 220 m deep, corners cut at 45°.
const W = 200, D = 110, C = 70;
export const SHAFT_PLAN = [[-W + C, D], [W - C, D], [W, D - C], [W, -D + C], [W - C, -D], [-W + C, -D], [-W, -D + C], [-W, D - C]];
export const SHAFT = {y0: -100, y1: 1150, k: 0.64};
export const PLINTH_TOP = 36;
export const KEEP_SOLIDS = {
  plinth: frustum([[-330, 245], [330, 245], [330, -230], [-330, -230]], -130, PLINTH_TOP, 0.96, 0, 7),
  shaft: frustum(SHAFT_PLAN, SHAFT.y0, SHAFT.y1, SHAFT.k),
  crown: frustum(SHAFT_PLAN.map(([x, z]) => [x * 0.6, z * 0.6]), SHAFT.y1 - 2, SHAFT.y1 + 80, 0.8),
  buttL: wedge(-94, -50, 86, 300, -100, 520),
  buttR: wedge(50, 94, 86, 300, -100, 520),
  wing: frustum([[-570, 40], [-180, 40], [-180, -120], [-570, -120]], -120, 240, 0.9, -375, -40),
  ramp: wedge(-34, 34, 220, 730, -110, PLINTH_TOP),
};
const LIST = Object.values(KEEP_SOLIDS);

// Where it stands: from Harrow Rise's pad, KEEP.dist along the ground toward the point under Veyra (longitude
// 180°, Tal being tidally locked), turned KEEP.off to one side. y = 0 sits 4 m under the highest ground there.
function place() {
  const d = new V3(...outpostDir(OUTPOSTS[KEEP.outpost])), v = new V3(-1, 0, 0);
  const tv = v.addScaledVector(d, -v.dot(d)).normalize().applyAxisAngle(d, KEEP.off), a = KEEP.dist / MOON_R;
  const up = d.clone().multiplyScalar(Math.cos(a)).addScaledVector(tv, Math.sin(a)).normalize();
  const z = tv.clone().addScaledVector(up, -tv.dot(up)).normalize().negate().applyAxisAngle(up, KEEP.turn), x = new V3().crossVectors(up, z);
  let top = -Infinity;
  for (let i = -400; i <= 400; i += 40) for (let j = -260; j <= 420; j += 40) { const p = up.clone().multiplyScalar(MOON_R).addScaledVector(x, i).addScaledVector(z, j).normalize(); top = Math.max(top, talHeight(p.x, p.y, p.z)); }
  const m = new THREE.Matrix4().makeBasis(x, up, z).setPosition(up.clone().multiplyScalar(MOON_R + top - 4));
  return m;
}
// Keep-local to Tal's body frame, and back.
export const KEEP_TO_BODY = place();
export const KEEP_FROM_BODY = KEEP_TO_BODY.clone().invert();
export const KEEP_BODY_POS = new V3().setFromMatrixPosition(KEEP_TO_BODY);
export const KEEP_RADIUS = 900; // a sphere round all of it (centre at y = 500)

// Is a Keep-local point within `margin` of a solid? (Inside every plane pushed out by the margin.)
export function keepHit(p, margin = 0) {
  for (const s of LIST) {
    let inside = true;
    for (const [nx, ny, nz, d] of s.planes) if (nx * p.x + ny * p.y + nz * p.z - d > margin) { inside = false; break; }
    if (inside) return true;
  }
  return false;
}

// The shaders' uniforms, shared by every material that takes the Keep's shadow (keep.js sets them each frame).
export const KEEP_U = {kInv: {value: new THREE.Matrix4()}, kSun: {value: new V3(0, 1, 0)}, kOn: {value: 0}};

// GLSL: keepShade(w) is 0 where the sun is hidden behind the Keep from render-space point w, else 1.
// Uniforms kInv (render space to Keep-local), kSun (direction to the sun, Keep-local), kOn (0 skips it).
// A ray from the point toward the sun is clipped against each solid's planes; the solids are written in
// as constants. A point on a sunlit face leaves its own solid at once, so exits closer than 1 m do not count.
const f = x => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(6);
export const KEEP_SHADE = `uniform mat4 kInv;uniform vec3 kSun;uniform float kOn;
float keepShade(vec3 w){
  if(kOn<0.5)return 1.0;
  vec3 p=(kInv*vec4(w,1.0)).xyz,d=kSun,oc=vec3(0.0,500.0,0.0)-p;
  float tc=dot(oc,d);if(tc<-${f(KEEP_RADIUS)}||dot(oc,oc)-tc*tc>${f(KEEP_RADIUS * KEEP_RADIUS)})return 1.0;
  float a,b,dn,nm;
${LIST.map(s => `  a=0.0;b=1e9;
${s.planes.map(([x, y, z, dd]) => `  dn=dot(vec3(${f(x)},${f(y)},${f(z)}),d);nm=dot(vec3(${f(x)},${f(y)},${f(z)}),p)-(${f(dd)});if(abs(dn)<1e-6){if(nm>0.0)b=-1.0;}else if(dn<0.0)a=max(a,-nm/dn);else b=min(b,-nm/dn);`).join('\n')}
  if(a<b&&b>1.0)return 0.0;`).join('\n')}
  return 1.0;}
`;
