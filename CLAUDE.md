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

Add `?debug` to the URL to get `window.starwake = {S, O, actions, W, cam, talAgl, talGroundVel, moonPos, orbInfo}` in the console (state, orbit readouts, actions, world objects, camera, height above and velocity of Tal's ground, Tal's position, readout refresh after editing `S`; `W.terrain.stats()` shows chunk counts), plus a line under the readouts with frame rate, triangles, draw calls and chunk counts. Useful for headless checks with Playwright and for checking performance on a phone.

Before finishing any change: `npm test` passes, `npm run build` succeeds, and the change has been looked at in a browser (a phone-sized viewport too if it touches the HUD or controls).

## Architecture

| File | Responsibility |
|---|---|
| `src/config.js` | All constants, in SI units (metres, seconds). Planet, moon, ring, ship, handling, terrain. Plain numbers, no three.js (the terrain worker imports it). |
| `src/physics.js` | Flight model. **No DOM, no rendering.** State `S`, orbital readouts `O`, `stepFlight(dt, input)`, holds, warp limits, orbit prediction, Tal's spin and ground-relative readouts, braking cue, landing (contact points, touchdown rules, landed state, take-off, crash checkpoint). |
| `src/engine.js` | Renderer, cameras, sky scene and sun, lights, environment map. |
| `src/sky.js` | Stars (realistic brightness and colour spread), the Milky Way glow (baked once), and the exposure that dims them when something bright fills the view. |
| `src/bake.js`, `src/shaders.js` | GPU-generated cube maps (planet height, colour, normals, clouds; moon) and the per-frame shaders (surface, clouds, atmosphere, ring). |
| `src/noise.js`, `src/tal.js` | JS port of the GLSL noise, and Tal's height in metres (`talHeight` = the bake's `talBase` plus `talDetail`, small craters and roughness that exist only in JS). For terrain meshes, collision and radar altitude. No DOM, so a Web Worker can use them. |
| `src/world.js` | Builds and updates everything drawn in the universe, plus ring rocks and the map-view orbit line. |
| `src/terrain.js`, `src/terrain-build.js`, `src/terrain-worker.js` | Tal's ground: cube-sphere quadtree of chunks that refine as the camera gets closer. Chunks are built from `talHeight` in Web Workers; `terrain-build.js` is pure so tests can check it. |
| `src/ship/destroyer.js` | The Halberd model, built from primitives in ship units (×`SHIP_SCALE` = metres), with its landing legs (`setLegs`). Leg and hull contact points are in `config.js`. |
| `src/ship/bridge.js` | Bridge interior (its own scene and camera) and its live screens and dials. |
| `src/camera.js` | Chase, bridge and map views; chase blends into a landing view while the legs are down. |
| `src/input.js` | Keyboard, mouse, touch gestures, on-screen buttons. Produces the input for `stepFlight`. |
| `src/hud.js` | HTML overlay: readouts, markers, flight-computer buttons, toasts, braking cue, touchdown light, intro and crash cards. Reads state each frame. |
| `src/main.js` | Wiring and the frame loop. |

Key ideas:

- **Universe frame**: inertial, centred on Veyra, metres. Physics lives here, in doubles.
- **Floating origin**: each frame `W.world.position = -S.pos`, so the ship is always at the render origin. Never put the ship far from the origin in render space; float32 precision breaks at planetary distances.
- **Tal's body frame** is `W.moon` (a Group; Tal is tidally locked, so it turns once per orbit). `talQuat(t)` in physics gives the same rotation; heights from `tal.js` and terrain chunks live in this frame.
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
- Below 20 km over Tal (`SURFACE_ALT`) speeds, the prograde/retrograde holds and the velocity markers are relative to Tal's turning ground (up to 113 m/s at its equator), and the readouts switch to ground speed, height, horizontal speed and time to impact.
- Braking cue: the latest moment a full-thrust retrograde burn can start and still stop with the stern `BRAKE_CLEAR` (150 m) above the ground ("Brake in 14 s", then "Brake now"). Tested: burning on the cue stops 100 to 160 m up.
- Low over Tal, Retrograde leans toward upright as the ship slows (`UP_BIAS`, below 30 m/s), so it ends up standing on its tail at a hover and leans against any drift.
- Time warp 1×, 10×, 100×, 1000×; limited to 100× in the atmosphere, 10× within 5 km of Tal's ground, and lower when a surface is coming up. Any warp once landed.
- Hard deck at 15 km on Veyra until landing there exists.
- Landing on Tal is tail-down on four legs at the stern. They deploy below 3 km (`LEG_ALT`) and stow again above 3.45 km. Touchdown limits: under 3 m/s down, 1.5 m/s sideways, 8° from upright, on ground sloping under 12°; 3 to 6 m/s down is a hard landing (a warning). Anything else, or any hull point touching the ground, is a crash: a card says why, with Try again (checkpoint saved passing 15 km on the way down, and at each landing) and Back to orbit. No damage model.
- Landed, the pose is fixed in Tal's body frame, so the ship turns with the ground at any warp. Thrust above hover (Tal's gravity is 1.5 m/s², about 6% throttle) takes off.
- `tests/physics.test.js` checks orbit stability, warp accuracy, the deorbit burn, the hard deck, flip time and stopping, the braking cue, and landing: a full approach from orbit lands, fast, tilted and steep touchdowns crash, take-off works, a landed ship stays put through 1000× warp, a crash restarts from the checkpoint. If a change fails one of these, it changed how the ship flies: confirm it is intended.

## Controls (touch is the primary target)

- One finger anywhere: steering stick appears where the finger lands. With **Look** on, one finger moves the camera instead.
- Two thumbs: twist like a steering wheel to roll (clockwise rolls right; ~4° dead zone, full rate at ~26°), pinch to zoom.
- Map view: one finger rotates the map, pinch zooms.
- Right side: thrust slider and Boost (double thrust while held). With the legs down the slider (and W/S) covers 0 to 18% ("Fine", with a green mark at hover); a burn already above that keeps going until you touch it, and Z and Boost still give full power. Left side: time warp, Prograde, Retrograde, Roll buttons.
- Tap Veyra, Tal or the green motion markers to have the flight computer face them.
- Keyboard: W/S thrust, Z/X full/cut, A/D yaw, arrows pitch, Q/E roll, Shift boost, Space retro, F/R holds, `,`/`.` warp, C cycle camera, M map, Esc pause.

## Style

- UI copy: sentence case, plain words, no em dashes.
- Single dark visual identity: Michroma for labels, Barlow for text, IBM Plex Mono for numbers. Amber `#ffb14a` accent, green `#b9f06e` for flight-computer states.
- Keep the HUD clear on a 375 px wide phone in portrait and a 390 px tall phone in landscape.

## Known limits

- Veyra's surface detail is tuned for orbit; it turns soft below about 50 km. Tal's ground has real detail down to craters about 70 m across and roughness at 40 m.
- Ring rocks have no collision. Only the ship casts shadows (on itself and on Tal's ground).
- No fuel, no objectives yet. Landing only on Tal.

## Roadmap

The game is a **frontier patrol**: the Halberd is the only warship in a young colony system, answering distress calls, escorting and inspecting freighters, and hunting raiders who hide in the ring. Fuel is generous (time against fuel is the choice, not whether you can get home), and combat comes early, at real distances with a fire-control computer. The full plan, with places, jobs, phases and open decisions, is `docs/game-plan.md`.

1. **Landing on Tal**: works (steps 1 to 5); polish next (step 6). Plan, decisions and status in `docs/tal-landing-plan.md`.
2. **Home port**: fuel, sideways thrusters, a station in Veyra orbit to rendezvous and dock with, saving, first sounds.
3. **Guns**: turrets with fire control, point defence, damage and repairs, a firing range, the first raider.
4. **A lived-in system**: freighters and miners on real orbits, jobs, raiders in the ring, pay, rank and upgrades, the first story arc.
5. **Landing on Veyra**: same terrain system plus atmospheric entry (heating, drag, descent), ports in the cities.
6. Later: the rest of the system, then other stars.
