// The hangar's walking paths: clear of the ship, the stalls, the hauler and the walls.
import {describe, it, expect} from 'vitest';
import {LOOPS, HAULER, OFFICER, SPOTS, HALL, SHIP_CLEAR, along, pathLength, clearance} from '../src/hangar/paths.js';

describe('hangar paths', () => {
  const walks = [...Object.entries(LOOPS).map(([k, p]) => [k, p, true]), ['officer', OFFICER.route, false]];
  it('keep clear of the Mudlark and inside the hall', () => {
    for (const [k, p, closed] of [...walks, ['hauler', HAULER, true]]) {
      expect(clearance(p, 0, 0, closed), k).toBeGreaterThan(SHIP_CLEAR);
      for (const [x, z] of p) { expect(Math.abs(x), k).toBeLessThan(HALL.x - 6); expect(Math.abs(z), k).toBeLessThan(HALL.z - 6); }
    }
  });
  it('walk round the checkpoint, the market, the groups and the container yard', () => {
    for (const [k, p, closed] of walks) for (const [s, [x, z, r]] of Object.entries(SPOTS)) if (r > 0) expect(clearance(p, x, z, closed), k + ' near ' + s).toBeGreaterThan(r + 1);
  });
  it('stay out of the hauler\'s way', () => {
    for (const [k, p, closed] of walks) for (const [x, z] of HAULER) expect(clearance(p, x, z, closed), k).toBeGreaterThan(6);
    for (const [k, p] of walks) for (const [x, z] of p) expect(clearance(HAULER, x, z), k).toBeGreaterThan(6);
  });
  it('a point along a loop wraps, and a route holds at its ends', () => {
    const L = pathLength(LOOPS.long), a = along(LOOPS.long, 5), b = along(LOOPS.long, 5 + L);
    expect(b.x).toBeCloseTo(a.x); expect(b.z).toBeCloseTo(a.z); expect(Math.hypot(a.dx, a.dz)).toBeCloseTo(1);
    const end = along(OFFICER.route, 1e6, false), last = OFFICER.route[OFFICER.route.length - 1];
    expect(end.x).toBeCloseTo(last[0]); expect(end.z).toBeCloseTo(last[1]);
  });
});
