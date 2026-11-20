import { describe, expect, it } from 'vitest';
import { historyActionForKey } from '../../src/commands/hotkeys';
import { moveWall } from '../../src/commands/walls';
import { apartmentClearAreaCm2, roomClearRect } from '../../src/domain/rooms';
import { cm2ToM2 } from '../../src/domain/units';
import { rectWidth } from '../../src/geometry/rect';
import { createProjectStore } from '../../src/store/projectStore';
import { twoRooms } from './fixtures';

const widths = (store: ReturnType<typeof createProjectStore>) => {
  const ap = store.getState().history.present;
  return [rectWidth(roomClearRect(ap, ap.rooms.a)), rectWidth(roomClearRect(ap, ap.rooms.b))];
};

describe('3.5 предложение, проверка, атомарное применение', () => {
  it('сдвиг общей стены на 30 см: 430 и 170 см, сумма 18,0 м²', () => {
    const store = createProjectStore(twoRooms());
    expect(store.getState().execute(moveWall('w7', 30)).ok).toBe(true);
    expect(widths(store)).toEqual([430, 170]);
    expect(cm2ToM2(apartmentClearAreaCm2(store.getState().history.present))).toBeCloseTo(18, 6);
  });

  it('сдвиг на 220 см отклонён с причиной, квартира и история прежние', () => {
    const store = createProjectStore(twoRooms());
    const before = store.getState().history;
    const result = store.getState().execute(moveWall('w7', 220));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain('Коридор Б');
    expect(store.getState().history).toBe(before);
  });

  it('предпросмотр не меняет состояние', () => {
    const store = createProjectStore(twoRooms());
    const before = store.getState().history;
    expect(store.getState().preview(moveWall('w7', 30)).ok).toBe(true);
    expect(store.getState().history).toBe(before);
  });

  it('длинная стена сдвигается целиком', () => {
    const store = createProjectStore(twoRooms());
    store.getState().execute(moveWall('w1', -50));
    const ap = store.getState().history.present;
    expect(ap.vertices.v1.zCm).toBe(-50);
    expect(ap.vertices.v2.zCm).toBe(-50);
    expect(ap.vertices.v3.zCm).toBe(-50);
  });
});

describe('3.6 отмена и повтор', () => {
  it('две отмены возвращают исходную квартиру, два повтора — итоговую', () => {
    const initial = twoRooms();
    const store = createProjectStore(initial);
    store.getState().execute(moveWall('w7', 30));
    store.getState().execute(moveWall('w3', 50));
    const final = store.getState().history.present;
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().history.present).toEqual(initial);
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().history.present).toEqual(final);
  });

  it('новое изменение после отмены очищает повтор; лишняя отмена ничего не делает', () => {
    const store = createProjectStore(twoRooms());
    store.getState().undo();
    expect(store.getState().history.past).toHaveLength(0);
    store.getState().execute(moveWall('w7', 30));
    store.getState().undo();
    store.getState().execute(moveWall('w7', 10));
    expect(store.getState().history.future).toHaveLength(0);
  });

  it('клавиши: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z; в поле ввода не перехватываются', () => {
    const k = (code: string, shiftKey = false, inEditableField = false) =>
      historyActionForKey({ code, ctrlKey: true, metaKey: false, shiftKey, inEditableField });
    expect(k('KeyZ')).toBe('undo');
    expect(k('KeyY')).toBe('redo');
    expect(k('KeyZ', true)).toBe('redo');
    expect(k('KeyZ', false, true)).toBeNull();
    expect(historyActionForKey({ code: 'KeyZ', ctrlKey: false, metaKey: false, shiftKey: false, inEditableField: false })).toBeNull();
  });
});
