/** Команды над стенами (D-03, SPEC §9). */
import type { CatalogLookup } from '../domain/furniture';
import { wallPoints } from '../domain/rooms';
import type { Apartment, Id, Vertex, Wall } from '../domain/types';
import { EPS_CM, nearlyEqual } from '../domain/units';
import { rotatePoint } from '../geometry/placement';
import type { Command } from './change';

const isVertical = (ap: Apartment, w: Wall) => {
  const [a, b] = wallPoints(ap, w);
  return nearlyEqual(a.x, b.x);
};

/** Стены на одной прямой, связанные через общие узлы: длинная стена сдвигается целиком (D-03). */
export function collinearChain(ap: Apartment, wallId: Id): Wall[] {
  const start = ap.walls[wallId];
  const vertical = isVertical(ap, start);
  const line = vertical ? ap.vertices[start.startId].xCm : ap.vertices[start.startId].zCm;
  const onLine = (w: Wall) =>
    isVertical(ap, w) === vertical &&
    nearlyEqual(vertical ? ap.vertices[w.startId].xCm : ap.vertices[w.startId].zCm, line);

  const chain = new Map<Id, Wall>([[start.id, start]]);
  const queue = [start];
  while (queue.length) {
    const w = queue.pop()!;
    for (const other of Object.values(ap.walls)) {
      if (chain.has(other.id) || !onLine(other)) continue;
      const shares = [other.startId, other.endId].some((v) => v === w.startId || v === w.endId);
      if (shares) {
        chain.set(other.id, other);
        queue.push(other);
      }
    }
  }
  return [...chain.values()];
}

/**
 * Настенные предметы, задняя сторона которых прилегает к грани стены из цепочки: они прикреплены
 * к стене и сдвигаются вместе с ней (это не перенос соседних помещений — SPEC §9).
 */
function followWall(ap: Apartment, chain: readonly Wall[], vertical: boolean, deltaCm: number, getItem: CatalogLookup) {
  const coord = (p: { x: number; z: number }) => (vertical ? p.x : p.z);
  const along = (p: { x: number; z: number }) => (vertical ? p.z : p.x);
  const line = coord(wallPoints(ap, chain[0])[0]);
  const span = chain.flatMap((w) => wallPoints(ap, w).map(along));
  const [a0, a1] = [Math.min(...span), Math.max(...span)];
  const furniture = { ...ap.furniture };
  for (const f of Object.values(ap.furniture)) {
    const item = getItem(f.catalogItemId);
    if (item?.mounting !== 'wall') continue;
    const r = rotatePoint({ x: 0, z: -item.size.depthCm / 2 }, f.angleDeg);
    const back = { x: f.position.xCm + r.x, z: f.position.zCm + r.z };
    const onFace = chain.some((w) => nearlyEqual(Math.abs(coord(back) - line), w.thicknessCm / 2));
    if (!onFace || along(back) < a0 - EPS_CM || along(back) > a1 + EPS_CM) continue;
    furniture[f.id] = { ...f, position: vertical ? { ...f.position, xCm: f.position.xCm + deltaCm } : { ...f.position, zCm: f.position.zCm + deltaCm } };
  }
  return furniture;
}

/**
 * Сдвиг стены (и всей её прямой) перпендикулярно на deltaCm по оси X или Z. С каталогом настенные
 * предметы на этой стене сдвигаются вместе с ней; остальная мебель остаётся и проверяется валидаторами.
 */
export function moveWall(wallId: Id, deltaCm: number, getItem?: CatalogLookup): Command {
  return {
    label: 'Сдвиг стены',
    apply(ap) {
      if (!ap.walls[wallId]) throw new Error(`Стена ${wallId} не найдена`);
      const vertical = isVertical(ap, ap.walls[wallId]);
      const chain = collinearChain(ap, wallId);
      const ids = new Set(chain.flatMap((w) => [w.startId, w.endId]));
      const vertices: Record<Id, Vertex> = { ...ap.vertices };
      for (const id of ids) {
        const v = vertices[id];
        vertices[id] = vertical ? { ...v, xCm: v.xCm + deltaCm } : { ...v, zCm: v.zCm + deltaCm };
      }
      const furniture = getItem ? followWall(ap, chain, vertical, deltaCm, getItem) : ap.furniture;
      return { ...ap, vertices, furniture };
    },
  };
}
