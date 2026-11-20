/**
 * Мебель в модели: коллайдеры экземпляров и проверки размещения (SPEC §11, задачи 5.4–5.5).
 * Один источник контуров для плана, 3D и валидаторов (DRY).
 */
import { footprintCorners, normalizeDeg, rotatePoint } from '../geometry/placement';
import { intervalsOverlap, polygonInside, polygonsOverlap, rectPolygon, type Polygon } from '../geometry/polygon';
import type { Point } from '../geometry/rect';
import { alongWall, doorZones, openingSpan, openingVerticalRange, wallAxis } from './openings';
import { roomClearRect, roomSideWalls, SIDES } from './rooms';
import type { Apartment, CatalogItem, ColliderBox, FurnitureInstance, Id } from './types';
import { EPS_CM, nearlyEqual } from './units';
import type { Issue, Validator } from './validation';

export type CatalogLookup = (id: Id) => CatalogItem | undefined;
type Placed = Pick<FurnitureInstance, 'position' | 'angleDeg'>;

/** Общий габарит на полу (для отображения на плане). */
export const instanceCorners = (f: Placed, item: CatalogItem): Point[] =>
  footprintCorners({ x: f.position.xCm, z: f.position.zCm }, item.size.widthCm, item.size.depthCm, f.angleDeg);

export interface ColliderShape {
  readonly polygon: Polygon;
  /** Нижняя и верхняя отметка над полом, см. */
  readonly bottom: number;
  readonly top: number;
}

export function colliderShape(f: Placed, c: ColliderBox): ColliderShape {
  const offset = rotatePoint({ x: c.center.xCm, z: c.center.zCm }, f.angleDeg);
  const center = { x: f.position.xCm + offset.x, z: f.position.zCm + offset.z };
  const mid = f.position.yCm + c.center.yCm;
  return {
    polygon: footprintCorners(center, c.size.widthCm, c.size.depthCm, f.angleDeg),
    bottom: mid - c.size.heightCm / 2,
    top: mid + c.size.heightCm / 2,
  };
}

export const instanceShapes = (f: Placed, item: CatalogItem): ColliderShape[] => item.colliders.map((c) => colliderShape(f, c));

export const shapesCollide = (a: ColliderShape, b: ColliderShape): boolean =>
  intervalsOverlap(a.bottom, a.top, b.bottom, b.top) && polygonsOverlap(a.polygon, b.polygon);

const topOf = (shapes: ColliderShape[]) => Math.max(...shapes.map((s) => s.top));

/**
 * Высота установки по способу из карточки (SPEC §11.3): пол — 0, стена — высота из карточки,
 * потолок — под потолком, столешница — верх опоры под точкой (0, если опоры нет).
 */
export function restingY(
  ap: Apartment,
  getItem: CatalogLookup,
  item: CatalogItem,
  at: Placed & { roomId: Id },
  ignoreId?: Id,
): number {
  switch (item.mounting) {
    case 'floor':
      return 0;
    case 'wall':
      return item.mountHeightCm ?? 0;
    case 'ceiling':
      return ap.ceilingCm - item.size.heightCm;
    case 'tabletop': {
      const p = { x: at.position.xCm, z: at.position.zCm };
      let best = 0;
      for (const f of Object.values(ap.furniture)) {
        const support = getItem(f.catalogItemId);
        if (f.id === ignoreId || f.roomId !== at.roomId || !support || support.mounting !== 'floor') continue;
        const shapes = instanceShapes(f, support);
        const top = topOf(shapes);
        if (shapes.some((s) => nearlyEqual(s.top, top) && polygonInside([p], s.polygon))) best = Math.max(best, top);
      }
      return best;
    }
  }
}

// ---- Валидаторы ----

interface Entry {
  readonly f: FurnitureInstance;
  readonly item: CatalogItem;
  readonly shapes: ColliderShape[];
}

const entries = (ap: Apartment, getItem: CatalogLookup): Entry[] =>
  Object.values(ap.furniture).flatMap((f) => {
    const item = getItem(f.catalogItemId);
    return item && ap.rooms[f.roomId] ? [{ f, item, shapes: instanceShapes(f, item) }] : [];
  });

const roomName = (ap: Apartment, id: Id) => ap.rooms[id].name;
const issue = (code: string, message: string, ...objectIds: Id[]): Issue => ({ code, message, objectIds });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const catalogPresenceValidator =
  (getItem: CatalogLookup): Validator =>
  (ap) =>
    Object.values(ap.furniture)
      .filter((f) => !getItem(f.catalogItemId))
      .map((f) => issue('catalog-missing', `Предмет ${f.id}: нет в каталоге`, f.id));

/** 5.4: все объёмы целиком в чистом прямоугольнике комнаты, с учётом поворота. */
export const furnitureInRoomValidator =
  (getItem: CatalogLookup): Validator =>
  (ap) =>
    entries(ap, getItem)
      .filter(({ f, shapes }) => {
        const room = rectPolygon(roomClearRect(ap, ap.rooms[f.roomId]));
        return shapes.some((s) => !polygonInside(s.polygon, room) || s.top > ap.ceilingCm + EPS_CM);
      })
      .map(({ f, item }) =>
        issue('out-of-room', `В комнате «${roomName(ap, f.roomId)}» ${lower(item.name)} пересекает стену`, f.id, f.roomId),
      );

/** 5.4–5.5: пересечение предметов по объёмам; ковёр под мебелью допустим, ковёр на ковре — нет. */
export const furnitureCollisionValidator =
  (getItem: CatalogLookup): Validator =>
  (ap) => {
    const list = entries(ap, getItem);
    const out: Issue[] = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (a.f.roomId !== b.f.roomId) continue;
        const coverings = [a, b].filter((e) => e.item.layer === 'floor-covering').length;
        if (coverings === 1) continue;
        const hit =
          coverings === 2
            ? a.shapes.some((s) => b.shapes.some((t) => polygonsOverlap(s.polygon, t.polygon)))
            : a.shapes.some((s) => b.shapes.some((t) => shapesCollide(s, t)));
        if (hit)
          out.push(issue('furniture-overlap', `${a.item.name} пересекается с предметом «${lower(b.item.name)}»`, a.f.id, b.f.id));
      }
    return out;
  };

/** 5.5 (D-06): мебель не стоит в дверном проёме и в зоне открывания створки. */
export const doorZoneValidator =
  (getItem: CatalogLookup): Validator =>
  (ap) => {
    const doors = Object.values(ap.openings).filter((o) => o.kind === 'door' && ap.walls[o.wallId]);
    const out: Issue[] = [];
    for (const { f, item, shapes } of entries(ap, getItem)) {
      if (item.layer === 'floor-covering') continue;
      for (const door of doors) {
        if (door.kind !== 'door') continue;
        const zones = doorZones(ap, door).filter((z) => z.roomId === f.roomId);
        const blocked = shapes.some((s) => s.bottom < door.heightCm - EPS_CM && zones.some((z) => polygonsOverlap(s.polygon, z.polygon)));
        if (blocked) out.push(issue('door-zone', `${item.name} мешает двери: стоит в проёме или в зоне открывания`, f.id, door.id));
      }
    }
    return out;
  };

/** Сторона комнаты, на которой лежит задняя грань предмета (локальная ось −Z), или null. */
function backWallSide(ap: Apartment, f: FurnitureInstance, item: CatalogItem) {
  const angle = normalizeDeg(f.angleDeg);
  if (Math.abs(angle % 90) > 1e-6) return null;
  const back = rotatePoint({ x: 0, z: -item.size.depthCm / 2 }, angle);
  const p = { x: f.position.xCm + back.x, z: f.position.zCm + back.z };
  const r = roomClearRect(ap, ap.rooms[f.roomId]);
  const out: Record<(typeof SIDES)[number], boolean> = {
    minX: nearlyEqual(p.x, r.minX) && back.x < 0,
    maxX: nearlyEqual(p.x, r.maxX) && back.x > 0,
    minZ: nearlyEqual(p.z, r.minZ) && back.z < 0,
    maxZ: nearlyEqual(p.z, r.maxZ) && back.z > 0,
  };
  return SIDES.find((s) => out[s]) ?? null;
}

/** 5.5: способы установки (D-05): опора, высота, стена без проёма, столешница. */
export const mountingValidator =
  (getItem: CatalogLookup): Validator =>
  (ap) => {
    const out: Issue[] = [];
    for (const { f, item, shapes } of entries(ap, getItem)) {
      const y = f.position.yCm;
      const name = item.name;
      switch (item.mounting) {
        case 'floor':
          if (!nearlyEqual(y, 0)) out.push(issue('mount-floor', `${name} должен стоять на полу`, f.id));
          break;
        case 'ceiling':
          if (!nearlyEqual(topOf(shapes), ap.ceilingCm)) out.push(issue('mount-ceiling', `${name} должен висеть на потолке`, f.id));
          break;
        case 'tabletop':
          if (y <= EPS_CM || !nearlyEqual(restingY(ap, getItem, item, f, f.id), y))
            out.push(issue('mount-tabletop', `${name} ставится только на столешницу`, f.id));
          break;
        case 'wall': {
          const side = backWallSide(ap, f, item);
          if (!side || !nearlyEqual(y, item.mountHeightCm ?? 0)) {
            out.push(issue('mount-wall', `${name} должен висеть на стене задней стороной`, f.id));
            break;
          }
          for (const wall of roomSideWalls(ap, ap.rooms[f.roomId])[side]) {
            const axis = wallAxis(ap, wall);
            const along = shapes.flatMap((s) => s.polygon.map((p) => alongWall(axis, p)));
            const [i0, i1] = [Math.min(...along), Math.max(...along)];
            const [b, t] = [Math.min(...shapes.map((s) => s.bottom)), topOf(shapes)];
            for (const o of Object.values(ap.openings).filter((x) => x.wallId === wall.id))
              if (intervalsOverlap(i0, i1, ...openingSpan(o)) && intervalsOverlap(b, t, ...openingVerticalRange(o)))
                out.push(issue('mount-over-opening', `${name} закрывает ${o.kind === 'door' ? 'дверь' : 'окно'}`, f.id, o.id));
          }
          break;
        }
      }
    }
    return out;
  };

export const furnitureValidators = (getItem: CatalogLookup): Validator[] => [
  catalogPresenceValidator(getItem),
  furnitureInRoomValidator(getItem),
  furnitureCollisionValidator(getItem),
  doorZoneValidator(getItem),
  mountingValidator(getItem),
];
