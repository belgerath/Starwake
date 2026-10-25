// Guards the flight feel and the physics. Run with `npm test`.
// If a change makes one of these fail, it changed how the ship flies: decide on purpose.
import {describe, it, expect, beforeEach} from 'vitest';
import * as THREE from 'three';
import {S, O, initOrbit, stepFlight, relVel} from '../src/physics.js';
import {SUN_DIR, R, FLOOR} from '../src/config.js';

const idle = {pitch: 0, yaw: 0, roll: 0, boost: false, retro: false};
const run = (seconds, inp = idle, dt = 0.05) => { for (let t = 0; t < seconds - 1e-9; t += dt) stepFlight(dt, inp); };
const nose = () => new THREE.Vector3(0, 0, -1).applyQuaternion(S.quat);
const angleDeg = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180 / Math.PI;

beforeEach(() => { initOrbit(SUN_DIR); S.launched = true; S.paused = false; });

describe('orbit', () => {
  it('starts in a circular 400 km orbit at about 7.35 km/s', () => {
    expect(Math.abs(O.ap - 400e3)).toBeLessThan(1e3);
    expect(Math.abs(O.pe - 400e3)).toBeLessThan(1e3);
    expect(O.speed).toBeGreaterThan(7300); expect(O.speed).toBeLessThan(7400);
  });
  it('stays in orbit for a full lap with engines off', () => {
    // Tal is close and heavy, so its tides really do stretch a low orbit by roughly ±15 km per lap.
    S.hold = null; S.warpIdx = 2; run(O.period / 100);
    expect(O.pe).toBeGreaterThan(350e3); expect(O.ap).toBeLessThan(450e3);
  });
  it('time warp gives the same orbit as real time', () => {
    S.hold = null; const lap = O.period;
    S.warpIdx = 0; run(lap); const ap1 = O.ap, pe1 = O.pe;
    initOrbit(SUN_DIR); S.hold = null; S.warpIdx = 3; run(lap / 1000);
    expect(Math.abs(O.ap - ap1)).toBeLessThan(500); expect(Math.abs(O.pe - pe1)).toBeLessThan(500);
  });
  it('a 30 s retrograde burn drops the periapsis below the surface', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(30);
    expect(O.pe).toBeLessThan(0);
  });
  it('never goes below the hard deck', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(60); S.throttle = 0;
    let minR = Infinity; for (let i = 0; i < 400; i++) { run(1); minR = Math.min(minR, S.pos.length()); }
    expect(minR).toBeGreaterThanOrEqual(R + FLOOR - 1);
  });
});

describe('handling', () => {
  it('flips from prograde to retrograde in under 40 s', () => {
    S.hold = 'retro'; let t = 0; const v = new THREE.Vector3();
    while (t < 60) { run(0.5); t += 0.5; if (angleDeg(nose(), relVel(v).normalize().negate()) < 1) break; }
    expect(t).toBeLessThan(40);
  });
  it('stops a full-rate turn within half a second with under 2.5° of overshoot', () => {
    S.hold = null; run(2, {...idle, yaw: 1});
    const atRelease = nose(); run(0.5);
    expect(S.w.length()).toBeLessThan(1e-3);
    expect(angleDeg(atRelease, nose())).toBeLessThan(2.5);
  });
  it('steering cancels the flight computer hold and time warp', () => {
    S.hold = 'pro'; S.warpIdx = 2; run(0.1, {...idle, pitch: 0.5});
    expect(S.hold).toBe(null); expect(S.warpIdx).toBe(0);
  });
});
