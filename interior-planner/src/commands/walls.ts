/** Команды над стенами (D-03, SPEC §9). */
import { wallPoints } from '../domain/rooms';
import type { Apartment, Id, Vertex, Wall } from '../domain/types';
import { nearlyEqual } from '../domain/units';
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

/** Сдвиг стены (и всей её прямой) перпендикулярно на deltaCm по оси X или Z. */
export function moveWall(wallId: Id, deltaCm: number): Command {
  return {
    label: 'Сдвиг стены',
    apply(ap) {
      if (!ap.walls[wallId]) throw new Error(`Стена ${wallId} не найдена`);
      const vertical = isVertical(ap, ap.walls[wallId]);
      const ids = new Set(collinearChain(ap, wallId).flatMap((w) => [w.startId, w.endId]));
      const vertices: Record<Id, Vertex> = { ...ap.vertices };
      for (const id of ids) {
        const v = vertices[id];
        vertices[id] = vertical ? { ...v, xCm: v.xCm + deltaCm } : { ...v, zCm: v.zCm + deltaCm };
      }
      return { ...ap, vertices };
    },
  };
}
