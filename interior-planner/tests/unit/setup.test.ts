import { describe, expect, it } from 'vitest';
import { setCeilingHeight } from '../../src/commands/apartment';
import { placeFurniture } from '../../src/commands/furniture';
import { apartmentClearAreaCm2, deltaForRoomSize, roomClearRect } from '../../src/domain/rooms';
import type { Apartment, Opening } from '../../src/domain/types';
import { cm2ToM2 } from '../../src/domain/units';
import { createValidators } from '../../src/domain/validators';
import { rectWidth } from '../../src/geometry/rect';
import { areaChange, roomChanges } from '../../src/setup/changes';
import { createSetupStore } from '../../src/setup/setupStore';
import { createProjectStore } from '../../src/store/projectStore';
import { twoRooms } from './fixtures';
import { testCatalog } from './testCatalog';

const setup = (ap: Apartment = twoRooms()) => {
  const project = createProjectStore(ap, createValidators(testCatalog));
  return { project, setup: createSetupStore(project) };
};
const widths = (ap: Apartment) => [rectWidth(roomClearRect(ap, ap.rooms.a)), rectWidth(roomClearRect(ap, ap.rooms.b))];

describe('8.2 размер через опорную стену (D-03)', () => {
  it('комната А 400 → 430 через общую стену: Б 200 → 170, сумма 18,0 м²', () => {
    const { project, setup: s } = setup();
    const ap = project.getState().history.present;
    const delta = deltaForRoomSize(ap, 'w7', ap.rooms.a, 430)!;
    expect(delta).toBe(30);
    s.getState().selectWall('w7');
    s.getState().setDelta(delta);
    expect(project.getState().history.present).toBe(ap); // предпросмотр не меняет проект
    expect(s.getState().apply()!.ok).toBe(true);
    const after = project.getState().history.present;
    expect(widths(after)).toEqual([430, 170]);
    expect(cm2ToM2(apartmentClearAreaCm2(after))).toBeCloseTo(18, 6);
  });

  it('тот же размер Б через общую стену: Б 200 → 230 сдвигает стену влево', () => {
    const ap = twoRooms();
    expect(deltaForRoomSize(ap, 'w7', ap.rooms.b, 230)).toBe(-30);
  });

  it('стена на стороне min: западная стена А, ширина 450 → сдвиг −50', () => {
    const ap = twoRooms();
    expect(deltaForRoomSize(ap, 'w6', ap.rooms.a, 450)).toBe(-50);
  });
});

describe('8.3 внешний контур', () => {
  it('сдвиг внешней стены наружу на 50 см: +1,5 м², мебель не масштабируется', () => {
    const base = twoRooms();
    const withSofa = placeFurniture({ id: 's', catalogItemId: 'sofa', assetVersion: 1, roomId: 'a', position: { xCm: 200, yCm: 0, zCm: 200 }, angleDeg: 0, variantId: null }).apply(base);
    const { project, setup: s } = setup(withSofa);
    s.getState().selectWall('w6');
    s.getState().setDelta(-50);
    const p = s.getState().proposal!;
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const area = areaChange(withSofa, p.candidate);
    expect(cm2ToM2(area.clear[1] - area.clear[0])).toBeCloseTo(1.5, 6);
    expect(area.outer[1]).toBeGreaterThan(area.outer[0]);
    s.getState().apply();
    expect(project.getState().history.present.furniture.s).toEqual(withSofa.furniture.s);
  });
});

describe('8.4 предпросмотр затронутых помещений (AC-03)', () => {
  it('длинная стена: меняются обе комнаты; список изменений для предпросмотра', () => {
    const { setup: s } = setup();
    s.getState().selectWall('w7');
    s.getState().setDelta(30);
    const p = s.getState().proposal!;
    if (!p.ok) throw new Error('ожидался допустимый кандидат');
    const ch = roomChanges(twoRooms(), p.candidate);
    expect(ch.map((c) => [c.room.id, c.before.w, c.after.w])).toEqual([
      ['a', 400, 430],
      ['b', 200, 170],
    ]);
  });
});

describe('8.5 отказ с причиной и полным откатом', () => {
  it('конфликт с мебелью в скрытом помещении (AC-09): состояние до и после одинаково', () => {
    const base = placeFurniture({ id: 'd', catalogItemId: 'dresser', assetVersion: 1, roomId: 'b', position: { xCm: 447.5, yCm: 0, zCm: 250 }, angleDeg: 90, variantId: null }).apply(twoRooms());
    const { project, setup: s } = setup(base);
    const before = project.getState().history;
    s.getState().selectWall('w7');
    s.getState().setDelta(30);
    const p = s.getState().proposal!;
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.issues[0].message).toBe('В комнате «Коридор Б» комод пересекает стену');
    expect(s.getState().apply()!.ok).toBe(false);
    expect(project.getState().history).toBe(before);
    expect(s.getState().lastIssue).toContain('комод пересекает стену');
  });

  it('слишком маленькая комната отклоняется с размером и пределом', () => {
    const { setup: s } = setup();
    s.getState().selectWall('w7');
    s.getState().setDelta(150);
    const p = s.getState().proposal!;
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.issues.map((i) => i.message).join()).toContain('вне пределов 80–1500 см');
  });
});

describe('8.6 высота потолка', () => {
  it('меняется для всей квартиры; конфликт с окном блокирует', () => {
    const ap = twoRooms();
    const win: Opening = { id: 'win', kind: 'window', wallId: 'w1', offsetCm: 100, widthCm: 120, heightCm: 140, sillCm: 90 };
    const { project } = setup({ ...ap, openings: { ...ap.openings, win } });
    expect(project.getState().execute(setCeilingHeight(300)).ok).toBe(true);
    expect(project.getState().history.present.ceilingCm).toBe(300);
    const r = project.getState().execute(setCeilingHeight(225)); // окно до 230 см
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toBe('Окно выше потолка');
    expect(project.getState().history.present.ceilingCm).toBe(300);
    expect(project.getState().execute(setCeilingHeight(450)).ok).toBe(false);
  });
});
