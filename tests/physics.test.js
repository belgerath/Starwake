// Guards the flight feel and the physics. Run with `npm test`.
// If a change makes one of these fail, it changed how the ship flies: decide on purpose.
import {describe, it, expect, beforeEach} from 'vitest';
import * as THREE from 'three';
import {S, O, initOrbit, initTalOrbit, stepFlight, relVel, talQuat, talAgl, moonPos, moonVel, talGroundVel, orbInfo, omegaT, setNotifier, hasCheckpoint, restoreCheckpoint, setHover, STAND_H} from '../src/physics.js';
import {SUN_DIR, R, FLOOR, MOON_R, MOON_A, MOON_INC, TAL_START_ALT, TILT, BRAKE_CLEAR, SHIP} from '../src/config.js';

const SUN = new THREE.Vector3(...SUN_DIR).normalize();
const idle = {pitch: 0, yaw: 0, roll: 0, boost: false, retro: false};
const run = (seconds, inp = idle, dt = 0.05) => { for (let t = 0; t < seconds - 1e-9; t += dt) stepFlight(dt, inp); };
const nose = () => new THREE.Vector3(0, 0, -1).applyQuaternion(S.quat);
const angleDeg = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180 / Math.PI;

beforeEach(() => { initOrbit(SUN); S.launched = true; S.paused = false; });

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
    initOrbit(SUN); S.hold = null; S.warpIdx = 3; run(lap / 1000);
    expect(Math.abs(O.ap - ap1)).toBeLessThan(500); expect(Math.abs(O.pe - pe1)).toBeLessThan(500);
  });
  it('a 60 s retrograde burn drops the periapsis below the surface', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(60); // the transport's engine is weak: 4 m/s²
    expect(O.pe).toBeLessThan(0);
  });
  it('never goes below the hard deck', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(300); S.throttle = 0;
    let minR = Infinity; for (let i = 0; i < 1500; i++) { run(1); minR = Math.min(minR, S.pos.length()); }
    expect(minR).toBeGreaterThanOrEqual(R + FLOOR - 1);
    expect(minR).toBeLessThan(R + FLOOR + 1000); // it really did come down to the deck
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

describe('Tal', () => {
  beforeEach(() => { initTalOrbit(SUN); });
  it('"Start above Tal" is a circular orbit 30 km up, on the sunlit side', () => {
    expect(O.dom).toBe(1);
    expect(Math.abs(O.ap - TAL_START_ALT)).toBeLessThan(1e3); expect(Math.abs(O.pe - TAL_START_ALT)).toBeLessThan(1e3);
    const up = S.pos.clone().sub(moonPos(S.t, new THREE.Vector3())).normalize();
    expect(up.dot(SUN)).toBeGreaterThan(0.3);
  });
  it('stays clear of the ground for a full lap with engines off', () => {
    S.hold = null; S.warpIdx = 2; const lap = O.period; let minAgl = Infinity;
    for (let t = 0; t < lap / 100; t += 0.5) { run(0.5); minAgl = Math.min(minAgl, O.agl); }
    expect(minAgl).toBeGreaterThan(10e3);
  });
  it('body frame matches the scene graph that draws Tal', () => {
    // world.js: tiltG (tilt about z) > moonPlane (rotation.x = MOON_INC) > moonPivot (rotation.y = moonTh) > Tal
    const tilt = new THREE.Group(), plane = new THREE.Group(), pivot = new THREE.Group(), tal = new THREE.Group();
    tilt.quaternion.setFromEuler(new THREE.Euler(0, 0, TILT)); plane.rotation.x = MOON_INC; tal.position.set(MOON_A, 0, 0);
    tilt.add(plane); plane.add(pivot); pivot.add(tal);
    S.t = 12345; pivot.rotation.y = S.moonTh0 + Math.sqrt((3.456e14 + 4.03e12) / MOON_A ** 3) * S.t; tilt.updateMatrixWorld(true);
    const q = tal.getWorldQuaternion(new THREE.Quaternion()), p = tal.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(q.dot(talQuat(S.t, new THREE.Quaternion())))).toBeGreaterThan(1 - 1e-9);
    expect(p.distanceTo(moonPos(S.t, new THREE.Vector3()))).toBeLessThan(1);
  });
});

describe('flying over Tal\'s ground', () => {
  const V = () => new THREE.Vector3();
  beforeEach(() => { initTalOrbit(SUN); });
  // Put the ship h metres above the ground straight below it, keeping its velocity.
  const dropTo = h => { const m = moonPos(S.t, V()), up = S.pos.clone().sub(m), r = up.length(), agl = talAgl(S.pos, S.t); S.pos.copy(m).addScaledVector(up, (r - (agl - h)) / r); orbInfo(); };
  it('Tal\'s equator moves at about 113 m/s', () => {
    const eq = V().crossVectors(omegaT, new THREE.Vector3(1, 0, 0)).normalize().multiplyScalar(MOON_R).add(moonPos(S.t, V()));
    expect(talGroundVel(eq, S.t, V()).sub(moonVel(S.t, V())).length()).toBeCloseTo(112.7, 0);
  });
  it('hovering over one spot reads as zero speed, low down', () => {
    dropTo(5000); talGroundVel(S.pos, S.t, S.vel); orbInfo();
    expect(O.surf).toBe(true); expect(O.speed).toBeLessThan(0.01); expect(O.hs).toBeLessThan(0.01);
  });
  it('retrograde holds against motion over the ground, low down', () => {
    dropTo(8000); const east = V().crossVectors(omegaT, S.pos.clone().sub(moonPos(S.t, V()))).normalize();
    talGroundVel(S.pos, S.t, S.vel).addScaledVector(east, -60); orbInfo(); // slower than the ground: drifting west over it
    S.hold = 'retro'; run(35);
    expect(angleDeg(nose(), relVel(V()).normalize().negate())).toBeLessThan(2);
  });
  // With a weak engine (4 m/s²) braking takes minutes, so the cue usually says "Brake now" soon after the
  // deorbit burn. It stops a little above its target: Retrograde leans upright over the last 30 m/s.
  for (const pre of [70, 280, 370]) it(`starting the burn on the braking cue stops clear of the ground (${pre} s deorbit burn)`, () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(pre); S.throttle = 0;
    let t = 0; while (O.brake > 0 && t < 4000) { run(0.05); t += 0.05; }
    expect(O.brake).toBe(0); expect(O.clear).toBeGreaterThan(BRAKE_CLEAR + 500); // it warned in good time
    S.throttle = 1; let minClear = Infinity; while (O.speed > 3 && t < 6000 && !S.crash) { run(0.05); t += 0.05; minClear = Math.min(minClear, O.clear); }
    expect(S.crash).toBe(null); expect(minClear).toBeGreaterThan(BRAKE_CLEAR - 50); // never came near the ground
    if (pre > 100) expect(O.clear).toBeLessThan(BRAKE_CLEAR + 200); // a shallow path stops higher: ridges on the way decide when to brake
  });
});

describe('landing on Tal', () => {
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  beforeEach(() => { initTalOrbit(SUN); });
  const upAt = () => S.pos.clone().sub(moonPos(S.t, V())).normalize();
  const deck = () => new THREE.Vector3(0, 1, 0).applyQuaternion(S.quat);
  const east = () => V().crossVectors(omegaT, upAt()).normalize();
  const bodyPos = () => S.pos.clone().sub(moonPos(S.t, V())).applyQuaternion(talQuat(S.t, Q()).invert());
  // Level the ship (belly down, nose east) with its feet about h metres above the ground, moving with the
  // ground, gear down, hovering with the thrust off.
  const hoverAt = h => {
    const m = moonPos(S.t, V()), up = S.pos.clone().sub(m), r = up.length(), agl = talAgl(S.pos, S.t);
    S.pos.copy(m).addScaledVector(up, (r - (agl - STAND_H - h)) / r); up.normalize();
    S.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(V(), east(), up));
    talGroundVel(S.pos, S.t, S.vel); S.w.set(0, 0, 0); S.hold = null; S.legs = 1; S.legsDown = true; S.landed = false; orbInfo();
    S.hover = true; S.throttle = 0; orbInfo();
  };
  // Walk along the ground in 1.5 km steps until the ground under the feet slopes between lo and hi degrees.
  const findGround = (lo, hi) => {
    for (let i = 0; i < 400; i++) {
      hoverAt(50); if (O.slope >= lo && O.slope < hi) return true;
      const m = moonPos(S.t, V()), rel = S.pos.clone().sub(m); rel.applyAxisAngle(V().crossVectors(rel, omegaT).normalize(), 1500 / rel.length()); S.pos.copy(m).add(rel);
    }
    return false;
  };
  // The last stretch, hovering: the ship levels itself; lift for a descent rate easing from 10 m/s to
  // 1.5 m/s near the ground.
  const descend = (maxT = 900) => {
    for (let t = 0; t < maxT && !S.landed && !S.crash; t += 0.05) {
      const vt = -Math.max(1.5, Math.min(10, O.clear / 10)), c = Math.max(0.5, deck().dot(upAt()));
      S.throttle = Math.min(1, Math.max(0, (O.g + 0.8 * (vt - O.vv)) / (SHIP.aLift * c)));
      run(0.05);
    }
  };
  const settle = () => { for (let i = 0; i < 600 && !S.landed && !S.crash; i++) run(0.05); S.throttle = 0; run(3); };
  const feetAgl = () => SHIP.feet.map(f => talAgl(new THREE.Vector3(...f).applyQuaternion(S.quat).add(S.pos), S.t));

  it('hover is only offered low over Tal', () => {
    initOrbit(SUN); expect(setHover(true)).toBe(false); expect(S.hover).toBe(false);
  });
  it('hovering, the ship levels itself and stops drifting', () => {
    hoverAt(200); S.vel.addScaledVector(east(), 3); S.quat.premultiply(Q().setFromAxisAngle(east(), 0.2)); S.throttle = O.g / SHIP.aLift; orbInfo();
    run(45);
    expect(O.tilt).toBeLessThan(2); expect(O.hs).toBeLessThan(0.3); expect(Math.abs(O.vv)).toBeLessThan(1);
  });
  it('steering in hover tilts the ship and moves it; letting go stops it again', () => {
    hoverAt(200); S.throttle = O.g / SHIP.aLift;
    run(5, {...idle, pitch: -1}); run(3); expect(O.hs).toBeGreaterThan(1);
    run(60); expect(O.hs).toBeLessThan(0.3); expect(O.tilt).toBeLessThan(2);
  });
  it('switching to hover nose-up after a braking burn swings level without dropping', () => {
    hoverAt(300); S.hover = false; S.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(V(), upAt(), east())); orbInfo();
    const h0 = O.agl; expect(setHover(true)).toBe(true);
    let minH = Infinity; for (let i = 0; i < 40; i++) { run(0.5); minH = Math.min(minH, O.agl); }
    expect(O.tilt).toBeLessThan(3); expect(h0 - minH).toBeLessThan(30); expect(O.hs).toBeLessThan(1);
  });
  it('a gentle descent onto flat ground lands, standing on all four feet', () => {
    expect(findGround(0, 3)).toBe(true); hoverAt(150); descend(); settle();
    expect(S.crash).toBe(null); expect(S.landed).toBe(true);
    expect(O.clear).toBe(0); expect(O.speed).toBeLessThan(0.01);
    expect(angleDeg(deck(), upAt())).toBeLessThan(4);
    for (const h of feetAgl()) { expect(h).toBeGreaterThan(-0.5); expect(h).toBeLessThan(1.5); }
  });
  it('from orbit to standing on Tal: deorbit, brake on the cue, hover down', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(340); S.throttle = 0;
    while (O.brake > 0) run(0.05);
    S.throttle = 1; while (O.speed > 3 && !S.crash) run(0.05);
    expect(S.legs).toBe(1); expect(setHover(true)).toBe(true); descend(); settle();
    expect(S.crash).toBe(null); expect(S.landed).toBe(true); expect(hasCheckpoint()).toBe(true);
  });
  it('a landed ship stays put through 1000× time warp', () => {
    findGround(0, 3); hoverAt(2); settle(); expect(S.landed).toBe(true);
    const before = bodyPos(), t0 = S.t; S.warpIdx = 3; run(100);
    expect(S.warpIdx).toBe(3); expect(S.landed).toBe(true); expect(S.t - t0).toBeGreaterThan(9.9e4);
    expect(bodyPos().distanceTo(before)).toBeLessThan(0.01); expect(O.speed).toBeLessThan(0.01);
  });
  it('raising the lift above hover takes off again', () => {
    findGround(0, 3); hoverAt(2); settle(); expect(S.landed).toBe(true);
    S.throttle = 0.6; run(20); // 2.4 m/s² against Tal's 1.5
    expect(S.landed).toBe(false); expect(S.crash).toBe(null); expect(O.clear).toBeGreaterThan(100); expect(O.vv).toBeGreaterThan(10);
  });
  it('touching down too fast crashes, and says why', () => {
    findGround(0, 3); hoverAt(100); S.vel.addScaledVector(upAt(), -15); run(30);
    expect(S.landed).toBe(false); expect(S.crash).toMatch(/^Touched down at \d+ m\/s\. Safe is under 3 m\/s\.$/);
  });
  it('3 to 6 m/s down is a hard landing: a warning, no harm', () => {
    const keys = []; setNotifier(k => keys.push(k));
    findGround(0, 3); hoverAt(3); S.vel.addScaledVector(upAt(), -4.5); S.throttle = O.g / SHIP.aLift * 0.999; // keep falling at about 4.5 m/s
    settle(); setNotifier(() => {});
    expect(S.crash).toBe(null); expect(S.landed).toBe(true); expect(keys).toContain('hard');
  });
  it('touching down tilted, or on steep ground, crashes', () => {
    findGround(0, 3); hoverAt(1); S.hover = false; S.quat.premultiply(Q().setFromAxisAngle(east(), 15 / 57.3)); run(10);
    expect(S.crash).toMatch(/^Touched down tilted \d+°\. Safe is under 8°\.$/);
    initTalOrbit(SUN); expect(findGround(16, 30)).toBe(true); hoverAt(1); S.hover = false; run(10);
    expect(S.crash).toMatch(/^The ground there slopes \d+° and the ship tipped over\./);
  });
  it('falling without braking crashes, and can be tried again from 15 km up', () => {
    S.hold = 'retro'; run(40); S.throttle = 1; run(360); S.throttle = 0;
    for (let i = 0; i < 900 && !S.crash; i++) run(1);
    expect(S.crash).toMatch(/^(Touched down at|The hull hit the ground at) \d+ m\/s/);
    expect(hasCheckpoint()).toBe(true); expect(restoreCheckpoint()).toBe(true);
    expect(S.crash).toBe(null); expect(S.landed).toBe(false);
    expect(O.agl).toBeLessThan(15e3); expect(O.agl).toBeGreaterThan(14e3); expect(O.vv).toBeLessThan(0);
  });
});
