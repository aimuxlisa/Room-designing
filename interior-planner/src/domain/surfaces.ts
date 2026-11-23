/** Внутренние поверхности стен (SPEC §13, этап 12): подпись стороны и физический масштаб обоев. */
import { normalIntoRoom } from './openings';
import { roomsOfWall } from './rooms';
import type { Apartment, Id } from './types';

/** Сторона света наружу от комнаты: на плане север сверху (меньший z). */
function outwardSide(n: { x: number; z: number }): string {
  const [ox, oz] = [-n.x, -n.z];
  if (Math.abs(ox) > Math.abs(oz)) return ox > 0 ? 'восточная' : 'западная';
  return oz > 0 ? 'южная' : 'северная';
}

/** Однозначная подпись поверхности: комната, сторона и сосед по общей стене (12.1). */
export function surfaceLabel(ap: Apartment, wallId: Id, roomId: Id): string {
  const room = ap.rooms[roomId];
  const side = outwardSide(normalIntoRoom(ap, ap.walls[wallId], room));
  const neighbour = roomsOfWall(ap, wallId).find((r) => r.id !== roomId);
  return neighbour
    ? `«${room.name}», ${side} стена — сторона к «${neighbour.name}»`
    : `«${room.name}», ${side} стена (наружная)`;
}

export interface TileUv {
  readonly repeat: readonly [number, number];
  readonly offset: readonly [number, number];
}

/**
 * Повтор и сдвиг текстуры обоев на участке стены (12.4). Рисунок привязан к стене в сантиметрах:
 * число повторов = длина / размер повтора, поэтому при удлинении стены рисунок повторяется, а не растягивается.
 * uStartCm — координата начала участка вдоль направления текстуры, bottomCm — высота низа участка.
 */
export function tileUv(uStartCm: number, lengthCm: number, bottomCm: number, heightCm: number, tile: { widthCm: number; heightCm: number }): TileUv {
  return {
    repeat: [lengthCm / tile.widthCm, heightCm / tile.heightCm],
    offset: [uStartCm / tile.widthCm, bottomCm / tile.heightCm],
  };
}
