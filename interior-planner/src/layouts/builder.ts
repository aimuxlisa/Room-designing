/**
 * Построитель квартиры из прямоугольников помещений (по осям стен).
 * Общие стены, разбиение в узлах, толщины, двери и окна выводятся автоматически — схемы
 * описываются коротко и без ручных идентификаторов (DRY). Результат проверяется валидатором.
 */
import { clearSpan } from '../domain/openings';
import { roomsOfWall } from '../domain/rooms';
import type { Apartment, BoundaryEdge, Id, Opening, Room, RoomType, Vertex, Wall } from '../domain/types';

export const EXTERIOR_WALL_CM = 30;
export const INTERIOR_WALL_CM = 10;
export const CEILING_CM = 270;
export const DOOR_CM = { interior: 80, bathroom: 70, entrance: 90 } as const;
export const DOOR_HEIGHT_CM = 210;
export const WINDOW = { widthCm: 120, heightCm: 140, sillCm: 90 } as const;

export interface RoomSpec {
  readonly key: string;
  readonly type: RoomType;
  readonly name: string;
  /** Прямоугольник по осям стен, см: [x0, z0, x1, z1]. */
  readonly rect: readonly [number, number, number, number];
  /** Окно на внешней стороне: 'north' | 'south' | 'west' | 'east'. */
  readonly window?: Side;
}

export type Side = 'north' | 'south' | 'west' | 'east';

export interface LayoutSpec {
  readonly id: string;
  readonly rooms: readonly RoomSpec[];
  /** Двери: пары помещений; первое — куда открывается створка. */
  readonly doors: readonly (readonly [into: string, from: string])[];
  /** Входная дверь: помещение и внешняя сторона. */
  readonly entrance: { readonly room: string; readonly side: Side };
  /** Множитель осей (D-15). Толщины, проёмы и высота не масштабируются. */
  readonly scale: number;
}

type P = { x: number; z: number };
const key = (p: P) => `${p.x},${p.z}`;
const BATH_TYPES: readonly RoomType[] = ['bathroom', 'toilet', 'combined-bathroom'];

/** Стороны прямоугольника в порядке обхода: север → восток → юг → запад. */
function sides(r: readonly [number, number, number, number]): Record<Side, [P, P]> {
  const [x0, z0, x1, z1] = r;
  return {
    north: [{ x: x0, z: z0 }, { x: x1, z: z0 }],
    east: [{ x: x1, z: z0 }, { x: x1, z: z1 }],
    south: [{ x: x1, z: z1 }, { x: x0, z: z1 }],
    west: [{ x: x0, z: z1 }, { x: x0, z: z0 }],
  };
}
const ORDER: readonly Side[] = ['north', 'east', 'south', 'west'];

/** Точки, лежащие на отрезке [a, b] (осевом), упорядоченные от a к b. */
function pointsOn(a: P, b: P, all: readonly P[]): P[] {
  const vertical = a.x === b.x;
  const [lo, hi] = vertical ? [Math.min(a.z, b.z), Math.max(a.z, b.z)] : [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const on = all.filter((p) => (vertical ? p.x === a.x && p.z >= lo && p.z <= hi : p.z === a.z && p.x >= lo && p.x <= hi));
  const t = (p: P) => (vertical ? p.z : p.x);
  const asc = (vertical ? a.z <= b.z : a.x <= b.x) ? 1 : -1;
  return [...new Map(on.map((p) => [key(p), p])).values()].sort((p, q) => (t(p) - t(q)) * asc);
}

export function buildApartment(spec: LayoutSpec): Apartment {
  const s = spec.scale;
  const rects = spec.rooms.map((r) => r.rect.map((v) => Math.round(v * s)) as unknown as [number, number, number, number]);
  const corners = rects.flatMap((r) => Object.values(sides(r)).map(([a]) => a));

  // Узлы.
  const vertices: Record<Id, Vertex> = {};
  const vid = new Map<string, Id>();
  for (const p of corners) {
    if (vid.has(key(p))) continue;
    const id = `v${vid.size + 1}`;
    vid.set(key(p), id);
    vertices[id] = { id, xCm: p.x, zCm: p.z };
  }

  // Стены: каждый отрезок между соседними узлами на стороне комнаты; общий отрезок — одна стена.
  const walls: Record<Id, Wall> = {};
  const wallBySeg = new Map<string, Id>();
  const segOwners = new Map<string, number>();
  const boundaries: BoundaryEdge[][] = rects.map(() => []);
  rects.forEach((r, ri) => {
    for (const side of ORDER) {
      const [a, b] = sides(r)[side];
      const pts = pointsOn(a, b, corners);
      for (let i = 0; i < pts.length - 1; i++) {
        const [p, q] = [pts[i], pts[i + 1]];
        const seg = [key(p), key(q)].sort().join('|');
        if (!wallBySeg.has(seg)) {
          const id = `w${wallBySeg.size + 1}`;
          wallBySeg.set(seg, id);
          walls[id] = { id, startId: vid.get(key(p))!, endId: vid.get(key(q))!, thicknessCm: EXTERIOR_WALL_CM };
        }
        segOwners.set(seg, (segOwners.get(seg) ?? 0) + 1);
        const id = wallBySeg.get(seg)!;
        boundaries[ri].push({ wallId: id, reversed: walls[id].startId !== vid.get(key(p)) });
      }
    }
  });
  for (const [seg, id] of wallBySeg) if (segOwners.get(seg)! > 1) walls[id] = { ...walls[id], thicknessCm: INTERIOR_WALL_CM };

  const rooms: Record<Id, Room> = Object.fromEntries(
    spec.rooms.map((r, i) => [r.key, { id: r.key, type: r.type, name: r.name, boundary: boundaries[i] }]),
  );
  const draft: Apartment = {
    id: spec.id,
    schemaVersion: 1,
    ceilingCm: CEILING_CM,
    vertices,
    walls,
    rooms,
    openings: {},
    furniture: {},
    finishes: { walls: {}, floors: {} },
  };

  // Проёмы ставятся по центру самого длинного подходящего участка стены.
  const openings: Record<Id, Opening> = {};
  const centered = (wallId: Id, roomIds: Id[], width: number): number => {
    const spans = roomIds.map((id) => clearSpan(draft, walls[wallId], rooms[id]));
    const [lo, hi] = [Math.max(...spans.map((x) => x[0])), Math.min(...spans.map((x) => x[1]))];
    return Math.round((lo + hi) / 2 - width / 2);
  };
  const usable = (wallId: Id, roomIds: Id[]) => {
    const spans = roomIds.map((id) => clearSpan(draft, walls[wallId], rooms[id]));
    return Math.min(...spans.map((x) => x[1])) - Math.max(...spans.map((x) => x[0]));
  };
  const bestWall = (candidates: Id[], roomIds: Id[], what: string) => {
    const best = [...candidates].sort((a, b) => usable(b, roomIds) - usable(a, roomIds))[0];
    if (!best) throw new Error(`${spec.id}: нет стены для «${what}»`);
    return best;
  };
  const sideWalls = (roomKey: string, side: Side) => {
    const r = rects[spec.rooms.findIndex((x) => x.key === roomKey)];
    const [a, b] = sides(r)[side];
    const pts = pointsOn(a, b, corners);
    return pts.slice(0, -1).map((p, i) => wallBySeg.get([key(p), key(pts[i + 1])].sort().join('|'))!);
  };
  const exteriorOn = (roomKey: string, side: Side) =>
    sideWalls(roomKey, side).filter((id) => roomsOfWall(draft, id).length === 1);

  spec.doors.forEach(([into, from], i) => {
    const shared = Object.keys(walls).filter((id) => {
      const ids = roomsOfWall(draft, id).map((r) => r.id);
      return ids.includes(into) && ids.includes(from);
    });
    const isBath = [into, from].some((k) => BATH_TYPES.includes(rooms[k].type));
    const width = isBath ? DOOR_CM.bathroom : DOOR_CM.interior;
    const wallId = bestWall(shared, [into, from], `${rooms[into].name} — ${rooms[from].name}`);
    openings[`d${i + 1}`] = {
      id: `d${i + 1}`, kind: 'door', wallId, offsetCm: centered(wallId, [into], width),
      widthCm: width, heightCm: DOOR_HEIGHT_CM, hinge: 'left', opensIntoRoomId: into,
    };
  });

  const e = spec.entrance;
  const entryWall = bestWall(exteriorOn(e.room, e.side), [e.room], 'входная дверь');
  openings.entry = {
    id: 'entry', kind: 'door', wallId: entryWall, offsetCm: centered(entryWall, [e.room], DOOR_CM.entrance),
    widthCm: DOOR_CM.entrance, heightCm: DOOR_HEIGHT_CM, hinge: 'left', opensIntoRoomId: e.room,
  };

  for (const r of spec.rooms) {
    if (!r.window) continue;
    const wallId = bestWall(exteriorOn(r.key, r.window), [r.key], `окно: ${r.name}`);
    openings[`win-${r.key}`] = {
      id: `win-${r.key}`, kind: 'window', wallId, offsetCm: centered(wallId, [r.key], WINDOW.widthCm),
      widthCm: WINDOW.widthCm, heightCm: WINDOW.heightCm, sillCm: WINDOW.sillCm,
    };
  }

  return { ...draft, openings };
}
