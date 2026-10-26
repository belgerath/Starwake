# Starwake game plan

Where the game goes next: the world, what you do in it, and the order to build it in. This replaces the earlier frontier patrol plan. Craig's choices are listed under "Decisions" at the end; the rest are recommendations until confirmed. Like the landing plan (`docs/tal-landing-plan.md`), each phase ends playable on the phone.

## The game in a paragraph

You fly the Mudlark, a small, tired transport ship about 35 m long (think of the Millennium Falcon), with a hold full of contraband and a couple of small guns for defence. It starts slow and clumsy. First stop: Tumbledown, a huge station in orbit around Veyra where outcasts and misfits trade with no questions asked, or not many. Get close, ask to dock, and the station brings you in. Clear an easy customs check in a hangar full of aliens, sell the cargo, and spend the money making the ship faster, tougher and better armed. Then take the next job. Everything flies for real: real orbits, real distances, a real planet and moon.

## Pillars

1. **Real scale, real physics.** No speed limits, no fake drag, no shrunken planets. The ship starts weak, so orbits and thrust matter from the first minute.
2. **A small ship in a big place.** 35 m of patched-up freighter next to a station kilometres across, a navy destroyer ten times your length, a planet underneath.
3. **Weird and lived-in.** Aliens, odd stalls, flickering signs, misfits with jobs. Humour is welcome.
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
| Tumbledown | A huge station, a wheel 2.6 km across, in orbit around Veyra. Outside the colony's law: outcasts, misfits, aliens, traders |
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
5. **The hangar.** The view moves inside: your ship on its pad, aliens and droids going about their business.
6. **Customs.** An officer wanders over: an easy check, a couple of choices on a card ("Anything to declare?"). At worst a small fee.
7. **Trade.** Tap the trader and sell the contraband. Now you have money, and from here: jobs, upgrades, the bar, and undocking to go back out.

## Inside the station: the hangar view

- A 3D hangar with your ship parked in it. Drag to look around, pinch to zoom, tap to focus on a spot.
- Tap a character or a place (customs officer, trader, mechanic, bar, job board) to get a card with choices, in the same style as the HUD.
- Ambient life: aliens walking set paths and idling, droids, cargo lifts, signs and lights. Sound and music later.
- **Aliens from free 3D asset packs** (confirmed). Public-domain (CC0) low-poly packs with walk and idle animations are available, for example from Quaternius and Kenney. Each pack's licence is checked and recorded in a credits file. Needs three.js's glTF loader (included in 0.128) and a download budget for phones (a few MB, loaded when you first dock).
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
- The model (`src/ship/transport.js`): a saucer hull 24 m across with two cargo prongs (35 m long in all), a cockpit pod on the right, an engine band glowing across the back with a sheet of flame, four lift thrusters and four gear legs under the belly, small turrets top and bottom, a radar dish, worn panels with a few rust patches. The Halberd's model stays in the code for phase 2.
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
- Tumbledown (`src/station.js`): a hub 900 m long with the bay at its back end, a wheel 2.6 km across turning once every 72 s (about 1 g at the rim), mismatched shacks and 2,600 lit windows on the wheel, solar wings with patched panels, a dish, blinking red beacons, a neon sign ("Berths · trade · no questions asked") and bay 3: a lit hangar 160 by 90 m and 260 m deep with crates, a pad and two doors that slide open. Guide lights run in toward the bay.
- Orbits: Tumbledown at 403 km, 25 km ahead of the start and drifting closer; the Halberd on a 420 km patrol orbit 70 km ahead, which the Mudlark overtakes, passing 10 to 25 km from it. Both move under the same gravity as the ship (Tal's tides too), so a ship that matches them stays matched. The station keeps its dish forward along the orbit and the bay facing back, toward the start.
- Docking: within 10 km and slower than 50 m/s relative, "Request docking" and "Not now" appear (time warp drops to 1× so the offer is not missed; Enter on a keyboard). Not now hides it until you leave that range; after undocking it waits until you are 3 km out. Station control flies the run: brakes, goes round the station if you are in front of it, lines up 1 km behind it, opens the doors, flies in at about 12 m/s and sets down on the pad with the gear down. The doors close and a card says you are docked. Docked, the ship is fixed in the station's frame at any time warp. Undock opens the doors, backs out, turns around once clear and lets go at 3 m/s, nose first. Time warp up to 100× during the run.
- Collision with the station's hub, wheel (turning spokes too), wings and dish, as shapes: hitting it is a crash, with the speed on the card.
- Markers for Tumbledown (within 3,000 km, with the speed relative to it inside 100 km) and the Halberd (within 300 km) with distance; tap one to face it.
- Saving: one save in the browser, written on docking, every minute of flight, on pause and when the page is hidden. The intro card offers Continue and New game. The crash checkpoint is also kept within 20 km of the station and on docking.
- Tests: drifting until the offer comes, the offer's limits, docking onto the pad and staying put through 1000× warp, docking from in front goes round, undocking (nose first, clear of the station, doors shut), hitting the station, a save brought back exactly, the Halberd's pass.

### Phase 3: The hangar

- The hangar scene inside the station: your ship on its pad, aliens from the asset packs, ambient life.
- Customs (easy) and a trader to sell the contraband; money.
- First sounds.

Done when: the first mission plays end to end.

### Phase 4: Upgrades and jobs

- A mechanic with upgrades (engine, thrusters, guns, hold, tanks, hull).
- Jobs from the job board and the bar: deliveries to Tal and the ring, pickups, a first hidden drop.
- Cargo prices and fuel.

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
| Scenes | 3 | The hangar is its own three.js scene, like the bridge interior. Space keeps its state while you are inside. |
| Asset loading | 3 | glTF loader, small compressed models, loaded on first dock, a credits file for licences. |
| Saving | 2 | Versioned, in the browser's storage. Phase 2 saves the flight (ship, station, Halberd, docked or not); cargo, money and progress join it in phase 3. |
| Sound | 3 | Web Audio; phone browsers only allow sound after a tap. |
| Performance | always | 60 fps on the phone; the `?debug` line is the tool. A hangar full of animated aliens needs a budget too. |

## Decisions

Confirmed by Craig:

1. **Premise:** a smuggler in a small transport ship (about 35 m, like the Millennium Falcon) carrying contraband, with small guns for defence; poor speed and handling at first, upgradable.
2. **First mission:** dock at a huge station for outcasts and misfits and trade the contraband.
3. **Docking:** get close, accept "Request docking?", and the station flies you into an opening bay.
4. **Customs:** an easy check in the hangar; then the game opens up from there.
5. **Station interior:** a hangar view with tap to interact, at first.
6. **Aliens:** from free 3D asset packs.
7. **Landing on Tal:** belly-down on downward thrusters.
8. **The Halberd:** stays as a navy destroyer that patrols.
9. **Fuel:** generous (from the earlier plan).
10. **Names:** the ship is the Mudlark, the station Tumbledown.
11. **Docking offer:** within 10 km and under 50 m/s relative.

Still to confirm (recommendations):

12. **Starting engine** about 4 m/s², so Veyra needs an upgrade.
13. **Ship and station models** built from shapes in code (like the Halberd), with asset packs used for the aliens and small props.
14. **Combat** with aim assist (the guns lead the target; you choose when to fire).

Next: phase 3, the hangar.
