// The flight computer's courses (course.js): to a low orbit of Tal and back to Tumbledown, flown under the
// same physics as the pilot, from the start orbit, from the "start above Tal" orbit (tilted to Tal's equator,
// so it is levelled first) and from near the station.
import {describe, it, expect, beforeEach} from 'vitest';
import * as THREE from 'three';
import {S, O, initOrbit, initTalOrbit, stepFlight, requestDock} from '../src/physics.js';
import {SUN_DIR, SHIP} from '../src/config.js';
import {startCourse, stepCourse, courseActive, courseStatus, courseOptions, cancelCourse, setCourseHooks} from '../src/course.js';

const SUN = new THREE.Vector3(...SUN_DIR).normalize(), idle = {pitch: 0, yaw: 0, roll: 0, boost: false, retro: false};
// Fly a frame at a time, as the game does, until the course ends (or hours of game time pass).
function fly(hours, inp = idle) { const t0 = S.t; while (courseActive() && S.t - t0 < hours * 3600 && !S.crash) { stepCourse(0.05); stepFlight(0.05, inp); } }
let docked = 0;
beforeEach(() => { initOrbit(SUN); S.launched = true; S.paused = false; docked = 0; setCourseHooks({dock: () => { docked++; return requestDock(); }}); });

describe('courses', () => {
  it('to Tal: from the start orbit into a low orbit of Tal, then back to Tumbledown and into station control', () => {
    expect(startCourse('tal')).toBe('');
    let f = S.fuel; fly(12);
    expect(S.crash).toBe(null); expect(courseActive()).toBe(false);
    expect(O.name).toBe('Tal'); expect(O.pe).toBeGreaterThan(60e3); expect(O.ap).toBeLessThan(450e3);
    expect(f - S.fuel).toBeLessThan(4000);
    f = S.fuel; expect(startCourse('station')).toBe(''); fly(30);
    expect(S.crash).toBe(null); expect(docked).toBe(1); expect(S.dock && S.dock.phase).toBe('approach');
    expect(f - S.fuel).toBeLessThan(5000);
  });
  it('back from an orbit tilted to Tal\'s equator: levels it first', () => {
    initTalOrbit(SUN); const f = S.fuel;
    expect(startCourse('station')).toBe(''); stepCourse(0.05); expect(courseStatus().text).toBe('Levelling the orbit');
    fly(30);
    expect(S.crash).toBe(null); expect(docked).toBe(1); expect(f - S.fuel).toBeLessThan(7000);
  });
  it('near the station: closes in and hands over to station control', () => {
    expect(startCourse('station')).toBe(''); fly(2);
    expect(docked).toBe(1); expect(O.stDist).toBeLessThan(10e3);
  });
  it('steering or the throttle hands the controls back', () => {
    startCourse('tal'); fly(0.01); expect(courseActive()).toBe(true);
    stepCourse(0.05); stepFlight(0.05, {...idle, pitch: 1}); stepCourse(0.05); expect(courseActive()).toBe(false);
    startCourse('tal'); stepCourse(0.05); stepFlight(0.05, idle); S.throttle = 0.5; stepCourse(0.05); expect(courseActive()).toBe(false);
    cancelCourse(); expect(courseActive()).toBe(false);
  });
  it('says why a course is not on offer', () => {
    const why = d => courseOptions().find(o => o.dest === d).why;
    S.fuel = 1000; expect(why('tal')).toMatch(/^Not enough fuel/); expect(startCourse('tal')).toMatch(/^Not enough fuel/);
    initTalOrbit(SUN); expect(why('tal')).toBe('Already at Tal.');
    S.landed = true; expect(why('station')).toMatch(/^Landed/);
  });
});
