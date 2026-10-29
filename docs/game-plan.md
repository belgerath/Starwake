# Starwake game plan

Where the game goes next: the world, what you do in it, and the order to build it in. This replaces the earlier frontier patrol plan. Craig's choices are listed under "Decisions" at the end; the rest are recommendations until confirmed. Like the landing plan (`docs/tal-landing-plan.md`), each phase ends playable on the phone.

## The game in a paragraph

You fly the Mudlark, a small transport ship about 35 m long, black and angular in the Harkonnen manner, with a hold full of contraband and a couple of small guns for defence. It starts slow and clumsy. First stop: Tumbledown, a huge station in orbit around Veyra where outcasts and misfits trade with no questions asked, or not many. Get close, ask to dock, and the station brings you in. Clear an easy customs check in a vast, dark hangar, sell the cargo to a broker who never met you, and spend the money making the ship faster, tougher and better armed. Then take the next job. Everything flies for real: real orbits, real distances, a real planet and moon.

## Pillars

1. **Real scale, real physics.** No speed limits, no fake drag, no shrunken planets. The ship starts weak, so orbits and thrust matter from the first minute.
2. **A small ship in a big place.** 35 m of black freighter next to a station kilometres across, a navy destroyer ten times your length, a planet underneath.
3. **Dark and heavy.** Dune more than Star Wars: monumental halls in haze, one shaft of light, robed and masked figures, terse people with something to hide. No neon, no jokes in the writing.
4. **Phone first.** Everything works with thumbs, in portrait and landscape, in 10 to 20 minute sessions. The hard parts (docking, aiming) have help.
5. **Every phase ships.** Each phase ends with something new to play on the phone.

## What carries over, and what changes

Carries over: the flight model and real-scale orbits, Veyra, Tal, the ring, the sun and sky, Tal's terrain, the landing contact code and touchdown rules, the HUD, touch controls, time warp, the test setup.

Changes:

- **The player's ship.** A new model of about 35 m, built from shapes like the Halberd was. New handling: weak engines and slow turns at the start, better with upgrades. The protected feel tests (flip time, stopping) change on purpose.
- **Landing on Tal.** Belly-down on downward thrusters, level, on landing gear, instead of tail-down on legs. Touchdown limits, contact points, the crash card and checkpoint, the landed state and take-off carry over; the landing camera and the readiness light adapt.
- **The Halberd** becomes a navy destroyer flying its own patrol: a ship you would rather not be scanned by.
- **The bridge interior** becomes a small cockpit (the chase view works until then).

## The world

### The system

| | |
|---|---|
| Veyra | 6,000 km radius, gravity 9.6 m/s², a ring from 4,200 to 8,100 km up. The colony: cities, a government, a navy |
| Tal | 1,640 km radius, gravity 1.5 m/s², 42,000 km away. Mining outposts, quiet places to land |
| Tumbledown | A huge station, a wheel 2.6 km across, in orbit around Veyra. Outside the colony's law: outcasts, pilgrims, brokers, smugglers |
| The Halberd | The navy's 400 m destroyer, on patrol. Scans ships; contraband in your hold is a problem |
| The Mudlark (your ship) | About 35 m, a hold with hidden compartments, two small guns |

### Places

| Place | What happens there |
|---|---|
| The station | Dock, customs, sell and buy cargo, jobs, upgrades, fuel, repairs, the bar for rumours. Home base and save point |
| Veyra's orbit | Traffic, navy patrols, the station |
| The ring | Hiding places, caches, and people who would rather not be found |
| Tal | Outposts to deliver to, quiet spots for drops. Landing there is part of the job |
| Veyra's cities | Bigger markets and stricter customs. Landing there needs a better engine (gravity 9.6 m/s²) |
| Further out | Other planets, then other stars |

## The first mission

1. **Start** in a 400 km orbit around Veyra, 25 km behind Tumbledown, with a hold full of contraband.
2. **Approach.** The station is marked, with distance and closing speed. Fly toward it; the readouts say when you are slow enough.
3. **Request docking.** Within about 10 km and under about 50 m/s relative to the station, a prompt asks "Request docking?". Tap yes.
4. **Automatic docking.** Station control takes over: it matches speed, lines you up, the bay doors open, and the ship glides in (about a minute, and time warp can skip it). The doors close behind you. While docked the ship is fixed in the station's frame, the way a landed ship is fixed to Tal.
5. **The hangar.** The view moves inside: your ship on its pad in a vast, dark hall, robed figures going about their business.
6. **Customs.** A masked Proctor comes over: an easy check, a couple of choices on a card ("State your cargo."). At worst a small tithe.
7. **Trade.** Find the Factor and sell the contraband. Now you have money, and from here: jobs, upgrades, the bar, and undocking to go back out.

## Inside the station: the hangar view

- A 3D hangar with your ship parked in it. Drag to look around, pinch to zoom, tap to focus on a spot.
- Tap a character or a place (customs officer, trader, mechanic, bar, job board) to get a card with choices, in the same style as the HUD.
- Ambient life: robed figures walking set paths and standing in groups, guards, drones, a hauler and a crane. Sound throughout.
- **Built in code** (revised): the first hangar used free cartoon models (Quaternius, Kenney); it read as cheesy, so the people are now robed and masked figures made from shapes, which suits the darker look and needs no download.
- Walking around as a character could come later if the hangar view feels limiting.

## Your ship

| Part | Start | Upgrades |
|---|---|---|
| Main engine | About 4 m/s² (enough for Tal at 1.5 m/s², not Veyra at 9.6) | Up to well above Veyra's gravity, so landing there is a goal to work toward |
| Turning | Slow | Faster thrusters |
| Downward thrusters | Enough to hover and land on Tal | Stronger, for Veyra |
| Guns | Two small guns, for defence | Bigger guns, a turret |
| Hold | Small, a hidden compartment | Bigger, better hidden |
| Fuel | Generous tanks, bought at the station | Bigger tanks |
| Hull | Thin | Plating, repairs at the station |

Low thrust at real scale means longer burns: about 3.4 km/s to reach Tal is 14 minutes of burning at 4 m/s² (seconds at time warp). Early trips are slow and planned; upgrades make them quick.

## The loop

1. Take cargo or a job at the station.
2. Fly it: to Tal, into the ring, to another orbit, past the navy if you can.
3. Deliver, get paid, buy upgrades and fuel.
4. Bigger jobs pay more and carry more risk: patrol scans, raiders, bounty hunters, stricter customs.

## Phases

### Phase 1: The new ship (done)

- The ship model (about 35 m) with landing gear, downward thrusters and two small guns (not firing yet).
- Handling: weak engine, slow turns, as data so upgrades can change it later.
- Belly-down landing on Tal: hover on downward thrusters, the touchdown rules and crash card carry over, the landing camera adjusted.
- Chase camera for a small ship.

Done when: fly the new ship from orbit and land it on Tal, on the phone.

What was built:
- `TRANSPORT` in `config.js`: everything about the ship as data (thrust, turn rates, gear height, contact points, camera framing), read by physics, camera, HUD and model, so upgrades can change it later. Main engine 4 m/s², Boost 8, lift thrusters 4, turns at about 10°/s.
- The model (`src/ship/transport.js`): a saucer hull 24 m across with two cargo prongs (35 m long in all), a cockpit pod on the right, an engine band glowing across the back with a sheet of flame, four lift thrusters and four gear legs under the belly, small turrets top and bottom, a radar dish, worn panels with a few rust patches. The Halberd's model stays in the code for phase 2. (Rebuilt after phase 3: see the visual pass.)
- Hover mode: a Hover button (G on a keyboard) low over Tal. The slider becomes lift, with a mark at hover (about 37%). Let go of the stick and the ship levels itself, leaning against drift until it stops; steer to tilt and move. Switched on nose-up after braking, the main engine carries part of the thrust while the ship swings level, so it does not drop.
- Belly-down landing: the gear comes down below 1.5 km; touchdown limits as before, with tilt measured from level. The touchdown light says "Hover to land" until hover is on.
- The braking cue now works from 60 km down and checks the ground along the whole burn: with a weak engine, braking from orbit takes minutes and covers hundreds of kilometres, and the first version only looked at the ground where the ship would stop (a test caught it hitting a ridge on the way).
- Cameras: chase and landing views framed for a 35 m ship, the cockpit view in the pod (still the destroyer's roomy bridge interior), the sun's shadow box sized to the ship.
- Tests: hover (levels and stops drift, steering moves it, switching on nose-up keeps height), a full approach from orbit that lands, the braking cue across shallow and steep deorbits, and the existing landing, crash, take-off and warp tests for the new ship.

### Phase 2: The station and docking (done)

- The huge station in orbit around Veyra, built from shapes, with a bay whose doors open.
- Start near it; a target marker with distance and closing speed.
- "Request docking?" within range, automatic docking and undocking.
- The Halberd on its own patrol orbit (just flying, no scans yet).
- Saving: the browser keeps your game.

Done when: start, approach, dock and undock again.

What was built:
- `STATION` and `PATROL` in `config.js`: the station's size, orbit, bay, docking range and pad as data. The ship is the Mudlark, the station Tumbledown.
- Tumbledown (`src/station.js`): a hub 900 m long with the bay at its back end, a wheel 2.6 km across turning once every 72 s (about 1 g at the rim), mismatched shacks and 2,600 lit windows on the wheel, solar wings with patched panels, a dish, blinking red beacons, a neon sign ("Berths · trade · no questions asked") and bay 3: a lit hangar 160 by 90 m and 260 m deep with crates, a pad and two doors that slide open. Guide lights run in toward the bay. (Rebuilt brutalist after phase 3: see the visual pass.)
- Orbits: Tumbledown at 403 km, 25 km ahead of the start and drifting closer; the Halberd on a 420 km patrol orbit 70 km ahead, which the Mudlark overtakes, passing 10 to 25 km from it. Both move under the same gravity as the ship (Tal's tides too), so a ship that matches them stays matched. The station keeps its dish forward along the orbit and the bay facing back, toward the start.
- Docking: within 10 km and slower than 50 m/s relative, "Request docking" and "Not now" appear (time warp drops to 1× so the offer is not missed; Enter on a keyboard). Not now hides it until you leave that range; after undocking it waits until you are 3 km out. Station control flies the run: brakes, goes round the station if you are in front of it, lines up 1 km behind it, opens the doors, flies in at about 12 m/s and sets down on the pad with the gear down. The doors close and a card says you are docked. Docked, the ship is fixed in the station's frame at any time warp. Undock opens the doors, backs out, turns around once clear and lets go at 3 m/s, nose first. Time warp up to 100× during the run.
- Collision with the station's hub, wheel (turning spokes too), wings and dish, as shapes: hitting it is a crash, with the speed on the card.
- Markers for Tumbledown (within 3,000 km, with the speed relative to it inside 100 km) and the Halberd (within 300 km) with distance; tap one to face it.
- Saving: one save in the browser, written on docking, every minute of flight, on pause and when the page is hidden. The intro card offers Continue and New game. The crash checkpoint is also kept within 20 km of the station and on docking.
- Tests: drifting until the offer comes, the offer's limits, docking onto the pad and staying put through 1000× warp, docking from in front goes round, undocking (nose first, clear of the station, doors shut), hitting the station, a save brought back exactly, the Halberd's pass.

### Phase 3: The hangar (done)

- The hangar scene inside the station: your ship on its pad, people, ambient life.
- Customs (easy) and a trader to sell the contraband; money.
- First sounds.

Done when: the first mission plays end to end.

What was built (first with cartoon CC0 models, then rebuilt darker at Craig's request, "something out of Dune"):
- The hangar (`src/hangar/`): its own scene, drawn instead of space once the doors close, built in code with no files. A concrete hall 128 by 144 m and 84 m high in warm haze: buttresses up the walls with lamp niches washing them, a carved back wall with an arch into the station and BAY 3 cut into the stone, banners, the doors you came in by shut behind the ship with light at the seam. One shaft of light comes down from an opening in the roof onto the Mudlark on its pad (gear down, engines cold), with dust hanging in it and real shadows.
- The checkpoint: a plinth and a monolith of a desk under a cold light, guards either side, a scanner arch on the walkway. The lower market: containers against the wall, the Factor's alcove under an awning with a rug and a lantern, sacks and jars. A container yard with a tracked hauler working round it, and a crane carrying a container overhead.
- The people (`src/hangar/figures.js`): robed and hooded figures in dusty browns, some with faint blue eyes in the hood's shadow, tall pilgrims with staffs, merchants with lamps, armoured guards with long weapons at the checkpoint, the doors and the arch, black drones with red eyes. They walk set loops (stopping now and then), stand in twos and threes, nod and shake their heads. Tap one for a line. The loops are tested to stay clear of the ship, the stalls, the hauler and the walls.
- Customs: Proctor Vey, masked, with a lit staff, comes down from the checkpoint when you arrive: "Vessel Mudlark. State your cargo." Every answer clears you; paying the 20-credit berth tithe gets you sent to the Factor, who then pays 10% more.
- The broker: the Factor buys the 8 crates of ashroot at 150 credits each, "and we never met"; asking for more once has a 60% chance of 15% more and never makes it worse. Selling ends the first run.
- The overlay: where you are, credits, the hold and what to do next; name tags over the Proctor and the Factor; cards you choose through; Customs, Market, Look around and Undock. Drag to look around, pinch or wheel to zoom.
- Loading: the hangar's code is fetched and built when you ask to dock, so it is ready by the time the doors close; the docked card shows progress, or says why it failed and offers Undock.
- Sound (`src/sound.js`, Web Audio, no files): the main engine's rumble, the lift thrusters, thruster hiss, the bay doors, a docking chime and clunk, a landing clunk, the crash, a double beep at "Brake now"; in the hangar a low drone, rumble and moving air with distant metal clanks echoing, the Proctor's seal, the sale's low struck tone. On after the first tap; Sound on and off on the pause card.
- Saving now keeps credits, the hold and the first run's progress too.
- Tests: the first run's rules (customs, the tip, haggling, selling, the save) and the walking paths.

### Visual pass (done)

After the hangar, the rest of what you see was brought into the same dark look (Craig: "more Dune esque").

- The Mudlark (`src/ship/transport.js`), Harkonnen-style: a faceted black hull lofted through angular sections from a knife-edge nose to a broad stern (the sections are data in `TRANSPORT.sections`, and the crash points follow them), swept blades along the spine, spikes off the chines, swept fins, a raised cockpit with a slit of red light, three hexagonal engines glowing orange, slits of light along the flanks. Rough, barely metallic plate, so it stays black in a low sun. Same size, handling, gear and contact rules.
- Tumbledown (`src/station.js`), same shape rebuilt brutalist, so docking and collisions are unchanged: an octagonal concrete hub with collars, fins, monolithic blocks and slit windows, a spire forward; a concrete wheel ribbed like a spine with habitation blocks and slit windows; dark radiator slabs instead of solar wings; the neon sign and painted shacks gone.
- Bay 3 seen from space is now the hangar's hall: the same concrete, buttresses and lamp niches, banners, BAY 3 cut into the back wall, and the shaft of light on the pad (shared textures and shader in `src/textures.js`). It is unlit like the hangar, with painted-on light and haze, so the docking run leads straight into what the hangar shows. (The old bay also hid its back half behind a solid collar of the hub; the collars are open rings now.)

### Phase 4: Upgrades and jobs (done)

- A mechanic with upgrades (engine, thrusters, guns, hold, tanks, hull).
- Jobs from the job board and the bar: deliveries to Tal and the ring, pickups, a first hidden drop.
- Cargo prices and fuel.

Done when: take a job at Tumbledown, fly it to Tal, land at the outpost, get paid, fly back and spend it.

What was built (Craig chose deliveries to Tal outposts first, the flight computer flying the trips, and Tal moved into the station's orbit plane):
- One orbit plane: Tal now orbits in the same plane as Tumbledown, the Halberd and the start orbit (it was 12° off), so trips need no plane change. Tal is tidally locked, so its equator lies in that plane too.
- Fuel (`physics.js`): counted as the speed change it buys, 20 km/s of it in the starting tanks; thrust spends it, coasting is free, the engines stop when it runs out. A fuel row on the HUD.
- The flight computer's courses (`src/course.js`), from the Course button: to Tal (wait for the window, burn until the coast passes Tal 150 km up, correct on the way, brake into an orbit about 150 by 400 km; about 3.1 km/s and 6 h of game time) and back to Tumbledown (level a tilted orbit onto Tal's equator, burn so the fall bottoms out on the station's orbit, correct on the way, brake into a phasing orbit in the station's plane, close in on a point 4 km behind it, match speed, then station control docks you; about 3.6 km/s and up to 18 h). Everything is predicted under the same gravity as the flight and flown closed-loop; time warp runs through the waits. Steering or the throttle takes over. Landing and take-off stay with the pilot.
- Four outposts on Tal (`src/outposts.js`): Kessit Deep, Onn Basin, Harrow Rise, Tessaly Flats, near the equator on flat ground: a pad with lamps, concrete bunkers with slit windows, a dome, a mast with a red beacon you can see from orbit, and a marker with the distance.
- Work: after the first run the Factor offers three deliveries each visit (air filters, drill heads, water casks, sealed crates), paid on landing within 3 km of the outpost. One job at a time, if the hold has room.
- Brannoc, the shipwright, at a bench under the Mudlark's nose: fills the tanks (2 credits per 100 m/s) and fits upgrades: main engine (5.5, then 7.5 m/s²), lift thrusters (5, 6.5), attitude jets (turn rates ×1.3, ×1.6), hold (12, 16 crates), tanks (26, 34 km/s). What you cannot afford is shown dimmed.
- The tug: with the tanks dry anywhere but docked, "Call a tug" brings the ship into bay 3 for 300 credits (you may end up owing; the next job pays it off) and leaves a quarter tank, so nobody gets stranded.
- Saving keeps the parts fitted, the job and the fuel.
- Tests: fuel, the shared plane, every outpost landable and recognised, the tug, the courses flown end to end (to Tal and back into station control, from a tilted orbit, from near the station), the rules for jobs, upgrades and fuel.

### Phase 5: Trouble

- The navy scans ships near Veyra; run, bluff or pay.
- Raiders and bounty hunters; fights with the small guns (aim assist on the phone); hull damage and repairs.

### Phase 6: Veyra

- Re-entry heating and drag; Veyra's ground in chunks like Tal's; landing at a city port once the engine is strong enough.

### Phase 7: Further out

The rest of the system, then other stars.

## Technical groundwork

| What | Phase | Notes |
|---|---|---|
| Ships as data | 1 and 2 | Model, size, thrust, turn rates and contact points per ship, so upgrades and other ships (the Halberd) use the same flight model. Today `stepFlight` flies one global ship `S`; split it. |
| Docked state | 2 | Like the landed state on Tal: the pose is kept in the station's frame and follows its orbit at any time warp. The docking run is a short path in that frame. |
| Station orbit | 2 | The station and the Halberd move under the same gravity as the ship, stepped with it, so a matched ship stays matched. |
| Scenes | 3 (done) | The hangar is its own three.js scene, drawn instead of space; physics keeps running while you are inside. |
| Asset loading | 3 (done, then dropped) | The first hangar loaded about 3 MB of CC0 models; the darker one is built in code and loads none. Any later asset packs need a credits file for their licences. |
| Saving | 2 | Versioned, in the browser's storage. Phase 2 saves the flight (ship, station, Halberd, docked or not); cargo, money and progress join it in phase 3. |
| Sound | 3 (done) | Web Audio, synthesized; phone browsers only allow sound after a tap. |
| Performance | always | 60 fps on the phone; the `?debug` line is the tool. The hangar's crowd and its one shadow-casting light need a budget too. |

## Decisions

Confirmed by Craig:

1. **Premise:** a smuggler in a small transport ship (about 35 m, first like the Millennium Falcon, now black and angular) carrying contraband, with small guns for defence; poor speed and handling at first, upgradable.
2. **First mission:** dock at a huge station for outcasts and misfits and trade the contraband.
3. **Docking:** get close, accept "Request docking?", and the station flies you into an opening bay.
4. **Customs:** an easy check in the hangar; then the game opens up from there.
5. **Station interior:** a hangar view with tap to interact, at first.
6. **People in the station:** robed and masked figures built in code (revised from cartoon aliens from free asset packs).
7. **Landing on Tal:** belly-down on downward thrusters.
8. **The Halberd:** stays as a navy destroyer that patrols.
9. **Fuel:** generous (from the earlier plan).
10. **Names:** the ship is the Mudlark, the station Tumbledown.
11. **Docking offer:** within 10 km and under 50 m/s relative.
12. **Tone:** dark, heavy science fiction, like Dune: terse and ominous writing. The hangar first, then Tumbledown's outside and the ship.
13. **The Mudlark's look:** Harkonnen-style: black, angular, heavy, spiked; same size and handling.
14. **Tumbledown's look:** the same shape rebuilt brutalist (dark ribbed stone and metal, slit windows; no neon, no painted shacks).
15. **First jobs:** deliveries to Tal outposts, with upgrades and fuel bought at the station.
16. **Trips:** the flight computer flies the trips between Tumbledown and Tal (a course from the Course button); the pilot lands and takes off.
17. **Tal's orbit:** moved into the station's plane, so trips need no plane change.

Still to confirm (recommendations):

18. **Starting engine** about 4 m/s², so Veyra needs an upgrade.
19. **Ship and station models** built from shapes in code (like the Halberd).
20. **Combat** with aim assist (the guns lead the target; you choose when to fire).

Next: phase 5, trouble.
