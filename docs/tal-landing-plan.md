# Tal landing plan

Goal: bring the Halberd down onto Tal, stand on the ground, and take off again. Orbit and ground are one world: the terrain you land on is the terrain you saw from orbit.

Each step ends with `npm test`, `npm run build`, a look in a browser (phone-sized too when the HUD or controls change), then a commit and push. Pushes go to the working branch; merging to `main` publishes the game to the phone.

## Numbers that shape the design

| | |
|---|---|
| Tal radius | 1,640 km |
| Surface gravity | 1.5 m/s² (Veyra is 9.6) |
| Terrain relief | basins to −8.5 km, rims to +6.9 km (from step 1) |
| Spin | tidally locked: one turn per orbit of Veyra, 25.4 h |
| Ground speed at Tal's equator | 113 m/s, so "stopped" means matching that, not zero |
| Low orbit (30 km) | about 1,550 m/s |
| Main engine | 25 m/s², 17× Tal's gravity: hovering needs 6% thrust |

## Decisions to confirm

These are recommendations. Change any of them before the step that needs it.

1. **Tail-down landing** (steps 5 and 6). The ship lands standing on its stern, nose up, like the ships in The Expanse. Holding retrograde already swings the nose upright as you slow down, the main engines do the braking and hovering, and no new controls are needed. The same method works on Veyra later, since the engines are 2.6× Veyra's gravity. The alternative, a belly landing, needs new downward thrusters and a new control to fly them.
2. **Touchdown limits** (step 5). Safe: under 3 m/s down, under 1.5 m/s sideways, tilted less than 8° from upright, on ground sloping less than 12°. 3 to 6 m/s down is a hard landing (a warning, no harm). Anything else, or the hull touching the ground, is a crash.
3. **Fine thrust near the ground** (step 5). Hovering at 6% is a 10 px target on the thrust slider. With the legs down, the slider covers 0 to 3× Tal's gravity (0 to 18%) and shows "Fine". Boost still gives full power.
4. **Crashing** (step 5). A card says what went wrong ("Touched down at 11 m/s. Safe is under 3 m/s.") with Try again (from a checkpoint saved 15 km up on the way down) and Back to orbit. No damage model yet.
5. **A shortcut for testing** (step 2). A "Start above Tal" button on the intro card puts you in a 30 km orbit around Tal, so each step can be tried on the phone in seconds instead of flying there first.

## Steps

### 1. Tal's ground in JavaScript (done)

- `src/noise.js` ports the GLSL noise; `src/tal.js` gives `talHeight(dir)` in metres. It matches the GPU bake to within about 1 m at all 1.57 million texels (`npm run check:tal`), and `tests/tal.test.js` keeps it that way.
- Tal's crater placement used `fract(sin(x)*43758.5)`, which depends on how each GPU computes `sin`: Tal's craters could differ between a phone and a desktop, and no JavaScript copy could match them. It is now an integer hash (PCG) that every WebGL2 GPU computes bit for bit.
- Crater rims were a sheer cliff (up to 2.6 km on big craters). They are now continuous with steep inner walls (about 25 to 35°), which keeps the crisp look from orbit and gives ground you can land near.
- Visible change: Tal's craters are in new places. Veyra is byte-for-byte unchanged.

### 2. Terrain you can see (done)

- Chunked level-of-detail terrain replaces Tal's sphere at every distance: a cube-sphere quadtree whose chunks split as you get closer, so detail follows the ship down.
- Chunks are built in a Web Worker from `talHeight`, so the drawn ground and the collision ground are the same numbers.
- Colours come from the same baked map as now, so Tal looks the same from orbit.
- Tal's hard deck follows the real ground (a cushion 500 m above it) until legs exist. The chase camera never goes underground.
- "Start above Tal" on the intro card.

What was built: `src/terrain.js` (quadtree, worker pool, cache), `src/terrain-build.js` (one chunk, pure), `src/terrain-worker.js`. Chunks are 33×33 vertices with skirts; 15 levels, down to 2.5 m between vertices. About 110 chunks are drawn in a 30 km orbit and about 200 at the deck. A chunk takes 13 to 19 ms to build on a desktop. From 1,000 km Tal looks the same as the old sphere. HUD buttons now sit above the body markers, so a marker pinned to the screen edge cannot take a tap meant for Boost or the camera button.

Found along the way, for later steps:
- Nose up (tail-down), the chase camera hangs below the ship and sees only sky. Step 5 needs a landing camera that looks down past the hull.
- Map view stays centred on Veyra even in orbit around Tal, so Tal is off-screen. Step 4 should centre the map on the body you are orbiting.

### 3. Ground detail and performance (done)

- Extra layers of small craters and roughness below what the orbit maps can show (the maps are about 5 km per pixel), so the ground is not smooth from a few kilometres up. They fade out with distance, so the view from orbit does not change.
- The ship's shadow falls on the ground: the best height cue there is.
- Tune for the phone: chunk size, how many chunks are built per frame, cache size, frame rate.

What was built:
- `talDetail()` in `tal.js`: bowl craters on six grids (20 km down to 210 m cells, craters about 9 km to 70 m across, about a tenth as deep as wide) and roughness from 3 km down to 40 m. Each chunk keeps only what its vertex spacing can show, so nothing changes from orbit (a test checks this) and the chunks under the ship carry the full detail physics uses, to within 1 m.
- Shading: the "pixelated" look was Tal's 5 km per texel maps being magnified. Up close the colour is now computed per pixel from the bake's own formula (the mare factor rides in the albedo map's alpha), shape comes from the mesh out to where the map is finer, and five octaves of noise (1.8 km to 22 m) vary the colour as you approach. Mesh normals are blurred with a [1 2 1] filter, which removes fine stripes on distant slopes where crater walls are sharper than the vertex spacing.
- Tried and dropped: bump-mapped lighting from screen-space derivatives. At grazing angles it sparkled along triangle edges.
- The ship's shadow falls on the ground (the sun's shadow map); shadowed ground keeps 12% of the light, as if bounced from the sunlit ground around it.
- `?debug` shows frame rate, triangles, draw calls and chunk counts under the readouts. Chunks take 12 to 25 ms to build on a desktop. In a software renderer the new shading costs about 15 to 20% more per frame than step 2. Phone numbers are still needed.

### 4. Flying relative to the ground (done)

- Tal's spin in the physics: surface speed and direction under the ship.
- Readouts switch to the ground when low over Tal: radar altitude (height above the ground below you), vertical speed and sideways speed relative to the ground.
- Prograde and Retrograde hold the ground-relative direction when low, which is what landing needs.
- Braking cue: "Brake in 14 s", then "Brake now", from the distance to the ground along your path and the engine's stopping distance.
- Time warp limits use radar altitude.

What was built:
- `omegaT` and `talGroundVel()` in physics; `O.surf` switches on below 20 km over Tal (off again above 22 km). Then `O.speed`, `O.hs`, the holds and the velocity markers are relative to the ground.
- Readouts in that mode: ground speed, height (metres below 10 km), vertical and horizontal speed (one decimal below 10 m/s), impact in (red under 30 s).
- Braking cue (`brakeCue()`): a planar model of a full-thrust retrograde burn (gravity less the vx²/r curvature term, which is what holds an orbit up), searched for the latest start that stops `BRAKE_STOP_H` (550 m) above the ground where the burn ends. Four very different descents that burned on the cue stopped between 502 and 553 m; two are tests.
- Map view and the predicted path are centred on Tal while you orbit it, so the orbit closes on itself.
- Narrow portrait: tighter readouts so they no longer run under the camera buttons.

Also in this round: a realistic sky (`src/sky.js`). About 9,000 stars with the real sky's spread of brightness (most faint, a few bright) and colour, round soft points, fainter ones crowding toward the galactic plane; the Milky Way as a baked glow with star clouds, dust lanes and a brighter core; and an exposure that fades the faint stars when sunlit Veyra or Tal or the sun fill the view.

### 5. Legs, touchdown, crash and take-off

- Four landing legs at the stern, deploying automatically below 3 km above the ground.
- Contact: leg feet and a few hull points tested against `talHeight` on every physics sub-step.
- Touchdown rules, landed state (the ship rides with Tal and time warp still works), take-off by pushing thrust above hover, the crash card and checkpoint.
- Fine thrust near the ground; a touchdown readiness light (green when within the limits).
- Tests: a scripted landing succeeds, a fast one crashes, take-off returns to flight, a landed ship stays put through 1000× warp.

### 6. Polish

- Dust kicked up by the engines near the ground, landing lights, sound cues if wanted.
- A play-through on the phone in portrait and landscape; tune the limits and the braking cue to feel right.
- Update `CLAUDE.md` (landing becomes protected feel, with tests).

## Technical notes

- **Precision.** Chunk vertices are stored relative to the chunk's centre. three.js composes object transforms in doubles, and with the floating origin a nearby chunk's transform has a small translation, so float32 on the GPU stays precise to millimetres near the ship.
- **Tal's body frame** is `moonQ × rotY(moonTh(t))`, the same rotation as `W.moonPivot`. Ground velocity at a point is Tal's orbital velocity plus `ω × r`, with ω = `MOON_N` about Tal's orbit normal.
- **Cost.** `talHeight` takes about 10 to 20 µs per sample on a desktop, about 20 ms for a 33×33 chunk; phones are perhaps 3× slower, which is why chunks are built in a worker and cached.
- **Keep in sync.** `NOISE` and `MOON_H` in `shaders.js` must match `noise.js` and `tal.js`. After changing either, run `npm run check:tal`: it compares them on a real GPU and refreshes the fixture `npm test` uses.
