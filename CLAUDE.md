# Starwake

A 3D space exploration game with real-scale, Newtonian flight. You fly the Mudlark, a small, battered transport (about 35 m, Millennium Falcon style) with contraband in the hold, around Veyra (an Earth-sized ringed planet) and its moon Tal, and dock at Tumbledown, a huge station for outcasts and misfits, where a vast, dark hangar, an easy customs check and a broker end the first run. Built with three.js and Vite, no framework. Craig plays it mostly on his phone (often landscape), and sometimes on a desktop with keyboard and mouse. Both have to work.

## Commands

```bash
npm install
npm run dev        # dev server; open the "Network" URL on a phone on the same Wi-Fi
npm test           # physics, handling and terrain tests (Vitest, runs in Node)
npm run check:tal  # compares Tal's JS terrain with the GPU bake in headless Chromium; refreshes the test fixture
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

Add `?debug` to the URL to get `window.starwake = {S, O, ST, HB, actions, W, cam, talAgl, talGroundVel, moonPos, orbInfo, hangar, sound}` in the console (state, orbit readouts, Tumbledown's and the Halberd's position and velocity, actions, world objects, camera, height above and velocity of Tal's ground, Tal's position, readout refresh after editing `S`, the hangar module once loaded, the audio context and master gain for listening in with an analyser; `W.terrain.stats()` shows chunk counts), plus a line under the readouts with frame rate, triangles, draw calls and chunk counts. Useful for headless checks with Playwright and for checking performance on a phone.

Before finishing any change: `npm test` passes, `npm run build` succeeds, and the change has been looked at in a browser (a phone-sized viewport too if it touches the HUD or controls).

## Architecture

| File | Responsibility |
|---|---|
| `src/config.js` | All constants, in SI units (metres, seconds). Planet, moon, ring, terrain, landing limits, ships as data: `TRANSPORT` (the Mudlark: thrust, turn rates, gear, contact points, camera framing; `SHIP` is the one the player flies) and `HALBERD` (its model), `STATION` (Tumbledown: orbit, size, bay, docking range, pad) and `PATROL` (the Halberd's orbit). Plain numbers, no three.js (the terrain worker imports it). |
| `src/physics.js` | Flight model. **No DOM, no rendering.** State `S`, orbital readouts `O`, `stepFlight(dt, input)`, holds, hover mode (`setHover`), warp limits, orbit prediction, Tal's spin and ground-relative readouts, braking cue, landing (contact points, touchdown rules, landed state, take-off, crash checkpoint). Tumbledown `ST` and the Halberd `HB` (stepped under the same gravity, `lvlhQuat` for their attitude, `ringAngle` for the wheel), collision with the station, docking (`requestDock`, `startUndock`, the run as paths in the station's frame), `snapshot`/`restore` (checkpoint and save). Reads the ship from `SHIP`. |
| `src/engine.js` | Renderer, cameras, sky scene and sun, lights (the sun's shadow box is sized to the ship), environment map. |
| `src/sky.js` | Stars (realistic brightness and colour spread), the Milky Way glow (baked once), and the exposure that dims them when something bright fills the view. |
| `src/bake.js`, `src/shaders.js` | GPU-generated cube maps (planet height, colour, normals, clouds; moon) and the per-frame shaders (surface, clouds, atmosphere, ring). |
| `src/noise.js`, `src/tal.js` | JS port of the GLSL noise, and Tal's height in metres (`talHeight` = the bake's `talBase` plus `talDetail`, small craters and roughness that exist only in JS). For terrain meshes, collision and radar altitude. No DOM, so a Web Worker can use them. |
| `src/world.js` | Builds and updates everything drawn in the universe, plus ring rocks and the map-view orbit line. Places Tumbledown and the Halberd, and dims the sun inside the bay. |
| `src/station.js` | Tumbledown's model, built from primitives in metres: hub, bay 3 (hangar, pad, crates, sliding doors), the turning wheel with shacks and windows, wings, dish, sign, beacons and guide lights. `update(t, bay, rt)` turns the wheel, moves the doors and blinks the lights. |
| `src/terrain.js`, `src/terrain-build.js`, `src/terrain-worker.js` | Tal's ground: cube-sphere quadtree of chunks that refine as the camera gets closer. Chunks are built from `talHeight` in Web Workers; `terrain-build.js` is pure so tests can check it. |
| `src/ship/transport.js` | The player's ship, built from primitives in metres: saucer hull, cargo prongs, cockpit pod, engine band, lift thrusters, landing gear (`setLegs`), two small turrets. |
| `src/ship/destroyer.js` | The Halberd, the navy's destroyer (on patrol, just flying for now), in ship units (×`HALBERD.scale` = metres). Also exports the hull panel textures and box helpers both models use. |
| `src/ship/bridge.js` | Cockpit interior (its own scene and camera) and its live screens and dials. |
| `src/camera.js` | Chase, cockpit and map views; chase blends into a landing view while the gear is down. |
| `src/input.js` | Keyboard, mouse, touch gestures, on-screen buttons. Produces the input for `stepFlight`. |
| `src/hud.js` | HTML overlay: readouts, markers, flight-computer buttons, toasts, braking cue, touchdown and docking light, docking offer, intro, docked and crash cards. Reads state each frame. |
| `src/game.js` | The game around the flight, no DOM: credits, the hold, the first run (customs, then the trader) as cards with choices (`talk`, `choose`). Per-visit state resets on undocking. |
| `src/hangar/` | The hangar, loaded on demand (`import()`) when you ask to dock, built in code with no files. `hangar.js`: its own scene (the hall, the light shaft, haze and dust, the Mudlark on its pad, checkpoint, market, container yard, hauler, crane, the crowd and what each one does, the orbit camera, picking). `figures.js`: robed figures, guards and drones, and how they walk, breathe and gesture. `paths.js`: the walking loops, the hauler's loop and floor spots, pure, tested. `ui.js`: the overlay, cards, name tags, lines from the crowd, gestures. |
| `src/sound.js` | Web Audio, synthesized (no files): engine, lift and thruster beds, bay doors, the hangar's drone, rumble, air and clanks, one-shots (clunk, crash, chime, seal, sale, taps). No music yet. Starts after the first tap or key; on/off remembered. Phone speakers play almost nothing below about 150 Hz, so every sound keeps most of its energy above that (low tones carry harmonics); on an iPhone the audio session is set to playback so the silent switch does not mute it. |
| `src/save.js` | One save in `localStorage` (`starwake.save`): the physics snapshot plus the game state. Every call may quietly do nothing (private windows). |
| `src/main.js` | Wiring and the frame loop: when to offer docking, entering and leaving the hangar, sound events, when to save. |

Key ideas:

- **Universe frame**: inertial, centred on Veyra, metres. Physics lives here, in doubles.
- **Floating origin**: each frame `W.world.position = -S.pos`, so the ship is always at the render origin. Never put the ship far from the origin in render space; float32 precision breaks at planetary distances.
- **Tal's body frame** is `W.moon` (a Group; Tal is tidally locked, so it turns once per orbit). `talQuat(t)` in physics gives the same rotation; heights from `tal.js` and terrain chunks live in this frame.
- **Render order** per frame: sky scene (no depth), clear depth, main scene, then the bridge scene (only in bridge view) over it.
- **Log depth buffer** is on (near 0.5 m, far 2e10 m). Custom shaders must include the `logdepthbuf` chunks (see `SURF_VERT` and the `*_FRAG` shaders).
- **The hangar replaces space while docked**: its own scene and camera, drawn instead of the space render (physics keeps stepping, so the station and the Halberd move on). Its code and models are a separate chunk fetched when docking starts, so they are usually in by the time the doors close; until then the docked card shows progress (or why it failed, with Undock).
- **The hangar's lighting** is dark on purpose: one shadow-casting spot light from the opening in the roof, a cold spot on the checkpoint, the Factor's lantern, fog, and painted-on light (additive washes on the walls and floor) instead of more real lights, so it stays cheap on a phone. The light shaft is a custom `ShaderMaterial`, so it includes the `logdepthbuf` chunks.
- **three.js is pinned to 0.128.0.** The code uses `outputEncoding`, `sRGBEncoding` and other pre-r152 APIs. Upgrading is a deliberate task, not a side effect.
- `ringDens()` in `RING_FRAG` and `ringDensJS()` in `world.js` describe the same ring profile and must stay in sync.
- `NOISE` and `MOON_H` in `shaders.js` and `noise.js` / `tal.js` describe the same terrain and must stay in sync. After changing either, run `npm run check:tal` (all 1.57 million texels must agree) and commit the refreshed `tests/fixtures/tal-bake.json`.
- Noise must give the same numbers on every GPU and in JS: hash with integers (the PCG `hash3`), never `fract(sin(x)*big)`, and avoid discontinuities (a value that jumps at an edge differs wherever rounding differs).

## Physics and feel (agreed with Craig, protected by tests)

- Newtonian: thrust changes velocity, nothing slows the ship but engines or atmosphere. Gravity from Veyra and Tal. Start: circular 400 km orbit, about 7.35 km/s, 91 min period, 25 km behind Tumbledown (403 km, drifting closer at about 5 m/s).
- Tal is close and heavy, so its tides stretch a low orbit by roughly ±15 km per lap. That is physical, not an integrator bug (warp levels agree to within metres).
- The transport starts weak, to be upgraded later: main engine 4 m/s² (0.4 g; Boost doubles it), lift thrusters 4 m/s², retro thrusters 1 m/s². Enough to land on Tal (1.5 m/s²), not on Veyra (9.6). Values in `TRANSPORT`.
- Rotation is rate-command with attitude hold: max about 10°/s pitch, 8°/s yaw, 14°/s roll; thrusters stop a turn in under half a second (~1.2° overshoot). A 180° flip takes about 22 s. Values in `TRANSPORT.rate`/`acc`.
- Stick and mouse use an expo curve (`0.25v + 0.75v³`) for fine control near centre.
- Flight computer holds: prograde, retrograde, face Veyra, face Tal. Any manual steering cancels holds and time warp.
- Below 20 km over Tal (`SURFACE_ALT`) speeds, the prograde/retrograde holds and the velocity markers are relative to Tal's turning ground (up to 113 m/s at its equator), and the readouts switch to ground speed, height, horizontal speed and time to impact.
- Braking cue: the latest moment a full-thrust retrograde burn can start and keep the ship's lowest point at least `BRAKE_CLEAR` (150 m) above the ground all along the burn ("Brake in 14 s", then "Brake now"). It works from 60 km down (`CUE_ALT`), because with the weak engine braking from orbit takes minutes, and checks a profile of the ground along the whole path. Tested over many deorbit burns: burning on the cue never comes within about 120 m of the ground and mostly stops 130 to 310 m up; shallow paths stop higher (up to 1.3 km), because a ridge on the way decides when to brake.
- Low over Tal, Retrograde leans toward upright as the ship slows (`UP_BIAS`, below 30 m/s), so it ends up standing on its tail at a hover and leans against any drift.
- Hover mode (low over Tal, below 20 km): the thrust slider drives the belly lift thrusters (hover at about 37%). Whenever the stick is let go, the ship levels itself and leans up to 15° against drift, so it comes to a stop over the ground; steering tilts it to move. Switched on nose-up after a braking burn, the main engine carries part of the thrust while the ship swings level, so it does not drop. Prograde and Retrograde are off while hovering. Turning hover on starts at hover thrust; off cuts the thrust.
- Time warp 1×, 10×, 100×, 1000×; limited to 100× in the atmosphere, 10× within 5 km of Tal's ground, and lower when a surface is coming up. Any warp once landed.
- Hard deck at 15 km on Veyra until landing there exists.
- Landing on Tal is belly-down on four gear legs, which come down below 1.5 km (`gearAlt`) and go up above 1.7 km. Touchdown limits: under 3 m/s down, 1.5 m/s sideways, tilted under 8°, on ground sloping under 12°; 3 to 6 m/s down is a hard landing (a warning). Anything else, or any hull point touching the ground, is a crash: a card says why, with Try again (checkpoint saved passing 15 km on the way down, and at each landing) and Back to orbit. No damage model.
- Landed, the pose is fixed in Tal's body frame, so the ship turns with the ground at any warp. Lift above hover takes off.
- Tumbledown: a wheel 2.6 km across turning once every 72 s, the bay at the back of its hub facing back along the orbit. Within 10 km (`dockRange`) and slower than 50 m/s relative (`dockSpeed`), "Request docking" and "Not now" appear and time warp drops to 1× (Not now hides it until you leave that range; after undocking it waits until you are 3 km out). Station control then flies the ship (brakes, goes round the station if needed, lines up 1 km behind it, flies into bay 3 at about 12 m/s, sets down on the pad); no input counts until it lets go. Docked, the pose is fixed in the station's frame at any warp. Undocking backs out, turns around once clear and lets go at 3 m/s. Warp up to 100× during the run. Hitting the station (hub, wheel and spokes, wings, dish) is a crash.
- The Halberd flies a 420 km patrol orbit, starting 70 km ahead; the Mudlark passes 10 to 25 km under it. Both NPCs move under the same gravity as the ship.
- The first run: you start with 120 credits and 8 crates of ashroot. In the hangar Proctor Vey walks over for customs: every answer clears you; paying the 20-credit berth tithe makes the Factor pay 10% more. The Factor pays 150 a crate for the ashroot; asking for more once has a 60% chance of 15% more and never lowers the price. Selling ends the first run. Customs again on every visit.
- Saving: on docking, in the hangar after customs and the sale, every minute of flight, on pause and when the page is hidden; the intro card offers Continue and New game. The crash checkpoint is also kept within 20 km of the station and on docking.
- `tests/physics.test.js` checks orbit stability, warp accuracy, the deorbit burn, the hard deck, flip time and stopping, the braking cue, hover (levels and stops drift, steering moves it, switching on nose-up keeps height) and landing: a full approach from orbit lands, fast, tilted and steep touchdowns crash, take-off works, a landed ship stays put through 1000× warp, a crash restarts from the checkpoint; and docking: the offer and its limits, docking onto the pad (and staying through 1000× warp), going round from in front, undocking nose first, hitting the station, a save brought back exactly, the Halberd's pass. `tests/game.test.js` checks the first run's rules, `tests/hangar.test.js` that every walking path stays clear of the ship, the stalls and the walls. If a change fails one of these, it changed how the ship flies: confirm it is intended.

## Controls (touch is the primary target)

- One finger anywhere: steering stick appears where the finger lands. With **Look** on, one finger moves the camera instead.
- Two thumbs: twist like a steering wheel to roll (clockwise rolls right; ~4° dead zone, full rate at ~26°), pinch to zoom.
- Map view: one finger rotates the map, pinch zooms.
- Right side: thrust slider and Boost (double thrust while held). In hover mode the slider is "Lift", with a green mark at hover. Left side: time warp, Prograde, Retrograde, Roll buttons, and Hover above them when low over Tal.
- Tap Veyra, Tal, Tumbledown, the Halberd or the green motion markers to have the flight computer face them.
- Tumbledown's marker shows its distance, and inside 100 km the speed relative to it. In range: Request docking or Not now at the top of the screen.
- Hangar: one finger or the mouse turns the view, pinch or the wheel zooms, a tap on someone talks to them (the Proctor and the Factor open a card, anyone else says a line). Buttons: Customs, Market, Look around, Undock. Sound on and off is on the pause card.
- Keyboard: W/S thrust, Z/X full/cut, A/D yaw, arrows pitch, Q/E roll, Shift boost, Space retro, F/R holds, G hover, `,`/`.` warp, C cycle camera, M map, Enter request docking or undock, Esc pause.

## Style

- UI copy: sentence case, plain words, no em dashes.
- Single dark visual identity: Michroma for labels, Barlow for text, IBM Plex Mono for numbers. Amber `#ffb14a` accent, green `#b9f06e` for flight-computer states.
- Keep the HUD clear on a 375 px wide phone in portrait and a 390 px tall phone in landscape.
- The world's tone is dark, heavy science fiction (think Dune): haze, one shaft of light, monumental concrete, robed and masked figures, terse lines with a sense of threat. No neon, no cartoon characters, no jokes in the writing.

## Known limits

- Veyra's surface detail is tuned for orbit; it turns soft below about 50 km. Tal's ground has real detail down to craters about 70 m across and roughness at 40 m.
- Ring rocks have no collision. Only the ship casts shadows (on itself and on Tal's ground).
- Credits and cargo exist for the first run only: no jobs, upgrades or fuel yet. Landing only on Tal.
- The hangar is a view, not a place to walk; the crowd follows set loops and can pass through each other.
- Tumbledown's outside still has the first, brighter look (a neon sign, painted shacks); it gets the hangar's darker treatment in a later pass.
- The Halberd only flies; it does not scan or react yet.
- The cockpit view reuses the old destroyer bridge interior, which is roomier than the transport's pod.

## Roadmap

You fly a **small smuggler's transport** with contraband in the hold and small guns, slow at first and upgradable. The first mission docks at a huge station for outcasts and misfits (automatic docking once you are close), clears an easy customs check in a vast, dark hangar, and sells the cargo. The Halberd stays as a navy destroyer on patrol. The full plan, with the first mission, phases and open decisions, is `docs/game-plan.md`.

1. **Landing on Tal**: works. Built in `docs/tal-landing-plan.md` (for the Halberd), then moved to the transport.
2. **The new ship**: done (phase 1): the model, weak handling as data, hover mode, belly-down landing on Tal.
3. **The station and docking**: works (phase 2): Tumbledown, "Request docking", automatic docking into bay 3 and undocking, the Halberd on patrol, saving.
4. **The hangar**: works (phase 3, rebuilt darker): bay 3 as a vast hall in haze with one shaft of light, robed figures, customs with Proctor Vey, selling the ashroot to the Factor, first sounds; the first mission end to end.
5. **Upgrades and jobs**, then **trouble** (navy scans, raiders, fights), then **Veyra** (re-entry, landing at cities), then further out.
