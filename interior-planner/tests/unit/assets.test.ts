// Задача 19.3: каждый предмет каталога и каждый файл ассетов зарегистрирован в ASSETS.md с источником и условиями.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/catalog/catalog';
import { OWN_MODELS } from '../../src/catalog/ownModels';

const root = resolve(__dirname, '../..');
const registry = readFileSync(resolve(root, 'ASSETS.md'), 'utf8');
const rows = registry.split('\n').filter((l) => l.startsWith('| '));
const rowFor = (url: string) => rows.find((l) => l.includes(`| ${url} |`));
const num = (s: string) => Number(s.trim().replace(',', '.'));

describe('реестр ассетов (19.3)', () => {
  it('у каждой модели Poly Haven есть строка с автором, CC0 и совпадающими габаритами', () => {
    for (const item of catalog.filter((i) => i.license === 'CC0 1.0')) {
      const row = rowFor(item.source);
      expect(row, item.id).toBeDefined();
      const cells = row!.split('|').map((c) => c.trim());
      expect(cells[4], `${item.id}: автор`).not.toBe('');
      expect(cells[5], item.id).toBe('CC0 1.0');
      // Габариты в реестре — «в файле»; у повёрнутых моделей (modelYawDeg) ширина и глубина меняются местами.
      const [fw, fd, h] = cells[8].split('×').map(num);
      const [w, d] = item.modelYawDeg ? [fd, fw] : [fw, fd];
      const { widthCm, depthCm, heightCm } = item.size;
      expect(Math.max(Math.abs(w - widthCm), Math.abs(d - depthCm), Math.abs(h - heightCm)), item.id).toBeLessThan(0.5);
      expect(existsSync(resolve(root, 'public', item.modelUrl.slice(1))), `${item.id}: GLB`).toBe(true);
    }
  });

  it('каждая собственная модель есть в реестре и в ownModels.ts', () => {
    for (const item of catalog.filter((i) => i.license === 'собственная')) {
      expect(OWN_MODELS[item.id], item.id).toBeDefined();
      expect(registry.includes(`\`${item.id}\``), `${item.id}: ASSETS.md`).toBe(true);
    }
  });

  it('у каждого предмета есть превью, а лицензия — одна из зарегистрированных', () => {
    for (const item of catalog) {
      expect(['CC0 1.0', 'собственная'], item.id).toContain(item.license);
      expect(existsSync(resolve(root, 'public', item.previewUrl.slice(1))), `${item.id}: превью`).toBe(true);
    }
  });

  it('в public нет незарегистрированных моделей и текстур', () => {
    for (const id of readdirSync(resolve(root, 'public/models'))) {
      expect(rowFor(`https://polyhaven.com/a/${id}`), id).toBeDefined();
    }
    for (const file of readdirSync(resolve(root, 'public/textures'))) {
      expect(rows.some((l) => l.includes(`| ${file} |`)), file).toBe(true);
    }
  });
});
