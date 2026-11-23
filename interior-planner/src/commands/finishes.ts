/** Команды отделки (SPEC §13): одна внутренняя поверхность «стена + комната»; другая сторона не меняется (AC-11). */
import { surfaceKey } from '../domain/rooms';
import type { Id } from '../domain/types';
import type { Command } from './change';

/** Назначить материал поверхности; null — вернуть стену без отделки. */
export function setWallFinish(wallId: Id, roomId: Id, materialId: Id | null): Command {
  return {
    label: 'Отделка стены',
    apply(ap) {
      const key = surfaceKey(wallId, roomId);
      const walls = { ...ap.finishes.walls };
      if (materialId === null) delete walls[key];
      else walls[key] = materialId;
      return { ...ap, finishes: { ...ap.finishes, walls } };
    },
  };
}

/** Покрытие пола на комнату (D-16, D-25); входит в проект и историю отмены (AC-19). null — без покрытия. */
export function setFloorFinish(roomId: Id, materialId: Id | null): Command {
  return {
    label: 'Покрытие пола',
    apply(ap) {
      const floors = { ...ap.finishes.floors };
      if (materialId === null) delete floors[roomId];
      else floors[roomId] = materialId;
      return { ...ap, finishes: { ...ap.finishes, floors } };
    },
  };
}
