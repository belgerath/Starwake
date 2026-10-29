// The flight computer's courses: trips between Tumbledown's orbit and a low orbit of Tal, flown with the ship's
// own engine and fuel under the same gravity as everything else (Tal and the station share one orbit plane).
// To Tal: wait for the window, burn prograde until the coast passes Tal PASS_ALT up, correct on the way if
// needed, then brake into a low orbit round Tal and hand back the controls (landing is the pilot's).
// To Tumbledown, from an orbit of Tal: burn so the fall back to Veyra bottoms out on the station's orbit,
// correct on the way, brake there into an orbit that brings the ship round to that point as the station
// arrives, then close in on a point behind the station, match its speed and ask station control to dock.
// From an orbit near the station's height it skips straight to closing in.
// No DOM. stepCourse(dt) runs once a frame before stepFlight. The pilot steering, or moving the throttle,
// cancels the course. Planning is spread over frames (BUDGET ms each) so the game never stalls.
import * as THREE from 'three';
import {GM, GM_M, R, MOON_R, MOON_A, MOON_N, TAU, SHIP, WARPS} from './config.js';
import {S, O, ST, accelAt, moonPos, moonVel, maxWarpIdx, requestDock, tell} from './physics.js';

const V3 = THREE.Vector3;
export const PASS_ALT = 150e3;  // the course to Tal aims to pass this high over Tal's mean radius
const ORBIT_AP = 400e3;         // and brakes until the orbit round Tal comes no higher than this
const BEHIND = 4000;            // the course to Tumbledown stops this far behind the station (m)
const BUDGET = 6;               // ms of planning per frame
const ALIGN = 3 / 57.3;         // the engine only fires with the nose this close to where it should point
const LEVEL_TOL = 4 / 57.3;     // an orbit of Tal tilted more than this from its equator is levelled before the way back
const LEVEL_STEP = 15 / 57.3;   // at most this much at one crossing of the equator

let C = null;                   // the course under way, or null
let hooks = {dock: requestDock};
// hooks.dock(): what docking means in the game (main.js loads the hangar too); returns whether it started.
export function setCourseHooks(h) { hooks = {...hooks, ...h}; }

// ---- coasting predictions (velocity Verlet, as stepFlight, with steps sized for accuracy) ----
const pA = new V3(), mp = new V3(), mv = new V3(), mq = new V3(), tv = new V3(), tw = new V3();
function stepSize(p, v, t) {
  const r = p.length(); moonPos(t, mp); moonVel(t, mv); const dm = p.distanceTo(mp), vr = Math.max(100, mv.distanceTo(v));
  return Math.max(0.25, Math.min(120, 0.002 * TAU * Math.sqrt(r * r * r / GM), 0.004 * dm / vr));
}
// Coasts (p, v) in place from t for T seconds; each(p, v, t) may return true to stop early. Returns the time.
function coast(p, v, t, T, each) {
  const end = t + T; accelAt(p, t, pA);
  while (t < end - 1e-9) {
    const h = Math.min(end - t, stepSize(p, v, t));
    v.addScaledVector(pA, h / 2); p.addScaledVector(v, h); t += h; accelAt(p, t, pA); v.addScaledVector(pA, h / 2);
    if (each && each(p, v, t)) break;
  }
  return t;
}
// The closest pass to Tal within T: height above Tal's mean radius, when, and the speed relative to Tal then.
function talPass(p0, v0, t0, T) {
  const r = p0.length(), eps = v0.lengthSq() / 2 - GM / r;
  if (eps < 0) { const a = -GM / (2 * eps), e = Math.sqrt(Math.max(0, 1 - tv.crossVectors(p0, v0).lengthSq() / (GM * a))), ra = a * (1 + e);
    if (ra < 0.75 * MOON_A && p0.distanceTo(moonPos(t0, mq)) > 0.3 * MOON_A) return {alt: MOON_A - ra, t: Infinity, v: 0}; } // nowhere near Tal yet
  const p = p0.clone(), v = v0.clone(); let best = Infinity, bt = t0, bv = 0, rMax = 0;
  coast(p, v, t0, T, (q, w, t) => {
    moonPos(t, mq); const d = q.distanceTo(mq), r = q.length(); rMax = Math.max(rMax, r);
    if (d < best) { best = d; bt = t; bv = moonVel(t, tw).distanceTo(w); }
    // through the ground, well past Tal, or falling back from the high point with Tal behind
    return d < MOON_R || (best < 0.4 * MOON_A && d > 2 * best + 3e6) || (rMax > 0.6 * MOON_A && r < rMax - 4e6 && d > best + 2e6);
  });
  return {alt: best - MOON_R, t: bt, v: bv};
}
// The lowest point over Veyra within T: its radius, when, and the state there.
function veyraLow(p0, v0, t0, T) {
  const p = p0.clone(), v = v0.clone(), out = {r: Infinity, t: t0, p: new V3(), v: new V3()};
  coast(p, v, t0, T, (q, w, t) => {
    const r = q.length();
    if (r < out.r) { out.r = r; out.t = t; out.p.copy(q); out.v.copy(w); } else if (out.r < 0.5 * MOON_A && r > out.r + 3e5) return true;
    return r < R || (t - t0 > 8 * 3600 && out.r > 0.8 * MOON_A); // into the ground, or not falling back at all
  });
  return out;
}
// Where a body is after coasting T from now (for the station: it feels the same gravity).
function ahead(p0, v0, T) { const p = p0.clone(), v = v0.clone(); coast(p, v, S.t, T); return {p, v}; }
const talRel = (v, t) => v.clone().sub(moonVel(t, tw));

// The orbit round Tal: its normal relative to Tal, and the tilt from Tal's equator (the shared orbit plane; an
// orbit the wrong way round counts as level too).
function talNormal(out) { moonPos(S.t, mq); moonVel(S.t, tw); return out.crossVectors(tv.subVectors(S.pos, mq), new V3().subVectors(S.vel, tw)).normalize(); }
const eqNormal = () => new V3().crossVectors(moonPos(S.t, mq), moonVel(S.t, tw)).normalize();
function talTilt() { const c = talNormal(new V3()).dot(eqNormal()); return Math.acos(Math.min(1, Math.abs(c))); }
// The turn about the radius (signed angle) that brings the orbit round Tal flattest onto the equator from here,
// with the position and velocity relative to Tal.
function levelTurn() {
  const r = S.pos.clone().sub(moonPos(S.t, mq)).normalize(), v = S.vel.clone().sub(moonVel(S.t, tw)), h = talNormal(new V3());
  let n = eqNormal(); if (n.dot(h) < 0) n.negate(); // the same way round
  const hp = h.clone().addScaledVector(r, -h.dot(r)).normalize(), np = n.clone().addScaledVector(r, -n.dot(r)).normalize();
  return {r, v, angle: Math.atan2(new V3().crossVectors(hp, np).dot(r), hp.dot(np))};
}

// ---- what the pilot can ask for ----
const kms = v => (v / 1000).toFixed(1);
const stationR = () => ST.pos.length();
// The courses on offer here and now: [{dest, label, ok, why}].
export function courseOptions() {
  const busy = S.dock ? 'Docked.' : S.landed ? 'Landed: take off and climb into orbit first.' : S.crash ? 'Crashed.' : '';
  const tal = {dest: 'tal', label: 'Course to Tal', ok: false, why: busy};
  const st = {dest: 'station', label: 'Course to Tumbledown', ok: false, why: busy};
  if (!busy) {
    if (O.dom === 1) tal.why = 'Already at Tal.';
    else if (O.ap === Infinity || O.pe < 150e3) tal.why = 'Get into a steady orbit of Veyra first.';
    else if (S.fuel < needTal()) tal.why = `Not enough fuel: the trip needs about ${kms(needTal())} km/s, the tanks hold ${kms(S.fuel)}.`;
    else tal.ok = true;
    if (O.dom === 1) {
      if (O.ap === Infinity || O.pe < 20e3) st.why = 'Climb into an orbit of Tal first, more than 20 km up.';
      else if (S.fuel < 4200) st.why = `Not enough fuel: the trip needs about 4.2 km/s, the tanks hold ${kms(S.fuel)}.`;
      else st.ok = true;
    } else if (O.pe < 150e3 || Math.abs(S.pos.length() - stationR()) > 300e3 || O.ap > 1500e3) st.why = 'Get into an orbit near Tumbledown\'s height first.';
    else if (S.fuel < 800) st.why = 'Not enough fuel to close in on the station.';
    else st.ok = true;
  }
  return [tal, st];
}
function needTal() { const r1 = S.pos.length(); return Math.sqrt(GM / r1) * (Math.sqrt(2 * MOON_A / (r1 + MOON_A)) - 1) + 1400; }

export function startCourse(dest) {
  const o = courseOptions().find(x => x.dest === dest); if (!o || !o.ok) return o ? o.why : 'No such course.';
  C = {dest, phase: '', text: '', lastHold: undefined, lastThrottle: undefined, lastWarp: undefined, userWarp: 3, tries: 0};
  S.hover = false;
  if (dest === 'tal') phase('plan', {gen: planTal()});
  else if (O.dom === 1) phase(talTilt() > LEVEL_TOL ? 'level' : 'plan', {gen: planReturn()}); // the plan runs after any levelling
  else phase('intercept');
  return '';
}
export function cancelCourse(msg) { if (!C) return; C = null; S.hold = null; S.throttle = 0; if (msg) tell('course', msg); }
export const courseActive = () => !!C;
// For the HUD: which course, and what it is doing (null when none).
export function courseStatus() { return C ? {dest: C.dest, text: C.text} : null; }

function phase(name, extra = {}) { Object.assign(C, {phase: name, t0: S.t, fuel0: S.fuel, userWarp: 3, pred: null}, extra); }
function done(msg) { C = null; S.hold = null; S.throttle = 0; tell('course', msg); }

// ---- the frame step ----
export function stepCourse(dt) {
  if (!C) return;
  if (S.crash || S.landed || S.dock) { C = null; return; }
  // The pilot took over: the stick drops the hold (stepFlight), or the throttle moved.
  if ((C.lastHold !== undefined && S.hold !== C.lastHold) || (C.lastThrottle !== undefined && Math.abs(S.throttle - C.lastThrottle) > 1e-6)) { cancelCourse('Course cancelled. You have the controls.'); return; }
  if (C.lastWarp !== undefined && S.warpIdx !== Math.min(C.lastWarp, maxWarpIdx())) C.userWarp = S.warpIdx; // the pilot chose a time warp: no faster this phase
  run[C.phase](dt);
  if (!C) return;
  C.lastHold = S.hold; C.lastThrottle = S.throttle; C.lastWarp = S.warpIdx;
}
// Time warp for a wait of `left` seconds: as fast as is safe, never past the pilot's choice in this phase.
function warpFor(left, cap = 3) {
  let i = left > 4000 ? 3 : left > 150 ? 2 : left > 20 ? 1 : 0;
  S.warpIdx = Math.min(i, cap, C.userWarp);
}
const aligned = dir => tv.set(0, 0, -1).applyQuaternion(S.quat).angleTo(dir) < ALIGN;
function holdDirection(dir) { S.hold = 'dir'; S.holdDir.copy(dir).normalize(); }
const fmtT = s => s < 90 ? Math.ceil(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round(s % 3600 / 60) + ' min';
const fmtKm = m => Math.max(0, Math.round(m / 1000)).toLocaleString('en-US') + ' km';
// A prediction, worked out again at most every 20 s of game time while far is true of the last one (it changes
// slowly then), and every frame near the end. Kept per phase.
function cached(work, far) {
  if (!C.pred || !(C.pred.far && S.t - C.predT < 20)) { const r = work(); C.pred = {r, far: far(r)}; C.predT = S.t; }
  return C.pred.r;
}
function plan(dt) {
  C.text = 'Plotting a course'; S.throttle = 0; S.warpIdx = 0; S.hold = null;
  const end = performance.now() + (dt > 0 ? BUDGET : Infinity);
  for (;;) { const r = C.gen.next(); if (r.done) { C.gen = null; return r.value; } if (performance.now() > end) return undefined; }
}

const run = {
  // -- to Tal --
  plan(dt) {
    const p = plan(dt); if (p === undefined) return;
    if (!p) return done(C.dest === 'tal' ? 'No way to Tal found from this orbit.' : 'No way back found from this orbit.');
    phase('wait', p);
  },
  wait() {
    const left = C.tStart - S.t; S.throttle = 0; S.hold = 'pro'; warpFor(left);
    C.text = 'Burn in ' + fmtT(Math.max(0, left));
    if (left <= 0) phase(C.dest === 'tal' ? 'burn' : 'burnBack');
  },
  burn() { // prograde until the pass over Tal comes down to PASS_ALT
    const pass = cached(() => talPass(S.pos, S.vel, S.t, 16 * 3600), p => p.alt - PASS_ALT > 3e6), rem = pass.alt - PASS_ALT;
    C.text = 'Burning: Tal pass ' + fmtKm(pass.alt);
    if (rem <= 0 || C.fuel0 - S.fuel > C.dv + 700) { S.throttle = 0; C.passT = pass.t; return phase('coast', {checks: [0.4, 0.75], from: S.t}); }
    burnStep('pro', ...taper(rem, 3e6, 3e5));
  },
  coast() {
    S.throttle = 0; S.hold = null; const left = C.passT - S.t;
    C.text = 'Coasting: Tal in ' + fmtT(Math.max(0, left));
    const frac = (S.t - C.from) / Math.max(1, C.passT - C.from);
    if (C.checks.length && frac >= C.checks[0]) {
      C.checks.shift(); const pass = talPass(S.pos, S.vel, S.t, 16 * 3600); C.passT = pass.t;
      if (Math.abs(pass.alt - PASS_ALT) > 40e3) { const dv = correction(v => [talPass(S.pos, v, S.t, 16 * 3600).alt - PASS_ALT]); if (dv) return phase('fix', {dv, next: 'coast'}); }
    }
    // Brake around the closest pass: start half the burn before it.
    const pass = left < 4 * 3600 ? cached(() => talPass(S.pos, S.vel, S.t, 6 * 3600), p => p.t - S.t > 1800) : null;
    if (pass) {
      C.passT = pass.t; const rp = pass.alt + MOON_R, vT = Math.sqrt(GM_M * (2 / rp - 2 / (2 * rp + ORBIT_AP - pass.alt)));
      const tBurn = Math.max(0, pass.v - vT) / SHIP.aMain;
      if (pass.t - S.t <= tBurn / 2 + 60) return phase('brakeWait', {tStart: pass.t - tBurn / 2});
    }
    warpFor(left - 1800);
  },
  brakeWait() {
    const left = C.tStart - S.t; S.throttle = 0; S.hold = 'retro'; warpFor(left);
    C.text = 'Braking in ' + fmtT(Math.max(0, left)); if (left <= 0) phase('brake');
  },
  brake() { // retrograde (relative to Tal) until the orbit closes, no higher than ORBIT_AP
    C.text = 'Braking into orbit'; S.hold = 'retro';
    if (O.dom === 1 && O.ap < ORBIT_AP) return done(`In orbit over Tal, ${fmtKm(O.pe)} by ${fmtKm(O.ap)}. You have the controls.`);
    burnStep('retro', 1, 1);
  },
  // -- corrections on the way (a small burn in any direction) --
  fix() {
    const left = C.dv.length() - (C.fuel0 - S.fuel); C.text = 'Correcting course';
    if (left <= 0.5) { S.throttle = 0; return phase(C.next, {checks: C.checks || [], from: C.from, passT: C.passT, lowT: C.lowT}); }
    holdDirection(C.dv); S.warpIdx = Math.min(left > 60 ? 1 : 0, C.userWarp);
    S.throttle = aligned(C.dv) ? Math.min(1, Math.max(0.03, left / (SHIP.aMain * 2))) : 0;
  },

  // -- back to Tumbledown --
  level() { // wait for the next crossing of Tal's equator
    C.text = 'Levelling the orbit'; S.throttle = 0; S.hold = null;
    const n = eqNormal(), p = S.pos.clone().sub(moonPos(S.t, mq)), v = S.vel.clone().sub(moonVel(S.t, tw)), side = Math.sign(p.dot(n)) || 1;
    // Coast to the crossing relative to Tal (its own pull dominates this close).
    let tc = 0; const q = p.clone(), w = v.clone(), dt = 2;
    for (; tc < 4 * 3600; tc += dt) { const r = q.length(); w.addScaledVector(q, -GM_M / (r * r * r) * dt); q.addScaledVector(w, dt); if (Math.sign(q.dot(n)) !== side) break; }
    const tBurn = 2 * w.length() * Math.sin(Math.min(talTilt(), LEVEL_STEP) / 2) / SHIP.aMain;
    if (tc - tBurn / 2 <= 20) return phase('levelBurn', {gen: C.gen});
    warpFor(tc - tBurn / 2 - 20, 2);
  },
  levelBurn() { // turn the velocity about the radius toward the equator, keeping its speed: at most LEVEL_STEP a crossing
    C.text = 'Levelling the orbit';
    const rel = levelTurn(), a = Math.abs(rel.angle); if (C.ang0 === undefined) { C.ang0 = a; C.v0 = rel.v.length(); }
    const left = Math.max(0, Math.min(a, LEVEL_STEP - (C.ang0 - a))); // what is still to turn at this crossing
    // The target keeps the speed the orbit had (this low, a few m/s lost would bring it down onto the ground).
    const dv = rel.v.clone().applyAxisAngle(rel.r, Math.sign(rel.angle) * left).setLength(C.v0).sub(rel.v);
    if (left < 0.1 / 57.3 && dv.length() < 0.5) { S.throttle = 0; return phase(talTilt() < 1 / 57.3 ? 'plan' : 'level', {gen: C.gen, ang0: undefined}); }
    holdDirection(dv); S.warpIdx = Math.min(1, C.userWarp);
    S.throttle = aligned(dv) ? Math.min(1, Math.max(0.05, dv.length() / (SHIP.aMain * 2))) : 0;
  },
  burnBack() { // prograde (relative to Tal) until the fall to Veyra bottoms out on the station's orbit
    const low = cached(() => veyraLow(S.pos, S.vel, S.t, 40 * 3600), l => l.r - stationR() > 2e6), rem = low.r - stationR();
    C.text = 'Burning: low point ' + fmtKm(low.r - R);
    if (rem <= 0 || C.fuel0 - S.fuel > C.dv + 500) { S.throttle = 0; C.lowT = low.t; return phase('fall', {checks: [0.4, 0.75], from: S.t, lowT: low.t}); }
    burnStep('pro', ...taper(rem, 2e6, 2e5));
  },
  fall() {
    S.throttle = 0; S.hold = null; const left = C.lowT - S.t;
    C.text = 'Coasting: Veyra in ' + fmtT(Math.max(0, left));
    const frac = (S.t - C.from) / Math.max(1, C.lowT - C.from);
    if (C.checks.length && frac >= C.checks[0]) {
      C.checks.shift(); const low = veyraLow(S.pos, S.vel, S.t, 40 * 3600); C.lowT = low.t;
      const hSt = new V3().crossVectors(ST.pos, ST.vel).normalize(), miss = l => [l.r - stationR(), l.p.dot(hSt)];
      const m = miss(low); if (Math.hypot(m[0], m[1]) > 15e3) { const dv = correction(v => miss(veyraLow(S.pos, v, S.t, 40 * 3600))); if (dv) return phase('fix', {dv, next: 'fall'}); }
    }
    if (left < 3600) {
      // Brake at the low point into an orbit that comes round to it again just as the station gets there.
      const low = cached(() => veyraLow(S.pos, S.vel, S.t, 2 * 3600), l => l.t - S.t > 1800); C.lowT = low.t;
      const st = ahead(ST.pos, ST.vel, low.t - S.t), Tst = TAU * Math.sqrt(stationR() ** 3 / GM), h = new V3().crossVectors(st.p, st.v).normalize();
      let go = Math.atan2(new V3().crossVectors(st.p, low.p).dot(h), st.p.clone().normalize().dot(low.p.clone().normalize())); if (go < 0) go += TAU;
      const {T, laps} = phasingLap(go), aT = Math.cbrt(GM * (T / TAU) ** 2), tBurn = captureTarget(low.p, low.v, aT).sub(low.v).length() / SHIP.aMain;
      if (low.t - S.t <= tBurn / 2 + 60) return phase('captureWait', {tStart: low.t - tBurn / 2, aT, meetT: low.t + laps * T, lap: T});
    }
    warpFor(left - 1800);
  },
  captureWait() {
    const left = C.tStart - S.t; S.throttle = 0; S.hold = 'retro'; warpFor(left);
    C.text = 'Braking in ' + fmtT(Math.max(0, left)); if (left <= 0) phase('capture', {aT: C.aT, meetT: C.meetT, lap: C.lap});
  },
  capture() { // brake into the station's orbit plane, onto the orbit whose period meets the station
    C.text = 'Braking into orbit';
    const dv = captureTarget(S.pos, S.vel, C.aT).sub(S.vel);
    if (dv.length() < 2) { S.throttle = 0; return phase('phasing', {meetT: C.meetT, lap: C.lap}); }
    holdDirection(dv); S.warpIdx = Math.min(1, C.userWarp);
    S.throttle = aligned(dv) ? Math.min(1, Math.max(0.05, dv.length() / (SHIP.aMain * 2))) : 0;
  },
  phaseBurn() { // from an orbit near the station's: prograde until the period brings the ship back as it arrives
    C.text = 'Burning to catch Tumbledown';
    const dv = captureTarget(S.pos, S.vel, C.aT).sub(S.vel);
    if (dv.length() < 1) { S.throttle = 0; return phase('phasing', {meetT: C.meetT, lap: C.lap}); }
    holdDirection(dv); S.warpIdx = Math.min(1, C.userWarp);
    S.throttle = aligned(dv) ? Math.min(1, Math.max(0.05, dv.length() / (SHIP.aMain * 2))) : 0;
  },
  phasing() { // half a lap before the meeting (at the high point, where changes are cheap) work out the way in
    S.throttle = 0; S.hold = null; const left = C.meetT - S.t, start = Math.max(1500, C.lap / 2);
    C.text = 'Catching Tumbledown: ' + fmtT(Math.max(0, left)); warpFor(left - start);
    if (left < start) phase('intercept', {meetT: C.meetT});
  },
  intercept() { // a burn that reaches a point behind the station after tau
    if (O.stDist < 8000 && O.stSpeed < 20) return dock();
    if (!C.meetT && O.stDist > 300e3) return phase('phaseBurn', phaseHere());
    if (++C.tries > 6) return done('Could not close in on Tumbledown. You have the controls.');
    const t0 = C.meetT ? Math.max(300, C.meetT - S.t) : Math.min(2400, Math.max(300, O.stDist / 80));
    let best = null, tau = t0;
    for (const k of [1, 0.75, 1.3, 0.55, 1.7, 2.2]) { // the planned time first, then others if it is costly or unsafe
      const T = Math.max(240, t0 * k), dv = interceptDv(T); if (!dv || !clearOfAir(dv, T)) continue;
      if (!best || dv.length() < best.length()) { best = dv; tau = T; } if (k === 1 && dv.length() < 300) break;
    }
    const dv = best;
    if (!dv || dv.length() > Math.min(2500, S.fuel - 200)) return done('Tumbledown is out of reach from here. You have the controls.');
    phase('fixClose', {dv, arrive: S.t + tau, meetT: 0, tries: C.tries});
  },
  fixClose() { // the intercept burn, worked out again every frame from where the ship is, then the coast to the meeting
    C.text = 'Closing in: ' + fmtKm(O.stDist);
    const tau = C.arrive - S.t, dv = tau > 120 ? interceptDv(tau, C.dv) : null;
    if (dv && dv.length() > 0.5) { C.dv = dv; holdDirection(dv); S.warpIdx = Math.min(dv.length() > 60 ? 1 : 0, C.userWarp); S.throttle = aligned(dv) ? Math.min(1, Math.max(0.03, dv.length() / (SHIP.aMain * 2))) : 0; return; }
    S.throttle = 0;
    const rel = ahead(S.pos, S.vel, Math.max(0, C.arrive - S.t)).v.sub(ahead(ST.pos, ST.vel, Math.max(0, C.arrive - S.t)).v).length();
    phase('closeCoast', {arrive: C.arrive, tMatch: C.arrive - rel / SHIP.aMain / 2 - 40, tries: C.tries});
  },
  closeCoast() {
    const left = C.tMatch - S.t; S.throttle = 0; S.hold = null; warpFor(left);
    C.text = 'Closing in: ' + fmtKm(O.stDist); if (left <= 0) phase('match', {tries: C.tries});
  },
  match() { // burn against the speed relative to the station until it is gone
    const rel = new V3().subVectors(ST.vel, S.vel), d = rel.length(); C.text = 'Matching speed: ' + Math.round(d) + ' m/s';
    if (d < 0.8) { S.throttle = 0; return phase('intercept', {tries: C.tries}); }
    holdDirection(rel); S.warpIdx = Math.min(d > 20 ? 1 : 0, C.userWarp); S.throttle = aligned(rel) ? Math.min(1, Math.max(0.03, d / (SHIP.aMain * 1.5))) : 0;
  },
};
// A phasing orbit: the ship goes round k times (period T each, from 1.03 to 1.35 station periods, so the
// orbit stays small and matching speed later is cheap) while the station covers `go` (radians) plus whole laps.
function phasingLap(go) {
  const Tst = TAU * Math.sqrt(stationR() ** 3 / GM), base = go / TAU * Tst;
  for (let k = 1; k <= 8; k++) for (let m = 0; m <= k + 1; m++) { const T = (base + m * Tst) / k; if (T >= 1.03 * Tst && T <= 1.35 * Tst) return {T, laps: k}; }
  let T = base; while (T < 1.05 * Tst) T += Tst; return {T, laps: 1};
}
// The velocity at p on an orbit of size aT in the station's plane, keeping the radial speed v has now.
function captureTarget(p, v, aT) {
  const h = new V3().crossVectors(ST.pos, ST.vel).normalize(), up = p.clone().normalize(), r = p.length(), vr = v.dot(up);
  const vh = Math.sqrt(Math.max(0, GM * (2 / r - 1 / aT) - vr * vr));
  return up.clone().multiplyScalar(vr).addScaledVector(new V3().crossVectors(h, up).normalize(), vh);
}
// For phaseBurn: the orbit size (aT) whose period brings the ship back to where it is now just as the station
// gets there, and when that is.
function phaseHere() {
  const Tst = TAU * Math.sqrt(stationR() ** 3 / GM), h = new V3().crossVectors(ST.pos, ST.vel).normalize();
  let go = Math.atan2(new V3().crossVectors(ST.pos, S.pos).dot(h), ST.pos.clone().normalize().dot(S.pos.clone().normalize())); if (go < 0) go += TAU;
  const {T, laps} = phasingLap(go);
  return {aT: Math.cbrt(GM * (T / TAU) ** 2), meetT: S.t + laps * T, lap: T};
}
// One frame of a burn along a prograde or retrograde hold, once the nose points there.
function burnStep(hold, throttle, warp) {
  S.hold = hold; const d = new V3(); if (!holdDirNow(d) || !aligned(d)) { S.throttle = 0; S.warpIdx = 0; return; }
  S.throttle = throttle; S.warpIdx = Math.min(warp, C.userWarp);
}
// Full thrust while the miss is above far, a third of it above near, then a trickle to finish precisely.
const taper = (rem, far, near) => rem > far ? [1, 2] : rem > near ? [0.3, 1] : [0.06, 0];
// The direction a prograde or retrograde hold points now (as physics computes it, in orbit).
function holdDirNow(out) {
  out.copy(S.vel); if (O.dom === 1) out.sub(moonVel(S.t, tw));
  if (S.hold === 'retro') out.negate(); return out.lengthSq() > 1 && out.normalize();
}
function dock() {
  S.throttle = 0; S.hold = null;
  if (hooks.dock()) { C = null; tell('course', 'Tumbledown control has you. Bringing you in.'); }
  else done('Station control did not answer. You have the controls.');
}

// A small velocity change that brings the misses f(v) (metres; one or two of them, as a function of the
// velocity now) to zero: the smallest change that does it to first order (finite differences), shortened until
// it at least halves the miss. Null when none helps.
function correction(f) {
  const v0 = S.vel, e0 = f(v0.clone()), n = e0.length, J = [];
  const axes = [v0.clone().normalize(), S.pos.clone().normalize(), new V3().crossVectors(S.pos, v0).normalize()];
  for (const ax of axes) { const e = f(v0.clone().add(ax)); J.push(e.map((x, i) => x - e0[i])); } // J[axis][miss], per m/s
  // Least change: dv = Jt (J Jt)^-1 (-e0), with J Jt an n×n matrix (n = 1 or 2).
  const JJ = [...Array(n)].map((_, i) => [...Array(n)].map((_, k) => J.reduce((s, col) => s + col[i] * col[k], 0)));
  let y;
  if (n === 1) { if (Math.abs(JJ[0][0]) < 1e-9) return null; y = [-e0[0] / JJ[0][0]]; }
  else { const det = JJ[0][0] * JJ[1][1] - JJ[0][1] * JJ[1][0]; if (Math.abs(det) < 1e-9) return null; y = [(-e0[0] * JJ[1][1] + e0[1] * JJ[0][1]) / det, (e0[0] * JJ[1][0] - e0[1] * JJ[0][0]) / det]; }
  const size = e => Math.hypot(...e), full = new V3();
  axes.forEach((ax, a) => full.addScaledVector(ax, J[a].reduce((s, x, i) => s + x * y[i], 0)));
  let k = Math.min(1, 400 / full.length());
  for (let i = 0; i < 6; i++, k *= 0.5) { const dv = full.clone().multiplyScalar(k); if (size(f(v0.clone().add(dv))) < 0.5 * size(e0)) return dv; }
  return null;
}
// Whether the coast after the change dv stays above 150 km for T seconds.
function clearOfAir(dv, T) { let low = Infinity; coast(S.pos.clone(), S.vel.clone().add(dv), S.t, T, q => { low = Math.min(low, q.length()); return low < R + 150e3; }); return low >= R + 150e3; }
// The velocity change now that puts the ship BEHIND metres behind the station after tau seconds (Newton's
// method on the coasting path, its Jacobian by finite differences).
function interceptDv(tau, guess) {
  const st = ahead(ST.pos, ST.vel, tau), target = st.p.clone().addScaledVector(st.v.clone().normalize(), -BEHIND);
  const miss = dv => { const s = ahead(S.pos, S.vel.clone().add(dv), tau); return s.p.sub(target); };
  const dv = guess ? guess.clone() : target.clone().sub(ahead(S.pos, S.vel, tau).p).divideScalar(tau), J = new THREE.Matrix3(), col = [new V3(), new V3(), new V3()];
  for (let k = 0; k < 10; k++) {
    const m = miss(dv); if (m.length() < 30) return dv;
    for (let i = 0; i < 3; i++) { const e = new V3(); e.setComponent(i, 1); col[i].copy(miss(dv.clone().add(e))).sub(m); }
    J.set(col[0].x, col[1].x, col[2].x, col[0].y, col[1].y, col[2].y, col[0].z, col[1].z, col[2].z);
    if (Math.abs(J.determinant()) < 1e-9) return null;
    dv.add(m.applyMatrix3(J.invert()).negate());
    if (!(dv.length() < 5000)) return null;
  }
  return miss(dv).length() < 500 ? dv : null;
}

// ---- planning (generators: they yield between trials so a frame can stop when its time is up) ----
// To Tal: when to burn and about how hard. A Hohmann estimate gives the window; around it, find the first
// moment when some prograde impulse makes the coast pass Tal within PASS_ALT.
function* planTal() {
  const r1 = S.pos.length(), a = (r1 + MOON_A) / 2, ns = Math.sqrt(GM / (r1 * r1 * r1));
  const dvH = Math.sqrt(GM / r1) * (Math.sqrt(2 * MOON_A / (r1 + MOON_A)) - 1), tH = Math.PI * Math.sqrt(a * a * a / GM);
  const n = new V3().crossVectors(S.pos, S.vel).normalize(); moonPos(S.t, mq);
  let ph = Math.atan2(new V3().crossVectors(S.pos, mq).dot(n), S.pos.clone().normalize().dot(mq.clone().normalize())); // Tal ahead of the ship
  const syn = TAU / (ns - MOON_N), lead = dvH / SHIP.aMain / 2 + 90;
  let tGuess = ((((ph - (Math.PI - MOON_N * tH)) % TAU) + TAU) % TAU) / (ns - MOON_N);
  while (tGuess - 900 < lead) tGuess += syn;
  const p = S.pos.clone(), v = S.vel.clone(); let t = coast(p, v, S.t, tGuess - 900);
  for (let w = tGuess - 900; w <= tGuess + 900; w += 60) {
    if (w > tGuess - 900) t = coast(p, v, t, 60);
    for (let dv = dvH - 100; dv <= dvH + 300; dv += 20) {
      const pass = talPass(p, v.clone().multiplyScalar(1 + dv / v.length()), t, 16 * 3600); yield;
      if (pass.alt <= PASS_ALT) return {tStart: t - dv / SHIP.aMain / 2, dv};
    }
  }
  return null;
}
// Back from an orbit of Tal: when to burn prograde (relative to Tal) and how hard, so the fall bottoms out
// on the station's orbit for the least fuel. Only where the burn sends the ship backwards along Tal's orbit.
function* planReturn() {
  const rT = stationR(), Tt = Math.min(O.period, 4 * 3600), lead = 150;
  const p = S.pos.clone(), v = S.vel.clone(); let t = coast(p, v, S.t, lead), best = null;
  for (let w = lead; w < lead + Tt; w += 60, t = coast(p, v, t, 60)) {
    const u = talRel(v, t).normalize(); if (u.dot(moonVel(t, tw).normalize()) > -0.3) continue;
    const f = dv => veyraLow(p, v.clone().addScaledVector(u, dv), t, 40 * 3600).r - rT;
    let lo = 400, flo = f(lo); yield; if (flo < 0) continue;
    for (let hi = 500; hi <= 2000; hi += 100) {
      const fhi = f(hi); yield;
      if (fhi < 0) { for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (f(m) < 0) hi = m; else lo = m; yield; } break; }
      lo = hi;
    }
    if (lo < 1990 && (!best || lo < best.dv)) best = {tStart: t - lo / SHIP.aMain / 2, dv: lo};
  }
  return best;
}
