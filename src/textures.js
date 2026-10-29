// Textures and a shader shared by Tumbledown's bay (station.js, seen from space) and the hangar (hangar/),
// so the two read as the same place: board-marked concrete, dark ribbed metal, carved letters, banners, a
// soft dot for painted-on light, and the shaft of light from the roof. Drawn on canvases, no files.
import * as THREE from 'three';
import {rng} from './util.js';

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
  if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...repeat); }
  return tx;
}
// n soft round stains of colour rgb ('r,g,b'), opacity a0..a1, radius s0..s1 pixels.
export const blotch = (g, r, n, w, h, rgb, a0, a1, s0, s1) => { for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, s = s0 + r() * (s1 - s0), gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(${rgb},${a0 + r() * (a1 - a0)})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); } };
// Board-marked concrete: grain, stains, the lines of the formwork, tie holes, streaks running down.
export function concrete(rep) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(11); g.fillStyle = '#8c857a'; g.fillRect(0, 0, w, h);
    blotch(g, r, 60, w, h, '40,34,28', 0.05, 0.16, 20, 90); blotch(g, r, 30, w, h, '200,190,170', 0.03, 0.08, 20, 70);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,18,16' : '230,220,200'},0.06)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    for (let y = 0; y < h; y += 128) { g.fillStyle = 'rgba(20,16,12,0.35)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,240,220,0.06)'; g.fillRect(0, y + 3, w, 2); }
    g.fillStyle = 'rgba(15,12,10,0.55)'; for (let x = 32; x < w; x += 64) for (let y = 64; y < h; y += 128) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 50; i++) { const x = r() * w, y = r() * h, l = 40 + r() * 200, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(30,24,18,0.18)'); gr.addColorStop(1, 'rgba(30,24,18,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 5, l); }
  }, rep);
}
// Dark ribbed metal, for doors, containers and hulls.
export const ribbed = (rep, rust = false) => canvasTex(256, 256, (g, w, h) => {
  const r = rng(rust ? 3 : 4); g.fillStyle = '#7d7a76'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 6, 0, 3, h); }
  if (rust) blotch(g, r, 25, w, h, '120,60,30', 0.15, 0.35, 8, 40);
  blotch(g, r, 20, w, h, '20,16,12', 0.1, 0.25, 10, 50);
}, rep);
// A banner: dark cloth with a pale geometric emblem.
export const bannerTex = (hex) => canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = hex; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(214,196,160,0.75)'; g.lineWidth = 4;
  g.beginPath(); g.arc(64, 150, 34, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(64, 100); g.lineTo(64, 260); g.stroke();
  g.beginPath(); g.moveTo(30, 230); g.lineTo(64, 260); g.lineTo(98, 230); g.stroke();
  g.fillStyle = 'rgba(214,196,160,0.6)'; g.fillRect(16, 20, 96, 4); g.fillRect(16, h - 24, 96, 4);
  for (let x = 0; x < w; x += 4) { g.fillStyle = `rgba(0,0,0,${0.08 + 0.08 * Math.sin(x * 0.3)})`; g.fillRect(x, 0, 2, h); }
});
// Carved letters: dark in the stone, a lit lower edge.
export const engraving = (text) => canvasTex(1024, 192, (g, w, h) => {
  g.fillStyle = '#4e483f'; g.fillRect(0, 0, w, h); g.font = '120px Michroma, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,230,190,0.22)'; g.fillText(text, w / 2 + 3, h / 2 + 4); g.fillStyle = '#16120e'; g.fillText(text, w / 2, h / 2);
});
// A soft white dot: lamp light painted on walls and floors (additive), dust.
let dot = null;
export const dotTex = () => dot || (dot = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
// Additive light painted on a surface: a dot stretched over a plane, colour hex at strength k.
export const wash = (hex, k) => new THREE.MeshBasicMaterial({map: dotTex(), color: new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});

// The shaft of light: an open cone from the roof to the floor, brightest where it is seen face-on and near
// the top, with faint streaks; added on top of whatever is behind it. time animates the streaks.
const SHAFT_VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`;
const SHAFT_FRAG = `#include <logdepthbuf_pars_fragment>
uniform vec3 color; uniform float strength; uniform float time;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
#include <logdepthbuf_fragment>
  float f = abs(dot(normalize(vN), normalize(vV)));
  float rays = 0.6 + 0.4 * sin(vUv.x * 56.5 + 2.0 * sin(vUv.x * 18.8 + time * 0.07));
  float a = f * f * strength * rays * mix(0.3, 1.0, vUv.y);
  gl_FragColor = vec4(color * a, 1.0);
}`;
export function lightShaft(rTop, rBottom, height, strength, hex = 0xffe2b8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true), new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, uniforms: {color: {value: new THREE.Color(hex).convertSRGBToLinear()}, strength: {value: strength}, time: {value: 0}},
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
  m.renderOrder = 2; return m;
}
