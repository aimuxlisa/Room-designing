/**
 * Выпуклые многоугольники в плоскости XZ: пересечение по теореме о разделяющей оси (SAT)
 * и вложенность. Касание без проникновения допустимо (допуск EPS_CM, SPEC §5.6).
 */
import { EPS_CM } from '../domain/units';
import type { Point, Rect } from './rect';

export type Polygon = readonly Point[];

export const rectPolygon = (r: Rect): Polygon => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
];

function axes(p: Polygon): Point[] {
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
  });
}

function project(p: Polygon, axis: Point): [number, number] {
  const values = p.map((v) => v.x * axis.x + v.z * axis.z);
  return [Math.min(...values), Math.max(...values)];
}

/** Проникновение глубже допуска по всем осям; касание — не пересечение. */
export function polygonsOverlap(a: Polygon, b: Polygon, eps = EPS_CM): boolean {
  for (const axis of [...axes(a), ...axes(b)]) {
    const [a0, a1] = project(a, axis);
    const [b0, b1] = project(b, axis);
    if (Math.min(a1, b1) - Math.max(a0, b0) <= eps) return false;
  }
  return true;
}

/** Точка внутри выпуклого многоугольника или на границе (с допуском). */
export function pointInConvex(p: Point, poly: Polygon, eps = EPS_CM): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const cross = ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / len;
    if (Math.abs(cross) <= eps) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export const polygonInside = (inner: Polygon, outer: Polygon): boolean => inner.every((p) => pointInConvex(p, outer));

/** Пересечение отрезков [a0, a1] и [b0, b1] глубже допуска. */
export const intervalsOverlap = (a0: number, a1: number, b0: number, b1: number, eps = EPS_CM): boolean =>
  Math.min(a1, b1) - Math.max(a0, b0) > eps;
