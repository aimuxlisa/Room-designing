/** Переходы стартового сценария (SPEC §8). Чистая логика над хранилищами, без React. */
import type { Apartment, RoomType } from '../domain/types';
import { getTemplate } from '../layouts/templates';
import type { Stores } from './stores';

export const emptyApartment = (): Apartment => ({
  id: 'empty',
  schemaVersion: 1,
  ceilingCm: 270,
  vertices: {},
  walls: {},
  rooms: {},
  openings: {},
  furniture: {},
  finishes: { walls: {}, floors: {} },
});

export type ChooseResult = 'continued' | 'replaced' | 'cancelled';

/**
 * Выбор схемы (SPEC §8, 7.5): та же схема — продолжение работы; другая — замена сразу,
 * если правок не было, иначе только после подтверждения; замена очищает историю отмены.
 */
export function chooseTemplate({ project, ui }: Stores, templateId: string, confirmReplace: () => boolean): ChooseResult {
  const template = getTemplate(templateId);
  if (!template) return 'cancelled';
  const current = ui.getState().templateId;
  if (current === templateId) {
    ui.getState().setStage('setup');
    return 'continued';
  }
  const edited = project.getState().history.past.length > 0;
  if (current && edited && !confirmReplace()) return 'cancelled';
  project.getState().load(template.apartment);
  ui.getState().setTemplateId(templateId);
  ui.getState().setActiveRoom(null);
  ui.getState().setPlanScope('apartment');
  ui.getState().setStage('setup');
  return 'replaced';
}

const PREFERRED: readonly RoomType[] = ['kitchen-living', 'living', 'bedroom', 'kitchen'];

/** Переход к интерьеру: активной становится главная жилая комната (если ещё не выбрана). */
export function enterInterior({ project, ui }: Stores) {
  const rooms = Object.values(project.getState().history.present.rooms);
  const current = ui.getState().activeRoomId;
  if (!current || !rooms.some((r) => r.id === current)) {
    const first = PREFERRED.map((t) => rooms.find((r) => r.type === t)).find(Boolean) ?? rooms[0];
    ui.getState().setActiveRoom(first?.id ?? null);
  }
  ui.getState().setPlanScope('room');
  ui.getState().setStage('interior');
}
