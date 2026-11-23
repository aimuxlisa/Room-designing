/**
 * Стена с реальными проёмами (SPEC §10.2, задача 10.2): стена разбивается на прямоугольные блоки
 * вокруг окон и дверей — простенки на всю высоту, подоконная часть под окном и перемычка над проёмом.
 * Чистая функция модели: 3D только строит коробки по этим блокам, поэтому отверстие всегда следует за проёмом.
 */
import { boundingRect, type Rect } from '../geometry/rect';
import { openingSpan, openingVerticalRange, wallAxis, wallPoint } from './openings';
import type { Apartment, Wall } from './types';
import { EPS_CM } from './units';

export interface WallBlock {
  /** Контур блока в плане, см. */
  readonly rect: Rect;
  readonly bottomCm: number;
  readonly topCm: number;
}

/** Участок стены [t0, t1] вдоль её оси (см от начальной вершины) толщиной thicknessCm по центру оси. */
export function wallSpanRect(ap: Apartment, wall: Wall, t0: number, t1: number, thicknessCm = wall.thicknessCm): Rect {
  const axis = wallAxis(ap, wall);
  const n = { x: -axis.dir.z, z: axis.dir.x };
  const h = thicknessCm / 2;
  return boundingRect([t0, t1].flatMap((t) => [wallPoint(axis, t, n, -h), wallPoint(axis, t, n, h)]));
}

/**
 * Блоки стены от пола до потолка за вычетом проёмов. Концы стены выходят за ось на полтолщины —
 * так же, как контур стены на плане (wallFootprint), чтобы углы смыкались без щели.
 */
export function wallBlocks(ap: Apartment, wall: Wall): WallBlock[] {
  const { lengthCm } = wallAxis(ap, wall);
  const ceiling = ap.ceilingCm;
  const ext = wall.thicknessCm / 2;
  const holes = Object.values(ap.openings)
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const [s0, s1] = openingSpan(o);
      const [bottom, top] = openingVerticalRange(o);
      return { s0, s1, bottom, top };
    })
    .sort((a, b) => a.s0 - b.s0);

  const blocks: WallBlock[] = [];
  const push = (t0: number, t1: number, bottomCm: number, topCm: number) => {
    if (t1 - t0 > EPS_CM && topCm - bottomCm > EPS_CM) blocks.push({ rect: wallSpanRect(ap, wall, t0, t1), bottomCm, topCm });
  };
  let cursor = -ext;
  for (const h of holes) {
    push(cursor, h.s0, 0, ceiling);
    push(h.s0, h.s1, 0, h.bottom);
    push(h.s0, h.s1, Math.min(h.top, ceiling), ceiling);
    cursor = Math.max(cursor, h.s1);
  }
  push(cursor, lengthCm + ext, 0, ceiling);
  return blocks;
}
