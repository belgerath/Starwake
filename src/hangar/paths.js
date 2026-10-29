// Walking paths on the hangar floor, in metres (x across, z along the hall, the Mudlark's pad at the origin,
// its nose toward the back wall at −z, the doors it came in by at +z). Loops are closed polylines of [x, z]
// points (two points: walking there and back); routes are open ones walked once. No three.js, so tests can
// check that every path keeps clear of the ship, the stalls and the hauler.

export const HALL = {x: 64, z: 72, h: 84};   // half-width, half-length, height
export const SHIP_CLEAR = 20;                // nobody walks closer than this to the pad's centre

export const LOOPS = {
  ring: [[27, 0], [23.4, 13.5], [13.5, 23.4], [0, 27], [-13.5, 23.4], [-23.4, 13.5], [-27, 0], [-23.4, -13.5], [-13.5, -23.4], [0, -27], [13.5, -23.4], [23.4, -13.5]],
  long: [[0, -62], [16, -40], [30, -24], [32, 22], [14, 44], [-18, 46], [-30, 30], [-24, 12], [-14, -38]],
  market: [[31, 18], [35, -34]],
  doors: [[-40, 56], [40, 56]],
  back: [[-20, -63], [20, -63]],
};
// The cargo hauler's loop round the container yard in the back corner.
export const HAULER = [[-55, -33], [-55, -63], [-31, -63], [-31, -33]];
// The Proctor's walk from the checkpoint to the Mudlark (and back the other way).
export const OFFICER = {home: [-30, -6], route: [[-30, -6], [-26, 2], [-22, 8]]};
// Things standing on the floor, [x, z, radius]: walkers keep out of these circles (radius 0: walked through).
export const SPOTS = {
  checkpoint: [-37, -6, 5.5], factor: [44, -10, 4], containers: [56, -10, 9], yard: [-44, -48, 7],
  talkE: [40, 36, 3], talkW: [-41, 31, 3], arch: [-27, 21, 0], backArch: [0, -70, 0],
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
