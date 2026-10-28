// Sound, made with Web Audio from noise and a few oscillators (no files to download). Continuous beds
// follow the ship each frame: the main engine's rumble, the lift thrusters' roar, the hiss of the attitude
// and retro thrusters, the bay doors, and the hangar's drone, rumble and moving air, with distant metal
// clanks echoing in it. One-shots for events: clunks, a crash, the docking chime, the customs seal, the
// sale, taps. Browsers only allow sound after a tap or key,
// so nothing starts before one; the on/off choice is remembered in the browser.
const KEY = 'starwake.sound';
let ctx = null, out = null, noise = null, beds = null, on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch (_) {}

export const soundOn = () => on;
export function setSound(v) {
  on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (_) {}
  if (out) out.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05);
}
function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch (_) { return; }
  out = ctx.createGain(); out.gain.value = on ? 0.9 : 0; out.connect(ctx.destination);
  const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noise = buf; beds = makeBeds();
}
for (const e of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(e, unlock, true);

// ---- building blocks ----
function src() { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 2); return s; }
function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

function makeBeds() {
  const b = {};
  // Main engine: low filtered noise and a growling 38 Hz saw, brighter with boost.
  b.engF = filt('lowpass', 180); b.eng = chain(src(), b.engF, gain(1), gain()); b.eng.connect(out);
  b.growl = chain(osc('sawtooth', 38), filt('lowpass', 110), gain()); b.growl.connect(out);
  b.lift = chain(src(), filt('bandpass', 700, 0.6), gain()); b.lift.connect(out);
  b.hiss = chain(src(), filt('highpass', 2600), gain()); b.hiss.connect(out);
  // Bay doors grinding: low noise and a 55 Hz hum.
  b.door = chain(src(), filt('lowpass', 240), gain()); b.door.connect(out);
  b.doorHum = chain(osc('triangle', 55), gain()); b.doorHum.connect(out);
  // The hangar: a low drone of detuned tones beating slowly, a deep rumble, air moving through the hall
  // (swelling and fading), and a faint low murmur of voices.
  b.drone = gain(); for (const [f, v] of [[41.2, 0.5], [41.6, 0.5], [55, 0.35], [82.4, 0.12]]) chain(osc('sine', f), gain(v), b.drone);
  const df = filt('lowpass', 140); b.drone.connect(df); df.connect(out);
  b.rumble = chain(src(), filt('lowpass', 90), gain()); b.rumble.connect(out);
  const lfo = osc('sine', 0.06), lfoG = gain(0.5); lfo.connect(lfoG);
  b.air = gain(); const ag = gain(0.6); lfoG.connect(ag.gain); chain(src(), filt('bandpass', 700, 0.4), ag, b.air); b.air.connect(out);
  b.voices = chain(src(), filt('bandpass', 300, 1.2), gain()); b.voices.connect(out);
  b.nextClank = 0;
  return b;
}
const level = (g, v, tc = 0.08) => g.gain.setTargetAtTime(v, ctx.currentTime, tc);

// Each frame: main, lift and turn in 0..1, boost and retro as flags, doors moving (0..1), hangar (bool).
export function updateSound(st) {
  if (!beds || ctx.state !== 'running') return;
  const q = st.quiet ? 0 : 1;
  level(beds.eng, q * 0.55 * st.main); beds.engF.frequency.setTargetAtTime(160 + 380 * st.main + (st.boost ? 300 : 0), ctx.currentTime, 0.1);
  level(beds.growl, q * 0.35 * st.main);
  level(beds.lift, q * 0.3 * st.lift);
  level(beds.hiss, q * (0.05 * Math.min(1, st.turn) + (st.retro ? 0.09 : 0)), 0.03);
  level(beds.door, q * 0.4 * st.doors, 0.2); level(beds.doorHum, q * 0.12 * st.doors, 0.2);
  const h = st.hangar ? 1 : 0, now = ctx.currentTime;
  level(beds.drone, 0.16 * h, 0.8); level(beds.rumble, 0.35 * h, 0.8); level(beds.air, 0.05 * h, 0.8); level(beds.voices, 0.06 * h, 0.8);
  // Somewhere far off in the hall, metal on metal, every few seconds.
  if (h && now > beds.nextClank) { if (beds.nextClank) clank(now + 0.05); beds.nextClank = now + 4 + Math.random() * 9; }
  if (!h) beds.nextClank = 0;
}
// A distant clank: a few inharmonic partials struck once, then fainter echoes off the walls.
function clank(t0) {
  const base = 160 + Math.random() * 140, v = 0.03 + Math.random() * 0.03;
  for (const [delay, k] of [[0, 1], [0.38, 0.45], [0.81, 0.2], [1.3, 0.08]]) {
    for (const r of [1, 1.58, 2.31]) tone('sine', base * r, v * k / r, 1.4, t0 + delay);
    burst('bandpass', base * 3, v * k * 0.6, 0.18, t0 + delay);
  }
}

// ---- one-shots ----
function env(node, peak, a, d, t0 = ctx.currentTime) { const g = gain(); node.connect(g); g.connect(out); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); return g; }
function tone(type, f, peak, d, t0 = ctx.currentTime, f1 = f) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t0 + d); env(o, peak, 0.005, d, t0); o.start(t0); o.stop(t0 + d + 0.05); }
function burst(type, f, peak, d, t0 = ctx.currentTime, f1 = f) { const s = ctx.createBufferSource(); s.buffer = noise; const b = filt(type, f); b.frequency.setValueAtTime(f, t0); if (f1 !== f) b.frequency.exponentialRampToValueAtTime(f1, t0 + d); s.connect(b); env(b, peak, 0.005, d, t0); s.start(t0, Math.random()); s.stop(t0 + d + 0.05); }
const SHOTS = {
  click: t => tone('sine', 880, 0.08, 0.05, t),
  blip: t => { tone('sine', 220, 0.08, 0.25, t, 196); },
  // The Proctor's seal: a heavy thud and a dull ring.
  stamp: t => { burst('lowpass', 300, 0.7, 0.16, t); tone('sine', 80, 0.5, 0.3, t, 48); tone('sine', 420, 0.05, 0.9, t + 0.02); tone('sine', 663, 0.03, 0.7, t + 0.02); },
  // The sale: a low struck tone, a fifth above it, slow to fade.
  coins: t => { tone('sine', 110, 0.22, 1.8, t); tone('sine', 165, 0.12, 1.6, t + 0.12); tone('triangle', 330, 0.04, 1.2, t + 0.12); burst('lowpass', 500, 0.25, 0.2, t); },
  clunk: t => { tone('sine', 70, 0.6, 0.35, t, 45); burst('lowpass', 600, 0.4, 0.25, t); },
  crash: t => { burst('lowpass', 2400, 0.9, 1.6, t, 90); tone('sawtooth', 50, 0.4, 1.2, t, 25); },
  chime: t => { tone('sine', 660, 0.1, 0.35, t); tone('sine', 990, 0.09, 0.5, t + 0.16); },
  warn: t => { tone('square', 880, 0.04, 0.09, t); tone('square', 880, 0.04, 0.09, t + 0.18); },
};
export function sfx(name) { if (!ctx || ctx.state !== 'running' || !SHOTS[name]) return; SHOTS[name](ctx.currentTime + 0.01); }
