import { describe, expect, it } from 'vitest';
import type { Proposal } from '../../src/commands/change';
import { patchOpening } from '../../src/commands/openings';
import { placeFurniture } from '../../src/commands/furniture';
import { clearOffsetCm, doorSwing, offsetFromClearCm } from '../../src/domain/openings';
import { roomsOfWall } from '../../src/domain/rooms';
import type { Apartment, DoorOpening } from '../../src/domain/types';
import { createValidators } from '../../src/domain/validators';
import { createProjectStore } from '../../src/store/projectStore';
import { twoRooms } from './fixtures';
import { testCatalog } from './testCatalog';

const store = (ap: Apartment = twoRooms()) => createProjectStore(ap, createValidators(testCatalog));
const issueCodes = (r: Proposal) => (r.ok ? [] : r.issues.map((i) => i.code));
const d1 = (ap: Apartment) => ap.openings.d1 as DoorOpening;

describe('9.1 положение проёма в см от угла комнаты', () => {
  it('сдвиг двери на 20 см меняет чистый отступ, и обратное преобразование совпадает', () => {
    const { getState } = store();
    const before = getState().history.present;
    const room = before.rooms.a;
    const cm = clearOffsetCm(before, d1(before), room);
    const r = getState().execute(patchOpening('d1', { offsetCm: d1(before).offsetCm + 20 }));
    expect(r.ok).toBe(true);
    const after = getState().history.present;
    expect(clearOffsetCm(after, d1(after), room)).toBeCloseTo(cm + 20, 6);
    expect(getState().history.past.length).toBe(1);
    expect(offsetFromClearCm(after, after.walls.w7, room, cm + 20)).toBeCloseTo(d1(after).offsetCm, 6);
  });
});

describe('9.2 одна общая дверь (AC-04)', () => {
  it('изменение общей двери меняет один проём и видно в обеих комнатах', () => {
    const { getState } = store();
    const before = getState().history.present;
    expect(getState().execute(patchOpening('d1', { offsetCm: 130 })).ok).toBe(true);
    const after = getState().history.present;
    expect(Object.keys(after.openings).sort()).toEqual(Object.keys(before.openings).sort());
    expect(roomsOfWall(after, 'w7').map((r) => r.id).sort()).toEqual(['a', 'b']);
    for (const room of [after.rooms.a, after.rooms.b]) {
      expect(clearOffsetCm(after, d1(after), room)).toBeCloseTo(clearOffsetCm(before, d1(before), room) + 30, 6);
    }
  });
});

describe('9.3 границы и пересечения проёмов (AC-10)', () => {
  it('дверь за пределами чистого участка стены отклоняется', () => {
    const r = store().getState().preview(patchOpening('d1', { offsetCm: 290 }));
    expect(issueCodes(r)).toContain('opening-outside-wall');
  });

  it('дверь выше допустимой высоты отклоняется пределом', () => {
    const r = store().getState().preview(patchOpening('d1', { heightCm: 300 }));
    expect(issueCodes(r)).toContain('opening-height');
  });

  it('пересечение с другим проёмом на той же стене отклоняется, касание допустимо', () => {
    const ap = twoRooms();
    const d2: DoorOpening = { ...d1(ap), id: 'd2', offsetCm: 150, widthCm: 60 };
    const withD2 = { ...ap, openings: { ...ap.openings, d2 } };
    expect(issueCodes(store(withD2).getState().preview(patchOpening('d2', {})))).toContain('opening-overlap');
    const touching = { ...ap, openings: { ...ap.openings, d2: { ...d1(ap), id: 'd2', offsetCm: 180, widthCm: 60 } } };
    expect(issueCodes(store(touching).getState().preview(patchOpening('d2', {})))).not.toContain('opening-overlap');
  });
});

describe('9.4 только согласованные операции (D-04)', () => {
  it('поля, не относящиеся к виду проёма, игнорируются: у двери нет подоконника', () => {
    const ap = twoRooms();
    const next = patchOpening('d1', { sillCm: 50 }).apply(ap);
    expect(next.openings.d1).toEqual(ap.openings.d1);
  });
});

describe('9.5 сторона и направление открывания', () => {
  it('смена петли меняет створку на плане и проходит проверки', () => {
    const { getState } = store();
    const before = getState().history.present;
    expect(getState().execute(patchOpening('d1', { hinge: 'right' })).ok).toBe(true);
    const after = getState().history.present;
    expect(doorSwing(after, d1(after)).hinge).not.toEqual(doorSwing(before, d1(before)).hinge);
  });

  it('направление открывания — только в прилегающую комнату; наружу для межкомнатной двери нельзя выбрать', () => {
    const { getState } = store();
    const toB = getState().preview(patchOpening('d1', { opensIntoRoomId: 'b' }));
    expect(toB.ok).toBe(true);
    const ap = twoRooms();
    const entryToA = getState().preview(patchOpening('entry', { opensIntoRoomId: 'a' }));
    expect(issueCodes(entryToA)).toContain('door-swing-room');
    expect(ap.openings.entry).toBeDefined();
  });

  it('створка, которая упирается в мебель в зоне открывания, блокирует смену петли', () => {
    const ap = twoRooms();
    const flipped = patchOpening('d1', { hinge: 'right' }).apply(ap);
    const swing = doorSwing(flipped, d1(flipped));
    // Тумбочка внутри зоны створки: 60 % пути от петли к точке на дуге 45°, не у стены.
    const p = swing.arc[Math.floor(swing.arc.length / 2)];
    const at = { x: swing.hinge.x + 0.6 * (p.x - swing.hinge.x), z: swing.hinge.z + 0.6 * (p.z - swing.hinge.z) };
    const withNightstand = placeFurniture({
      id: 'night',
      catalogItemId: 'nightstand',
      assetVersion: 1,
      roomId: 'a',
      position: { xCm: at.x, yCm: 0, zCm: at.z },
      angleDeg: 0,
      variantId: null,
    }).apply(ap);
    const r = store(withNightstand).getState().preview(patchOpening('d1', { hinge: 'right' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.message)).toContain('Тумба мешает двери: стоит в проёме или в зоне открывания');
  });
});
