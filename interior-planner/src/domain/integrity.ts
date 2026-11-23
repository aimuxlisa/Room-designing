/** Базовые проверки целостности модели (этап 3). Каждая — отдельный валидатор (SRP). */
import { boundingRect, rectDepth, rectWidth } from '../geometry/rect';
import { inRange, LIMITS } from './limits';
import { edgePoints, parseSurfaceKey, roomClearRect, roomOutline, roomSideWalls, SIDES } from './rooms';
import type { Apartment, Room } from './types';
import type { Issue, Validator } from './validation';
import { nearlyEqual } from './units';

const finite = (...values: number[]) => values.every(Number.isFinite);
const issue = (code: string, message: string, ...objectIds: string[]): Issue => ({ code, message, objectIds });

export const validateNumbers: Validator = (ap) => {
  const out: Issue[] = [];
  if (!finite(ap.ceilingCm) || !inRange(ap.ceilingCm, LIMITS.ceilingCm))
    out.push(issue('ceiling-range', `Высота потолка должна быть от ${LIMITS.ceilingCm.min} до ${LIMITS.ceilingCm.max} см`));
  for (const v of Object.values(ap.vertices))
    if (!finite(v.xCm, v.zCm)) out.push(issue('vertex-nan', `Узел ${v.id} имеет некорректные координаты`, v.id));
  for (const w of Object.values(ap.walls))
    if (!finite(w.thicknessCm) || w.thicknessCm <= 0)
      out.push(issue('wall-thickness', `Стена ${w.id} имеет некорректную толщину`, w.id));
  for (const o of Object.values(ap.openings)) {
    const sill = o.kind === 'window' ? o.sillCm : 0;
    if (!finite(o.offsetCm, o.widthCm, o.heightCm, sill) || o.offsetCm < 0 || o.widthCm <= 0 || o.heightCm <= 0 || sill < 0)
      out.push(issue('opening-nan', `Проём ${o.id} имеет некорректные размеры`, o.id));
  }
  for (const f of Object.values(ap.furniture)) {
    const p = f.position;
    if (!finite(p.xCm, p.yCm, p.zCm, f.angleDeg))
      out.push(issue('furniture-nan', `Предмет ${f.id} имеет некорректное положение`, f.id));
  }
  return out;
};

export const validateReferences: Validator = (ap) => {
  const out: Issue[] = [];
  for (const w of Object.values(ap.walls)) {
    if (!ap.vertices[w.startId] || !ap.vertices[w.endId])
      out.push(issue('wall-vertex-missing', `Стена ${w.id} ссылается на несуществующий узел`, w.id));
    else if (w.startId === w.endId) out.push(issue('wall-degenerate', `Стена ${w.id} имеет нулевую длину`, w.id));
  }
  for (const r of Object.values(ap.rooms))
    for (const e of r.boundary)
      if (!ap.walls[e.wallId])
        out.push(issue('room-wall-missing', `Комната «${r.name}» ссылается на несуществующую стену`, r.id, e.wallId));
  for (const o of Object.values(ap.openings))
    if (!ap.walls[o.wallId]) out.push(issue('opening-wall-missing', `Проём ${o.id} стоит на несуществующей стене`, o.id));
  for (const f of Object.values(ap.furniture))
    if (!ap.rooms[f.roomId]) out.push(issue('furniture-room-missing', `Предмет ${f.id} привязан к несуществующей комнате`, f.id));
  for (const roomId of Object.keys(ap.finishes.floors))
    if (!ap.rooms[roomId]) out.push(issue('finish-room-missing', `Покрытие пола назначено несуществующей комнате`, roomId));
  // Отделка стены привязана к стабильной поверхности «стена + комната» (12.5): стена должна быть в границе комнаты.
  for (const key of Object.keys(ap.finishes.walls)) {
    const { wallId, roomId } = parseSurfaceKey(key);
    if (!ap.rooms[roomId]?.boundary.some((e) => e.wallId === wallId))
      out.push(issue('finish-surface-missing', 'Отделка назначена несуществующей поверхности стены', key));
  }
  return out;
};

/** Ссылки комнаты целы — иначе геометрию комнаты проверять нельзя. */
const roomRefsOk = (ap: Apartment, room: Room) =>
  room.boundary.every((e) => {
    const w = ap.walls[e.wallId];
    return w && ap.vertices[w.startId] && ap.vertices[w.endId];
  });

function roomShapeIssues(ap: Apartment, room: Room): Issue[] {
  const name = `Комната «${room.name}»`;
  const edges = room.boundary.map((e) => edgePoints(ap, e));
  if (edges.length < 4) return [issue('room-open', `${name}: контур не замкнут`, room.id)];
  for (let i = 0; i < edges.length; i++) {
    const end = edges[i][1];
    const nextStart = edges[(i + 1) % edges.length][0];
    if (!nearlyEqual(end.x, nextStart.x) || !nearlyEqual(end.z, nextStart.z))
      return [issue('room-open', `${name}: контур не замкнут`, room.id)];
    const [a, b] = edges[i];
    if (!nearlyEqual(a.x, b.x) && !nearlyEqual(a.z, b.z))
      return [issue('room-not-rect', `${name}: стена не параллельна осям`, room.id)];
  }
  const rect = boundingRect(roomOutline(ap, room));
  const onBoundary = roomOutline(ap, room).every(
    (p) => nearlyEqual(p.x, rect.minX) || nearlyEqual(p.x, rect.maxX) || nearlyEqual(p.z, rect.minZ) || nearlyEqual(p.z, rect.maxZ),
  );
  const sides = roomSideWalls(ap, room);
  if (!onBoundary || SIDES.some((s) => sides[s].length === 0))
    return [issue('room-not-rect', `${name}: комната должна быть прямоугольной`, room.id)];

  const out: Issue[] = [];
  for (const s of SIDES) {
    const t = sides[s][0].thicknessCm;
    if (sides[s].some((w) => w.thicknessCm !== t))
      out.push(issue('side-thickness', `${name}: на одной стороне стены разной толщины`, room.id));
  }
  const clear = roomClearRect(ap, room);
  for (const size of [rectWidth(clear), rectDepth(clear)])
    if (!inRange(Math.round(size), LIMITS.roomSideCm)) {
      out.push(issue('room-size', `${name}: размер ${Math.round(size)} см вне пределов ${LIMITS.roomSideCm.min}–${LIMITS.roomSideCm.max} см`, room.id));
      break;
    }
  return out;
}

export const validateRoomShapes: Validator = (ap) =>
  Object.values(ap.rooms).filter((r) => roomRefsOk(ap, r)).flatMap((r) => roomShapeIssues(ap, r));

/** Реестр проверок. Этап 5 добавляет сюда геометрические проверки (OCP). */
export const integrityValidators: readonly Validator[] = [validateNumbers, validateReferences, validateRoomShapes];
