/**
 * Переходы между помещениями (SPEC §10.2, задача 10.4): двери активной комнаты и куда они ведут.
 * Межкомнатная дверь ведёт в соседнюю комнату; входная (одна прилегающая комната) — наружу, перехода нет.
 */
import { roomsOfWall } from './rooms';
import type { Apartment, DoorOpening, Id, Room } from './types';

export interface DoorLink {
  readonly door: DoorOpening;
  /** Соседняя комната; null — входная дверь, ведёт наружу. */
  readonly to: Room | null;
}

export function doorLinks(ap: Apartment, roomId: Id): DoorLink[] {
  const room = ap.rooms[roomId];
  if (!room) return [];
  const walls = new Set(room.boundary.map((e) => e.wallId));
  return Object.values(ap.openings)
    .filter((o): o is DoorOpening => o.kind === 'door' && walls.has(o.wallId))
    .map((door) => ({ door, to: roomsOfWall(ap, door.wallId).find((r) => r.id !== roomId) ?? null }))
    .sort((a, b) => a.door.id.localeCompare(b.door.id));
}
