import { describe, expect, it } from 'vitest';
import { fitTransform, panBy, toScreen, toWorld, zoomAt } from '../../src/plan2d/viewTransform';

describe('6.2 перевод координат плана', () => {
  const fit = fitTransform({ minX: 0, maxX: 450, minZ: 0, maxZ: 380 }, 800, 600);

  it('экран ↔ проект взаимно обратны при любом масштабе и сдвиге', () => {
    const p = { x: 210, z: 175 };
    for (const t of [fit, zoomAt(fit, { x: 123, y: 456 }, 2.7), panBy(zoomAt(fit, { x: 10, y: 10 }, 0.4), 37, -81)]) {
      const w = toWorld(t, toScreen(t, p));
      expect(w.x).toBeCloseTo(210, 9);
      expect(w.z).toBeCloseTo(175, 9);
    }
  });

  it('масштаб колесом сохраняет точку под указателем', () => {
    const screen = { x: 300, y: 200 };
    const before = toWorld(fit, screen);
    const after = toWorld(zoomAt(fit, screen, 3), screen);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.z).toBeCloseTo(before.z, 9);
  });

  it('масштаб ограничен', () => {
    expect(zoomAt(fit, { x: 0, y: 0 }, 1e6).scale).toBe(20);
  });
});
