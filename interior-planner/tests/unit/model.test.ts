import { describe, expect, it } from 'vitest';
import { integrityValidators } from '../../src/domain/integrity';
import {
  apartmentClearAreaCm2,
  apartmentOuterAreaCm2,
  roomClearRect,
  roomsOfWall,
  surfaceKey,
} from '../../src/domain/rooms';
import { rectDepth, rectWidth } from '../../src/geometry/rect';
import { runValidators } from '../../src/domain/validation';
import {
  assetToSceneScale,
  cm2ToM2,
  cmToScene,
  formatCm,
  formatM2,
  parseCmInput,
  sceneToCm,
} from '../../src/domain/units';
import { createUiStore } from '../../src/store/uiStore';
import { twoRooms } from './fixtures';

describe('3.1 вершины, стены, комнаты', () => {
  const ap = twoRooms();

  it('тестовая квартира проходит проверки целостности', () => {
    expect(runValidators(ap, integrityValidators)).toEqual([]);
  });

  it('общая стена одна и принадлежит обеим комнатам', () => {
    expect(roomsOfWall(ap, 'w7').map((r) => r.id).sort()).toEqual(['a', 'b']);
    const wallIdsA = ap.rooms.a.boundary.map((e) => e.wallId);
    const wallIdsB = ap.rooms.b.boundary.map((e) => e.wallId);
    expect(wallIdsA.filter((id) => wallIdsB.includes(id))).toEqual(['w7']);
  });

  it('узлы общей стены не дублируются', () => {
    const coords = Object.values(ap.vertices).map((v) => `${v.xCm},${v.zCm}`);
    expect(new Set(coords).size).toBe(coords.length);
  });

  it('чистые размеры 400 × 300 и 200 × 300, между комнатами ровно 10 см', () => {
    const a = roomClearRect(ap, ap.rooms.a);
    const b = roomClearRect(ap, ap.rooms.b);
    expect([rectWidth(a), rectDepth(a)]).toEqual([400, 300]);
    expect([rectWidth(b), rectDepth(b)]).toEqual([200, 300]);
    expect(b.minX - a.maxX).toBe(10);
  });

  it('две стороны перегородки — разные поверхности', () => {
    expect(surfaceKey('w7', 'a')).not.toBe(surfaceKey('w7', 'b'));
  });

  it('незамкнутый и непрямоугольный контур отклоняются', () => {
    const open = { ...ap, rooms: { ...ap.rooms, a: { ...ap.rooms.a, boundary: ap.rooms.a.boundary.slice(0, 3) } } };
    expect(runValidators(open, integrityValidators).map((i) => i.code)).toContain('room-open');
    const skew = { ...ap, vertices: { ...ap.vertices, v6: { ...ap.vertices.v6, xCm: 20 } } };
    expect(runValidators(skew, integrityValidators).map((i) => i.code)).toContain('room-not-rect');
  });

  it('NaN и ссылки на несуществующие объекты отклоняются', () => {
    const bad = { ...ap, vertices: { ...ap.vertices, v1: { ...ap.vertices.v1, xCm: NaN } } };
    expect(runValidators(bad, integrityValidators).map((i) => i.code)).toContain('vertex-nan');
    const missing = { ...ap, openings: { ...ap.openings, d1: { ...ap.openings.d1, wallId: 'nope' } } };
    expect(runValidators(missing, integrityValidators).map((i) => i.code)).toContain('opening-wall-missing');
  });
});

describe('3.2 проект отделён от интерфейса', () => {
  it('смена комнаты сбрасывает выбор, интерфейс не хранит координат', () => {
    const ui = createUiStore();
    ui.getState().select('f1');
    ui.getState().setActiveRoom('b');
    expect(ui.getState().selectedId).toBeNull();
    expect(Object.keys(ui.getState())).not.toContain('apartment');
  });
});

describe('3.3 единицы (AC-02)', () => {
  it('100 см = 1 единица сцены и обратно', () => {
    expect(cmToScene(100)).toBe(1);
    expect(sceneToCm(cmToScene(273))).toBe(273);
  });

  it('предмет 100 см даёт 1 единицу сцены при модели в м, см и мм', () => {
    const rawSize = { m: 1, cm: 100, mm: 1000 } as const;
    for (const unit of ['m', 'cm', 'mm'] as const) {
      expect(rawSize[unit] * assetToSceneScale(unit)).toBeCloseTo(1, 10);
    }
  });

  it('масштаб применяется один раз: метровая модель не масштабируется повторно', () => {
    expect(assetToSceneScale('m')).toBe(1);
  });

  it('см² → м² и подписи', () => {
    expect(cm2ToM2(120_000)).toBe(12);
    expect(formatM2(241_200)).toBe('24,1 м²');
    expect(formatCm(99.6)).toBe('100 см');
  });

  it('ввод: целые см, запятая и точка, мусор отклоняется', () => {
    expect(parseCmInput('12,6')).toBe(13);
    expect(parseCmInput(' 12.4 ')).toBe(12);
    expect(parseCmInput('abc')).toBeNull();
    expect(parseCmInput('')).toBeNull();
    expect(parseCmInput('1e400')).toBeNull();
  });
});

describe('3.4 правила площади', () => {
  it('сумма чистых 18,0 м², по внешнему контуру 24,12 м²', () => {
    const ap = twoRooms();
    expect(cm2ToM2(apartmentClearAreaCm2(ap))).toBeCloseTo(18.0, 6);
    expect(cm2ToM2(apartmentOuterAreaCm2(ap))).toBeCloseTo(24.12, 6);
  });
});
