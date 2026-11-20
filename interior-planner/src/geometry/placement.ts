/**
 * Контур предмета на полу и проверка выхода за комнату. Одни и те же углы используют
 * план, 3D и валидатор (DRY). Поворот — как у three.js вокруг +Y:
 * (x, z) → (x·cos θ + z·sin θ, −x·sin θ + z·cos θ).
 */
import type { Point } from './rect';

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export function rotatePoint(p: Point, angleDeg: number): Point {
  const t = degToRad(angleDeg);
  return { x: p.x * Math.cos(t) + p.z * Math.sin(t), z: -p.x * Math.sin(t) + p.z * Math.cos(t) };
}

/** Четыре угла прямоугольника width × depth с центром в center, повёрнутого на angleDeg. */
export function footprintCorners(center: Point, widthCm: number, depthCm: number, angleDeg: number): Point[] {
  const [hw, hd] = [widthCm / 2, depthCm / 2];
  return [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ].map((p) => {
    const r = rotatePoint(p, angleDeg);
    return { x: center.x + r.x, z: center.z + r.z };
  });
}

export const snapCm = (value: number, stepCm: number): number => Math.round(value / stepCm) * stepCm;

/** Нормализация угла в [0, 360). */
export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;
