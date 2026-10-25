// Flight physics. No DOM and no rendering here, so it can run in tests (see tests/physics.test.js).
//
// Model: Newtonian point mass with gravity from Veyra and Tal, exponential atmosphere drag,
// thrust along the nose, and rigid-body rotation driven by RCS with rate limits (RATE) and
// angular acceleration limits (ACC). The flight computer can hold an attitude (prograde,
// retrograde, or facing a body); manual steering cancels any hold and any time warp.
import * as THREE from 'three';
import {R, GM, ATM_TOP, FLOOR, SCALE_H, MOON_FLOOR, MOON_R, GM_M, MOON_A, MOON_INC, SOI_M, MOON_N, SPIN, TILT, SHIP_MASS, CDA, A_MAIN, A_BOOST, A_RETRO, RATE, ACC, WARPS, TAU, TAL_MAX_H, TAL_START_ALT, SURFACE_ALT, BRAKE_STOP_H} from './config.js';
import {clamp, smooth} from './util.js';
import {talHeight} from './tal.js';

const V3 = THREE.Vector3;
export const qTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, TILT));
export const qTiltInv = qTilt.clone().invert();
export const eqN = new V3(0, 1, 0).applyQuaternion(qTilt);           // Veyra's spin axis
const moonQ = qTilt.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(MOON_INC, 0, 0)));
export const omegaP = eqN.clone().multiplyScalar(SPIN);              // atmosphere co-rotates with the planet
export const omegaT = new V3(0, 1, 0).applyQuaternion(moonQ).multiplyScalar(MOON_N); // Tal's spin (once per orbit)
const zero = new V3(), m4 = new THREE.Matrix4();
const mNow = new V3(), yAxis = new V3(0, 1, 0), qSpin = new THREE.Quaternion(), qBody = new THREE.Quaternion(), tB = new V3(), mP2 = new V3(), gV = new V3(), cU = new V3(), cH = new V3(), cP = new V3();
const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), mP = new V3(), mPa = new V3(), mV = new V3(), pa = new V3(), aExt = new V3(), thrust = new V3(), vAir = new V3(), pp = new V3(), pvv = new V3(), hT = new V3(), hU = new V3(), des = new V3(), fwd = new V3(), tV = new V3(), tQ = new THREE.Quaternion(), invQ = new THREE.Quaternion(), tE = new THREE.Euler();

// Ship and session state. Camera and UI fields live here too so a whole session can be saved and restored.
export const S = {
  pos: new V3(), vel: new V3(), quat: new THREE.Quaternion(), w: new V3(), t: 0, moonTh0: 0,
  throttle: 0, warpIdx: 0, hold: 'pro', heat: 0, lit: 1, aMain: 0, boostAmt: 0, inAtmo: false, inPitch: 0, inYaw: 0,
  camMode: 0, camYaw: 0, camPitch: 0, camZoom: 1, mapYaw: 0, mapPitch: 0.4, mapZoom: 1, launched: false, paused: true,
};
// Derived orbital readouts, relative to the dominant body (Tal inside its sphere of influence, otherwise Veyra).
// agl is height above the ground below the ship when over Tal, otherwise the same as alt.
// surf: low over Tal (below SURFACE_ALT), where speed, hs (horizontal) and vv are relative to the
// turning ground, and so are the prograde and retrograde holds. impact: seconds until the ground on
// the current path. brake: seconds until a full-thrust retrograde burn must start to stop just above
// the ground (0 = now, Infinity = no burn needed).
export const O = {dom: 0, name: 'Veyra', speed: 0, alt: 0, agl: 0, vv: 0, hs: 0, surf: false, impact: Infinity, brake: Infinity, ap: 0, pe: 0, period: 0, altPlanet: 0, altMoon: 0};

let notify = () => {};
export function setNotifier(fn) { notify = fn; }

export function moonTh(t) { return S.moonTh0 + MOON_N * t; }
export function moonPos(t, out) { const th = moonTh(t); return out.set(MOON_A * Math.cos(th), 0, -MOON_A * Math.sin(th)).applyQuaternion(moonQ); }
export function moonVel(t, out) { const th = moonTh(t); return out.set(-MOON_A * MOON_N * Math.sin(th), 0, -MOON_A * MOON_N * Math.cos(th)).applyQuaternion(moonQ); }
// Tal is tidally locked: its body frame (the frame of W.moon, where tal.js heights live) turns once
// per orbit. Same rotation as W.tiltG > moonPlane > moonPivot in world.js.
export function talQuat(t, out) { return out.copy(moonQ).multiply(qSpin.setFromAxisAngle(yAxis, moonTh(t))); }
// Height of universe point p above Tal's ground (metres). More than 50 km above the highest ground it
// skips the terrain lookup and returns a lower bound (height above the highest possible ground).
export function talAgl(p, t) {
  moonPos(t, mP2); tB.subVectors(p, mP2); const r = tB.length();
  if (r > MOON_R + TAL_MAX_H + 50e3) return r - MOON_R - TAL_MAX_H;
  tB.applyQuaternion(talQuat(t, qBody).invert()).divideScalar(r);
  return r - MOON_R - talHeight(tB.x, tB.y, tB.z);
}
// Velocity of Tal's ground (or of a point fixed to Tal) at universe point p.
export function talGroundVel(p, t, out) { moonPos(t, gV); return out.crossVectors(omegaT, gV.subVectors(p, gV)).add(moonVel(t, gV)); }
export function accelAt(p, t, out) {
  const r2 = p.lengthSq(), r = Math.sqrt(r2); out.copy(p).multiplyScalar(-GM / (r2 * r));
  moonPos(t, mPa); tmpC.subVectors(p, mPa); const d2 = tmpC.lengthSq(), d = Math.sqrt(d2);
  return out.addScaledVector(tmpC, -GM_M / (d2 * d));
}

export function orbInfo() {
  moonPos(S.t, mP); const dmoon = S.pos.distanceTo(mP); let mu, Rb;
  if (dmoon < SOI_M) { O.dom = 1; O.name = 'Tal'; mu = GM_M; Rb = MOON_R; tmpA.subVectors(S.pos, mP); moonVel(S.t, mV); tmpB.subVectors(S.vel, mV); }
  else { O.dom = 0; O.name = 'Veyra'; mu = GM; Rb = R; tmpA.copy(S.pos); tmpB.copy(S.vel); }
  const r = tmpA.length(), v2 = tmpB.lengthSq(); O.speed = Math.sqrt(v2); O.alt = r - Rb; O.vv = tmpB.dot(tmpA) / r;
  const eps = v2 / 2 - mu / r, h2 = tmpC.crossVectors(tmpA, tmpB).lengthSq(), e = Math.sqrt(Math.max(0, 1 + 2 * eps * h2 / (mu * mu)));
  if (eps < 0) { const a = -mu / (2 * eps); O.ap = a * (1 + e) - Rb; O.pe = a * (1 - e) - Rb; O.period = TAU * Math.sqrt(a * a * a / mu); if (O.dom === 1 && O.ap + Rb > SOI_M) O.ap = Infinity; }
  else { O.ap = Infinity; O.pe = h2 / (mu * (1 + e)) - Rb; O.period = Infinity; }
  O.altPlanet = S.pos.length() - R; O.altMoon = dmoon - MOON_R;
  O.agl = O.dom === 1 ? talAgl(S.pos, S.t) : O.alt;
  O.surf = O.dom === 1 && O.agl < (O.surf ? SURFACE_ALT * 1.1 : SURFACE_ALT);
  if (O.surf) O.speed = relVel(tmpB).length(); // the ground's motion is horizontal, so vv is the same either way
  O.hs = Math.sqrt(Math.max(0, O.speed * O.speed - O.vv * O.vv));
  brakeCue();
}
// Velocity relative to the dominant body: its centre in orbit, its ground when low over Tal.
export function relVel(out) {
  if (O.surf) return out.subVectors(S.vel, talGroundVel(S.pos, S.t, mV));
  if (O.dom === 1) { moonVel(S.t, mV); return out.subVectors(S.vel, mV); } return out.copy(S.vel);
}

// ---- braking cue ----
// A planar model is enough here: height h, vertical speed vz and horizontal speed vx over the ground,
// gravity g less the curvature term vx²/r (which is what keeps an orbit up), and full main-engine
// thrust against the velocity. burnStop returns how far a burn from this state drops (dh) and
// travels (dx) before the ship stops.
function burnStop(vz, vx, g, r) {
  let dh = 0, dx = 0, n = 0;
  for (;;) {
    const v = Math.hypot(vx, vz); if (v < 1 || n++ > 4000) break;
    const dt = Math.min(0.5, Math.max(0.05, v / A_MAIN / 50)), ge = g - vx * vx / r;
    const ax = -A_MAIN * vx / v, az = -A_MAIN * vz / v - ge;
    dh += vz * dt + az * dt * dt / 2; dx += vx * dt + ax * dt * dt / 2; vz += az * dt; vx += ax * dt;
  }
  return [dh, dx];
}
let cueT = -1, cueAgl = 0;
// Ground height under the point dx metres ahead along the ground track, relative to the ground here.
function groundAhead(dx) {
  moonPos(S.t, mP2); cU.subVectors(S.pos, mP2); const r = cU.length(); cU.divideScalar(r);
  relVel(cH); cH.addScaledVector(cU, -cH.dot(cU)); const l = cH.length(); if (l < 1e-6) return 0;
  cP.copy(cU).multiplyScalar(r).addScaledVector(cH, dx / l).setLength(r).add(mP2);
  return O.agl - talAgl(cP, S.t);
}
function brakeCue() {
  if (!O.surf || O.speed < 2 || O.agl < BRAKE_STOP_H + 100) { O.impact = O.brake = Infinity; cueT = -1; return; }
  if (cueT >= 0 && Math.abs(S.t - cueT) < 0.2 && Math.abs(O.agl - cueAgl) < 50) return; // a few times a second is plenty
  cueT = S.t; cueAgl = O.agl;
  const r = O.agl + MOON_R, g = GM_M / (r * r), ge = g - O.hs * O.hs / r, h = O.agl, vz = O.vv, vx = O.hs;
  // Coasting: h(t) = h + vz t - ge t²/2 over ground at today's height.
  if (ge > 0) O.impact = (vz + Math.sqrt(vz * vz + 2 * ge * h)) / ge; else O.impact = vz < 0 ? h / -vz : Infinity;
  if (O.impact === Infinity) { O.brake = Infinity; return; }
  const stopH = T => { // height left above the ground where the ship stops, if the burn starts in T seconds
    const [dh, dx] = burnStop(vz - ge * T, vx, g, r);
    return h + vz * T - ge * T * T / 2 + dh - groundAhead(vx * T + dx) - BRAKE_STOP_H;
  };
  if (stopH(0) <= 0) { O.brake = 0; return; }
  let lo = 0, hi = O.impact; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (stopH(m) > 0) lo = m; else hi = m; }
  O.brake = lo;
}
export function radialOut(out) { if (O.dom === 1) { moonPos(S.t, mP); return out.subVectors(S.pos, mP).normalize(); } return out.copy(S.pos).normalize(); }

// Start: circular orbit 400 km up, inclined to the ring, sun behind, Tal ahead and lit.
export function initOrbit(sunDir) {
  const hN = eqN.clone().applyAxisAngle(new V3(1, 0, 0), 0.33).normalize();
  const want = sunDir.clone().applyAxisAngle(hN, 0.5);
  const rh = want.sub(hN.clone().multiplyScalar(want.dot(hN))).normalize();
  const r0 = R + 400e3; S.pos.copy(rh).multiplyScalar(r0);
  const vh = new V3().crossVectors(hN, rh).normalize(); S.vel.copy(vh).multiplyScalar(Math.sqrt(GM / r0));
  m4.lookAt(zero, vh, rh); S.quat.setFromRotationMatrix(m4);
  const look = vh.clone().multiplyScalar(0.8).addScaledVector(rh, 0.6).normalize(); let best = -9, bt = 0;
  for (let i = 0; i < 120; i++) { S.moonTh0 = i / 120 * TAU; moonPos(0, mP); const u = mP.sub(S.pos).normalize(); const sc = u.dot(look) - 0.5 * u.dot(sunDir); if (sc > best) { best = sc; bt = S.moonTh0; } }
  S.moonTh0 = bt; S.t = 0; S.hold = 'pro'; S.throttle = 0; S.w.set(0, 0, 0); S.warpIdx = 0;
  orbInfo();
}

// "Start above Tal": circular orbit TAL_START_ALT up, flying toward the sunlit side with the sun
// about 25° above the horizon (long shadows), and Veyra up in the sky ahead where possible.
export function initTalOrbit(sunDir) {
  S.moonTh0 = 0; let best = -9, bt = 0;
  const side = new V3().crossVectors(sunDir, new V3(0, 1, 0)).normalize();
  const rh = sunDir.clone().multiplyScalar(Math.cos(1.13)).addScaledVector(side, Math.sin(1.13)).normalize();
  const hN = new V3().crossVectors(sunDir, rh).normalize(), vh = new V3().crossVectors(rh, hN).normalize();
  for (let i = 0; i < 120; i++) { S.moonTh0 = i / 120 * TAU; moonPos(0, mP); const u = mP.negate().normalize(); const sc = 0.6 * u.dot(vh) + 0.4 * u.dot(rh); if (sc > best) { best = sc; bt = S.moonTh0; } }
  S.moonTh0 = bt; S.t = 0; moonPos(0, mP); moonVel(0, mV);
  const r0 = MOON_R + TAL_START_ALT; S.pos.copy(mP).addScaledVector(rh, r0); S.vel.copy(mV).addScaledVector(vh, Math.sqrt(GM_M / r0));
  m4.lookAt(zero, vh, rh); S.quat.setFromRotationMatrix(m4);
  S.hold = 'pro'; S.throttle = 0; S.w.set(0, 0, 0); S.warpIdx = 0;
  orbInfo();
}

// ---- attitude control ----
function holdDir(out) {
  if (S.hold === 'planet') { out.copy(S.pos).negate().normalize(); return true; }
  if (S.hold === 'moon') { moonPos(S.t, out).sub(S.pos).normalize(); return true; }
  relVel(out); if (out.lengthSq() < 1) return false; out.normalize(); if (S.hold === 'retro') out.negate(); return true;
}
// Body-frame angular velocity that brings the nose to the hold direction without overshoot,
// and rolls so the dominant body is "down" once the nose is close.
function holdDesired(out) {
  if (!holdDir(hT)) return false;
  invQ.copy(S.quat).invert(); hT.applyQuaternion(invQ);
  const ax = hT.y, ay = -hT.x, s = Math.hypot(ax, ay), c = -hT.z, ang = Math.atan2(s, c);
  let ux = 0, uy = 0; if (s > 1e-9) { ux = ax / s; uy = ay / s; } else if (c < 0) ux = 1;
  const rate = Math.min(RATE[1], Math.sqrt(2 * ACC[1] * ang) * 0.8); out.set(ux * rate, uy * rate, 0);
  if (ang < 0.6) { radialOut(hU).applyQuaternion(invQ); if (Math.hypot(hU.x, hU.y) > 0.2) { const phi = Math.atan2(-hU.x, hU.y); out.z = Math.sign(phi) * Math.min(RATE[2], Math.sqrt(2 * ACC[2] * Math.abs(phi)) * 0.8); } }
  return true;
}
function snapHold() { if (!holdDir(hT)) return; radialOut(hU); m4.lookAt(zero, hT, hU); tQ.setFromRotationMatrix(m4); S.quat.slerp(tQ, 0.5); }
function rotate(dt, p, y, r) {
  if (!(S.hold && holdDesired(des))) des.set(p * RATE[0], -y * RATE[1], r * RATE[2]);
  S.w.x += clamp(des.x - S.w.x, -ACC[0] * dt, ACC[0] * dt);
  S.w.y += clamp(des.y - S.w.y, -ACC[1] * dt, ACC[1] * dt);
  S.w.z += clamp(des.z - S.w.z, -ACC[2] * dt, ACC[2] * dt);
  tE.set(S.w.x * dt, S.w.y * dt, S.w.z * dt); tQ.setFromEuler(tE); S.quat.multiply(tQ).normalize();
}

function collide() {
  const r = S.pos.length();
  if (r < R + FLOOR) { tV.copy(S.pos).divideScalar(r); S.pos.copy(tV).multiplyScalar(R + FLOOR); const vr = S.vel.dot(tV); if (vr < 0) S.vel.addScaledVector(tV, -vr); notify('floor', 'Hard deck at 15 km. Landing arrives in a later phase.'); }
  // Tal: the hard deck follows the ground, MOON_FLOOR above it.
  moonPos(S.t, mP); tV.subVectors(S.pos, mP); const d = tV.length();
  if (d < MOON_R + TAL_MAX_H + MOON_FLOOR) {
    const agl = talAgl(S.pos, S.t);
    if (agl < MOON_FLOOR) { tV.divideScalar(d); S.pos.addScaledVector(tV, MOON_FLOOR - agl); moonVel(S.t, mV); tmpB.subVectors(S.vel, mV); const vr = tmpB.dot(tV); if (vr < 0) S.vel.addScaledVector(tV, -vr); notify('floor', 'Hard deck 500 m above the ground. Landing arrives in a later phase.'); }
  }
}

// Highest warp allowed: 100× inside the atmosphere, and lower when a surface is coming up fast.
export function maxWarpIdx() {
  let m = 3; if (O.dom === 0 && O.alt < ATM_TOP) m = 2; const fl = O.dom === 0 ? FLOOR : MOON_FLOOR;
  if (O.vv < 0) { const tImp = (O.agl - fl) / (-O.vv); while (m > 0 && tImp < WARPS[m] * 8) m--; }
  return m;
}

// One frame of flight. inp = {pitch, yaw, roll} in [-1,1] plus {boost, retro} booleans.
export function stepFlight(dt, inp) {
  const p = clamp(inp.pitch), y = clamp(inp.yaw), r = clamp(inp.roll);
  S.inPitch = p; S.inYaw = y;
  if (Math.abs(p) + Math.abs(y) + Math.abs(r) > 0.12) { S.hold = null; S.warpIdx = 0; }
  S.boostAmt += ((inp.boost ? 1 : 0) - S.boostAmt) * (1 - Math.exp(-dt * 4));
  S.warpIdx = Math.min(S.warpIdx, maxWarpIdx());
  const warp = WARPS[S.warpIdx];
  if (warp === 1) rotate(dt, p, y, r); else { S.w.set(0, 0, 0); if (S.hold) snapHold(); }
  S.aMain = inp.boost ? A_BOOST : S.throttle * A_MAIN;
  fwd.set(0, 0, -1).applyQuaternion(S.quat); thrust.copy(fwd).multiplyScalar(S.aMain - (inp.retro ? A_RETRO : 0));
  // Sub-steps: velocity Verlet, step size limited by local orbital period so time warp stays accurate.
  let T = dt * warp, n = 0; S.heat = 0;
  while (T > 1e-6 && n < 300) {
    const rr = S.pos.length(); moonPos(S.t, mP); const dm = S.pos.distanceTo(mP);
    let h = Math.min(T, 5, 0.002 * TAU * Math.sqrt(rr * rr * rr / GM), 0.01 * TAU * Math.sqrt(dm * dm * dm / GM_M));
    aExt.copy(thrust);
    const alt = rr - R;
    if (alt < ATM_TOP) {
      h = Math.min(h, 0.25); vAir.crossVectors(omegaP, S.pos); vAir.subVectors(S.vel, vAir);
      const spd = vAir.length(), rho = 1.2 * Math.exp(-alt / SCALE_H);
      aExt.addScaledVector(vAir, -0.5 * rho * spd * CDA / SHIP_MASS);
      S.heat = Math.max(S.heat, clamp(0.5 * rho * spd * spd * spd / 6e7, 0, 1));
    }
    accelAt(S.pos, S.t, pa); S.vel.addScaledVector(pa, h * 0.5).addScaledVector(aExt, h * 0.5);
    S.pos.addScaledVector(S.vel, h); S.t += h;
    accelAt(S.pos, S.t, pa); S.vel.addScaledVector(pa, h * 0.5).addScaledVector(aExt, h * 0.5);
    collide(); T -= h; n++;
  }
  orbInfo();
  const inA = O.dom === 0 && O.alt < ATM_TOP; if (inA && !S.inAtmo) notify('atmo', 'Entering the atmosphere. Drag is slowing you.'); S.inAtmo = inA;
}

// Predicted path (gravity only, Tal moving) written into out as xyz triples in the universe frame.
// Returns the number of points. Covers one orbit when bound and low, otherwise 2.5 days. Inside Tal's
// sphere of influence the path is drawn relative to Tal, placed where Tal is now, so an orbit of Tal
// closes on itself instead of smearing along Tal's own orbit.
export function predictPath(out, maxPts) {
  pp.copy(S.pos); pvv.copy(S.vel); let t = S.t, i = 0, el = 0, horizon = 2.5 * 86400;
  const talRel = O.dom === 1, kM = talRel ? 0.004 : 0.01; moonPos(S.t, mNow);
  if (talRel) {
    const r0 = pp.distanceTo(mNow), v2 = moonVel(S.t, mV).sub(pvv).lengthSq(), eps = v2 / 2 - GM_M / r0;
    if (eps < 0) { const a = -GM_M / (2 * eps); if (a < SOI_M * 0.5) horizon = TAU * Math.sqrt(a * a * a / GM_M) * 1.02; }
  } else {
    const r0 = pp.length(), v2 = pvv.lengthSq(), eps = v2 / 2 - GM / r0;
    if (eps < 0) { const a = -GM / (2 * eps); if (a < MOON_A * 0.45) horizon = TAU * Math.sqrt(a * a * a / GM) * 1.02; }
  }
  out[0] = pp.x; out[1] = pp.y; out[2] = pp.z; accelAt(pp, t, pa);
  while (i < maxPts - 1 && el < horizon) {
    const r = pp.length(); moonPos(t, mP); const dm = pp.distanceTo(mP);
    const h = clamp(Math.min(0.004 * TAU * Math.sqrt(r * r * r / GM), kM * TAU * Math.sqrt(dm * dm * dm / GM_M)), 0.5, 1800);
    pvv.addScaledVector(pa, h * 0.5); pp.addScaledVector(pvv, h); t += h; el += h; accelAt(pp, t, pa); pvv.addScaledVector(pa, h * 0.5);
    i++; if (talRel) moonPos(t, mP).negate().add(mNow).add(pp); else mP.copy(pp);
    out[i * 3] = mP.x; out[i * 3 + 1] = mP.y; out[i * 3 + 2] = mP.z;
    if (r < R + FLOOR || dm < MOON_R) break;
  }
  return i + 1;
}

// Eclipse factor at the ship (1 = full sun, 0 = in Veyra's shadow).
export function sunlitFactor(sunDir) {
  const sdot = S.pos.dot(sunDir); if (sdot > 0) return 1;
  const perp = tV.copy(S.pos).addScaledVector(sunDir, -sdot).length();
  return smooth(R - 30e3, R + 60e3, perp);
}
