/** Проверки квартиры (задачи 5.1–5.3). Каждая — отдельный валидатор реестра (OCP). */
import { intervalsOverlap, polygonsOverlap, rectPolygon } from '../geometry/polygon';
import { inRange, LIMITS } from './limits';
import { clearSpan, doorConnects, isExteriorWall, normalIntoRoom, openingSpan, wallAxis, alongWall } from './openings';
import { roomAxisRect, roomsOfWall, wallPoints } from './rooms';
import type { Apartment, Id, Opening } from './types';
import { EPS_CM, nearlyEqual } from './units';
import type { Issue, Validator } from './validation';

const issue = (code: string, message: string, ...objectIds: Id[]): Issue => ({ code, message, objectIds });
const pairs = <T>(xs: readonly T[]): [T, T][] => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as [T, T]));

/** Ссылки стены целы — без этого геометрию стены считать нельзя (ссылки проверяет integrity). */
const wallOk = (ap: Apartment, id: Id) => {
  const w = ap.walls[id];
  return !!w && !!ap.vertices[w.startId] && !!ap.vertices[w.endId] && w.startId !== w.endId;
};
const roomOk = (ap: Apartment, roomId: Id) => ap.rooms[roomId].boundary.every((e) => wallOk(ap, e.wallId));

// ---- 5.1: помещения и узлы ----

export const validateRoomOverlaps: Validator = (ap) =>
  pairs(Object.values(ap.rooms).filter((r) => roomOk(ap, r.id)))
    .filter(([a, b]) => polygonsOverlap(rectPolygon(roomAxisRect(ap, a)), rectPolygon(roomAxisRect(ap, b))))
    .map(([a, b]) => issue('room-overlap', `Комнаты «${a.name}» и «${b.name}» накладываются`, a.id, b.id));

export const validateVertices: Validator = (ap) =>
  pairs(Object.values(ap.vertices))
    .filter(([a, b]) => nearlyEqual(a.xCm, b.xCm) && nearlyEqual(a.zCm, b.zCm))
    .map(([a, b]) => issue('vertex-duplicate', `Узлы ${a.id} и ${b.id} совпадают`, a.id, b.id));

export const validateWalls: Validator = (ap) => {
  const out: Issue[] = [];
  const walls = Object.values(ap.walls).filter((w) => wallOk(ap, w.id));
  for (const w of walls) {
    if (roomsOfWall(ap, w.id).length === 0) out.push(issue('wall-orphan', `Стена ${w.id} не принадлежит ни одной комнате`, w.id));
    const axis = wallAxis(ap, w);
    // Узел другой стены внутри отрезка: стена не разбита в месте примыкания.
    for (const v of Object.values(ap.vertices)) {
      if (v.id === w.startId || v.id === w.endId) continue;
      const t = alongWall(axis, { x: v.xCm, z: v.zCm });
      const off = Math.abs((v.xCm - axis.start.x) * -axis.dir.z + (v.zCm - axis.start.z) * axis.dir.x);
      if (off <= EPS_CM && t > EPS_CM && t < axis.lengthCm - EPS_CM)
        out.push(issue('wall-unsplit', `Стена ${w.id} не разбита в узле ${v.id}`, w.id, v.id));
    }
  }
  // 5.2: двойная стена — две стены перекрываются на одной прямой.
  for (const [a, b] of pairs(walls)) {
    const [a0, a1] = wallPoints(ap, a);
    const axis = wallAxis(ap, a);
    const [b0, b1] = wallPoints(ap, b);
    const offB = (p: { x: number; z: number }) => Math.abs((p.x - a0.x) * -axis.dir.z + (p.z - a0.z) * axis.dir.x);
    if (offB(b0) > EPS_CM || offB(b1) > EPS_CM) continue;
    const [t0, t1] = [alongWall(axis, b0), alongWall(axis, b1)].sort((x, y) => x - y);
    if (intervalsOverlap(0, alongWall(axis, a1), t0, t1))
      out.push(issue('wall-double', `Стены ${a.id} и ${b.id} совпадают: двойная стена`, a.id, b.id));
  }
  return out;
};

// ---- 5.2: общая стена ----

export const validateSharedWalls: Validator = (ap) => {
  const out: Issue[] = [];
  for (const w of Object.values(ap.walls).filter((x) => wallOk(ap, x.id))) {
    const rooms = roomsOfWall(ap, w.id).filter((r) => roomOk(ap, r.id));
    if (rooms.length > 2) out.push(issue('wall-many-rooms', `Стена ${w.id} принадлежит больше чем двум комнатам`, w.id));
    if (rooms.length !== 2) continue;
    const [na, nb] = rooms.map((r) => normalIntoRoom(ap, w, r));
    if (na.x * nb.x + na.z * nb.z > 0)
      out.push(issue('wall-same-side', `Комнаты «${rooms[0].name}» и «${rooms[1].name}» лежат по одну сторону стены ${w.id}`, w.id));
  }
  return out;
};

// ---- 5.3: проёмы и граф проходов ----

function openingIssues(ap: Apartment, o: Opening): Issue[] {
  const out: Issue[] = [];
  const kind = o.kind === 'door' ? 'Дверь' : 'Окно';
  const lim = o.kind === 'door' ? LIMITS.door : LIMITS.window;
  if (!inRange(o.widthCm, lim.widthCm)) out.push(issue('opening-width', `${kind}: ширина ${Math.round(o.widthCm)} см вне пределов ${lim.widthCm.min}–${lim.widthCm.max} см`, o.id));
  if (!inRange(o.heightCm, lim.heightCm)) out.push(issue('opening-height', `${kind}: высота ${Math.round(o.heightCm)} см вне пределов ${lim.heightCm.min}–${lim.heightCm.max} см`, o.id));
  const top = o.kind === 'window' ? o.sillCm + o.heightCm : o.heightCm;
  if (o.kind === 'window' && !inRange(o.sillCm, LIMITS.window.sillCm)) out.push(issue('window-sill', `Окно: подоконник ${Math.round(o.sillCm)} см вне пределов`, o.id));
  if (top > ap.ceilingCm + EPS_CM) out.push(issue('opening-above-ceiling', `${kind} выше потолка`, o.id));

  const wall = ap.walls[o.wallId];
  const rooms = roomsOfWall(ap, wall.id);
  const [s0, s1] = openingSpan(o);
  for (const room of rooms) {
    const [c0, c1] = clearSpan(ap, wall, room);
    if (s0 < c0 - EPS_CM || s1 > c1 + EPS_CM)
      out.push(issue('opening-outside-wall', `${kind} выходит за стену комнаты «${room.name}»`, o.id, room.id));
  }
  if (o.kind === 'window' && !isExteriorWall(ap, wall.id))
    out.push(issue('window-interior', 'Окно можно поставить только на внешнюю стену', o.id));
  if (o.kind === 'door' && o.opensIntoRoomId !== null && !rooms.some((r) => r.id === o.opensIntoRoomId))
    out.push(issue('door-swing-room', 'Дверь открывается в комнату, к которой не примыкает', o.id));
  return out;
}

export const validateOpenings: Validator = (ap) => {
  const list = Object.values(ap.openings).filter((o) => wallOk(ap, o.wallId));
  const out = list.flatMap((o) => openingIssues(ap, o));
  for (const [a, b] of pairs(list))
    if (a.wallId === b.wallId && intervalsOverlap(...openingSpan(a), ...openingSpan(b)))
      out.push(issue('opening-overlap', 'Проёмы на одной стене пересекаются', a.id, b.id));
  return out;
};

/** Все помещения достижимы от входной двери через двери (SPEC §7). */
export const validatePassageGraph: Validator = (ap) => {
  const rooms = Object.values(ap.rooms);
  if (rooms.length === 0) return [];
  const links = new Map<Id, Id[]>(rooms.map((r) => [r.id, []]));
  const entrances: Id[] = [];
  for (const o of Object.values(ap.openings)) {
    if (o.kind !== 'door' || !wallOk(ap, o.wallId)) continue;
    const c = doorConnects(ap, o);
    if (!c) continue;
    const [a, b] = c;
    if (b) {
      links.get(a.id)!.push(b.id);
      links.get(b.id)!.push(a.id);
    } else entrances.push(a.id);
  }
  if (entrances.length === 0) return [issue('no-entrance', 'В квартире нет входной двери', ap.id)];
  const seen = new Set(entrances);
  const queue = [...entrances];
  while (queue.length)
    for (const n of links.get(queue.pop()!) ?? [])
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  return rooms
    .filter((r) => !seen.has(r.id))
    .map((r) => issue('room-unreachable', `В помещение «${r.name}» нет прохода`, r.id));
};

export const apartmentValidators: readonly Validator[] = [
  validateRoomOverlaps,
  validateVertices,
  validateWalls,
  validateSharedWalls,
  validateOpenings,
  validatePassageGraph,
];
