import { describe, expect, it } from 'vitest';
import { apartmentClearAreaCm2, roomClearRect } from '../../src/domain/rooms';
import { cm2ToM2 } from '../../src/domain/units';
import { runValidators } from '../../src/domain/validation';
import { createValidators } from '../../src/domain/validators';
import { rectDepth, rectWidth } from '../../src/geometry/rect';
import { rankTemplates } from '../../src/layouts/match';
import { layoutTemplates, templateAreaCm2 } from '../../src/layouts/templates';

const validators = createValidators(() => undefined);

describe('Этап 22: Квартиры чуть больше (SPEC D-15)', () => {
  it('22.1: все 9 схем валидны, без мебели, стены 30/10 см, двери 70/80/90 см, потолок 270 см', () => {
    expect(layoutTemplates).toHaveLength(9);
    for (const t of layoutTemplates) {
      expect(runValidators(t.apartment, validators)).toEqual([]);
      expect(Object.keys(t.apartment.furniture)).toHaveLength(0);
      const thick = new Set(Object.values(t.apartment.walls).map((w) => w.thicknessCm));
      expect([...thick].sort()).toEqual([10, 30]);
      for (const o of Object.values(t.apartment.openings)) {
        if (o.kind === 'door') expect([70, 80, 90]).toContain(o.widthCm);
      }
      expect(t.apartment.ceilingCm).toBe(270);
    }
  });

  it('22.1: оси увеличены в 1.1 раза (кухня-гостиная 1А по осям 572 × 495 см)', () => {
    const t = layoutTemplates.find((x) => x.code === '1А')!;
    const kl = roomClearRect(t.apartment, t.apartment.rooms.kl);
    expect(rectWidth(kl)).toBe(572 - 30);
    expect(rectDepth(kl)).toBe(495 - 15 - 5);
  });

  it('22.2: ранжирование схем по введённой площади (36, 52, 72, 90, 108 м²)', () => {
    // Для 1-комнатных
    const r36 = rankTemplates(1, 36);
    expect(r36[0].template.code).toBe('1А');

    const r52 = rankTemplates(1, 52);
    expect(['1Б', '1В']).toContain(r52[0].template.code);

    // Для 2-комнатных
    const r72 = rankTemplates(2, 72);
    expect(r72[0].template.code).toBe('2Б');

    // Для 3-комнатных
    const r90 = rankTemplates(3, 90);
    expect(r90[0].template.code).toBe('3А');

    const r108 = rankTemplates(3, 108);
    expect(r108[0].template.code).toBe('3В');
  });

  it('22.4: площади точно совпадают со SPEC §3.1', () => {
    const expected = {
      '1А': 36.4,
      '1Б': 49.3,
      '1В': 53.2,
      '2А': 64.1,
      '2Б': 74.8,
      '2В': 80.8,
      '3А': 89.6,
      '3Б': 100.3,
      '3В': 108.4,
    };

    for (const t of layoutTemplates) {
      const area = Number(cm2ToM2(templateAreaCm2(t)).toFixed(1));
      expect(area).toBeCloseTo(expected[t.code as keyof typeof expected], 1);
    }
  });
});
