/**
 * Геометрия проёмов (SPEC §6, §11.3). Положение проёма: offsetCm — расстояние вдоль оси стены
 * от её начальной вершины до края проёма. Чистый отступ до угла комнаты выводится отсюда же.
 */
import type { Point } from '../geometry/rect';
import type { Polygon } from '../geometry/polygon';
import { roomClearRect, roomsOfWall, wallPoints } from './rooms';
import type { Apartment, DoorOpening, Opening, Room, Wall } from './types';

/** Глубина запретной зоны перед дверью, см (SPEC §11.3). */
export const DOOR_THRESHOLD_CM = 30;
/** Число звеньев дуги створки. */
export const SWING_SEGMENTS = 12;

export interface WallAxis {
  readonly start: Point;
  /** Единичный вектор от начала к концу. */
  readonly dir: Point;
  readonly lengthCm: number;
}

export function wallAxis(ap: Apartment, wall: Wall): WallAxis {
  const [a, b] = wallPoints(ap, wall);
  const lengthCm = Math.hypot(b.x - a.x, b.z - a.z);
  return { start: a, dir: { x: (b.x - a.x) / lengthCm, z: (b.z - a.z) / lengthCm }, lengthCm };
}

const along = (axis: WallAxis, t: number): Point => ({ x: axis.start.x + axis.dir.x * t, z: axis.start.z + axis.dir.z * t });

/** Единичная нормаль от оси стены внутрь комнаты. */
export function normalIntoRoom(ap: Apartment, wall: Wall, room: Room): Point {
  const axis = wallAxis(ap, wall);
  const r = roomClearRect(ap, room);
  const c = { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
  const n = { x: -axis.dir.z, z: axis.dir.x };
  const side = (c.x - axis.start.x) * n.x + (c.z - axis.start.z) * n.z;
  return side >= 0 ? n : { x: -n.x, z: -n.z };
}

/** Проекция точки на ось стены, см от начала. */
export const alongWall = (axis: WallAxis, p: Point): number =>
  (p.x - axis.start.x) * axis.dir.x + (p.z - axis.start.z) * axis.dir.z;

/** Чистый участок стены со стороны комнаты: [от, до] вдоль оси. */
export function clearSpan(ap: Apartment, wall: Wall, room: Room): [number, number] {
  const axis = wallAxis(ap, wall);
  const r = roomClearRect(ap, room);
  const values = [
    { x: r.minX, z: r.minZ },
    { x: r.maxX, z: r.maxZ },
  ].map((p) => alongWall(axis, p));
  return [Math.max(0, Math.min(...values)), Math.min(axis.lengthCm, Math.max(...values))];
}

/** Точка на оси стены на расстоянии t от начала, со сдвигом d по нормали n. */
export const wallPoint = (axis: WallAxis, t: number, n: Point = { x: 0, z: 0 }, d = 0): Point => {
  const p = along(axis, t);
  return { x: p.x + n.x * d, z: p.z + n.z * d };
};

/** Контур проёма в плане: участок стены на всю толщину (общий для плана и 3D). */
export function openingFootprint(ap: Apartment, o: Opening): Point[] {
  const wall = ap.walls[o.wallId];
  const axis = wallAxis(ap, wall);
  const n = { x: -axis.dir.z, z: axis.dir.x };
  const h = wall.thicknessCm / 2;
  const [s0, s1] = openingSpan(o);
  return [wallPoint(axis, s0, n, -h), wallPoint(axis, s1, n, -h), wallPoint(axis, s1, n, h), wallPoint(axis, s0, n, h)];
}

/** Чистый отступ проёма от угла комнаты, см (подпись на плане, SPEC §9). */
export const clearOffsetCm = (ap: Apartment, o: Opening, room: Room): number =>
  o.offsetCm - clearSpan(ap, ap.walls[o.wallId], room)[0];

export const openingSpan =(o: Opening): [number, number] => [o.offsetCm, o.offsetCm + o.widthCm];

/** Вертикальный диапазон проёма над полом, см. */
export const openingVerticalRange = (o: Opening): [number, number] =>
  o.kind === 'window' ? [o.sillCm, o.sillCm + o.heightCm] : [0, o.heightCm];

/** Окно или дверь на внешней стене (одна прилегающая комната). */
export const isExteriorWall = (ap: Apartment, wallId: string): boolean => roomsOfWall(ap, wallId).length === 1;

/** Комнаты, которые соединяет дверь; null — выход наружу (входная дверь, SPEC §7). */
export function doorConnects(ap: Apartment, door: DoorOpening): [Room, Room | null] | null {
  const rooms = roomsOfWall(ap, door.wallId);
  if (rooms.length === 0) return null;
  return [rooms[0], rooms[1] ?? null];
}

/**
 * Запретные зоны двери (SPEC §11.3, D-06): прямоугольник глубиной 30 см перед проёмом
 * в каждой прилегающей комнате и четверть круга радиусом в ширину двери со стороны открывания.
 */
export function doorZones(ap: Apartment, door: DoorOpening): { roomId: string; polygon: Polygon }[] {
  const wall = ap.walls[door.wallId];
  const axis = wallAxis(ap, wall);
  const [s0, s1] = openingSpan(door);
  const half = wall.thicknessCm / 2;
  const zones: { roomId: string; polygon: Polygon }[] = [];

  for (const room of roomsOfWall(ap, wall.id)) {
    const n = normalIntoRoom(ap, wall, room);
    const at = (t: number, d: number): Point => wallPoint(axis, t, n, d);
    zones.push({
      roomId: room.id,
      polygon: [at(s0, half), at(s1, half), at(s1, half + DOOR_THRESHOLD_CM), at(s0, half + DOOR_THRESHOLD_CM)],
    });

    if (door.opensIntoRoomId !== room.id) continue;
    const swing = doorSwing(ap, door);
    zones.push({ roomId: room.id, polygon: [swing.hinge, ...swing.arc] });
  }
  return zones;
}

export interface DoorSwing {
  /** Петля на поверхности стены со стороны открывания. */
  readonly hinge: Point;
  /** Конец открытого на 90° полотна. */
  readonly leafEnd: Point;
  /** Дуга створки от закрытого положения до открытого (SWING_SEGMENTS звеньев). */
  readonly arc: Point[];
}

/**
 * Створка двери: петля у начала проёма ('left') или у конца ('right') по направлению стены;
 * открывается в opensIntoRoomId или наружу, если null. Общая для плана и зон двери (DRY).
 */
export function doorSwing(ap: Apartment, door: DoorOpening): DoorSwing {
  const wall = ap.walls[door.wallId];
  const axis = wallAxis(ap, wall);
  const rooms = roomsOfWall(ap, wall.id);
  const into = rooms.find((r) => r.id === door.opensIntoRoomId);
  const ref = normalIntoRoom(ap, wall, into ?? rooms[0]);
  const n = into ? ref : { x: -ref.x, z: -ref.z };
  const [s0, s1] = openingSpan(door);
  const toward = door.hinge === 'left' ? 1 : -1;
  const hinge = wallPoint(axis, door.hinge === 'left' ? s0 : s1, n, wall.thicknessCm / 2);
  const arc: Point[] = [];
  for (let i = 0; i <= SWING_SEGMENTS; i++) {
    const a = (i / SWING_SEGMENTS) * (Math.PI / 2);
    const u = Math.cos(a) * door.widthCm * toward;
    const v = Math.sin(a) * door.widthCm;
    arc.push({ x: hinge.x + axis.dir.x * u + n.x * v, z: hinge.z + axis.dir.z * u + n.z * v });
  }
  return { hinge, leafEnd: arc[arc.length - 1], arc };
}
