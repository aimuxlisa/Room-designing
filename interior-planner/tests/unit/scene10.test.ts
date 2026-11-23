import { describe, expect, it } from 'vitest';
import { patchOpening } from '../../src/commands/openings';
import { doorLinks } from '../../src/domain/navigation';
import { roomClearRect, wallFootprint } from '../../src/domain/rooms';
import type { Apartment, WindowOpening } from '../../src/domain/types';
import { cmToScene, sceneToCm } from '../../src/domain/units';
import { wallBlocks } from '../../src/domain/wallBlocks';
import { layoutTemplates } from '../../src/layouts/templates';
import { roomView } from '../../src/scene3d/roomView';
import { twoRooms } from './fixtures';

/** Высотные интервалы блоков, покрывающие точку вдоль стены w7 (вертикальная стена, ось z от v2 к v5). */
const coverAt = (ap: Apartment, zCm: number) =>
  wallBlocks(ap, ap.walls.w7)
    .filter((b) => b.rect.minZ < zCm && b.rect.maxZ > zCm)
    .map((b) => [b.bottomCm, b.topCm]);

describe('10.2 стена с реальными проёмами', () => {
  it('стена без проёмов — один блок по контуру плана на всю высоту', () => {
    const ap = twoRooms();
    const blocks = wallBlocks(ap, ap.walls.w1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].rect).toEqual(wallFootprint(ap, ap.walls.w1));
    expect([blocks[0].bottomCm, blocks[0].topCm]).toEqual([0, ap.ceilingCm]);
  });

  it('дверь 100–180 см высотой 210: простенки на всю высоту и перемычка 210–270 над проёмом', () => {
    const ap = twoRooms();
    expect(wallBlocks(ap, ap.walls.w7)).toHaveLength(3);
    expect(coverAt(ap, 140)).toEqual([[210, 270]]);
    expect(coverAt(ap, 50)).toEqual([[0, 270]]);
  });

  it('после сдвига двери отверстие следует за ней', () => {
    const moved = patchOpening('d1', { offsetCm: 200 }).apply(twoRooms());
    expect(coverAt(moved, 140)).toEqual([[0, 270]]);
    expect(coverAt(moved, 240)).toEqual([[210, 270]]);
  });

  it('окно: подоконная часть и перемычка, отверстие между ними', () => {
    const ap = twoRooms();
    const win: WindowOpening = { id: 'win', kind: 'window', wallId: 'w7', offsetCm: 200, widthCm: 60, heightCm: 100, sillCm: 90 };
    const withWin = { ...ap, openings: { ...ap.openings, win } };
    expect(coverAt(withWin, 230)).toEqual([
      [0, 90],
      [190, 270],
    ]);
  });
});

describe('10.4 переходы через двери', () => {
  it('техническая квартира: А → Б через общую дверь; в Б входная дверь ведёт наружу', () => {
    const ap = twoRooms();
    expect(doorLinks(ap, 'a').map((l) => [l.door.id, l.to?.id ?? null])).toEqual([['d1', 'b']]);
    expect(doorLinks(ap, 'b').map((l) => [l.door.id, l.to?.id ?? null])).toEqual([
      ['d1', 'a'],
      ['entry', null],
    ]);
  });

  for (const t of layoutTemplates) {
    it(`${t.code}: по каждой межкомнатной двери можно пройти туда и обратно, вход ровно один`, () => {
      const ap = t.apartment;
      let entrances = 0;
      for (const room of Object.values(ap.rooms)) {
        const links = doorLinks(ap, room.id);
        expect(links.length).toBeGreaterThan(0);
        for (const { door, to } of links) {
          if (!to) {
            entrances++;
            continue;
          }
          expect(doorLinks(ap, to.id).find((l) => l.door.id === door.id)?.to?.id).toBe(room.id);
        }
      }
      expect(entrances).toBe(1);
    });
  }
});

describe('10.3 начальная камера', () => {
  it('комната А: камера с противоположной от двери стороны (дверь на восточной стене) и смотрит в центр', () => {
    const ap = twoRooms();
    const v = roomView(ap, ap.rooms.a);
    const r = roomClearRect(ap, ap.rooms.a);
    expect(sceneToCm(v.position[0])).toBeLessThan(r.minX); // за западной стеной: она скрывается, дверь видна
    expect(sceneToCm(v.target[0])).toBeCloseTo((r.minX + r.maxX) / 2, 6);
    expect(sceneToCm(v.target[2])).toBeCloseTo((r.minZ + r.maxZ) / 2, 6);
  });

  for (const t of layoutTemplates) {
    it(`${t.code}: во всех комнатах камера снаружи контура, расстояние внутри пределов приближения`, () => {
      for (const room of Object.values(t.apartment.rooms)) {
        const v = roomView(t.apartment, room);
        const r = roomClearRect(t.apartment, room);
        const [x, , z] = v.position.map(sceneToCm);
        expect(x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ).toBe(true);
        const d = Math.hypot(...v.position.map((p, i) => p - v.target[i]));
        expect(d).toBeGreaterThanOrEqual(v.minDistance);
        expect(d).toBeLessThanOrEqual(v.maxDistance);
        expect(v.minDistance).toBe(cmToScene(50));
      }
    });
  }
});
