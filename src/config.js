// World and ship constants. Everything is in SI units: metres, seconds, m/s, m/s².
// The universe frame is inertial and centred on Veyra; physics never touches render coordinates.
// Plain numbers only (no three.js), so the terrain Web Worker can import this without the library.

export const TAU = Math.PI * 2;

// Veyra (home planet, roughly Earth-sized)
export const R = 6.0e6;            // radius
export const GM = 3.456e14;        // gravity parameter, gives 9.6 m/s² at the surface
export const SPIN = TAU / 72000;   // 20 h sidereal day
export const TILT = 0.41;          // axial tilt, radians
export const ATM_TOP = 150e3;      // top of the atmosphere shell
export const SCALE_H = 8500;       // atmosphere density scale height
export const FLOOR = 15e3;         // hard deck until landing exists

// Tal (moon)
export const MOON_R = 1.64e6;
export const GM_M = 4.03e12;
export const MOON_A = 4.2e7;       // orbit radius
// Tal, Tumbledown, the Halberd and the start orbit share one plane, tilted this far (radians) from Veyra's
// equator, so the ring is seen at an angle and trips between them need no change of plane.
export const ORBIT_INC = 0.33;
export const SOI_M = MOON_A * Math.pow(GM_M / GM, 0.4);
export const MOON_N = Math.sqrt((GM + GM_M) / Math.pow(MOON_A, 3));
// Tal's terrain. MOON_H (GPU bake) and tal.js (JS, for meshes and collision) both use these.
export const TAL_SEED = [1.9, 4.4, 6.6];
export const TAL_RELIEF = 0.02 * MOON_R; // metres per unit of baked height, the same relief the normal map shows
export const TAL_MAX_H = 0.35 * TAL_RELIEF; // no ground on Tal is further than this from MOON_R, up or down (about 11.5 km)
export const TAL_START_ALT = 30e3;       // "Start above Tal": circular orbit this high above the mean radius
export const SURFACE_ALT = 20e3;         // below this height above Tal's ground, speeds and holds are relative to the ground
export const BRAKE_CLEAR = 150;          // the braking cue aims to stop the ship's lowest point this high above the ground
export const CUE_ALT = 60e3;             // the braking cue works below this height (a weak engine brakes for minutes)

// Tal's terrain mesh: a cube-sphere quadtree of chunks, each GRID × GRID vertices. A chunk splits
// into four when its size divided by its distance from the camera exceeds SPLIT.
export const TERRAIN_GRID = 33;
export const TERRAIN_MAX_LEVEL = 15;     // chunks 79 m across, 2.5 m between vertices
export const TERRAIN_SPLIT = 1.5;
export const TERRAIN_CACHE = 400;        // chunks kept in memory, including ones not drawn right now

// Ring (equatorial)
export const RING_IN = 1.7 * R;
export const RING_OUT = 2.35 * R;
export const RING_H = 350;         // half-thickness for local rocks

export const WARPS = [1, 10, 100, 1000];

// Ships. Positions are metres in the ship's frame: the nose points along −z, the deck along +y.
// The Mudlark's hull, nose to stern: at each z, the half-width at the chine w, the height of the spine t, of the
// chine c and of the belly b, and the belly's half-width bw. Each section is seven points (hullRing): the spine,
// two shoulders, the chines and the belly's edges. transport.js lofts the hull through them.
const SECTIONS = [
  {z: -21, w: 0.3, t: 0.3, c: 0, b: -0.3, bw: 0.15},
  {z: -16, w: 3.2, t: 1.4, c: -0.2, b: -1.4, bw: 1.8},
  {z: -9, w: 6.5, t: 2.6, c: -0.3, b: -2.2, bw: 4.0},
  {z: -2, w: 9.5, t: 3.2, c: -0.2, b: -2.4, bw: 6.0},
  {z: 6, w: 10.5, t: 3.3, c: 0, b: -2.4, bw: 7.0},
  {z: 12, w: 9.0, t: 2.8, c: 0.2, b: -1.7, bw: 6.0},
  {z: 14, w: 8.2, t: 2.6, c: 0.3, b: -1.2, bw: 5.4},
];
export const hullRing = s => [[0, s.t], [s.w * 0.55, s.t * 0.74], [s.w, s.c], [s.bw, s.b], [-s.bw, s.b], [-s.w, s.c], [-s.w * 0.55, s.t * 0.74]].map(([x, y]) => [x, y, s.z]);
const mirror = pts => pts.flatMap(([x, y, z]) => [[x, y, z], [-x, y, z]]);
// The player's ship: the Mudlark, a small, battered transport about 35 m long, black and angular. A faceted
// hull from a knife-edge nose to a broad stern, blades along the spine, spikes off the chines, swept fins, three
// engines in the stern, lift thrusters and landing gear under the belly. Weak to start with; upgrades come
// later (docs/game-plan.md, phase 4).
export const TRANSPORT = {
  name: 'Mudlark', length: 35, mass: 4e5, cda: 150, // drag coefficient × frontal area (m²)
  aMain: 4, aBoost: 8, aRetro: 1,  // m/s²: main engine at full throttle (along the nose), Boost, retro thrusters (Space)
  aLift: 4,                        // m/s²: belly lift thrusters at full throttle, in hover mode
  tank: 20e3,                      // fuel, as the speed change it buys (m/s): generous, a trip to Tal and back is about 12 km/s
  // Rotation [pitch, yaw, roll]: rate is the top turn rate (rad/s), acc how fast thrusters start and stop a turn (rad/s²).
  rate: [0.17, 0.14, 0.24], acc: [0.45, 0.4, 0.6],
  stand: [0, 1, 0],                // lands belly-down: this axis points up when standing on the gear
  gearAlt: 1500,                   // the gear comes down below this height over Tal's ground (up again 15% higher)
  feet: [[6, -6, -6], [-6, -6, -6], [6, -6, 6], [-6, -6, 6]], // bottoms of the gear pads, deployed (diagonals 0-3 and 1-2)
  sections: SECTIONS,
  // Points around the hull: any of them touching the ground is a crash. The sections' points, then the tips of
  // the spikes and fins, the spine's blades, the turrets, the sensor mast and the engines.
  hull: [...SECTIONS.flatMap(hullRing), ...mirror([[7.6, -0.1, -10.4], [10.1, -0.1, -4.9], [12.1, 0, 0.6], [11.6, 0.2, 5.5], [11.6, 0.2, 12.5], [4.4, -1.0, 15.1]]),
    [0, 4.3, -6.5], [0, 6.4, 1.5], [0, 6.0, 5.5], [0, 3.8, 11.5], [0, -3.35, -4], [-3.4, 4.3, 10], [0, -1.0, 15.1]],
  // Cameras: chase offset, how far ahead it looks, how far it pulls back with Boost; landing view distance;
  // the least height above Tal's ground; the cockpit eye.
  chase: [0, 11, 50], ahead: 110, boostPull: 4, landView: 65, camClear: 10, eye: [0, 2.75, -11.8],
};
export const SHIP = TRANSPORT;     // the ship the player flies
// The Halberd (DD-07), the navy's 400 m destroyer, on patrol PATROL.alt up, starting PATROL.lead ahead of
// you: it drifts back and passes overhead after about half an hour. Its model is built in ship units
// (×scale = metres), with landing legs at the stern that fold forward along the hull.
export const PATROL = {alt: 420e3, lead: 70e3};
export const HALBERD = {
  name: 'Halberd', scale: 28,
  legHinges: [[1.6, -1.0, 4.9], [-1.6, -1.0, 4.9], [1.8, 0.55, 4.9], [-1.8, 0.55, 4.9]],
  legFeet: [[2.5, -2.6, 8.35], [-2.5, -2.6, 8.35], [2.5, 2.4, 8.35], [-2.5, 2.4, 8.35]],
};

// Tumbledown: a huge brutalist station where outcasts and misfits trade. It orbits STATION.alt up, starting
// STATION.lead ahead of you on the start orbit; being a little higher, it drifts back toward you at about 5 m/s.
// Station frame (metres): −z along its orbit, +y away from Veyra (it keeps that attitude as it goes round). A hub
// along z with the docking bay in its +z end (facing back along the orbit), a ring around its middle spinning
// for about 1 g, radiator wings and a spire at the front (wings and dish below are the shapes they collide as).
// Within dockRange and under dockSpeed relative to it you can ask to dock: station control flies you to the
// approach point behind the bay, then in to the pad.
export const STATION = {
  name: 'Tumbledown', alt: 403e3, lead: 25e3, dockRange: 10e3, dockSpeed: 50,
  hubR: 110, hubLen: 900, ringR: 1300, ringTube: 70, spin: 0.087, spokeR: 22,
  bay: {w: 160, h: 90, depth: 260}, wings: {z: -380, x0: 200, x1: 1100, h: 160}, dish: {z: -540, r: 120},
  pad: [0, -39, 300], approach: [0, -20, 1000], // ship centres: on the pad (gear on the bay floor), and the holding point behind the bay
};

// Landing on Tal, belly-down on the landing gear.
export const LEG_TIME = 3;         // seconds to lower or raise the gear
// Touchdown limits: safe under LAND_DOWN m/s down, LAND_SIDE m/s sideways, tilted under LAND_TILT°, on ground
// sloping less than LAND_SLOPE°. LAND_DOWN to LAND_HARD m/s down is a hard landing (a warning). Anything else crashes.
export const LAND_DOWN = 3, LAND_HARD = 6, LAND_SIDE = 1.5, LAND_TILT = 8, LAND_SLOPE = 12;
export const CHECKPOINT_ALT = 15e3; // "Try again" restarts here on the way down (or from the last landing)

// Direction to the sun (fixed; Veyra's year is long compared with a play session)
export const SUN_DIR = [0.65, 0.32, 1]; // normalised where it is used (engine.js sunDir)

// Rendering
export const SUN_I = 3.0;
export const UVS = 2.4;            // hull panel texture repeat
export const BRIDGE_PITCH = -0.14;
export const RADAR_RANGE = 6e7;
export const NPRED = 2400;         // predicted-orbit points in map view
export const ROCK_MAX = 900, ROCK_CELL = 3000, ROCK_VIS = 18000;
export const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
