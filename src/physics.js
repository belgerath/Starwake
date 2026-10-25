// Flight physics. No DOM and no rendering here, so it can run in tests (see tests/physics.test.js).
//
// Model: Newtonian point mass with gravity from Veyra and Tal, exponential atmosphere drag,
// thrust along the nose, and rigid-body rotation driven by RCS with rate limits (SHIP.rate) and
// angular acceleration limits (SHIP.acc). The flight computer can hold an attitude (prograde,
// retrograde, or facing a body); manual steering cancels any hold and any time warp.
// Low over Tal, hover mode (setHover()) moves the thrust to the belly lift thrusters and keeps the ship
// level whenever it is not being steered. It lands belly-down on its gear (contact(), touchdown(),
// stepLanded()). Any hull point touching the ground, or a touchdown outside the limits, is a crash.
import * as THREE from 'three';
import {R, GM, ATM_TOP, FLOOR, SCALE_H, MOON_R, GM_M, MOON_A, MOON_INC, SOI_M, MOON_N, SPIN, TILT, SHIP, WARPS, TAU, TAL_MAX_H, TAL_START_ALT, SURFACE_ALT, BRAKE_CLEAR, CUE_ALT,
  LEG_TIME, LAND_DOWN, LAND_HARD, LAND_SIDE, LAND_TILT, LAND_SLOPE, CHECKPOINT_ALT} from './config.js';
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
const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), mP = new V3(), mPa = new V3(), mV = new V3(), pa = new V3(), aExt = new V3(), thrust = new V3(), vAir = new V3(), pp = new V3(), pvv = new V3(), hT = new V3(), hU = new V3(), hB = new V3(), des = new V3(), fwd = new V3(), nose = new V3(), tV = new V3(), tQ = new THREE.Quaternion(), invQ = new THREE.Quaternion(), tE = new THREE.Euler();
const DEG = 180 / Math.PI;

// Ship and session state. Camera and UI fields live here too so a whole session can be saved and restored.
// aMain and aLift: what the main engine and the lift thrusters are pushing right now (m/s²).
// Landing: hover (thrust on the lift thrusters), legs (the gear: 0 stowed .. 1 down, animated), legsDown
// (where the gear is heading), landed (standing on Tal, pose lp/lq in Tal's body frame, easing from
// lpc/lqc), crash (what went wrong).
export const S = {
  pos: new V3(), vel: new V3(), quat: new THREE.Quaternion(), w: new V3(), t: 0, moonTh0: 0,
  throttle: 0, warpIdx: 0, hold: 'pro', heat: 0, lit: 1, aMain: 0, aLift: 0, boostAmt: 0, inAtmo: false, inPitch: 0, inYaw: 0,
  hover: false, legs: 0, legsDown: false, landed: false, crash: null, lp: new V3(), lpc: new V3(), lq: new THREE.Quaternion(), lqc: new THREE.Quaternion(),
  camMode: 0, camYaw: 0, camPitch: 0, camZoom: 1, mapYaw: 0, mapPitch: 0.4, mapZoom: 1, launched: false, paused: true,
};
// Derived orbital readouts, relative to the dominant body (Tal inside its sphere of influence, otherwise Veyra).
// agl is height of the ship's centre above the ground below it when over Tal, otherwise the same as alt;
// clear is the height of its lowest point (0 when landed). g is gravity there.
// surf: low over Tal (below SURFACE_ALT), where speed, hs (horizontal) and vv are relative to the
// turning ground, and so are the prograde and retrograde holds. impact: seconds until the ground on
// the current path. brake: seconds until a full-thrust retrograde burn must start to stop just above
// the ground (0 = now, Infinity = no burn needed). With the gear down: tilt from standing straight and slope
// of the ground under the feet (degrees), and ready, the touchdown light ('ok', or what is outside the limits).
export const O = {dom: 0, name: 'Veyra', speed: 0, alt: 0, agl: 0, clear: 0, g: 0, vv: 0, hs: 0, surf: false, impact: Infinity, brake: Infinity, ap: 0, pe: 0, period: 0, altPlanet: 0, altMoon: 0, tilt: 0, slope: 0, ready: ''};

// Contact points in the ship frame, metres.
const FEET = SHIP.feet.map(p => new V3(...p)), HULL = SHIP.hull.map(p => new V3(...p)), ALL = FEET.concat(HULL);
const SHIP_RAD = Math.max(...ALL.map(p => p.length()));   // no contact point is further than this from the centre
const STAND = new V3(...SHIP.stand);                       // points up when the ship stands on its gear
export const STAND_H = -FEET[0].dot(STAND);                // height of the centre above flat ground, standing on the gear
export const BRAKE_STOP_H = STAND_H + BRAKE_CLEAR;         // the braking cue stops the centre this high
// Angle (degrees) between the ship's standing axis and direction u.
const tiltFrom = u => Math.acos(clamp(nose.copy(STAND).applyQuaternion(S.quat).dot(u))) * DEG;

let notify = () => {};
export function setNotifier(fn) { notify = fn; }

export function moonTh(t) { return S.moonTh0 + MOON_N * t; }
export function moonPos(t, out) { const th = moonTh(t); return out.set(MOON_A * Math.cos(th), 0, -MOON_A * Math.sin(th)).applyQuaternion(moonQ); }
export function moonVel(t, out) { const th = moonTh(t); return out.set(-MOON_A * MOON_N * Math.sin(th), 0, -MOON_A * MOON_N * Math.cos(th)).applyQuaternion(moonQ); }
// Tal is tidally locked: its body frame (the frame of W.moon, where tal.js heights live) turns once
// per orbit. Same rotation as W.tiltG > moonPlane > moonPivot in world.js.
export function talQuat(t, out) { return out.copy(moonQ).multiply(qSpin.setFromAxisAngle(yAxis, moonTh(t))); }
// Height of universe point p above Tal's ground (metres). More than 50 km above the highest ground it
// skips the terrain lookup and returns a lower bound (height above the highest possible ground). A spacing
// (metres) leaves out ground detail smaller than that, which is cheaper (see talDetail in tal.js).
export function talAgl(p, t, spacing = 0) {
  moonPos(t, mP2); tB.subVectors(p, mP2); const r = tB.length();
  if (r > MOON_R + TAL_MAX_H + 50e3) return r - MOON_R - TAL_MAX_H;
  tB.applyQuaternion(talQuat(t, qBody).invert()).divideScalar(r);
  return r - MOON_R - talHeight(tB.x, tB.y, tB.z, spacing);
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
  O.agl = O.dom === 1 ? talAgl(S.pos, S.t) : O.alt; O.g = mu / (r * r);
  O.surf = O.dom === 1 && O.agl < (O.surf ? SURFACE_ALT * 1.1 : SURFACE_ALT);
  if (O.surf) O.speed = relVel(tmpB).length(); // the ground's motion is horizontal, so vv is the same either way
  O.hs = Math.sqrt(Math.max(0, O.speed * O.speed - O.vv * O.vv));
  O.clear = O.agl; O.ready = '';
  if (O.surf) {
    uO.copy(tmpA).divideScalar(r);
    if (S.landed) O.clear = 0;
    else { let low = 0; for (const c of (S.legs >= 1 ? ALL : HULL)) low = Math.max(low, -cO.copy(c).applyQuaternion(S.quat).dot(uO)); O.clear = O.agl - low; }
    if (S.legsDown && !S.landed) {
      O.tilt = tiltFrom(uO); O.slope = feetGround(S.quat, gO);
      O.ready = S.legs < 1 ? 'legs' : !S.hover ? 'hover' : O.slope >= LAND_SLOPE ? 'steep' : O.tilt >= LAND_TILT ? 'tilt' : O.hs >= LAND_SIDE ? 'drift' : -O.vv >= LAND_DOWN ? 'fast' : 'ok';
    }
  }
  brakeCue();
}
const uO = new V3(), cO = new V3(), gO = new V3();
// Velocity relative to the dominant body: its centre in orbit, its ground when low over Tal.
export function relVel(out) {
  if (O.surf) return out.subVectors(S.vel, talGroundVel(S.pos, S.t, mV));
  if (O.dom === 1) { moonVel(S.t, mV); return out.subVectors(S.vel, mV); } return out.copy(S.vel);
}

// ---- braking cue ----
// A planar model is enough here: height h, vertical speed vz and horizontal speed vx over the ground,
// gravity g less the curvature term vx²/r (which is what keeps an orbit up), and full main-engine
// thrust against the velocity. burnStop returns how far a burn from this state drops (dh) and
// travels (dx) before the ship stops, and writes the same every PATH_DT seconds along the way into
// path, so the ground can be checked under the whole burn (a weak engine brakes over hundreds of km).
const PATH_DT = 2, path = [];
function burnStop(vz, vx, g, r) {
  let dh = 0, dx = 0, n = 0, t = 0, next = PATH_DT; path.length = 0;
  for (;;) {
    const v = Math.hypot(vx, vz); if (v < 1 || n++ > 4000) break;
    const dt = Math.min(0.5, Math.max(0.05, v / SHIP.aMain / 50)), ge = g - vx * vx / r;
    const ax = -SHIP.aMain * vx / v, az = -SHIP.aMain * vz / v - ge;
    dh += vz * dt + az * dt * dt / 2; dx += vx * dt + ax * dt * dt / 2; vz += az * dt; vx += ax * dt;
    t += dt; if (t >= next) { path.push(dh, dx); next += PATH_DT; }
  }
  return [dh, dx];
}
let cueT = -1, cueAgl = 0;
// The ground along the track ahead: its height above Tal's mean radius every PROF_DX metres along the great
// circle the ship is moving on, without detail finer than the spacing. Rebuilt every few seconds; profS is how
// far the ship has gone along it since.
const PROF_DX = 2500, PROF_N = 260, prof = new Float64Array(PROF_N), cA = new V3();
let profN = 0, profT = -1e9, profS = 0;
function buildProfile(maxDx) {
  moonPos(S.t, mP2); cU.subVectors(S.pos, mP2); const r = cU.length(); cU.divideScalar(r);
  cH.subVectors(S.vel, talGroundVel(S.pos, S.t, mV)); cH.addScaledVector(cU, -cH.dot(cU)); cA.crossVectors(cU, cH).normalize();
  profN = Math.min(PROF_N, Math.ceil(maxDx / PROF_DX) + 2);
  for (let i = 0; i < profN; i++) { cP.copy(cU).applyAxisAngle(cA, i * PROF_DX / r).multiplyScalar(r).add(mP2); prof[i] = r - MOON_R - talAgl(cP, S.t, PROF_DX); }
  profT = S.t; profS = 0;
}
const groundNear = x => { const i = Math.floor(Math.max(0, x) / PROF_DX); return i + 1 >= profN ? prof[profN - 1] : Math.max(prof[i], prof[i + 1]); };
// Works from CUE_ALT down, with speeds relative to Tal's turning ground (as in surface mode, even above it).
function brakeCue() {
  if (O.dom !== 1 || O.agl > CUE_ALT || O.agl < BRAKE_STOP_H + 100 || S.landed) { O.impact = O.brake = Infinity; cueT = -1; return; }
  if (cueT >= 0 && Math.abs(S.t - cueT) < 0.2 && Math.abs(O.agl - cueAgl) < 50) return; // a few times a second is plenty
  cU.subVectors(S.vel, talGroundVel(S.pos, S.t, mV)); const sp = cU.length(), vz = O.vv, vx = Math.sqrt(Math.max(0, sp * sp - vz * vz));
  if (sp < 2) { O.impact = O.brake = Infinity; cueT = -1; return; }
  const since = cueT >= 0 ? S.t - cueT : 0; cueT = S.t; cueAgl = O.agl;
  const r = O.agl + MOON_R, g = GM_M / (r * r), ge = g - vx * vx / r, hc = Math.max(0, O.clear);
  // Coasting: h(t) = h + vz t - ge t²/2 over ground at today's height, until the lowest part of the ship meets it.
  if (ge > 0) O.impact = (vz + Math.sqrt(vz * vz + 2 * ge * hc)) / ge; else O.impact = vz < 0 ? hc / -vz : Infinity;
  if (O.impact === Infinity || S.hover) { O.brake = Infinity; return; } // hovering, the main engine is not what brakes
  if (since === 0 || S.t - profT > 3 || S.t < profT) buildProfile(vx * O.impact + vx * vx / SHIP.aMain); else profS += vx * since;
  const H = S.pos.distanceTo(moonPos(S.t, mP2)) - MOON_R; // the ship's height above the mean radius
  const stopH = T => { // least height above the ground during a burn that starts in T seconds, less the target
    const [dh, dx] = burnStop(vz - ge * T, vx, g, r), h0 = H + vz * T - ge * T * T / 2, x0 = profS + vx * T;
    let m = h0 + dh - groundNear(x0 + dx);
    for (let i = 0; i < path.length; i += 2) m = Math.min(m, h0 + path[i] - groundNear(x0 + path[i + 1]));
    return m - BRAKE_STOP_H;
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
  resetLanding(); orbInfo();
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
  resetLanding(); orbInfo();
}
function resetLanding() { S.hover = false; S.legs = 0; S.legsDown = false; S.landed = false; S.crash = null; ck = null; lastAgl = Infinity; cueT = -1; }

// ---- attitude control ----
const UP_BIAS = 3; // m/s: how hard retrograde leans toward upright when slow over Tal's ground
function holdDir(out) {
  if (S.hold === 'planet') { out.copy(S.pos).negate().normalize(); return true; }
  if (S.hold === 'moon') { moonPos(S.t, out).sub(S.pos).normalize(); return true; }
  relVel(out);
  if (S.hold === 'retro') {
    out.negate();
    // Low over Tal, retrograde leans toward upright as the ship slows, so it ends up standing on its tail
    // at a hover (and leans against any drift) instead of chasing a velocity that shrinks to nothing.
    if (O.surf) out.addScaledVector(radialOut(hB), UP_BIAS * (1 - smooth(5, 30, out.length())));
  }
  if (out.lengthSq() < 1) return false; out.normalize(); return true;
}
// Body-frame angular velocity that brings the nose to the hold direction without overshoot,
// and rolls so the dominant body is "down" once the nose is close.
function holdDesired(out) {
  if (!holdDir(hT)) return false;
  invQ.copy(S.quat).invert(); hT.applyQuaternion(invQ);
  const ax = hT.y, ay = -hT.x, s = Math.hypot(ax, ay), c = -hT.z, ang = Math.atan2(s, c);
  let ux = 0, uy = 0; if (s > 1e-9) { ux = ax / s; uy = ay / s; } else if (c < 0) ux = 1;
  const {rate: RATE, acc: ACC} = SHIP;
  const rate = Math.min(RATE[1], Math.sqrt(2 * ACC[1] * ang) * 0.8); out.set(ux * rate, uy * rate, 0);
  if (ang < 0.6) { radialOut(hU).applyQuaternion(invQ); if (Math.hypot(hU.x, hU.y) > 0.2) { const phi = Math.atan2(-hU.x, hU.y); out.z = Math.sign(phi) * Math.min(RATE[2], Math.sqrt(2 * ACC[2] * Math.abs(phi)) * 0.8); } }
  return true;
}
function snapHold() { if (!holdDir(hT)) return; radialOut(hU); m4.lookAt(zero, hT, hU); tQ.setFromRotationMatrix(m4); S.quat.slerp(tQ, 0.5); }

// ---- hover ----
// Low over Tal, hover mode puts the thrust on the belly lift thrusters. Whenever the stick is let go, the
// ship levels itself, leaning against any drift over the ground (up to LEAN_MAX) so it comes to a stop.
// If the nose is high (just after a braking burn), the main engine carries part of the thrust while the
// ship swings level, so the push stays upward.
const LEAN_K = 0.1, LEAN_MAX = 0.26; // rad of lean per m/s of drift, and at most
export function setHover(on) {
  if (on === S.hover || (on && !O.surf)) return false;
  S.hover = on; S.hold = null; S.throttle = on ? clamp(O.g / SHIP.aLift, 0, 1) : 0; // start at hover thrust; off cuts thrust
  return true;
}
// Where the standing axis should point: up, leaning against the drift.
function levelTarget(out) {
  radialOut(out); relVel(hB); hB.addScaledVector(out, -hB.dot(out)); const v = hB.length();
  if (v > 0.05) out.addScaledVector(hB, -Math.tan(Math.min(LEAN_MAX, v * LEAN_K)) / v).normalize();
  return out;
}
function levelDesired(out) {
  levelTarget(hT).applyQuaternion(invQ.copy(S.quat).invert());
  hU.crossVectors(STAND, hT); const s = hU.length(), ang = Math.atan2(s, STAND.dot(hT));
  if (s < 1e-9) return out.set(0, 0, 0);
  hU.divideScalar(s); const {rate, acc} = SHIP, k = i => Math.min(rate[i], Math.sqrt(2 * acc[i] * ang) * 0.8);
  return out.set(hU.x * k(0), hU.y * k(1), hU.z * k(2));
}
function snapLevel() { levelTarget(hT); tQ.setFromUnitVectors(hU.copy(STAND).applyQuaternion(S.quat), hT).multiply(S.quat); S.quat.slerp(tQ, 0.5); }
// Thrust acceleration (universe frame) for this frame's controls; also sets S.aMain and S.aLift.
const upT = new V3(), yT = new V3();
function thrustAccel(inp, out) {
  fwd.set(0, 0, -1).applyQuaternion(S.quat);
  if (S.hover) {
    const e = Math.asin(clamp(fwd.dot(radialOut(upT)))) * DEG, wm = smooth(35, 65, e), f = inp.boost ? 2 : S.throttle;
    S.aMain = f * wm * SHIP.aMain; S.aLift = f * (1 - wm) * SHIP.aLift;
    out.copy(fwd).multiplyScalar(S.aMain).addScaledVector(yT.set(0, 1, 0).applyQuaternion(S.quat), S.aLift);
  } else { S.aMain = inp.boost ? SHIP.aBoost : S.throttle * SHIP.aMain; S.aLift = 0; out.copy(fwd).multiplyScalar(S.aMain); }
  if (inp.retro) out.addScaledVector(fwd, -SHIP.aRetro);
  return out;
}

function rotate(dt, p, y, r) {
  const {rate: RATE, acc: ACC} = SHIP, steering = Math.abs(p) + Math.abs(y) + Math.abs(r) > 0.12;
  if (S.hover && !steering) levelDesired(des);
  else if (!(S.hold && holdDesired(des))) des.set(p * RATE[0], -y * RATE[1], r * RATE[2]);
  S.w.x += clamp(des.x - S.w.x, -ACC[0] * dt, ACC[0] * dt);
  S.w.y += clamp(des.y - S.w.y, -ACC[1] * dt, ACC[1] * dt);
  S.w.z += clamp(des.z - S.w.z, -ACC[2] * dt, ACC[2] * dt);
  tE.set(S.w.x * dt, S.w.y * dt, S.w.z * dt); tQ.setFromEuler(tE); S.quat.multiply(tQ).normalize();
}

function collide() {
  const r = S.pos.length();
  if (r < R + FLOOR) { tV.copy(S.pos).divideScalar(r); S.pos.copy(tV).multiplyScalar(R + FLOOR); const vr = S.vel.dot(tV); if (vr < 0) S.vel.addScaledVector(tV, -vr); notify('floor', 'Hard deck at 15 km. Landing arrives in a later phase.'); }
  contact();
}

// ---- landing ----
const cW = new V3(), vRel = new V3(), uC = new V3(), gN = new V3(), mF = new V3(), gU = new V3(), d1 = new V3(), d2 = new V3(), qL = new THREE.Quaternion();
const gP = [new V3(), new V3(), new V3(), new V3()];
const pt = (c, q, out) => out.copy(c).applyQuaternion(q).add(S.pos); // ship-frame contact point to the universe frame
// The ground under the four feet (with the ship at attitude q): the plane through the ground points below
// them. Writes its upward normal into out and returns its slope from level, in degrees.
function feetGround(q, out) {
  for (let i = 0; i < 4; i++) { const p = pt(FEET[i], q, gP[i]), h = talAgl(p, S.t); gU.subVectors(p, moonPos(S.t, mF)).normalize(); p.addScaledVector(gU, -h); }
  out.crossVectors(d1.subVectors(gP[3], gP[0]), d2.subVectors(gP[2], gP[1])).normalize();
  gU.subVectors(S.pos, mF).normalize(); if (out.dot(gU) < 0) out.negate();
  return Math.acos(clamp(out.dot(gU))) * DEG;
}
// Speeds rounded up to 0.1 (so 1.52 m/s reads 1.6, not "1.5, safe is under 1.5"), whole numbers from 10.
const upTo = v => v < 10 ? (Math.ceil(v * 10 - 1e-9) / 10).toFixed(1) : String(Math.round(v));
function crash(msg) { S.crash = msg; S.paused = true; S.warpIdx = 0; S.w.set(0, 0, 0); }
// Every sub-step once the ship is within reach of Tal's ground: any hull point below the ground is a
// crash, and with the gear down a foot below the ground is a touchdown.
function contact() {
  moonPos(S.t, mP); uC.subVectors(S.pos, mP); const d = uC.length();
  if (d > MOON_R + TAL_MAX_H + SHIP_RAD + 300) return;
  const agl = talAgl(S.pos, S.t); if (agl > SHIP_RAD + 300) return;
  uC.divideScalar(d); vRel.subVectors(S.vel, talGroundVel(S.pos, S.t, mV));
  const down = -vRel.dot(uC), side = Math.sqrt(Math.max(0, vRel.lengthSq() - down * down));
  let hit = agl < 0;
  for (let i = 0; i < HULL.length && !hit; i++) hit = talAgl(pt(HULL[i], S.quat, cW), S.t) < 0;
  if (hit) { crash('The hull hit the ground at ' + upTo(vRel.length()) + ' m/s.' + (S.legs < 1 ? ' The landing gear was not down yet.' : '')); return; }
  if (S.legs < 1) return;
  let low = Infinity; for (const c of FEET) low = Math.min(low, talAgl(pt(c, S.quat, cW), S.t));
  if (low >= 0) return;
  if (down <= 0 && side < LAND_SIDE) { S.pos.addScaledVector(uC, -low); return; } // lifting off: keep the feet on top of the ground
  touchdown(down, side);
}
function touchdown(down, side) {
  const tilt = tiltFrom(uC), slope = feetGround(S.quat, gN);
  if (down >= LAND_HARD) return crash(`Touched down at ${upTo(down)} m/s. Safe is under ${LAND_DOWN} m/s.`);
  if (side >= LAND_SIDE) return crash(`Touched down sliding sideways at ${upTo(side)} m/s. Safe is under ${LAND_SIDE} m/s.`);
  if (tilt >= LAND_TILT) return crash(`Touched down tilted ${Math.ceil(tilt)}°. Safe is under ${LAND_TILT}°.`);
  if (slope >= LAND_SLOPE) return crash(`The ground there slopes ${Math.ceil(slope)}° and the ship tipped over. Safe is under ${LAND_SLOPE}°.`);
  land(gN);
  if (down >= LAND_DOWN) notify('hard', `Hard landing at ${upTo(down)} m/s. Safe is under ${LAND_DOWN} m/s.`);
  else notify('land', `Landed on Tal. To take off, ${S.hover ? '' : 'hover and '}raise the lift above ${Math.ceil(O.g / SHIP.aLift * 100)}%.`);
}
// Settle onto all four feet: the ship turns to stand along the ground's normal n, keeping its heading, and
// from now on rides with Tal. The settled pose is kept in Tal's body frame; stepLanded() eases into it.
function land(n) {
  nose.copy(STAND).applyQuaternion(S.quat); tQ.setFromUnitVectors(nose, n).multiply(S.quat);
  let low = Infinity; for (const c of FEET) low = Math.min(low, talAgl(pt(c, tQ, cW), S.t));
  moonPos(S.t, mP); talQuat(S.t, qL).invert();
  S.lpc.subVectors(S.pos, mP).applyQuaternion(qL); S.lp.copy(S.pos).addScaledVector(uC, -low).sub(mP).applyQuaternion(qL);
  S.lqc.copy(qL).multiply(S.quat); S.lq.copy(qL).multiply(tQ);
  S.landed = true; S.hold = null; S.w.set(0, 0, 0); talGroundVel(S.pos, S.t, S.vel);
  saveCheckpoint();
}
// Standing on Tal: the pose is fixed in Tal's body frame, so the ship turns with the ground at any time warp.
function stepLanded(dt, T) {
  S.t += T; const k = 1 - Math.exp(-dt * 3);
  S.lpc.lerp(S.lp, k); S.lqc.slerp(S.lq, k);
  talQuat(S.t, qL); S.pos.copy(S.lpc).applyQuaternion(qL).add(moonPos(S.t, mP)); S.quat.copy(qL).multiply(S.lqc);
  talGroundVel(S.pos, S.t, S.vel); S.w.set(0, 0, 0);
}

// Checkpoint for "Try again": saved passing CHECKPOINT_ALT on the way down to Tal, and on every landing.
let ck = null, lastAgl = Infinity;
const CK_VALS = ['t', 'moonTh0', 'throttle', 'hold', 'hover', 'legs', 'legsDown', 'landed'], CK_OBJS = ['pos', 'vel', 'quat', 'w', 'lp', 'lpc', 'lq', 'lqc'];
function saveCheckpoint() { ck = {}; for (const k of CK_VALS) ck[k] = S[k]; for (const k of CK_OBJS) ck[k] = S[k].clone(); }
export function hasCheckpoint() { return ck !== null; }
export function restoreCheckpoint() {
  if (!ck) return false;
  for (const k of CK_VALS) S[k] = ck[k]; for (const k of CK_OBJS) S[k].copy(ck[k]);
  S.crash = null; S.warpIdx = 0; cueT = -1; orbInfo(); lastAgl = O.agl;
  return true;
}

// Highest warp allowed: 100× inside the atmosphere, 10× within 5 km of Tal's ground (so touchdowns are
// checked finely), lower again when a surface is coming up fast. Any warp once landed.
export function maxWarpIdx() {
  if (S.landed) return 3;
  let m = 3; if (O.dom === 0 && O.alt < ATM_TOP) m = 2; if (O.dom === 1 && O.agl < 5000) m = 1;
  const fl = O.dom === 0 ? FLOOR : STAND_H;
  if (O.vv < 0) { const tImp = (O.agl - fl) / (-O.vv); while (m > 0 && tImp < WARPS[m] * 8) m--; }
  return m;
}

// One frame of flight. inp = {pitch, yaw, roll} in [-1,1] plus {boost, retro} booleans.
export function stepFlight(dt, inp) {
  if (S.crash) return;
  const p = clamp(inp.pitch), y = clamp(inp.yaw), r = clamp(inp.roll);
  S.inPitch = p; S.inYaw = y;
  if (Math.abs(p) + Math.abs(y) + Math.abs(r) > 0.12) { S.hold = null; S.warpIdx = 0; }
  S.boostAmt += ((inp.boost ? 1 : 0) - S.boostAmt) * (1 - Math.exp(-dt * 4));
  // Landing gear: down below gearAlt over Tal's ground, up again 15% higher. It moves in real time.
  const legs = O.dom === 1 && (S.landed || O.agl < (S.legsDown ? SHIP.gearAlt * 1.15 : SHIP.gearAlt));
  if (legs !== S.legsDown) { S.legsDown = legs; notify(legs ? 'legs' : 'legsUp', legs ? 'Landing gear down. Once you have slowed down, tap Hover to land on the belly thrusters.' : 'Landing gear up.'); }
  S.legs = clamp(S.legs + (legs ? dt : -dt) / LEG_TIME, 0, 1);
  if (S.hover && !O.surf) { setHover(false); notify('hoverOff', 'Hover off: too high above the ground.'); }
  S.warpIdx = Math.min(S.warpIdx, maxWarpIdx());
  let warp = WARPS[S.warpIdx];
  if (S.landed) {
    // Take off once the engines push up harder than Tal pulls down.
    thrustAccel(inp, thrust); moonPos(S.t, mP); uC.subVectors(S.pos, mP); const d = uC.length();
    if (thrust.dot(uC) / d <= GM_M / (d * d)) { stepLanded(dt, dt * warp); finish(); return; }
    S.landed = false; S.warpIdx = 0; warp = 1;
  }
  if (warp === 1) rotate(dt, p, y, r); else { S.w.set(0, 0, 0); if (S.hover) snapLevel(); else if (S.hold) snapHold(); }
  thrustAccel(inp, thrust);
  // Sub-steps: velocity Verlet, step size limited by local orbital period so time warp stays accurate,
  // and to 0.05 s near Tal's ground so contact is checked finely.
  let T = dt * warp, n = 0; S.heat = 0;
  const nearTal = O.dom === 1 && O.agl < 2000;
  while (T > 1e-6 && n < 300) {
    const rr = S.pos.length(); moonPos(S.t, mP); const dm = S.pos.distanceTo(mP);
    let h = Math.min(T, 5, 0.002 * TAU * Math.sqrt(rr * rr * rr / GM), 0.01 * TAU * Math.sqrt(dm * dm * dm / GM_M));
    if (nearTal) h = Math.min(h, 0.05);
    aExt.copy(thrust);
    const alt = rr - R;
    if (alt < ATM_TOP) {
      h = Math.min(h, 0.25); vAir.crossVectors(omegaP, S.pos); vAir.subVectors(S.vel, vAir);
      const spd = vAir.length(), rho = 1.2 * Math.exp(-alt / SCALE_H);
      aExt.addScaledVector(vAir, -0.5 * rho * spd * SHIP.cda / SHIP.mass);
      S.heat = Math.max(S.heat, clamp(0.5 * rho * spd * spd * spd / 6e7, 0, 1));
    }
    accelAt(S.pos, S.t, pa); S.vel.addScaledVector(pa, h * 0.5).addScaledVector(aExt, h * 0.5);
    S.pos.addScaledVector(S.vel, h); S.t += h;
    accelAt(S.pos, S.t, pa); S.vel.addScaledVector(pa, h * 0.5).addScaledVector(aExt, h * 0.5);
    collide(); T -= h; n++;
    if (S.crash) break;
    if (S.landed) { stepLanded(dt, T); break; }
  }
  finish();
}
function finish() {
  orbInfo();
  const inA = O.dom === 0 && O.alt < ATM_TOP; if (inA && !S.inAtmo) notify('atmo', 'Entering the atmosphere. Drag is slowing you.'); S.inAtmo = inA;
  if (O.dom === 1 && !S.landed && O.vv < 0 && lastAgl >= CHECKPOINT_ALT && O.agl < CHECKPOINT_ALT) saveCheckpoint();
  lastAgl = O.agl;
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
