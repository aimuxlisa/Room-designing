import { describe, expect, it } from 'vitest';
import { getCatalogItem } from '../../src/catalog/catalog';
import { createValidators } from '../../src/domain/validators';
import { footprintCorners } from '../../src/geometry/placement';
import { createDragStore } from '../../src/interaction/dragStore';
import { createProjectStore } from '../../src/store/projectStore';
import { createTechApartment, TECH_ROOM_ID } from '../../src/tech/techApartment';

// Чистый прямоугольник технической комнаты: x 15..435, z 15..365.
const setup = () => {
  const project = createProjectStore(createTechApartment(), createValidators(getCatalogItem));
  const drag = createDragStore(project, () => TECH_ROOM_ID, getCatalogItem);
  return { project, drag };
};

describe('контур предмета', () => {
  it('поворот на 90° меняет ширину и глубину местами', () => {
    const c = footprintCorners({ x: 0, z: 0 }, 200, 100, 90);
    const xs = c.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
  });
});

describe('4.4 перенос с общей проверкой', () => {
  it('стол касается стены — допустимо; на 1 см дальше — нет', () => {
    const { drag } = setup();
    drag.getState().startFromCatalog('modern_coffee_table_01'); // 60 × 120,2
    drag.getState().pointAt({ x: 15 + 30, z: 200 }, false);
    expect(drag.getState().draft!.proposal!.ok).toBe(true);
    drag.getState().pointAt({ x: 15 + 29, z: 200 }, false);
    const p = drag.getState().draft!.proposal!;
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.issues[0].message).toContain('пересекает стену');
  });

  it('центр внутри, но угол после поворота выходит — отклоняется', () => {
    const { drag } = setup();
    drag.getState().startFromCatalog('sofa_03'); // 273,1 × 92,5
    drag.getState().pointAt({ x: 225, z: 70 }, false);
    expect(drag.getState().draft!.proposal!.ok).toBe(true);
    drag.getState().rotate(45);
    expect(drag.getState().draft!.proposal!.ok).toBe(false);
  });

  it('недопустимое отпускание ничего не меняет; допустимое — один шаг истории', () => {
    const { project, drag } = setup();
    const before = project.getState().history;
    drag.getState().startFromCatalog('modern_arm_chair_01');
    drag.getState().pointAt({ x: 5, z: 5 });
    expect(drag.getState().finish()!.ok).toBe(false);
    expect(project.getState().history).toBe(before);
    expect(drag.getState().lastIssue).toContain('кресло пересекает стену');

    drag.getState().startFromCatalog('modern_arm_chair_01');
    drag.getState().pointAt({ x: 200, z: 200 });
    expect(drag.getState().finish()!.ok).toBe(true);
    expect(project.getState().history.past).toHaveLength(1);
  });

  it('перенос существующего: отказ оставляет прежнее положение', () => {
    const { project, drag } = setup();
    drag.getState().startFromCatalog('modern_arm_chair_01');
    drag.getState().pointAt({ x: 200, z: 200 });
    drag.getState().finish();
    const id = Object.keys(project.getState().history.present.furniture)[0];
    drag.getState().startMove(id, { x: 210, z: 210 });
    drag.getState().pointAt({ x: 1000, z: 1000 });
    drag.getState().finish();
    expect(project.getState().history.present.furniture[id].position).toEqual({ xCm: 200, yCm: 0, zCm: 200 });
  });

  it('привязка 5 см и сохранение смещения захвата', () => {
    const { project, drag } = setup();
    drag.getState().startFromCatalog('modern_arm_chair_01');
    drag.getState().pointAt({ x: 201.7, z: 198.2 });
    expect(drag.getState().draft!.position).toEqual({ xCm: 200, yCm: 0, zCm: 200 });
    drag.getState().finish();
    const id = Object.keys(project.getState().history.present.furniture)[0];
    drag.getState().startMove(id, { x: 230, z: 200 }); // захват в 30 см правее центра
    drag.getState().pointAt({ x: 260, z: 200 });
    expect(drag.getState().draft!.position!.xCm).toBe(230);
  });

  it('Esc (cancel) не создаёт предмета', () => {
    const { project, drag } = setup();
    drag.getState().startFromCatalog('sofa_03');
    drag.getState().pointAt({ x: 200, z: 200 });
    drag.getState().cancel();
    expect(Object.keys(project.getState().history.present.furniture)).toHaveLength(0);
  });
});
