# Starwake

A 3D space exploration game with real-scale, Newtonian flight. You fly the Halberd (DD-07), a 400 m destroyer, around Veyra (an Earth-sized ringed planet) and its moon Tal. Built with three.js and Vite, no framework. Craig plays it mostly on his phone (often landscape), and sometimes on a desktop with keyboard and mouse. Both have to work.

## Commands

```bash
npm install
npm run dev        # dev server; open the "Network" URL on a phone on the same Wi-Fi
npm test           # physics, handling and terrain tests (Vitest, runs in Node)
npm run check:tal  # compares Tal's JS terrain with the GPU bake in headless Chromium; refreshes the test fixture
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

Add `?debug` to the URL to get `window.starwake = {S, O, actions, W}` in the console (state, orbit readouts, actions, world objects). Useful for headless checks with Playwright.

Before finishing any change: `npm test` passes, `npm run build` succeeds, and the change has been looked at in a browser (a phone-sized viewport too if it touches the HUD or controls).

## Architecture

| File | Responsibility |
|---|---|
| `src/config.js` | All constants, in SI units (metres, seconds). Planet, moon, ring, ship, handling. |
| `src/physics.js` | Flight model. **No DOM, no rendering.** State `S`, orbital readouts `O`, `stepFlight(dt, input)`, holds, warp limits, orbit prediction. |
| `src/engine.js` | Renderer, cameras, sky scene (stars, sun), lights, environment map. |
| `src/bake.js`, `src/shaders.js` | GPU-generated cube maps (planet height, colour, normals, clouds; moon) and the per-frame shaders (surface, clouds, atmosphere, ring). |
| `src/noise.js`, `src/tal.js` | JS port of the GLSL noise, and Tal's height in metres (`talHeight`). For terrain meshes, collision and radar altitude. No DOM, so a Web Worker can use them. |
| `src/world.js` | Builds and updates everything drawn in the universe, plus ring rocks and the map-view orbit line. |
| `src/ship/destroyer.js` | The Halberd model, built from primitives in ship units (×`SHIP_SCALE` = metres). |
| `src/ship/bridge.js` | Bridge interior (its own scene and camera) and its live screens and dials. |
| `src/camera.js` | Chase, bridge and map views. |
| `src/input.js` | Keyboard, mouse, touch gestures, on-screen buttons. Produces the input for `stepFlight`. |
| `src/hud.js` | HTML overlay: readouts, markers, flight-computer buttons, toasts, intro card. Reads state each frame. |
| `src/main.js` | Wiring and the frame loop. |

Key ideas:

- **Universe frame**: inertial, centred on Veyra, metres. Physics lives here, in doubles.
- **Floating origin**: each frame `W.world.position = -S.pos`, so the ship is always at the render origin. Never put the ship far from the origin in render space; float32 precision breaks at planetary distances.
- **Render order** per frame: sky scene (no depth), clear depth, main scene, then the bridge scene (only in bridge view) over it.
- **Log depth buffer** is on (near 0.5 m, far 2e10 m). Custom shaders must include the `logdepthbuf` chunks (see `SURF_VERT` and the `*_FRAG` shaders).
- **three.js is pinned to 0.128.0.** The code uses `outputEncoding`, `sRGBEncoding` and other pre-r152 APIs. Upgrading is a deliberate task, not a side effect.
- `ringDens()` in `RING_FRAG` and `ringDensJS()` in `world.js` describe the same ring profile and must stay in sync.
- `NOISE` and `MOON_H` in `shaders.js` and `noise.js` / `tal.js` describe the same terrain and must stay in sync. After changing either, run `npm run check:tal` (all 1.57 million texels must agree) and commit the refreshed `tests/fixtures/tal-bake.json`.
- Noise must give the same numbers on every GPU and in JS: hash with integers (the PCG `hash3`), never `fract(sin(x)*big)`, and avoid discontinuities (a value that jumps at an edge differs wherever rounding differs).

## Physics and feel (agreed with Craig, protected by tests)

- Newtonian: thrust changes velocity, nothing slows the ship but engines or atmosphere. Gravity from Veyra and Tal. Start: circular 400 km orbit, about 7.35 km/s, 91 min period.
- Tal is close and heavy, so its tides stretch a low orbit by roughly ±15 km per lap. That is physical, not an integrator bug (warp levels agree to within metres).
- Rotation is rate-command with attitude hold: max 8°/s pitch and yaw, 10°/s roll; thrusters stop a turn in under half a second (~1.7° overshoot). A 180° flip takes about 25 to 30 s. Values in `RATE`/`ACC`.
- Stick and mouse use an expo curve (`0.25v + 0.75v³`) for fine control near centre.
- Flight computer holds: prograde, retrograde, face Veyra, face Tal. Any manual steering cancels holds and time warp.
- Time warp 1×, 10×, 100×, 1000×; limited to 100× in the atmosphere and lower when a surface is coming up.
- Hard deck at 15 km on Veyra and 3 km on Tal until landing exists.
- `tests/physics.test.js` checks orbit stability, warp accuracy, the deorbit burn, the hard deck, flip time and stopping. If a change fails one of these, it changed how the ship flies: confirm it is intended.

## Controls (touch is the primary target)

- One finger anywhere: steering stick appears where the finger lands. With **Look** on, one finger moves the camera instead.
- Two thumbs: twist like a steering wheel to roll (clockwise rolls right; ~4° dead zone, full rate at ~26°), pinch to zoom.
- Map view: one finger rotates the map, pinch zooms.
- Right side: thrust slider and Boost (double thrust while held). Left side: time warp, Prograde, Retrograde, Roll buttons.
- Tap Veyra, Tal or the green motion markers to have the flight computer face them.
- Keyboard: W/S thrust, Z/X full/cut, A/D yaw, arrows pitch, Q/E roll, Shift boost, Space retro, F/R holds, `,`/`.` warp, C cycle camera, M map, Esc pause.

## Style

- UI copy: sentence case, plain words, no em dashes.
- Single dark visual identity: Michroma for labels, Barlow for text, IBM Plex Mono for numbers. Amber `#ffb14a` accent, green `#b9f06e` for flight-computer states.
- Keep the HUD clear on a 375 px wide phone in portrait and a 390 px tall phone in landscape.

## Known limits

- Planet surface detail is tuned for orbit; it turns soft below about 50 km.
- Ring rocks have no collision. Only the ship casts shadows.
- No fuel, no objectives yet.

## Roadmap

1. **Landing on Tal**: in progress. Plan, decisions and status in `docs/tal-landing-plan.md`.
2. **Landing on Veyra**: same terrain system plus atmospheric entry (heating, drag, descent).
3. **Core loop**: fuel and delta-v budget so burns cost something; places worth reaching (survey sites, a station to refuel and dock with, wrecks).
4. Later: more of the system, then other star systems.
