/**
 * sections.ts — the camera rails, scroll lengths and light keyframes for
 * every station. This is the file to edit when tuning the choreography.
 *
 *   arrive / leave   camera position + look-at target at the start and end
 *                    of the station's dwell (scroll while the copy is on screen)
 *   via              extra rail points inside the corridor INTO this station
 *   dwell / corridor scroll length in vh (corridor = travel into the station)
 *   fov              [arrive, leave]; fovPunch = mid-corridor FOV (whoosh)
 *   roll             [arrive, leave] in degrees (dutch tilt)
 *   center           the room's origin in world space
 *
 * World axes: forward is −Z, floor is y = 0, units ≈ metres.
 */
import type { StationId } from '../content';

export type V3 = [number, number, number];

export interface RailPoint {
  pos: V3;
  look: V3;
}

export interface LightPreset {
  bg: string; // page/section background + fog colour (cream page, blush section)
  key: string;
  keyIntensity: number;
  keyDir: V3; // offset of the key light from the look target
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  rim: string;
  rimIntensity: number;
  accent: string; // secondary rim (Fun coral/teal)
  accentIntensity: number;
  exposure: number;
  fog: number; // FogExp2 density
  saturation: number; // image-plane grade
  practical: number; // room practical light (People glow, Faith beam)
  gold: number; // Interesting spotlight
  glow: number; // corridor path glow
  bloom: number;
}

export interface StationDef {
  id: StationId;
  center: V3;
  via?: RailPoint[];
  arrive: RailPoint;
  leave: RailPoint;
  dwell: number;
  corridor: number;
  fov: [number, number];
  fovPunch?: number;
  roll?: [number, number];
  light: LightPreset;
}

/** Eniola's palette (from her site's theme tokens) */
export const palette = {
  cream: '#fdf7ef', // page background
  blush: '#f8e6d7', // section background
  ink: '#281c18', // buttons / text
  clay: '#af8471', // accent / hover
  border: '#e8dbd1',
  muted: '#645048',
  gold: '#d4a84b',
};

const base: LightPreset = {
  bg: palette.cream,
  key: '#ffe2c2',
  keyIntensity: 2.4,
  keyDir: [-7, 6, 7],
  hemiSky: '#fff8ee',
  hemiGround: palette.clay,
  hemiIntensity: 0.9,
  rim: '#ffd9b0',
  rimIntensity: 30,
  accent: '#5fb3ad',
  accentIntensity: 0,
  exposure: 1.0,
  fog: 0.028,
  saturation: 1,
  practical: 0,
  gold: 0,
  glow: 0.3,
  bloom: 0.25,
};

const L = (o: Partial<LightPreset>): LightPreset => ({ ...base, ...o });

export const stations: StationDef[] = [
  {
    id: 'hero',
    center: [0, 0, 0],
    arrive: { pos: [0.4, 4.2, 13], look: [0.9, 2.6, 0] },
    leave: { pos: [0.6, 2.9, 9.2], look: [1.1, 2.15, 0] },
    dwell: 75,
    corridor: 0,
    fov: [35, 30],
    light: L({ key: '#ffc994', keyIntensity: 2.8, keyDir: [-8, 3.5, 6], fog: 0.028 }),
  },
  {
    id: 'people',
    center: [9, 0, -18],
    arrive: { pos: [7.75, 2.7, -6.1], look: [8.2, 2.4, -19] },
    leave: { pos: [10.25, 2.7, -6.1], look: [8.6, 2.4, -19] },
    dwell: 70,
    corridor: 50,
    fov: [30, 30],
    light: L({ key: '#ffd6b8', keyIntensity: 2.2, keyDir: [-5, 8, 6], practical: 1, fog: 0.03 }),
  },
  {
    id: 'faith',
    center: [5, 0, -40],
    arrive: { pos: [5, 7.8, -27], look: [3.8, 4.0, -40] },
    leave: { pos: [5, 7.2, -30], look: [3.9, 4.2, -40] },
    dwell: 70,
    corridor: 50,
    fov: [40, 40],
    light: L({
      key: '#fff6e6',
      keyIntensity: 1.6,
      keyDir: [0.5, 12, 1],
      hemiSky: '#fffaf2',
      hemiIntensity: 0.7,
      rim: '#fff0d0',
      rimIntensity: 20,
      exposure: 1.15,
      fog: 0.034,
      practical: 1,
      glow: 0.15,
    }),
  },
  {
    id: 'work',
    center: [0, 0, -66],
    arrive: { pos: [0.6, 3.3, -57], look: [0, 3.1, -68] },
    leave: { pos: [0.2, 3.1, -59.5], look: [0, 3.1, -68] },
    dwell: 65,
    corridor: 55,
    fov: [32, 32],
    fovPunch: 50,
    roll: [7, 0],
    light: L({
      key: '#eef2f6',
      keyIntensity: 3.0,
      keyDir: [6, 10, 4],
      hemiSky: '#f2f4f6',
      hemiGround: '#8a6a5c',
      hemiIntensity: 0.75,
      rim: '#dfe8ff',
      rimIntensity: 50,
      fog: 0.026,
    }),
  },
  {
    id: 'help',
    center: [-8, 0, -82],
    arrive: { pos: [-7.2, 3.4, -69.4], look: [-7.6, 2.9, -81] },
    leave: { pos: [-8.8, 3.4, -69.7], look: [-8.4, 2.9, -81] },
    dwell: 85,
    corridor: 45,
    fov: [38, 38],
    light: L({ key: '#fff0de', keyIntensity: 2.4, keyDir: [2, 10, 9], hemiIntensity: 1.0, fog: 0.026 }),
  },
  {
    id: 'fun',
    center: [-4, 0, -104],
    via: [{ pos: [-8, 7.5, -88], look: [-6, 6.5, -100] }],
    arrive: { pos: [-4, 7.2, -94], look: [-2.0, 5.2, -104] },
    leave: { pos: [-3.4, 3.0, -94.6], look: [-1.8, 2.3, -104] },
    dwell: 85,
    corridor: 55,
    fov: [36, 40],
    light: L({
      key: '#ffe0d2',
      keyIntensity: 2.2,
      keyDir: [-4, 9, 5],
      rim: '#ff8a6a',
      rimIntensity: 60,
      accent: '#5fb3ad',
      accentIntensity: 30,
      hemiIntensity: 0.85,
      fog: 0.03,
    }),
  },
  {
    id: 'style',
    center: [3, 0, -126],
    arrive: { pos: [3.2, 2.6, -118], look: [3.2, 2.55, -126] },
    leave: { pos: [3.05, 2.55, -119.4], look: [3.2, 2.5, -126] },
    dwell: 65,
    corridor: 45,
    fov: [28, 28],
    light: L({
      key: '#f6f6f6',
      keyIntensity: 3.4,
      keyDir: [9, 6, 2],
      hemiSky: '#f2f2f2',
      hemiGround: '#6e6e6e',
      hemiIntensity: 0.6,
      rim: '#ffffff',
      rimIntensity: 30,
      saturation: 0.1,
      fog: 0.03,
      glow: 0.1,
    }),
  },
  {
    id: 'interesting',
    center: [-2, 0, -148],
    arrive: { pos: [-1.2, 2.75, -141.5], look: [-2, 2.1, -148] },
    leave: { pos: [-1.75, 2.3, -145.8], look: [-2, 2.1, -148] },
    dwell: 65,
    corridor: 45,
    fov: [28, 22],
    light: L({
      key: '#ffe2b0',
      keyIntensity: 1.0,
      hemiIntensity: 0.45,
      rimIntensity: 10,
      exposure: 1.0,
      fog: 0.04,
      gold: 1,
      glow: 0.05,
      bloom: 0.5,
    }),
  },
  {
    id: 'sayhi',
    center: [-3, 0, -168],
    via: [{ pos: [-6, 6, -156], look: [-14, 5, -153] }],
    arrive: { pos: [-8, 16, -178], look: [-2, 0, -120] },
    leave: { pos: [-8.5, 18.5, -182], look: [-2, 0, -116] },
    dwell: 85,
    corridor: 55,
    fov: [45, 45],
    light: L({ bg: palette.blush, key: '#ffc994', keyIntensity: 2.6, keyDir: [-8, 6, 10], fog: 0.006, glow: 1 }),
  },
  {
    id: 'footer',
    center: [-3, 0, -186],
    arrive: { pos: [-9, 24, -186], look: [-3, 12, -130] },
    leave: { pos: [-9, 31, -188], look: [-4, 27, -140] },
    dwell: 60,
    corridor: 40,
    fov: [45, 45],
    light: L({ key: '#ffc994', keyIntensity: 1.6, fog: 0.06, glow: 0.6 }),
  },
];

/** Flatten stations into rail control points and remember each station's indices. */
export function buildRailPoints() {
  const pos: V3[] = [];
  const look: V3[] = [];
  const index: { arrive: number; leave: number }[] = [];
  for (const s of stations) {
    for (const v of s.via ?? []) {
      pos.push(v.pos);
      look.push(v.look);
    }
    const arrive = pos.length;
    pos.push(s.arrive.pos);
    look.push(s.arrive.look);
    pos.push(s.leave.pos);
    look.push(s.leave.look);
    index.push({ arrive, leave: arrive + 1 });
  }
  const n = pos.length - 1;
  const t = index.map((i) => ({ arrive: i.arrive / n, leave: i.leave / n }));
  return { pos, look, t };
}

export const stationIndex = (id: StationId) => stations.findIndex((s) => s.id === id);
