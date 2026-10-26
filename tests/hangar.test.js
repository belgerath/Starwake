// The hangar's walking paths: clear of the ship, the stalls and the walls.
import {describe, it, expect} from 'vitest';
import {LOOPS, OFFICER, SPOTS, HALL, SHIP_CLEAR, along, pathLength, clearance} from '../src/hangar/paths.js';

describe('hangar paths', () => {
  const all = [...Object.entries(LOOPS).map(([k, p]) => [k, p, true]), ['officer', OFFICER.route, false]];
  it('keep clear of the Mudlark and inside the hall', () => {
    for (const [k, p, closed] of all) {
      expect(clearance(p, 0, 0, closed), k).toBeGreaterThan(SHIP_CLEAR);
      for (const [x, z] of p) { expect(Math.abs(x), k).toBeLessThan(HALL.x - 4); expect(Math.abs(z), k).toBeLessThan(HALL.z - 4); }
    }
  });
  it('walk round the stalls, the cargo and the parked craft', () => {
    for (const [k, p, closed] of all) for (const [s, [x, z, r]] of Object.entries(SPOTS)) if (r > 0) expect(clearance(p, x, z, closed), k + ' near ' + s).toBeGreaterThan(r + 1);
  });
  it('a point along a loop wraps, and a route holds at its ends', () => {
    const L = pathLength(LOOPS.market), a = along(LOOPS.market, 5), b = along(LOOPS.market, 5 + L);
    expect(b.x).toBeCloseTo(a.x); expect(b.z).toBeCloseTo(a.z); expect(Math.hypot(a.dx, a.dz)).toBeCloseTo(1);
    const end = along(OFFICER.route, 1e6, false), last = OFFICER.route[OFFICER.route.length - 1];
    expect(end.x).toBeCloseTo(last[0]); expect(end.z).toBeCloseTo(last[1]);
  });
});
