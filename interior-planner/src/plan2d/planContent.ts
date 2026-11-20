/** Область плана, которую нужно вписать в экран: стены помещений и дуги дверей. */
import { doorSwing } from '../domain/openings';
import { wallFootprint } from '../domain/rooms';
import type { Apartment, Room } from '../domain/types';
import { boundingRect, expandRect, type Rect } from '../geometry/rect';

/** Запас вокруг комнаты для подписей размеров, см. */
const LABEL_MARGIN_CM = 40;

export function contentRect(ap: Apartment, rooms: readonly Room[]): Rect {
  const wallIds = new Set(rooms.flatMap((r) => r.boundary.map((e) => e.wallId)));
  const walls = [...wallIds].map((id) => wallFootprint(ap, ap.walls[id]));
  // Дуги створок (в том числе входной двери наружу) тоже должны попасть в вид.
  const swings = Object.values(ap.openings).flatMap((o) => (o.kind === 'door' && wallIds.has(o.wallId) ? doorSwing(ap, o).arc : []));
  return expandRect(
    boundingRect([...walls.flatMap((w) => [{ x: w.minX, z: w.minZ }, { x: w.maxX, z: w.maxZ }]), ...swings]),
    rooms.length === 1 ? LABEL_MARGIN_CM : 10,
  );
}

