/**
 * Начальный вид активной комнаты (SPEC §10.2, задача 10.3): камера стоит напротив двери и смотрит
 * на неё через центр комнаты, расстояние зависит от размера комнаты. Без Three.js — проверяется тестами.
 */
import { doorLinks } from '../domain/navigation';
import { normalIntoRoom } from '../domain/openings';
import { roomClearRect } from '../domain/rooms';
import type { Apartment, Room } from '../domain/types';
import { cmToScene } from '../domain/units';
import { rectDepth, rectWidth } from '../geometry/rect';

/** Высота точки, на которую смотрит камера, см. */
export const VIEW_TARGET_Y_CM = 80;
/** Наклон взгляда камеры вниз. */
const ELEVATION = (35 * Math.PI) / 180;
/** Поворот от оси двери: вид на три четверти, а не строго в лоб. */
const SIDE_TURN = (20 * Math.PI) / 180;

export interface RoomView {
  /** В единицах сцены. */
  readonly position: [number, number, number];
  readonly target: [number, number, number];
  readonly minDistance: number;
  readonly maxDistance: number;
}

export function roomView(ap: Apartment, room: Room): RoomView {
  const r = roomClearRect(ap, room);
  const c = { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
  const span = Math.max(rectWidth(r), rectDepth(r));
  const links = doorLinks(ap, room.id);
  // Входная дверь — главная; иначе первая межкомнатная. Без дверей — диагональ.
  const door = (links.find((l) => l.to === null) ?? links[0])?.door;
  const n = door ? normalIntoRoom(ap, ap.walls[door.wallId], room) : { x: Math.SQRT1_2, z: Math.SQRT1_2 };
  const [cos, sin] = [Math.cos(SIDE_TURN), Math.sin(SIDE_TURN)];
  const dir = { x: n.x * cos - n.z * sin, z: n.x * sin + n.z * cos };
  const dist = span * 1.1 + 150;
  const horiz = dist * Math.cos(ELEVATION);
  return {
    position: [cmToScene(c.x + dir.x * horiz), cmToScene(VIEW_TARGET_Y_CM + dist * Math.sin(ELEVATION)), cmToScene(c.z + dir.z * horiz)],
    target: [cmToScene(c.x), cmToScene(VIEW_TARGET_Y_CM), cmToScene(c.z)],
    minDistance: cmToScene(50),
    maxDistance: cmToScene(dist * 2),
  };
}
