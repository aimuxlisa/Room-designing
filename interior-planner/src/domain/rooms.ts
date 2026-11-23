/**
 * Производная геометрия комнат. Единственное место, где из стен выводятся контур пола,
 * чистый прямоугольник и площади (DRY, SPEC §4, §5.2). 2D и 3D вызывают эти функции.
 */
import { boundingRect, expandRect, insetRect, rectArea, rectDepth, rectWidth, unionArea, type Point, type Rect } from '../geometry/rect';
import type { Apartment, BoundaryEdge, Id, Room, Vertex, Wall } from './types';
import { nearlyEqual } from './units';

export type Side = 'minX' | 'maxX' | 'minZ' | 'maxZ';
export const SIDES: readonly Side[] = ['minX', 'maxX', 'minZ', 'maxZ'];

export const surfaceKey = (wallId: Id, roomId: Id): string => `${wallId}|${roomId}`;
export const parseSurfaceKey = (key: string): { wallId: Id; roomId: Id } => {
  const [wallId, roomId] = key.split('|');
  return { wallId, roomId };
};

const toPoint = (v: Vertex): Point => ({ x: v.xCm, z: v.zCm });

export function wallPoints(ap: Apartment, wall: Wall): [Point, Point] {
  return [toPoint(ap.vertices[wall.startId]), toPoint(ap.vertices[wall.endId])];
}

/** Контур стены на плане: отрезок оси, расширенный на полтолщины (общий для 2D, 3D и площадей). */
export const wallFootprint = (ap: Apartment, wall: Wall): Rect =>
  expandRect(boundingRect(wallPoints(ap, wall)), wall.thicknessCm / 2);

export const wallLengthCm =(ap: Apartment, wall: Wall): number => {
  const [a, b] = wallPoints(ap, wall);
  return Math.hypot(b.x - a.x, b.z - a.z);
};

/** Вершины обхода комнаты в порядке границы (по одной на ребро — его начало). */
export function roomOutline(ap: Apartment, room: Room): Point[] {
  return room.boundary.map((edge) => edgePoints(ap, edge)[0]);
}

export function edgePoints(ap: Apartment, edge: BoundaryEdge): [Point, Point] {
  const [a, b] = wallPoints(ap, ap.walls[edge.wallId]);
  return edge.reversed ? [b, a] : [a, b];
}

/** Прямоугольник по осям стен. Предполагает прямоугольную комнату (проверяется в integrity). */
export const roomAxisRect = (ap: Apartment, room: Room): Rect => boundingRect(roomOutline(ap, room));

/** На какой стороне осевого прямоугольника лежит ребро; null — ребро не на границе прямоугольника. */
export function edgeSide(rect: Rect, a: Point, b: Point): Side | null {
  if (nearlyEqual(a.x, b.x)) {
    if (nearlyEqual(a.x, rect.minX)) return 'minX';
    if (nearlyEqual(a.x, rect.maxX)) return 'maxX';
  } else if (nearlyEqual(a.z, b.z)) {
    if (nearlyEqual(a.z, rect.minZ)) return 'minZ';
    if (nearlyEqual(a.z, rect.maxZ)) return 'maxZ';
  }
  return null;
}

/** Стены комнаты, сгруппированные по сторонам прямоугольника. */
export function roomSideWalls(ap: Apartment, room: Room): Record<Side, Wall[]> {
  const rect = roomAxisRect(ap, room);
  const result: Record<Side, Wall[]> = { minX: [], maxX: [], minZ: [], maxZ: [] };
  for (const edge of room.boundary) {
    const [a, b] = edgePoints(ap, edge);
    const side = edgeSide(rect, a, b);
    if (side) result[side].push(ap.walls[edge.wallId]);
  }
  return result;
}

/** Сторона комнаты, на которой лежит стена; null — стена не принадлежит комнате. */
export function wallSideInRoom(ap: Apartment, wallId: Id, room: Room): Side | null {
  const sides = roomSideWalls(ap, room);
  return SIDES.find((s) => sides[s].some((w) => w.id === wallId)) ?? null;
}

/** Ось, вдоль которой сторона задаёт размер: minX/maxX — ширина (X), minZ/maxZ — глубина (Z). */
export const sideAxis = (side: Side): 'x' | 'z' => (side === 'minX' || side === 'maxX' ? 'x' : 'z');

/**
 * Сдвиг стены, который даёт комнате новый чистый размер при неподвижной противоположной стене (D-03):
 * стена на стороне max двигается в +, на стороне min — в −.
 */
export function deltaForRoomSize(ap: Apartment, wallId: Id, room: Room, newSizeCm: number): number | null {
  const side = wallSideInRoom(ap, wallId, room);
  if (!side) return null;
  const r = roomClearRect(ap, room);
  const current = sideAxis(side) === 'x' ? rectWidth(r) : rectDepth(r);
  return side === 'maxX' || side === 'maxZ' ? newSizeCm - current : current - newSizeCm;
}

/**
 * Чистый прямоугольник пола: осевой минус половина толщины стены с каждой стороны.
 * Толщина на стороне едина (проверяется в integrity), поэтому берётся первая стена.
 */
export function roomClearRect(ap: Apartment, room: Room): Rect {
  const sides = roomSideWalls(ap, room);
  const half = (side: Side) => (sides[side][0]?.thicknessCm ?? 0) / 2;
  return insetRect(roomAxisRect(ap, room), {
    minX: half('minX'),
    maxX: half('maxX'),
    minZ: half('minZ'),
    maxZ: half('maxZ'),
  });
}

export const roomClearAreaCm2 = (ap: Apartment, room: Room): number => rectArea(roomClearRect(ap, room));

/** Комнаты, к которым примыкает стена (выводится из границ, SPEC §6). */
export const roomsOfWall = (ap: Apartment, wallId: Id): Room[] =>
  Object.values(ap.rooms).filter((r) => r.boundary.some((e) => e.wallId === wallId));

/** Сумма чистых площадей помещений — используется в подборе схемы (SPEC §5.2, задача 3.4). */
export const apartmentClearAreaCm2 = (ap: Apartment): number =>
  Object.values(ap.rooms).reduce((sum, room) => sum + roomClearAreaCm2(ap, room), 0);

/**
 * Площадь по внешнему контуру (со стенами): объединение осевых прямоугольников комнат,
 * и внешних стен, расширенных на полтолщины во все стороны (продление по длине заполняет углы).
 */
export function apartmentOuterAreaCm2(ap: Apartment): number {
  const rects: Rect[] = Object.values(ap.rooms).map((room) => roomAxisRect(ap, room));
  const exterior = Object.values(ap.walls).filter((w) => roomsOfWall(ap, w.id).length === 1);
  return unionArea([...rects, ...exterior.map((w) => wallFootprint(ap, w))]);
}

/** Подписи площадей для интерфейса (задача 3.4): два разных правила не смешиваются. */
export const AREA_LABELS = {
  clear: 'Площадь помещений (чистая)',
  outer: 'Площадь по внешнему контуру (со стенами)',
} as const;
