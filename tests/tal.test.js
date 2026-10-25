// Tal's terrain in JavaScript must match what the GPU bakes into Tal's maps, or the ground you land
// on would not be the ground you saw from orbit. The fixture holds GPU-baked heights from
// `npm run check:tal`; rerun that after changing NOISE or MOON_H (shaders.js), noise.js or tal.js.
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {talBase, talHeight, talDetail} from '../src/tal.js';
import {TAL_MAX_H} from '../src/config.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/tal-bake.json', import.meta.url), 'utf8'));

describe('Tal terrain', () => {
  it('matches the GPU bake to within about 3 m', () => {
    let worst = 0;
    for (const [x, y, z, gpu] of fixture.samples) worst = Math.max(worst, Math.abs(talBase(x, y, z) - gpu));
    expect(fixture.samples.length).toBeGreaterThan(500);
    expect(worst).toBeLessThan(1e-4); // baked units; 1e-4 × TAL_RELIEF ≈ 3.3 m
  });
  it('has moon-like relief: deep basins and high rims, within ±12 km', () => {
    let lo = Infinity, hi = -Infinity;
    for (const [x, y, z] of fixture.samples) { const h = talHeight(x, y, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    expect(lo).toBeLessThan(-4000); expect(hi).toBeGreaterThan(3000);
    expect(lo).toBeGreaterThan(-12000); expect(hi).toBeLessThan(12000);
    expect(Math.max(-lo, hi)).toBeLessThan(TAL_MAX_H - 1000); // culling and the hard deck rely on this bound
  });
  it('keeps small-scale detail out of what is seen from orbit', () => {
    // Chunks with vertices 5 km or more apart (all that is drawn from a few hundred km up) get none of
    // it, so Tal from orbit still matches the bake; vertices 10 m apart get all of it.
    for (const [x, y, z] of fixture.samples.slice(0, 50)) {
      expect(talDetail(x, y, z, 5000)).toBe(0);
      expect(Math.abs(talDetail(x, y, z, 10) - talDetail(x, y, z))).toBeLessThan(1);
    }
  });
  it('has no cliffs: a 200 km walk in 10 m steps never climbs more than 45°', () => {
    // Crater rims used to be a sheer step (over 1 km on this walk). Inner walls now peak around 30°.
    let worst = 0, prev = null;
    for (let i = 0; i < 20000; i++) {
      const a = 0.3 + i * 10 / 1.64e6, h = talHeight(Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8);
      if (prev !== null) worst = Math.max(worst, Math.abs(h - prev)); prev = h;
    }
    expect(worst).toBeLessThan(10);
  });
});
