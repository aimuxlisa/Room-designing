/** Команды над мебелью. Положение и угол — единственное хранилище в Apartment.furniture. */
import type { Apartment, FurnitureInstance, Id, Vec3Cm } from '../domain/types';
import { normalizeDeg } from '../geometry/placement';
import type { Command } from './change';

const withFurniture = (ap: Apartment, furniture: Apartment['furniture']): Apartment => ({ ...ap, furniture });

export const placeFurniture = (instance: FurnitureInstance): Command => ({
  label: 'Добавить предмет',
  apply: (ap) => withFurniture(ap, { ...ap.furniture, [instance.id]: instance }),
});

export const moveFurniture = (id: Id, position: Vec3Cm, angleDeg: number): Command => ({
  label: 'Переместить предмет',
  apply(ap) {
    const f = ap.furniture[id];
    if (!f) throw new Error(`Предмет ${id} не найден`);
    return withFurniture(ap, { ...ap.furniture, [id]: { ...f, position, angleDeg: normalizeDeg(angleDeg) } });
  },
});

export const removeFurniture = (id: Id): Command => ({
  label: 'Удалить предмет',
  apply(ap) {
    const rest = { ...ap.furniture };
    delete rest[id];
    return withFurniture(ap, rest);
  },
});
