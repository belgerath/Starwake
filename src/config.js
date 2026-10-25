// World and ship constants. Everything is in SI units: metres, seconds, m/s, m/s².
// The universe frame is inertial and centred on Veyra; physics never touches render coordinates.
import * as THREE from 'three';

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
export const MOON_INC = 0.09;      // orbit inclination to Veyra's equator
export const MOON_FLOOR = 3e3;
export const SOI_M = MOON_A * Math.pow(GM_M / GM, 0.4);
export const MOON_N = Math.sqrt((GM + GM_M) / Math.pow(MOON_A, 3));

// Ring (equatorial)
export const RING_IN = 1.7 * R;
export const RING_OUT = 2.35 * R;
export const RING_H = 350;         // half-thickness for local rocks

// Ship: DD-07 Halberd, ~400 m
export const SHIP_SCALE = 28;      // model "ship units" to metres
export const SHIP_MASS = 6e7;
export const CDA = 2400;           // drag coefficient × frontal area
export const A_MAIN = 25;          // main engine at 100% throttle
export const A_BOOST = 50;         // boost (overdrive)
export const A_RETRO = 6;          // forward-facing retro thrusters
// Rotation: [pitch, yaw, roll]. RATE is max turn rate (rad/s), ACC is how fast thrusters start and stop a turn (rad/s²).
// Tuned with Craig: heavy top speed, crisp stop (~1.7° overshoot). Change with care.
export const RATE = [0.14, 0.14, 0.17];
export const ACC = [0.33, 0.33, 0.4];
export const WARPS = [1, 10, 100, 1000];

// Direction to the sun (fixed; Veyra's year is long compared with a play session)
export const SUN_DIR = new THREE.Vector3(0.65, 0.32, 1).normalize();

// Rendering
export const SUN_I = 3.0;
export const UVS = 2.4;            // hull panel texture repeat
export const BRIDGE_PITCH = -0.14;
export const RADAR_RANGE = 6e7;
export const CHASE = new THREE.Vector3(0, 4.8, 21.8); // chase camera offset in ship units
export const NPRED = 2400;         // predicted-orbit points in map view
export const ROCK_MAX = 900, ROCK_CELL = 3000, ROCK_VIS = 18000;
export const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
