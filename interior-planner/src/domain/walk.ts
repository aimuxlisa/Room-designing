/**
 * Режим «Прогулка» (этап 24, D-17): движение от первого лица по всей квартире. Без Three.js.
 * Игрок в плане — квадрат 2·PLAYER_RADIUS_CM; препятствия — многоугольники в плане: блоки стен ниже пояса
 * (простенки и подоконники; перемычка над дверью не мешает), закрытая входная дверь и коллайдеры мебели
 * в диапазоне высот тела (ковры и предметы над головой не мешают). Проёмы межкомнатных дверей проходимы.
 */
import { polygonsOverlap, rectPolygon, type Polygon } from '../geometry/polygon';
import type { Point } from '../geometry/rect';
import { instanceShapes, type CatalogLookup } from './furniture';
import { openingSpan } from './openings';
import { roomClearRect, roomsOfWall } from './rooms';
import type { Apartment, DoorOpening, Id } from './types';
import { wallBlocks, wallSpanRect } from './wallBlocks';

/** Высота глаз, см. */
export const EYE_HEIGHT_CM = 160;
/** Половина ширины игрока в плане, см: проходит в дверь от 40 см. */
export const PLAYER_RADIUS_CM = 18;
/** Скорость шага и бега (Shift), см/с. */
export const WALK_SPEED_CM_S = 140;
export const RUN_SPEED_CM_S = 280;
/** Предел наклона взгляда вверх и вниз, рад. */
export const PITCH_LIMIT = 1.45;
/** Препятствие начинается ниже пояса и выше щиколотки, см. */
const BODY_TOP_CM = 120;
const ANKLE_CM = 12;

export interface Obstacle {
  readonly id: string;
  readonly polygon: Polygon;
}

/** Входная дверь — дверь стены, к которой прилегает одна комната; в прогулке она закрыта. */
export const entryDoors = (ap: Apartment): DoorOpening[] =>
  Object.values(ap.openings).filter((o): o is DoorOpening => o.kind === 'door' && roomsOfWall(ap, o.wallId).length < 2);

export function walkObstacles(ap: Apartment, getItem: CatalogLookup): Obstacle[] {
  const out: Obstacle[] = [];
  for (const wall of Object.values(ap.walls))
    wallBlocks(ap, wall).forEach((b, i) => b.bottomCm < BODY_TOP_CM && out.push({ id: `wall-${wall.id}-${i}`, polygon: rectPolygon(b.rect) }));
  for (const door of entryDoors(ap)) {
    const [s0, s1] = openingSpan(door);
    out.push({ id: `entry-${door.id}`, polygon: rectPolygon(wallSpanRect(ap, ap.walls[door.wallId], s0, s1)) });
  }
  for (const f of Object.values(ap.furniture)) {
    const item = getItem(f.catalogItemId);
    if (!item || item.layer === 'floor-covering') continue;
    instanceShapes(f, item).forEach(
      (s, i) => s.bottom < BODY_TOP_CM && s.top > ANKLE_CM && out.push({ id: `furniture-${f.id}-${i}`, polygon: s.polygon }),
    );
  }
  return out;
}

const playerPolygon = (p: Point): Polygon =>
  rectPolygon({ minX: p.x - PLAYER_RADIUS_CM, maxX: p.x + PLAYER_RADIUS_CM, minZ: p.z - PLAYER_RADIUS_CM, maxZ: p.z + PLAYER_RADIUS_CM });

/** Препятствие, в которое упирается игрок в точке p, или undefined. */
export const obstacleAt = (p: Point, obstacles: readonly Obstacle[]): Obstacle | undefined => {
  const me = playerPolygon(p);
  return obstacles.find((o) => polygonsOverlap(me, o.polygon));
};

/**
 * Шаг с учётом столкновений: движение по x и по z отдельно, поэтому вдоль стены игрок скользит.
 * Длинный шаг (медленный кадр) дробится, чтобы не проскочить тонкую стену. Если игрок уже внутри
 * препятствия (например, предмет поставили на него), движение свободно — он может выйти.
 */
export function walkStep(p: Point, delta: Point, obstacles: readonly Obstacle[]): Point {
  if (obstacleAt(p, obstacles)) return { x: p.x + delta.x, z: p.z + delta.z };
  const n = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (PLAYER_RADIUS_CM / 2)));
  let cur = p;
  for (let i = 0; i < n; i++) {
    const nx = { x: cur.x + delta.x / n, z: cur.z };
    if (!obstacleAt(nx, obstacles)) cur = nx;
    const nz = { x: cur.x, z: cur.z + delta.z / n };
    if (!obstacleAt(nz, obstacles)) cur = nz;
  }
  return cur;
}

export interface WalkInput {
  /** Вперёд (+1) / назад (−1). */
  readonly forward: number;
  /** Вправо (+1) / влево (−1). */
  readonly right: number;
}

/**
 * Смещение за кадр, см: yaw — поворот взгляда вокруг вертикали (0 — взгляд в −z, как у камеры Three.js),
 * по диагонали не быстрее, чем прямо.
 */
export function walkDelta(yaw: number, input: WalkInput, distanceCm: number): Point {
  const len = Math.hypot(input.forward, input.right);
  if (len === 0) return { x: 0, z: 0 };
  const [f, r] = [input.forward / len, input.right / len];
  const [s, c] = [Math.sin(yaw), Math.cos(yaw)];
  return { x: (-s * f + c * r) * distanceCm, z: (-c * f - s * r) * distanceCm };
}

/** Комната, в чистом прямоугольнике которой стоит точка; в проёме двери — null. */
export const roomAt = (ap: Apartment, p: Point): Id | null => {
  for (const room of Object.values(ap.rooms)) {
    const r = roomClearRect(ap, room);
    if (p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ) return room.id;
  }
  return null;
};

/**
 * Начальная точка прогулки в комнате: центр, а если там предмет — ближайшая свободная точка по спирали
 * с шагом 20 см. Взгляд — вдоль длинной стороны комнаты.
 */
export function walkStart(ap: Apartment, roomId: Id, obstacles: readonly Obstacle[]): { x: number; z: number; yaw: number } {
  const r = roomClearRect(ap, ap.rooms[roomId]);
  const c = { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
  const yaw = r.maxX - r.minX > r.maxZ - r.minZ ? -Math.PI / 2 : 0;
  const inside = (p: Point) => p.x - PLAYER_RADIUS_CM > r.minX && p.x + PLAYER_RADIUS_CM < r.maxX && p.z - PLAYER_RADIUS_CM > r.minZ && p.z + PLAYER_RADIUS_CM < r.maxZ;
  for (let ring = 0; ring < 40; ring++)
    for (let i = -ring; i <= ring; i++)
      for (const p of [
        { x: c.x + i * 20, z: c.z - ring * 20 },
        { x: c.x + i * 20, z: c.z + ring * 20 },
        { x: c.x - ring * 20, z: c.z + i * 20 },
        { x: c.x + ring * 20, z: c.z + i * 20 },
      ])
        if (inside(p) && !obstacleAt(p, obstacles)) return { ...p, yaw };
  return { ...c, yaw };
}
