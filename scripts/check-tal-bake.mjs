// Checks that Tal's height in JavaScript (src/tal.js) matches the GPU bake the game draws (MOON_H),
// texel by texel, using the game's own bake code in headless Chromium.
//   npm run check:tal
// Run it after changing NOISE or MOON_H in shaders.js, or noise.js / tal.js. It also rewrites
// tests/fixtures/tal-bake.json, a sample of GPU values that npm test checks the JS against.
// Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions; elsewhere
// `npm i -g playwright && npx playwright install chromium`).
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const {chromium} = createRequire(import.meta.url)('playwright');
const SIZE = 512, SAMPLES = 600, TOL = 1.0e-4; // bake size used by the game; tolerance in baked units (~3 m)

const entry = `
import * as THREE from 'three';
import {renderer} from './src/engine.js';
import {bake} from './src/bake.js';
import {MOON_H} from './src/shaders.js';
import {TAL_SEED} from './src/config.js';
import {talBase} from './src/tal.js';
// faceDir() from BAKE_HEAD, for texel (i, j) of a face.
function faceDir(face, u, v) {
  const x = u * 2 - 1, y = v * 2 - 1; let d;
  if (face === 0) d = [1, -y, -x]; else if (face === 1) d = [-1, -y, x]; else if (face === 2) d = [x, 1, y];
  else if (face === 3) d = [x, -1, -y]; else if (face === 4) d = [x, -y, 1]; else d = [-x, -y, -1];
  const l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l];
}
window.checkTal = (size, samples) => {
  const t0 = performance.now();
  const rt = bake(size, MOON_H, {seed: {value: new THREE.Vector3(...TAL_SEED)}}, true);
  const buf = new Uint8Array(size * size * 4), stats = {n: 0, max: 0, sum: 0, over: 0, min: 1e9, maxH: -1e9, worst: null};
  const sample = [], every = Math.floor(6 * size * size / samples);
  let k = 0;
  for (let face = 0; face < 6; face++) {
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf, face);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
      const o = (j * size + i) * 4, gpu = ((buf[o] * 256 + buf[o + 1]) / 65535) * 2 - 1;
      const d = faceDir(face, (i + 0.5) / size, (j + 0.5) / size), js = talBase(d[0], d[1], d[2]);
      const err = Math.abs(gpu - js) - 2 / 65535 * 0.5; // the 16-bit encode floors, so allow half a step either way
      stats.n++; stats.sum += Math.abs(gpu - js); stats.min = Math.min(stats.min, js); stats.maxH = Math.max(stats.maxH, js);
      if (err > stats.max) { stats.max = err; stats.worst = {face, i, j, gpu, js}; }
      if (err > ${TOL}) stats.over++;
      if (k % every === 0) sample.push([+d[0].toFixed(9), +d[1].toFixed(9), +d[2].toFixed(9), gpu]);
    }
  }
  rt.dispose(); stats.ms = Math.round(performance.now() - t0);
  return {stats, sample, gl: renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl1'};
};
`;
const bundle = await build({stdin: {contents: entry, resolveDir: root, loader: 'js'}, bundle: true, write: false, format: 'iife', logLevel: 'error'});
const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']});
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.setContent('<!doctype html><div id="app" style="width:64px;height:64px"></div>');
await page.addScriptTag({content: bundle.outputFiles[0].text});
const {stats, sample, gl} = await page.evaluate(([s, n]) => window.checkTal(s, n), [SIZE, SAMPLES]);
await browser.close();

const unit = 'baked units (×TAL_RELIEF for metres)';
console.log(`${gl}, ${stats.n} texels in ${stats.ms} ms`);
console.log(`height range in JS: ${stats.min.toFixed(4)} to ${stats.maxH.toFixed(4)} ${unit}`);
console.log(`mean |GPU - JS|: ${(stats.sum / stats.n).toExponential(2)}, worst beyond encoding step: ${stats.max.toExponential(2)} ${unit}`);
if (stats.worst) console.log('worst texel:', stats.worst);
writeFileSync(root + 'tests/fixtures/tal-bake.json', JSON.stringify({note: 'GPU-baked MOON_H samples [x, y, z, height]. Regenerate with npm run check:tal.', size: SIZE, samples: sample}) + '\n');
console.log(`wrote tests/fixtures/tal-bake.json (${sample.length} samples)`);
if (stats.over) { console.error(`FAIL: ${stats.over} texels differ by more than ${TOL}`); process.exit(1); }
console.log('OK: JS terrain matches the GPU bake');
