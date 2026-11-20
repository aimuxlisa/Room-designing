/** Последствия изменения для предпросмотра (8.4): какие помещения и как меняются. */
import { apartmentClearAreaCm2, apartmentOuterAreaCm2, roomClearRect } from '../domain/rooms';
import type { Apartment, Room } from '../domain/types';
import { rectDepth, rectWidth } from '../geometry/rect';

export interface RoomChange {
  readonly room: Room;
  readonly before: { readonly w: number; readonly d: number };
  readonly after: { readonly w: number; readonly d: number };
}

const size = (ap: Apartment, room: Room) => {
  const r = roomClearRect(ap, room);
  return { w: rectWidth(r), d: rectDepth(r) };
};

export function roomChanges(before: Apartment, after: Apartment): RoomChange[] {
  return Object.values(before.rooms).flatMap((room) => {
    const next = after.rooms[room.id];
    if (!next) return [];
    const [b, a] = [size(before, room), size(after, next)];
    return b.w === a.w && b.d === a.d ? [] : [{ room, before: b, after: a }];
  });
}

export const areaChange = (before: Apartment, after: Apartment) => ({
  clear: [apartmentClearAreaCm2(before), apartmentClearAreaCm2(after)] as const,
  outer: [apartmentOuterAreaCm2(before), apartmentOuterAreaCm2(after)] as const,
});
