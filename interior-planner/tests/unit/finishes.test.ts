import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { floorMaterials, getWallMaterial, wallMaterials } from '../../src/catalog/materials';
import { setWallFinish } from '../../src/commands/finishes';
import { moveWall } from '../../src/commands/walls';
import { surfaceKey } from '../../src/domain/rooms';
import { surfaceLabel, tileUv } from '../../src/domain/surfaces';
import { runValidators } from '../../src/domain/validation';
import { createValidators } from '../../src/domain/validators';
import { rectWidth } from '../../src/geometry/rect';
import { wallBlocks } from '../../src/domain/wallBlocks';
import { createProjectStore } from '../../src/store/projectStore';
import { twoRooms } from './fixtures';
import { testCatalog } from './testCatalog';

const validators = createValidators(testCatalog);

describe('12.1 выбор поверхности: сторона общей стены однозначна', () => {
  it('подпись называет комнату, сторону света и соседа', () => {
    const ap = twoRooms();
    expect(surfaceLabel(ap, 'w7', 'a')).toBe('«Комната А», восточная стена — сторона к «Коридор Б»');
    expect(surfaceLabel(ap, 'w7', 'b')).toBe('«Коридор Б», западная стена — сторона к «Комната А»');
    expect(surfaceLabel(ap, 'w1', 'a')).toBe('«Комната А», северная стена (наружная)');
    expect(surfaceLabel(ap, 'w5', 'a')).toBe('«Комната А», южная стена (наружная)');
  });
});

describe('12.2 материалы', () => {
  it('стены: 8 красок, 9 тканей, 9 плиток/штукатурок/кирпичей; пол: 22 покрытия; текстуры WebP на месте, id уникальны', () => {
    expect(wallMaterials.filter((m) => m.kind === 'paint')).toHaveLength(8);
    expect(wallMaterials.filter((x) => x.kind === 'wallpaper')).toHaveLength(9);
    expect(wallMaterials.filter((x) => ['tile', 'plaster', 'brick'].includes(x.kind))).toHaveLength(9);
    expect(floorMaterials).toHaveLength(22);
    for (const m of [...wallMaterials, ...floorMaterials].filter((x) => x.textureUrl)) {
      expect(m.tileSizeCm!.widthCm).toBeGreaterThan(20);
      expect(m.tileSizeCm!.heightCm).toBeGreaterThan(20);
      expect(m.source).toMatch(/^https:\/\/polyhaven\.com\/a\/\w+ \(CC0\)$/);
      expect(m.textureUrl).toMatch(/^\/textures\/\w+\.webp$/);
      expect(existsSync(fileURLToPath(new URL(`../../public${m.textureUrl}`, import.meta.url)))).toBe(true);
    }
    const ids = [...wallMaterials, ...floorMaterials].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('12.3 отделка одной стороны (AC-11)', () => {
  it('покраска стороны А не меняет сторону Б; отмена возвращает стену без отделки', () => {
    const project = createProjectStore(twoRooms(), validators);
    expect(project.getState().execute(setWallFinish('w7', 'a', 'paint-sage')).ok).toBe(true);
    const ap = project.getState().history.present;
    expect(ap.finishes.walls).toEqual({ [surfaceKey('w7', 'a')]: 'paint-sage' });
    expect(ap.finishes.walls[surfaceKey('w7', 'b')]).toBeUndefined();
    project.getState().undo();
    expect(project.getState().history.present.finishes.walls).toEqual({});
  });

  it('сброс убирает отделку только этой поверхности', () => {
    let ap = setWallFinish('w7', 'a', 'paint-sage').apply(twoRooms());
    ap = setWallFinish('w7', 'b', 'paint-blue').apply(ap);
    ap = setWallFinish('w7', 'a', null).apply(ap);
    expect(ap.finishes.walls).toEqual({ [surfaceKey('w7', 'b')]: 'paint-blue' });
  });
});

describe('12.4 физический масштаб обоев', () => {
  const tile = getWallMaterial('wallpaper-fabric_pattern_05')!.tileSizeCm!;

  it('повтор = длина / размер повтора; сдвиг привязан к координате стены', () => {
    expect(tileUv(100, 450, 0, 270, tile)).toEqual({ repeat: [9, 5.4], offset: [2, 0] });
  });

  it('после удлинения стены на 50 см повторов на один больше — рисунок не растянут', () => {
    const ap = twoRooms();
    const longer = moveWall('w6', -50).apply(ap); // западная стена А наружу: северная стена w1 длиннее на 50 см
    const len = (a: typeof ap) => rectWidth(wallBlocks(a, a.walls.w1)[0].rect);
    expect(len(longer) - len(ap)).toBeCloseTo(50, 6);
    const [r0, r1] = [tileUv(0, len(ap), 0, 270, tile).repeat[0], tileUv(0, len(longer), 0, 270, tile).repeat[0]];
    expect(r1 - r0).toBeCloseTo(1, 6);
    expect(len(ap) / r0).toBeCloseTo(50, 6);
    expect(len(longer) / r1).toBeCloseTo(50, 6);
  });
});

describe('12.5 отделка связана со стабильной поверхностью', () => {
  it('сдвиг стены сохраняет отделку и проходит проверки', () => {
    const project = createProjectStore(setWallFinish('w7', 'a', 'paint-sage').apply(twoRooms()), validators);
    expect(project.getState().execute(moveWall('w7', 30)).ok).toBe(true);
    expect(project.getState().history.present.finishes.walls[surfaceKey('w7', 'a')]).toBe('paint-sage');
  });

  it('отделка несуществующей поверхности отклоняется проверкой целостности', () => {
    const bad = setWallFinish('w2', 'a', 'paint-sage').apply(twoRooms()); // w2 — стена коридора, не комнаты А
    expect(runValidators(bad, validators).map((i) => i.code)).toContain('finish-surface-missing');
  });
});
