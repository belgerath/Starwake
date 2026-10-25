# Starwake game plan

Where the game goes after landing on Tal: the world, what you do in it, and the order to build it in. Like the landing plan (`docs/tal-landing-plan.md`), recommendations are open until Craig confirms them (see "Decisions to confirm" at the end), and each phase ends playable on the phone.

## The game in a paragraph

You command the Halberd, a 400 m destroyer, in a star system that has gone quiet. Everything flies for real: orbits, transfer windows, burns that cost fuel, landings on real ground. You go where the signals are: a dark station, wrecks in Veyra's ring, survey sites and ice on Tal, the cities on Veyra. Each trip is a piece of flying to plan and land well, and each place tells you a little more about what happened here.

## Pillars

1. **Real scale, real physics.** No speed limits, no fake drag, no shrunken planets. The challenge comes from orbits and fuel, not from rules made up for the game.
2. **A big ship that feels big.** Slow turns, long burns, heavy landings, a bridge you sit in.
3. **Phone first.** Everything works with thumbs, in portrait and landscape, in 10 to 20 minute sessions. The flight computer does the arithmetic; the player does the flying and the deciding.
4. **Places, not lists.** A few places made well, each with something to see, a piece of flying and a bit of story, beat many empty ones.
5. **Every phase ships.** Each phase ends with something new to play on the phone, as the landing steps did.

## What exists now

- Veyra (Earth-sized, oceans, clouds, atmosphere, a ring), Tal (its tidally locked moon, with ground you can land on), the sun, the stars and the Milky Way.
- Newtonian flight with gravity from both bodies, time warp to 1000×, flight computer holds, a map with the predicted path.
- Landing on Tal: legs, touchdown rules, crash card and checkpoint, take-off. Polish (landing step 6) is still to do.
- A bridge interior with live screens and dials.
- Not yet: fuel, saving, sound, or anything to do once you arrive somewhere.

## The world

### The system today

| | |
|---|---|
| Veyra | 6,000 km radius, gravity 9.6 m/s², 20 h day, a ring from 4,200 to 8,100 km up |
| Tal | 1,640 km radius, gravity 1.5 m/s², 42,000 km from Veyra, one orbit (and one turn) every 25.4 h |
| The Halberd | 400 m, 60,000 t, main engine 25 m/s² (2.6× Veyra's gravity), 50 with Boost |

### Premise (decision 1)

Recommended: **the silent colony.** Veyra was settled. Its station, its ships and its cities stopped answering, and the Halberd is sent to find out why.

- It fits what is built: a warship arriving in an empty, beautiful system.
- It gives every place a reason to visit.
- The story is told through things you find (logs, signals, wrecks, ruins) rather than characters and cutscenes, which suits a small project and a phone.
- It leaves room for danger later (whatever silenced the colony) without needing combat early.

Alternatives:

- **Frontier patrol.** The system is alive and you are its only warship: rescues, escorts, intercepts. More variety, but other ships need their own flying and AI, a big build before the first job is fun.
- **Sandbox.** No story, just places and challenges (land here, dock there, fastest trip to Tal). Cheapest and good for testing, but nothing pulls you onward.

### Places

| Place | Where | What you do there | What it needs |
|---|---|---|---|
| The station (name to decide, e.g. Highport) | Low orbit of Veyra, a little above where you start | Dock, refuel, repair, save. Dark at first: bringing it back to life is the first job | A second orbiting object, docking, sideways thrusters |
| The ring | 4,200 to 8,100 km above Veyra | Find the wrecks of ships that tried to leave, salvage parts, thread through rocks at low relative speed | Rock collisions, wrecks as places, a scanner |
| Tal's polar ice | Craters near the poles the sun barely reaches | Land on the ice and take on fuel | Landing (done), a refuel action, ice sites in the terrain |
| Tal survey sites | Craters and plains on the near side | Land near a beacon and scan it | Places fixed to Tal's ground, a scanner |
| Tal's far side | Always facing away from Veyra, radio quiet | Something is transmitting from there | A site and a signal: the first story arc ends here |
| Veyra's cities | Coasts and plains | Land at a port and look around | Landing on Veyra, the biggest technical step |
| Further out | Other planets, then other stars | Later | A sun you can orbit, distances thousands of times larger |

## What you do: the loop

1. **Pick a destination**: a signal on the map, a job at the station, ice for fuel.
2. **Plan**: the flight computer proposes the burns and shows what they cost.
3. **Fly**: burns on cues, time warp through the coast, capture into orbit, land or dock.
4. **Do something there**: scan, salvage, refuel, read what you found.
5. **Get back** with enough fuel, or find fuel where you are.

Rewards: story (logs, new signals on the map), parts that improve the ship (tanks, engines, scanner range), and the station coming back to life piece by piece.

### Fuel is what makes the orbits matter

| Trip | Cost (change in speed) |
|---|---|
| From the 400 km orbit onto a path to Tal | 2.3 km/s, then 5.6 h coasting (20 s at 1000×) |
| Into a 30 km orbit at Tal | 1.0 km/s |
| Down to Tal's ground from that orbit | about 1.6 km/s, and the same to take off |
| From Veyra's ground to orbit | about 9 km/s (7.6 for orbital speed, plus gravity and air) |
| Straight at Tal at full thrust, flipping halfway | about 60 km/s, 40 minutes |

The Halberd's engine is strong enough to ignore orbits and fly straight lines, as in The Expanse. Fuel is what stops it. With tanks worth about 12 km/s (decision 3), a round trip to Tal's ground costs two thirds to four fifths of a tank (less if Veyra's air does the braking on the way home), a landing on Veyra and the climb back costs most of a tank, and a straight-line dash is an emergency that burns everything. So planning matters, and Tal's ice is worth landing for.

## The ship

| System | What it adds | Phase |
|---|---|---|
| Fuel | A gauge, speed change left, and the cost of a burn shown before you commit to it | 2 |
| Sideways thrusters | Move without turning: docking, and sliding to flat ground before touchdown | 1 or 2 |
| Scanner | Pings show signals and sites; range grows with upgrades | 3 |
| Cargo | Ice and salvaged parts | 3 |
| Hull and heat | Damage from hard landings, rock strikes and re-entry; repaired at the station. Crashes stay as now | 4 and 5 |
| Weapons | The turrets and point defence on the model get a job when the story has something to point them at | 5 |
| Bridge | Its screens become the ship's status, scanner and journal, so the bridge is a place you use, not only a view | ongoing |

## Flying on a phone: the flight computer

The braking cue showed the pattern: the computer works out the moment, the player flies it. Extend that:

- **Targets.** Tap the station, Tal or a signal to make it the target; the readouts show distance, closing speed and closest approach.
- **Trip planner** (decision 4). Choose a destination; the computer proposes the burns (when, which way, how long, what they cost) and gives "Burn in 2:10" cues like the braking cue. Time warp stops itself before each burn.
- **Rendezvous and docking aids.** A marker for speed relative to the target, a docking view with alignment guides.
- **Later, optional.** The computer flies a planned burn itself, as an upgrade or a setting.

## Phases

### Phase 1: Flight test (now)

Landing step 6: dust kicked up by the engines, landing lights, sound cues, a play-through on the phone and tuning of the limits and the cue. Sideways thrusters could come here, since picking a flat spot needs them.

Done when: landing on Tal is fun on the phone, in portrait and landscape.

### Phase 2: A reason to fly

- Fuel and the speed-change budget.
- Sideways thrusters.
- The station in orbit around Veyra: targets, rendezvous readouts, docking, refuelling.
- Saving: the browser keeps your game; the start moves to the station.
- First sounds: engines, bridge hum, warnings.

Done when: undock, fly to Tal, land, come back and dock on one tank, and the game remembers where you were.

### Phase 3: Something to find

- Scanner, and signals on the map.
- Places fixed to Tal's ground and in the ring: survey sites, polar ice (land on it to refuel), the first wrecks.
- Logs to read on the bridge, and a journal.
- The trip planner.
- The first story arc, ending on Tal's far side.

Done when: a new player can follow the signals for an hour and wants to know what is on Veyra.

### Phase 4: Veyra

- Re-entry: heating, glowing plasma, drag; aerobraking to save fuel.
- Veyra's ground in chunks like Tal's (needs a JavaScript copy of Veyra's terrain, as Tal got in landing step 1), with oceans and coastlines up close.
- A port to land at, clouds from below, take-off through the atmosphere.

Done when: land at a city on Veyra and fly back to the station.

### Phase 5: Danger and growth

Hull damage and repairs, ring rock collisions, upgrades from salvage, and the story's threat: what silenced the colony, and whether the guns get used (decision 5).

### Phase 6: The wider system

The sun becomes a body you orbit, with Veyra and Tal going round it, and other planets (a gas giant with its own moons is the classic next place). Needs distances thousands of times larger, orbits handed from one body's gravity to the next, and much longer time warp.

### Phase 7: Other stars

How you get there (the name Starwake suggests a drive that leaves a wake behind it), and whether new systems are made by hand or generated.

## Technical groundwork

| What | Phase | Notes |
|---|---|---|
| Sound | 1 or 2 | Web Audio, generated or small files. Phone browsers only allow sound after a tap. |
| Saving | 2 | `S` plus progress, versioned, in the browser's storage. The crash checkpoint becomes part of it. |
| A second orbiting object | 2 | The station has its own orbit. Relative readouts, and docking contact reusing the landing contact code. |
| Places as data | 3 | Each place says which frame it lives in (Veyra orbit, Tal's ground, the ring), how it is drawn, what triggers it and what it gives. Objectives and logs are data, not code. |
| Veyra's terrain | 4 | The same quadtree and workers, a JS port of `PLANET_H` checked against the GPU like `npm run check:tal`, sea level, and much finer detail (Veyra is 3.7 times Tal's size and you see far more of it from low). |
| Scale | 6 | A sun-centred universe frame, a farther depth buffer limit (20 million km today), longer warp. Positions in doubles and the floating origin already scale. |
| Performance | always | 60 fps on the phone; the `?debug` line is the tool. |

## Decisions to confirm

1. **Premise.** The silent colony (recommended), frontier patrol, or sandbox.
2. **Order.** The core loop (fuel, station, docking, saving) before landing on Veyra (recommended). The roadmap in CLAUDE.md has Veyra next; swapping gives Tal landing a purpose sooner, and Veyra's terrain is the biggest single technical step.
3. **Fuel.** Tanks worth about 12 km/s (recommended): Tal and back is comfortable but not free, Veyra is a commitment, and Tal's ice is worth landing for. Alternatives: generous (20 km/s or more, mostly free roaming) or tight (8 km/s, every trip planned).
4. **Flight computer.** It plans the burns and cues them, you fly them (recommended); flying planned burns for you comes later as an option.
5. **Combat.** None until the story needs it (recommended); then threats from whatever silenced the colony, using the turrets and point defence. Alternative: combat early.
6. **Sideways thrusters on touch.** A "Move" button that turns the steering stick into sideways thrust while on (recommended), or a second stick.
7. **Saves.** One automatic save in the browser (recommended), plus the crash checkpoint.

Next, once these are settled: finish phase 1 (landing step 6), then write a phase 2 plan in the same style as the landing plan.
