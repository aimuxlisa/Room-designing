/**
 * Модель времени суток (20.1, D-12): час 0–24 → солнце или луна (направление, цвет, сила), цвета неба,
 * заполняющий свет, звёзды и огни города. Без Three.js — проверяется модульными тестами.
 * Стороны света сцены: север — −z, восток — +x, верх — +y. Солнце встаёт в 6:00 на востоке,
 * в 13:00 стоит на юге выше всего, садится в 20:00 на западе; луна идёт по противоположной дуге.
 * Значения между опорными часами интерполируются, поэтому любая смена часа плавная, а 24:00 совпадает с 0:00.
 */

export type Rgb = readonly [number, number, number];

export interface Daylight {
  readonly hour: number;
  /** Единичный вектор от сцены к солнцу; y < 0 — солнце под горизонтом. */
  readonly sunDir: readonly [number, number, number];
  readonly moonDir: readonly [number, number, number];
  /** Направленный свет сцены: солнце днём, луна ночью. */
  readonly key: { readonly dir: readonly [number, number, number]; readonly color: Rgb; readonly intensity: number; readonly isSun: boolean };
  /** Рассеянный свет полусферы (небо / земля). */
  readonly fill: { readonly sky: Rgb; readonly ground: Rgb; readonly intensity: number };
  /** Сила окружения для отражений. */
  readonly envIntensity: number;
  readonly skyTop: Rgb;
  readonly skyHorizon: Rgb;
  readonly ground: Rgb;
  /** Видимость звёзд, 0–1. */
  readonly stars: number;
  /** Огни в окнах домов, 0–1. */
  readonly cityLights: number;
}

export const SUNRISE_H = 6;
export const SUNSET_H = 20;
const SUN_MAX_ELEV = (62 * Math.PI) / 180;
const MOON_MAX_ELEV = (48 * Math.PI) / 180;

/** Быстрые кнопки (20.2). */
export const DAY_PRESETS: readonly { readonly label: string; readonly hour: number }[] = [
  { label: 'Утро', hour: 8 },
  { label: 'День', hour: 13 },
  { label: 'Вечер', hour: 19 },
  { label: 'Ночь', hour: 23 },
];
export const DEFAULT_HOUR = 13;

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

interface Key {
  readonly h: number;
  readonly skyTop: string;
  readonly skyHorizon: string;
  readonly ground: string;
  readonly sun: string;
  readonly fillSky: string;
  readonly fillGround: string;
  readonly fill: number;
  readonly env: number;
}

/** Опорные часы, по возрастанию; последний совпадает с первым через сутки. */
const KEYS: readonly Key[] = [
  { h: 0, skyTop: '#05070f', skyHorizon: '#141b2e', ground: '#0c0f12', sun: '#9fb4ff', fillSky: '#5a6a9a', fillGround: '#121418', fill: 0.1, env: 0.06 },
  { h: 4.5, skyTop: '#070a16', skyHorizon: '#1a2238', ground: '#0d1013', sun: '#9fb4ff', fillSky: '#5a6a9a', fillGround: '#121418', fill: 0.1, env: 0.06 },
  { h: 5.5, skyTop: '#1d2848', skyHorizon: '#6a5468', ground: '#1e2022', sun: '#ff9a5c', fillSky: '#7a7ea0', fillGround: '#2a2622', fill: 0.25, env: 0.14 },
  { h: 6.5, skyTop: '#41639a', skyHorizon: '#f0a070', ground: '#3a3a30', sun: '#ffa868', fillSky: '#b8b4c8', fillGround: '#4a4034', fill: 0.55, env: 0.28 },
  { h: 8, skyTop: '#4f86c8', skyHorizon: '#cfdcea', ground: '#4e5a3c', sun: '#ffe0b8', fillSky: '#e2e8f4', fillGround: '#5a5246', fill: 0.85, env: 0.4 },
  { h: 13, skyTop: '#3b78c8', skyHorizon: '#bcd6f0', ground: '#56653e', sun: '#fff6ea', fillSky: '#ffffff', fillGround: '#5a534c', fill: 1.0, env: 0.45 },
  { h: 17.5, skyTop: '#4a7cc0', skyHorizon: '#d8dce4', ground: '#525c3a', sun: '#ffe4c0', fillSky: '#eeeaf0', fillGround: '#5a5246', fill: 0.85, env: 0.4 },
  { h: 19.3, skyTop: '#4a5c94', skyHorizon: '#f4945a', ground: '#3e3a2c', sun: '#ff9048', fillSky: '#d0b8b0', fillGround: '#4a3a2c', fill: 0.55, env: 0.28 },
  { h: 20.5, skyTop: '#1e2448', skyHorizon: '#7a4a58', ground: '#1c1c1e', sun: '#ff7a48', fillSky: '#6e6e98', fillGround: '#262220', fill: 0.22, env: 0.12 },
  { h: 21.5, skyTop: '#080b18', skyHorizon: '#1c2238', ground: '#0e1114', sun: '#9fb4ff', fillSky: '#5a6a9a', fillGround: '#121418', fill: 0.1, env: 0.06 },
  { h: 24, skyTop: '#05070f', skyHorizon: '#141b2e', ground: '#0c0f12', sun: '#9fb4ff', fillSky: '#5a6a9a', fillGround: '#121418', fill: 0.1, env: 0.06 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Час в диапазоне [0, 24). */
export const wrapHour = (h: number) => ((h % 24) + 24) % 24;

/** Подпись часа «ЧЧ:ММ»; 24 показывается как 24:00. */
export function formatHour(h: number): string {
  const total = Math.round(Math.min(24, Math.max(0, h)) * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Направление по дуге: phase 0 — восход на востоке, 0.5 — верхняя точка на юге, 1 — закат на западе. */
function arcDir(phase: number, maxElev: number): [number, number, number] {
  const elev = Math.sin(phase * Math.PI) * maxElev;
  // Азимут от востока (+x) через юг (+z) к западу (−x); вне дуги (phase < 0 или > 1) уходит под горизонт.
  const az = phase * Math.PI;
  const cosE = Math.cos(elev);
  return [Math.cos(az) * cosE, Math.sin(elev), Math.sin(az) * cosE];
}

export function daylight(hourIn: number): Daylight {
  const hour = wrapHour(hourIn);
  const i = KEYS.findIndex((k, n) => n < KEYS.length - 1 && hour >= k.h && hour < KEYS[n + 1].h);
  const [a, b] = [KEYS[i], KEYS[i + 1]];
  const t = smooth((hour - a.h) / (b.h - a.h));
  const c = (f: (k: Key) => string) => mix(hex(f(a)), hex(f(b)), t);
  const n = (f: (k: Key) => number) => lerp(f(a), f(b), t);

  const dayLen = SUNSET_H - SUNRISE_H;
  const sunPhase = (hour - SUNRISE_H) / dayLen;
  // Луна: восход в 20:00, закат в 6:00 следующих суток.
  const moonPhase = wrapHour(hour - SUNSET_H) / (24 - dayLen);
  const sunDir = arcDir(sunPhase, SUN_MAX_ELEV);
  const moonDir = arcDir(moonPhase, MOON_MAX_ELEV);

  // Сила солнца растёт с высотой над горизонтом; у горизонта свет мягко гаснет за 3°.
  const sunUp = clamp01(sunDir[1] / Math.sin((3 * Math.PI) / 180));
  const sunIntensity = sunUp * (0.6 + 1.9 * Math.sqrt(clamp01(sunDir[1] / Math.sin(SUN_MAX_ELEV))));
  const moonUp = clamp01(moonDir[1] / Math.sin((3 * Math.PI) / 180));
  const moonIntensity = 0.32 * moonUp;
  // Направленный свет переходит от солнца к луне, когда солнце опускается ниже горизонта.
  const isSun = sunDir[1] > -0.02 || moonIntensity === 0;
  const key = isSun
    ? { dir: sunDir[1] > 0.05 ? sunDir : ([sunDir[0], 0.05, sunDir[2]] as const), color: c((k) => k.sun), intensity: sunIntensity, isSun }
    : { dir: moonDir, color: hex('#9fb4ff'), intensity: moonIntensity, isSun };

  const night = 1 - clamp01((sunDir[1] + 0.12) / 0.2);
  return {
    hour,
    sunDir,
    moonDir,
    key,
    fill: { sky: c((k) => k.fillSky), ground: c((k) => k.fillGround), intensity: n((k) => k.fill) },
    envIntensity: n((k) => k.env),
    skyTop: c((k) => k.skyTop),
    skyHorizon: c((k) => k.skyHorizon),
    ground: c((k) => k.ground),
    stars: smooth(night),
    cityLights: smooth(clamp01((0.1 - sunDir[1]) / 0.25)),
  };
}
