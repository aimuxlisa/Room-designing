import { describe, expect, it } from 'vitest';
import { proposeChange } from '../../src/commands/change';
import { moveWall } from '../../src/commands/walls';
import { doorConnects, doorZones } from '../../src/domain/openings';
import { roomClearRect } from '../../src/domain/rooms';
import type { Apartment, FurnitureInstance, Opening } from '../../src/domain/types';
import { formatCm } from '../../src/domain/units';
import { runValidators } from '../../src/domain/validation';
import { createValidators } from '../../src/domain/validators';
import { polygonsOverlap, rectPolygon } from '../../src/geometry/polygon';
import { twoRooms } from './fixtures';
import { testCatalog } from './testCatalog';

const validators = createValidators(testCatalog);
const codes = (ap: Apartment) => runValidators(ap, validators).map((i) => i.code);
const messages = (ap: Apartment) => runValidators(ap, validators).map((i) => i.message);

/** Комната А: чистые x 15..415, z 15..315. Окно на северной стене x 100..220, подоконник 90 см. */
function base(): Apartment {
  const ap = twoRooms();
  const window: Opening = { id: 'win', kind: 'window', wallId: 'w1', offsetCm: 100, widthCm: 120, heightCm: 140, sillCm: 90 };
  return { ...ap, openings: { ...ap.openings, win: window } };
}

let n = 0;
function put(
  ap: Apartment,
  catalogItemId: string,
  x: number,
  z: number,
  angleDeg = 0,
  yCm = 0,
  roomId = 'a',
): Apartment {
  const f: FurnitureInstance = {
    id: `f${n++}`,
    catalogItemId,
    assetVersion: 1,
    roomId,
    position: { xCm: x, yCm, zCm: z },
    angleDeg,
    variantId: null,
  };
  return { ...ap, furniture: { ...ap.furniture, [f.id]: f } };
}

describe('базовая квартира', () => {
  it('проходит все проверки', () => {
    expect(codes(base())).toEqual([]);
  });
});

describe('5.1 помещения, узлы, стены', () => {
  it('наложение комнат называет обе комнаты; соприкосновение стеной — не наложение', () => {
    const ap = base();
    const bad = { ...ap, vertices: { ...ap.vertices, v1: { ...ap.vertices.v1, xCm: 0 } } };
    expect(codes(bad)).not.toContain('room-overlap');
    // Третья комната поверх первой.
    const over: Apartment = {
      ...ap,
      vertices: { ...ap.vertices, u1: { id: 'u1', xCm: 100, zCm: 100 }, u2: { id: 'u2', xCm: 300, zCm: 100 }, u3: { id: 'u3', xCm: 300, zCm: 250 }, u4: { id: 'u4', xCm: 100, zCm: 250 } },
      walls: {
        ...ap.walls,
        x1: { id: 'x1', startId: 'u1', endId: 'u2', thicknessCm: 10 },
        x2: { id: 'x2', startId: 'u2', endId: 'u3', thicknessCm: 10 },
        x3: { id: 'x3', startId: 'u3', endId: 'u4', thicknessCm: 10 },
        x4: { id: 'x4', startId: 'u4', endId: 'u1', thicknessCm: 10 },
      },
      rooms: { ...ap.rooms, c: { id: 'c', type: 'bedroom', name: 'Спальня', boundary: ['x1', 'x2', 'x3', 'x4'].map((wallId) => ({ wallId, reversed: false })) } },
    };
    const m = messages(over).join('\n');
    expect(m).toContain('«Комната А» и «Спальня» накладываются');
  });

  it('совпадающие узлы, неразбитая стена, стена без комнаты', () => {
    const ap = base();
    const dup = { ...ap, vertices: { ...ap.vertices, vx: { id: 'vx', xCm: 420, zCm: 0 } } };
    expect(codes(dup)).toContain('vertex-duplicate');
    const unsplit = { ...ap, walls: { ...ap.walls, long: { id: 'long', startId: 'v1', endId: 'v3', thicknessCm: 30 } } };
    expect(codes(unsplit)).toEqual(expect.arrayContaining(['wall-unsplit', 'wall-orphan', 'wall-double']));
  });
});

describe('5.2 общая стена', () => {
  it('сдвиг перегородки на 30 см: ровно 10 см между комнатами, без щели и двойной стены', () => {
    const r = proposeChange(base(), moveWall('w7', 30), validators);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = roomClearRect(r.candidate, r.candidate.rooms.a);
    const b = roomClearRect(r.candidate, r.candidate.rooms.b);
    expect(b.minX - a.maxX).toBe(10);
    expect(Object.keys(r.candidate.walls)).toHaveLength(7);
  });

  it('вторая стена на месте общей отклоняется', () => {
    const ap = base();
    const dbl = { ...ap, walls: { ...ap.walls, w7b: { id: 'w7b', startId: 'v5', endId: 'v2', thicknessCm: 10 } } };
    expect(codes(dbl)).toContain('wall-double');
  });

  it('стены разной толщины на одной стороне отклоняются', () => {
    // Восточная сторона коридора из двух стен: w3a (30 см) и w3b (20 см).
    const ap = base();
    const { w3: _w3, ...walls } = ap.walls;
    const split: Apartment = {
      ...ap,
      vertices: { ...ap.vertices, v7: { id: 'v7', xCm: 640, zCm: 150 } },
      walls: {
        ...walls,
        w3a: { id: 'w3a', startId: 'v3', endId: 'v7', thicknessCm: 30 },
        w3b: { id: 'w3b', startId: 'v7', endId: 'v4', thicknessCm: 20 },
      },
      rooms: {
        ...ap.rooms,
        b: {
          ...ap.rooms.b,
          boundary: ap.rooms.b.boundary.flatMap((e) =>
            e.wallId === 'w3' ? [{ wallId: 'w3a', reversed: false }, { wallId: 'w3b', reversed: false }] : [e],
          ),
        },
      },
      openings: { ...ap.openings, entry: { ...ap.openings.entry, wallId: 'w3a', offsetCm: 20 } as Opening },
    };
    expect(codes(split)).toContain('side-thickness');
    const same = { ...split, walls: { ...split.walls, w3b: { ...split.walls.w3b, thicknessCm: 30 } } };
    expect(codes(same)).toEqual([]);
  });
});

describe('5.3 проёмы и граф проходов (AC-04, AC-10)', () => {
  it('общая дверь — один проём, ведёт в обе комнаты; входная — наружу', () => {
    const ap = base();
    const [a, b] = doorConnects(ap, ap.openings.d1 as Extract<Opening, { kind: 'door' }>)!;
    expect([a.id, b!.id].sort()).toEqual(['a', 'b']);
    const [inside, outside] = doorConnects(ap, ap.openings.entry as Extract<Opening, { kind: 'door' }>)!;
    expect(inside.id).toBe('b');
    expect(outside).toBeNull();
  });

  it('помещение без прохода обнаруживается; без входной двери — тоже', () => {
    const ap = base();
    const { d1: _d1, ...rest } = ap.openings;
    expect(messages({ ...ap, openings: rest })).toContain('В помещение «Комната А» нет прохода');
    const { entry: _e, ...noEntry } = ap.openings;
    expect(codes({ ...ap, openings: noEntry })).toContain('no-entrance');
  });

  it('проём за стеной, пересечение проёмов (касание допустимо), окно на внутренней стене, выше потолка', () => {
    const ap = base();
    const out = { ...ap, openings: { ...ap.openings, win: { ...ap.openings.win, offsetCm: 330 } as Opening } };
    expect(codes(out)).toContain('opening-outside-wall');
    const touching: Opening = { id: 'w2nd', kind: 'window', wallId: 'w1', offsetCm: 220, widthCm: 60, heightCm: 140, sillCm: 90 };
    expect(codes({ ...ap, openings: { ...ap.openings, w2nd: touching } })).toEqual([]);
    const crossing = { ...touching, offsetCm: 200 };
    expect(codes({ ...ap, openings: { ...ap.openings, w2nd: crossing } })).toContain('opening-overlap');
    const interior: Opening = { ...touching, wallId: 'w7', offsetCm: 200 };
    expect(codes({ ...ap, openings: { ...ap.openings, w2nd: interior } })).toContain('window-interior');
    const tall = { ...ap, openings: { ...ap.openings, win: { ...ap.openings.win, heightCm: 200 } as Opening } };
    expect(codes(tall)).toContain('opening-above-ceiling');
  });
});

describe('5.4 коллайдеры с поворотом', () => {
  it('центр внутри, угол после поворота выходит — отклоняется', () => {
    expect(codes(put(base(), 'sofa', 230, 60))).toEqual([]);
    expect(codes(put(base(), 'sofa', 230, 60, 45))).toContain('out-of-room');
  });
});

describe('5.5 правила D-05/D-06 (SPEC §11.3)', () => {
  const table = (ap: Apartment) => put(ap, 'table', 200, 200);

  it('разрешено: стул задвинут сиденьем под столешницу, не задевая ножки', () => {
    expect(codes(put(table(base()), 'chair', 200, 235, 180))).toEqual([]);
  });
  it('запрещено: стул пересекает столешницу (спинка под столом)', () => {
    expect(codes(put(table(base()), 'chair', 200, 235, 0))).toContain('furniture-overlap');
  });
  it('запрещено: стул задевает ножку стола', () => {
    expect(codes(put(table(base()), 'chair', 257, 240, 180))).toContain('furniture-overlap');
  });
  it('разрешено: ковёр под диваном и под столом; запрещено: ковёр поверх ковра', () => {
    const rugged = put(base(), 'rug', 200, 200);
    expect(codes(put(rugged, 'sofa', 200, 200))).toEqual([]);
    expect(codes(table(rugged))).toEqual([]);
    expect(codes(put(rugged, 'rug2', 220, 220))).toContain('furniture-overlap');
  });
  it('разрешено: ковёр в зоне двери', () => {
    expect(codes(put(base(), 'rug2', 360, 150))).toEqual([]);
  });
  it('запрещено: диван поверх кровати', () => {
    expect(codes(put(put(base(), 'bed', 200, 200), 'sofa', 200, 200))).toContain('furniture-overlap');
  });
  it('разрешено: комод и диван под окном', () => {
    expect(codes(put(base(), 'dresser', 160, 37.5))).toEqual([]);
    expect(codes(put(base(), 'sofa', 160, 60))).toEqual([]);
  });
  it('разрешено: полка над комодом; навесной шкаф на сплошной стене', () => {
    const ap = put(put(base(), 'dresser', 37.5, 200, 90), 'shelf', 27.5, 200, 90, 150);
    expect(codes(ap)).toEqual([]);
    expect(codes(put(base(), 'wallcab', 32.5, 60, 90, 140))).toEqual([]);
  });
  it('запрещено: навесной шкаф на окне, зеркало на двери', () => {
    expect(codes(put(base(), 'wallcab', 160, 32.5, 0, 140))).toContain('mount-over-opening');
    expect(codes(put(base(), 'mirror', 413.5, 140, 270, 100))).toContain('mount-over-opening');
  });
  it('запрещено: настенный предмет не у стены или повёрнут от неё', () => {
    expect(codes(put(base(), 'shelf', 200, 200, 0, 150))).toContain('mount-wall');
    expect(codes(put(base(), 'shelf', 27.5, 200, 270, 150))).toContain('mount-wall');
  });
  it('запрещено: шкаф в дверном проёме, тумба в зоне открывания створки', () => {
    expect(codes(put(base(), 'wardrobe', 385, 140, 90))).toContain('door-zone');
    expect(codes(put(base(), 'nightstand', 360, 160))).toContain('door-zone');
  });
  it('настольная лампа только на столешнице; люстра — на потолке', () => {
    expect(codes(put(table(base()), 'desklamp', 200, 200, 0, 76))).toEqual([]);
    expect(codes(put(base(), 'desklamp', 200, 200, 0, 0))).toContain('mount-tabletop');
    expect(codes(put(base(), 'ceilinglamp', 200, 200, 0, 240))).toEqual([]);
    expect(codes(put(base(), 'ceilinglamp', 200, 200, 0, 0))).toContain('mount-ceiling');
  });
  it('зона двери: порог 30 см и сектор из 12 звеньев', () => {
    const ap = base();
    const zones = doorZones(ap, ap.openings.d1 as Extract<Opening, { kind: 'door' }>);
    expect(zones.filter((z) => z.roomId === 'a')).toHaveLength(2);
    expect(zones.filter((z) => z.roomId === 'b')).toHaveLength(1);
    expect(zones.find((z) => z.polygon.length === 14)).toBeTruthy();
  });
  it('сдвиг стены отклоняется из-за комода в скрытом коридоре', () => {
    const ap = put(base(), 'dresser', 447.5, 250, 90, 0, 'b');
    expect(codes(ap)).toEqual([]);
    const r = proposeChange(ap, moveWall('w7', 30), validators);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.message)).toContain('В комнате «Коридор Б» комод пересекает стену');
  });
});

describe('5.6 допуск и округление', () => {
  it('касание с проникновением 0,005 см допустимо, 0,02 см — нет', () => {
    expect(codes(put(base(), 'dresser', 160, 37.5 - 0.005))).toEqual([]);
    expect(codes(put(base(), 'dresser', 160, 37.5 - 0.02))).toContain('out-of-room');
  });
  it('подписи 100 и 99,6 см одинаковы, но проверяются по-разному', () => {
    expect(formatCm(100)).toBe(formatCm(99.6));
    const a = rectPolygon({ minX: 0, maxX: 100, minZ: 0, maxZ: 10 });
    expect(polygonsOverlap(a, rectPolygon({ minX: 100, maxX: 200, minZ: 0, maxZ: 10 }))).toBe(false);
    expect(polygonsOverlap(a, rectPolygon({ minX: 99.6, maxX: 200, minZ: 0, maxZ: 10 }))).toBe(true);
  });
});
