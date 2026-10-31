# Starwake

A 3D space exploration game with real-scale, Newtonian flight. You fly the Mudlark, a small transport (about 35 m, black and angular, Harkonnen style) with contraband in the hold, around Veyra (an Earth-sized ringed planet) and its moon Tal, and dock at Tumbledown, a huge station for outcasts and misfits, where a vast, dark hangar, an easy customs check and a broker end the first run. After that: delivery jobs to outposts on Tal, flown there and back by the flight computer, with upgrades and fuel from a shipwright. Built with three.js and Vite, no framework. Craig plays it mostly on his phone (often landscape), and sometimes on a desktop with keyboard and mouse. Both have to work.

## Commands

```bash
npm install
npm run dev        # dev server; open the "Network" URL on a phone on the same Wi-Fi
npm test           # physics, handling and terrain tests (Vitest, runs in Node)
npm run check:tal  # compares Tal's JS terrain with the GPU bake in headless Chromium; refreshes the test fixture
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

Add `?debug` to the URL to get `window.starwake = {S, O, ST, HB, G, actions, W, cam, talAgl, talGroundVel, moonPos, outpostPos, orbInfo, hangar, sound}` in the console (state, orbit readouts, Tumbledown's and the Halberd's position and velocity, actions, world objects, camera, height above and velocity of Tal's ground, Tal's position, readout refresh after editing `S`, the hangar module once loaded, the audio context and master gain for listening in with an analyser; `W.terrain.stats()` shows chunk counts), plus a line under the readouts with frame rate, triangles, draw calls and chunk counts. Useful for headless checks with Playwright and for checking performance on a phone.

Before finishing any change: `npm test` passes, `npm run build` succeeds, and the change has been looked at in a browser (a phone-sized viewport too if it touches the HUD or controls).

## Architecture

| File | Responsibility |
|---|---|
| `src/config.js` | All constants, in SI units (metres, seconds). Planet, moon, ring, terrain, landing limits, ships as data: `TRANSPORT` (the Mudlark: thrust, turn rates, tanks, gear, hull sections and contact points, camera framing; `SHIP` is the one the player flies, upgrades change it) and `HALBERD` (its model), `STATION` (Tumbledown: orbit, size, bay, docking range, pad), `PATROL` (the Halberd's orbit), `ORBIT_INC` (the plane they and Tal share) and `OUTPOSTS` (on Tal). Plain numbers, no three.js (the terrain worker imports it). |
| `src/physics.js` | Flight model. **No DOM, no rendering.** State `S`, orbital readouts `O`, `stepFlight(dt, input)`, holds, hover mode (`setHover`), warp limits, orbit prediction, Tal's spin and ground-relative readouts, braking cue, landing (contact points, touchdown rules, landed state, take-off, crash checkpoint). Tumbledown `ST` and the Halberd `HB` (stepped under the same gravity, `lvlhQuat` for their attitude, `ringAngle` for the wheel), collision with the station, docking (`requestDock`, `startUndock`, the run as paths in the station's frame), the tug (`towIn`), fuel (`S.fuel`), outposts (`outpostPos`, the nearest in `O.outpost`), a direction hold for the flight computer, `snapshot`/`restore` (checkpoint and save). Reads the ship from `SHIP`. |
| `src/engine.js` | Renderer, cameras, sky scene and sun, lights (the sun's shadow box is sized to the ship), environment map. |
| `src/sky.js` | Stars (realistic brightness and colour spread), the Milky Way glow (baked once), and the exposure that dims them when something bright fills the view. |
| `src/bake.js`, `src/shaders.js` | GPU-generated cube maps (planet height, colour, normals, clouds; moon) and the per-frame shaders (surface, clouds, atmosphere, ring). |
| `src/noise.js`, `src/tal.js` | JS port of the GLSL noise, and Tal's height in metres (`talHeight` = the bake's `talBase` plus `talDetail`, small craters and roughness that exist only in JS). For terrain meshes, collision and radar altitude. No DOM, so a Web Worker can use them. |
| `src/world.js` | Builds and updates everything drawn in the universe, plus ring rocks and the map-view orbit line. Places Tumbledown, the Halberd and the outposts, and dims the sun inside the bay. |
| `src/station.js` | Tumbledown's model, brutalist, built from primitives in metres: an octagonal concrete hub with collars, fins, blocks and slit windows, a spire; bay 3 behind sliding doors, inside like the hangar (unlit concrete, buttresses, lamp niches, banners, the shaft of light on the pad); the turning wheel of ribbed concrete with blocks and slit windows; radiator slabs; beacons and guide lights. `update(t, bay, rt)` turns the wheel, moves the doors and blinks the lights. |
| `src/textures.js` | Canvas textures and the light shaft shader shared by bay 3 seen from space (`station.js`) and the hangar, so the two are the same place: concrete, ribbed metal, banners, carved letters, painted-on light (`wash`), `lightShaft`. |
| `src/terrain.js`, `src/terrain-build.js`, `src/terrain-worker.js` | Tal's ground: cube-sphere quadtree of chunks that refine as the camera gets closer. Chunks are built from `talHeight` in Web Workers; `terrain-build.js` is pure so tests can check it. |
| `src/ship/transport.js` | The player's ship, built from primitives in metres: a faceted black hull lofted through `TRANSPORT.sections`, blades along the spine, spikes, swept fins, a cockpit block with a red slit, three hexagonal engines, lift thrusters, landing gear (`setLegs`), two turrets, a sensor mast. |
| `src/ship/destroyer.js` | The Halberd, the navy's destroyer (on patrol, just flying for now), in ship units (×`HALBERD.scale` = metres). Also exports the hull panel textures and box helpers both models use. |
| `src/ship/bridge.js` | Cockpit interior (its own scene and camera) and its live screens and dials. |
| `src/camera.js` | Chase, cockpit and map views; chase blends into a landing view while the gear is down. |
| `src/input.js` | Keyboard, mouse, touch gestures, on-screen buttons. Produces the input for `stepFlight`. |
| `src/hud.js` | HTML overlay: readouts and fuel, markers (outposts too), flight-computer buttons, toasts, braking cue, touchdown, docking and course light, docking and tug offers, intro, docked, course, delivery and crash cards. Reads state each frame. |
| `src/course.js` | The flight computer's courses, no DOM: to a low orbit of Tal (window, burn until the coast passes Tal 150 km up, corrections, braking into orbit) and back to Tumbledown (levelling a tilted orbit, a burn so the fall bottoms out on the station's orbit, braking into a phasing orbit in its plane, closing in on a point behind it, matching speed, then station control). Closed-loop guidance on predictions under the same gravity; planning spread over frames. `stepCourse(dt)` runs before `stepFlight`; steering or the throttle cancels. |
| `src/outposts.js` | Outposts on Tal (`OUTPOSTS`), in Tal's body frame: a pad with lamps, bunkers with slit windows, a dome, a mast with a red beacon (fixed size on screen, so it shows from orbit). At Kessit Deep, the citadel. |
| `src/citadel.js` | The citadel at Kessit Deep, a test of buildings made in code: a carved stone tower (pilasters, cornices swept round it, niches with robed statues, an octagonal drum and dome), a concrete annex with black slots and lit windows, landing pads on drums, chrome ducts, containers, cranes, two robed colossi at the door (the hangar's figures, scaled up in stone). Merged into one mesh per material (10 draw calls, about 35k triangles). |
| `src/game.js` | The game around the flight, no DOM: credits (below 0 when you owe), the hold, the first run (customs, then the Factor), delivery jobs from the Factor (paid on landing at the outpost), Brannoc the shipwright (upgrades that set `SHIP`'s numbers, fuel), the tug. Cards with choices (`talk`, `choose`). Per-visit state resets on undocking. |
| `src/hangar/` | The hangar, loaded on demand (`import()`) when you ask to dock, built in code with no files. `hangar.js`: its own scene (the hall, the light shaft, haze and dust, the Mudlark on its pad, checkpoint, market, Brannoc's bench, container yard, hauler, crane, the crowd and what each one does, the orbit camera, picking). `figures.js`: robed figures, guards and drones, and how they walk, breathe and gesture. `paths.js`: the walking loops, the hauler's loop and floor spots, pure, tested. `ui.js`: the overlay, cards, name tags, lines from the crowd, gestures. |
| `src/sound.js` | Web Audio, synthesized (no files): engine, lift and thruster beds, bay doors, the hangar's drone, rumble, air and clanks, one-shots (clunk, crash, chime, seal, sale, taps). No music yet. Starts after the first tap or key; on/off remembered. Phone speakers play almost nothing below about 150 Hz, so every sound keeps most of its energy above that (low tones carry harmonics); on an iPhone the audio session is set to playback so the silent switch does not mute it. |
| `src/save.js` | One save in `localStorage` (`starwake.save`): the physics snapshot plus the game state. Every call may quietly do nothing (private windows). |
| `src/main.js` | Wiring and the frame loop: when to offer docking, entering and leaving the hangar, sound events, when to save. |

Key ideas:

- **Universe frame**: inertial, centred on Veyra, metres. Physics lives here, in doubles.
- **One orbit plane**: Tal, Tumbledown, the Halberd and the start orbit share a plane (`ORBIT_INC` from Veyra's equator; physics' `orbitN` and `moonQ`, which world.js also uses to draw Tal's orbit), so trips between the station and Tal need no plane change. Tal is tidally locked, so its equator lies in that plane too, and the outposts sit near it.
- **Floating origin**: each frame `W.world.position = -S.pos`, so the ship is always at the render origin. Never put the ship far from the origin in render space; float32 precision breaks at planetary distances.
- **Tal's body frame** is `W.moon` (a Group; Tal is tidally locked, so it turns once per orbit). `talQuat(t)` in physics gives the same rotation; heights from `tal.js` and terrain chunks live in this frame.
- **Render order** per frame: sky scene (no depth), clear depth, main scene, then the bridge scene (only in bridge view) over it.
- **Log depth buffer** is on (near 0.5 m, far 2e10 m). Custom shaders must include the `logdepthbuf` chunks (see `SURF_VERT` and the `*_FRAG` shaders).
- **The hangar replaces space while docked**: its own scene and camera, drawn instead of the space render (physics keeps stepping, so the station and the Halberd move on). Its code and models are a separate chunk fetched when docking starts, so they are usually in by the time the doors close; until then the docked card shows progress (or why it failed, with Undock).
- **Bay 3 seen from space** is unlit (`MeshBasicMaterial`) with painted-on light and haze, like the hangar, so the sun never lights its inside and the docking run leads into what the hangar shows.
- **The hangar's lighting** is dark on purpose: one shadow-casting spot light from the opening in the roof, a cold spot on the checkpoint, the Factor's lantern, fog, and painted-on light (additive washes on the walls and floor) instead of more real lights, so it stays cheap on a phone. The light shaft is a custom `ShaderMaterial`, so it includes the `logdepthbuf` chunks.
- **three.js is pinned to 0.128.0.** The code uses `outputEncoding`, `sRGBEncoding` and other pre-r152 APIs. Upgrading is a deliberate task, not a side effect.
- `ringDens()` in `RING_FRAG` and `ringDensJS()` in `world.js` describe the same ring profile and must stay in sync.
- `NOISE` and `MOON_H` in `shaders.js` and `noise.js` / `tal.js` describe the same terrain and must stay in sync. After changing either, run `npm run check:tal` (all 1.57 million texels must agree) and commit the refreshed `tests/fixtures/tal-bake.json`.
- Noise must give the same numbers on every GPU and in JS: hash with integers (the PCG `hash3`), never `fract(sin(x)*big)`, and avoid discontinuities (a value that jumps at an edge differs wherever rounding differs).

## Physics and feel (agreed with Craig, protected by tests)

- Newtonian: thrust changes velocity, nothing slows the ship but engines or atmosphere. Gravity from Veyra and Tal. Start: circular 400 km orbit, about 7.35 km/s, 91 min period, 25 km behind Tumbledown (403 km, drifting closer at about 5 m/s).
- Tal is close and heavy, so its tides stretch a low orbit by roughly ±15 km per lap. That is physical, not an integrator bug (warp levels agree to within metres).
- The transport starts weak: main engine 4 m/s² (0.4 g; Boost doubles it), lift thrusters 4 m/s², retro thrusters 1 m/s². Enough to land on Tal (1.5 m/s²), not on Veyra (9.6). Values in `TRANSPORT`; Brannoc's upgrades (`PARTS` in game.js) change them in `SHIP` (engine 5.5 and 7.5, lift 5 and 6.5, turn rates ×1.3 and ×1.6, hold 12 and 16 crates, tanks 26 and 34 km/s).
- Fuel is counted as the speed change it buys (`S.fuel`, tanks of `SHIP.tank`, 20 km/s to start): every m/s² of thrust for a second costs 1 m/s, coasting is free, the engines stop when it runs out (warnings at a fifth and at empty). A trip to Tal and back is about 3 + 4 km/s, plus landing and take-off. Brannoc fills the tanks at 2 credits per 100 m/s. Dry and not docked: "Call a tug" tows the ship into bay 3 for 300 credits (you may end up owing) with a quarter tank.
- Rotation is rate-command with attitude hold: max about 10°/s pitch, 8°/s yaw, 14°/s roll; thrusters stop a turn in under half a second (~1.2° overshoot). A 180° flip takes about 22 s. Values in `TRANSPORT.rate`/`acc`.
- Stick and mouse use an expo curve (`0.25v + 0.75v³`) for fine control near centre.
- Flight computer holds: prograde, retrograde, face Veyra, face Tal. Any manual steering cancels holds and time warp.
- Courses (the Course button, P): from an orbit of Veyra, Course to Tal ends in an orbit of about 150 by 400 km over Tal (about 3.1 km/s, 6 h of game time); from an orbit of Tal more than 20 km up, Course to Tumbledown levels the orbit onto Tal's equator if needed and ends with station control docking (about 3.6 km/s, 9 to 18 h; up to 5.5 from a steeply tilted orbit); from near the station's height it closes in directly. The computer drives time warp (the pilot can lower it) and fires the engine only when the nose is on target. Steering, the throttle, Boost, retro or a hold button hands the controls back.
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
- Outposts on Tal (`OUTPOSTS`: Kessit Deep, Onn Basin, Harrow Rise, Tessaly Flats), near its equator on ground under 2.5° of slope for a kilometre round. Kessit Deep also has the citadel, 340 m from the pad (about 225 m tall, no collision). Landing within 3 km (`OUTPOST_RANGE`) with a job for that outpost delivers it: a card and the pay. The buildings have no collision.
- Work: after the first run the Factor offers three deliveries a visit (3 to 8 crates, 400 to 1,100 credits, more for sealed crates), one at a time, if the hold has room.
- The first run: you start with 120 credits and 8 crates of ashroot. In the hangar Proctor Vey walks over for customs: every answer clears you; paying the 20-credit berth tithe makes the Factor pay 10% more. The Factor pays 150 a crate for the ashroot; asking for more once has a 60% chance of 15% more and never lowers the price. Selling ends the first run. Customs again on every visit.
- Saving: on docking, in the hangar after customs, a sale, taking a job, a purchase, on delivery, every minute of flight, on pause and when the page is hidden; the intro card offers Continue and New game. The crash checkpoint is also kept within 20 km of the station and on docking.
- `tests/physics.test.js` checks orbit stability, warp accuracy, the deorbit burn, the hard deck, flip time and stopping, the braking cue, hover (levels and stops drift, steering moves it, switching on nose-up keeps height) and landing: a full approach from orbit lands, fast, tilted and steep touchdowns crash, take-off works, a landed ship stays put through 1000× warp, a crash restarts from the checkpoint; and docking: the offer and its limits, docking onto the pad (and staying through 1000× warp), going round from in front, undocking nose first, hitting the station, a save brought back exactly, the Halberd's pass; fuel (spent by thrust, engines stop when dry, saved), the shared orbit plane, every outpost landable and found on landing, the tug. `tests/course.test.js` flies the courses: to Tal and back into station control, back from a tilted orbit of Tal, closing in from near the station, the pilot taking over, why a course is refused. `tests/game.test.js` checks the first run's rules, jobs (taking, hold room, delivery at the right outpost only), upgrades (cost, effect on `SHIP`, saved), fuel and the tug, `tests/hangar.test.js` that every walking path stays clear of the ship, the stalls and the walls. If a change fails one of these, it changed how the ship flies: confirm it is intended.

## Controls (touch is the primary target)

- One finger anywhere: steering stick appears where the finger lands. With **Look** on, one finger moves the camera instead.
- Two thumbs: twist like a steering wheel to roll (clockwise rolls right; ~4° dead zone, full rate at ~26°), pinch to zoom.
- Map view: one finger rotates the map, pinch zooms.
- Right side: thrust slider and Boost (double thrust while held). In hover mode the slider is "Lift", with a green mark at hover. Left side: time warp, Prograde, Retrograde, Roll buttons, and Hover above them when low over Tal.
- Tap Veyra, Tal, Tumbledown, the Halberd or the green motion markers to have the flight computer face them. Near Tal, outpost markers show the job's outpost (and any within 300 km); a tap says what is there.
- Course (top right): the flight computer's trips, or Cancel course while one is flying; its status shows in the light at the top. Tanks dry: Call a tug or Not now at the top of the screen.
- Tumbledown's marker shows its distance, and inside 100 km the speed relative to it. In range: Request docking or Not now at the top of the screen.
- Hangar: one finger or the mouse turns the view, pinch or the wheel zooms, a tap on someone talks to them (the Proctor, the Factor and Brannoc open a card, anyone else says a line). Buttons: Customs, Market (the sale, then work), Shipwright (fuel and upgrades; what you cannot afford is shown dimmed), Look around, Undock. Sound on and off is on the pause card.
- Keyboard: W/S thrust, Z/X full/cut, A/D yaw, arrows pitch, Q/E roll, Shift boost, Space retro, F/R holds, G hover, P course, `,`/`.` warp, C cycle camera, M map, Enter request docking or undock, Esc pause.

## Style

- UI copy: sentence case, plain words, no em dashes.
- Single dark visual identity: Michroma for labels, Barlow for text, IBM Plex Mono for numbers. Amber `#ffb14a` accent, green `#b9f06e` for flight-computer states.
- Keep the HUD clear on a 375 px wide phone in portrait and a 390 px tall phone in landscape.
- The world's tone is dark, heavy science fiction (think Dune): haze, one shaft of light, monumental concrete, robed and masked figures, terse lines with a sense of threat. No neon, no cartoon characters, no jokes in the writing.

## Known limits

- Veyra's surface detail is tuned for orbit; it turns soft below about 50 km. Tal's ground has real detail down to craters about 70 m across and roughness at 40 m.
- Ring rocks have no collision. Only the ship casts shadows (on itself and on Tal's ground).
- Jobs are deliveries to Tal's outposts only; the guns are not upgradable yet; no repairs (no damage model). Landing only on Tal. Courses only between Tumbledown and Tal, and a course is not saved: after reloading the page, start it again.
- The hangar is a view, not a place to walk; the crowd follows set loops and can pass through each other.
- The Halberd only flies; it does not scan or react yet.
- The cockpit view reuses the old destroyer bridge interior, which is roomier than the transport's pod.

## Roadmap

You fly a **small smuggler's transport** with contraband in the hold and small guns, slow at first and upgradable. The first mission docks at a huge station for outcasts and misfits (automatic docking once you are close), clears an easy customs check in a vast, dark hangar, and sells the cargo. The Halberd stays as a navy destroyer on patrol. The full plan, with the first mission, phases and open decisions, is `docs/game-plan.md`.

1. **Landing on Tal**: works. Built in `docs/tal-landing-plan.md` (for the Halberd), then moved to the transport.
2. **The new ship**: done (phase 1): the model, weak handling as data, hover mode, belly-down landing on Tal.
3. **The station and docking**: works (phase 2): Tumbledown, "Request docking", automatic docking into bay 3 and undocking, the Halberd on patrol, saving.
4. **The hangar**: works (phase 3, rebuilt darker): bay 3 as a vast hall in haze with one shaft of light, robed figures, customs with Proctor Vey, selling the ashroot to the Factor, first sounds; the first mission end to end. Then a visual pass: the Mudlark black and angular, Tumbledown brutalist, bay 3 from space matching the hangar.
5. **Upgrades and jobs**: works (phase 4): fuel, Brannoc's upgrades, the Factor's deliveries to four outposts on Tal, flight computer courses there and back, the tug. Tal moved into the station's orbit plane.
6. Then **trouble** (navy scans, raiders, fights), then **Veyra** (re-entry, landing at cities), then further out.
