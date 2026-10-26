// Walking paths on the hangar floor, in metres (x across, z along the hall, the Mudlark's pad at the origin).
// Loops are closed polylines of [x, z] points; routes are open ones walked once. No three.js, so tests can
// check that every path keeps clear of the ship and the stalls.

export const HALL = {x: 56, z: 46, h: 30};   // half-width, half-length, height
export const SHIP_CLEAR = 17;                // nobody walks closer than this to the pad's centre

export const LOOPS = {
  ring: [[21.5, 0], [18.6, 10.8], [10.8, 18.6], [0, 21.5], [-10.8, 18.6], [-18.6, 10.8], [-21.5, 0], [-18.6, -10.8], [-10.8, -18.6], [0, -21.5], [10.8, -18.6], [18.6, -10.8]],
  market: [[24, -3], [50, -3], [50, -30], [24, -30]],
  cargo: [[-50, 13], [-26, 13], [-26, 40], [-50, 40]],
  cross: [[0, 36], [25, 9], [25, -26], [-20, -31], [-24, 0], [-16, 25]],
  back: [[-22, -38], [22, -38], [32, -26], [-32, -26]],
};
// Inspector Drab's walk from the customs booth to the Mudlark (and back the other way).
export const OFFICER = {home: [-26, -11], route: [[-26, -11], [-22, -4], [-19, 3]]};
// Things standing on the floor, [x, z, radius]: walkers keep out of these circles.
export const SPOTS = {
  booth: [-33, -15, 6], stall: [36, -15, 7], stall2: [42, 14, 6], cargo: [-38, 26, 8],
  craftA: [-44, -36, 6], craftB: [43, 34, 7], gate: [-23, -2, 0], // the scanner gate is walked through
};

const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export function pathLength(pts, closed = true) {
  let L = 0; const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) L += segLen(pts[i], pts[(i + 1) % pts.length]);
  return L;
}
// The point s metres along the path (wrapping on a loop, held at the ends of a route), with its unit
// direction of travel: {x, z, dx, dz}.
export function along(pts, s, closed = true, out = {x: 0, z: 0, dx: 0, dz: 1}) {
  const L = pathLength(pts, closed), n = closed ? pts.length : pts.length - 1;
  s = closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s));
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = segLen(a, b);
    if (s <= l || i === n - 1) { const k = l > 0 ? Math.min(1, s / l) : 0; out.x = a[0] + (b[0] - a[0]) * k; out.z = a[1] + (b[1] - a[1]) * k; out.dx = (b[0] - a[0]) / (l || 1); out.dz = (b[1] - a[1]) / (l || 1); return out; }
    s -= l;
  }
  return out;
}
// Closest approach of a path to a point, for the tests (and for placing things clear of the walkers).
export function clearance(pts, px, pz, closed = true) {
  let d = Infinity; const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
    const k = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[1]) * ez) / l2)) : 0;
    d = Math.min(d, Math.hypot(a[0] + ex * k - px, a[1] + ez * k - pz));
  }
  return d;
}
