import { describe, expect, it } from 'vitest';
import { roomClearRect } from '../../src/domain/rooms';
import { cm2ToM2 } from '../../src/domain/units';
import { runValidators } from '../../src/domain/validation';
import { createValidators } from '../../src/domain/validators';
import { rectDepth, rectWidth } from '../../src/geometry/rect';
import { layoutTemplates, templateAreaCm2 } from '../../src/layouts/templates';

const validators = createValidators(() => undefined);

describe('7.2 стартовые схемы', () => {
  it('9 схем, по 3 на 1/2/3 комнаты', () => {
    expect(layoutTemplates).toHaveLength(9);
    for (const n of [1, 2, 3]) expect(layoutTemplates.filter((t) => t.livingRooms === n)).toHaveLength(3);
  });

  for (const t of layoutTemplates) {
    it(`${t.code}: проходит все проверки, без мебели, есть прихожая`, () => {
      expect(runValidators(t.apartment, validators)).toEqual([]);
      expect(Object.keys(t.apartment.furniture)).toHaveLength(0);
      expect(Object.values(t.apartment.rooms).some((r) => r.type === 'hallway')).toBe(true);
    });
  }

  it('стены 30/10 см, двери 80/70/90 см, потолок 270 см — не масштабируются', () => {
    for (const t of layoutTemplates) {
      const thick = new Set(Object.values(t.apartment.walls).map((w) => w.thicknessCm));
      expect([...thick].sort()).toEqual([10, 30]);
      for (const o of Object.values(t.apartment.openings))
        if (o.kind === 'door') expect([70, 80, 90]).toContain(o.widthCm);
      expect(t.apartment.ceilingCm).toBe(270);
    }
  });

  it('оси увеличены в 1,1 раза (D-15): кухня-гостиная 1А по осям 572 × 495 см', () => {
    const t = layoutTemplates.find((x) => x.code === '1А')!;
    const kl = roomClearRect(t.apartment, t.apartment.rooms.kl);
    expect(rectWidth(kl)).toBe(572 - 30);
    expect(rectDepth(kl)).toBe(495 - 15 - 5);
  });

  it('таблица площадей (для SPEC §3.1)', () => {
    const table = layoutTemplates.map((t) => `${t.code} ${cm2ToM2(templateAreaCm2(t)).toFixed(1)}`);
    expect(table).toMatchSnapshot();
  });
});
