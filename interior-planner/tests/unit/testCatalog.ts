/** Синтетический каталог для проверок D-05/D-06 (не модели каталога). */
import type { CatalogItem, ColliderBox, Mounting, Size3Cm } from '../../src/domain/types';

const box = (x: number, y: number, z: number, w: number, h: number, d: number): ColliderBox => ({
  center: { xCm: x, yCm: y, zCm: z },
  size: { widthCm: w, heightCm: h, depthCm: d },
});

function item(id: string, name: string, size: Size3Cm, mounting: Mounting = 'floor', extra: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    version: 1,
    category: id,
    name,
    roomTypes: ['living'],
    size,
    modelUrl: '',
    modelUnit: 'cm',
    previewUrl: '',
    mounting,
    layer: 'item',
    colliders: [box(0, size.heightCm / 2, 0, size.widthCm, size.heightCm, size.depthCm)],
    license: 'test',
    source: 'test',
    ...extra,
  };
}

const s = (widthCm: number, depthCm: number, heightCm: number): Size3Cm => ({ widthCm, depthCm, heightCm });

export const testItems: CatalogItem[] = [
  // Стол 120 × 80: столешница 72–76 см и четыре ножки 5 × 5.
  item('table', 'Стол', s(120, 80, 76), 'floor', {
    colliders: [
      box(0, 74, 0, 120, 4, 80),
      ...[-57.5, 57.5].flatMap((x) => [-37.5, 37.5].map((z) => box(x, 36, z, 5, 72, 5))),
    ],
  }),
  // Стул 45 × 45: сиденье с ножками до 47 см, спинка сзади (локальная −Z) 47–90 см.
  item('chair', 'Стул', s(45, 45, 90), 'floor', { colliders: [box(0, 23.5, 0, 45, 47, 45), box(0, 68.5, -20, 45, 43, 5)] }),
  item('rug', 'Ковёр', s(200, 140, 1), 'floor', { layer: 'floor-covering' }),
  item('rug2', 'Ковёр', s(100, 100, 1), 'floor', { layer: 'floor-covering' }),
  item('sofa', 'Диван', s(200, 90, 80)),
  item('bed', 'Кровать', s(160, 200, 50)),
  item('dresser', 'Комод', s(100, 45, 85)),
  item('wardrobe', 'Шкаф', s(100, 60, 200)),
  item('nightstand', 'Тумба', s(45, 40, 55)),
  item('shelf', 'Полка', s(80, 25, 4), 'wall', { mountHeightCm: 150 }),
  item('wallcab', 'Навесной шкаф', s(80, 35, 70), 'wall', { mountHeightCm: 140 }),
  item('mirror', 'Зеркало', s(60, 3, 90), 'wall', { mountHeightCm: 100 }),
  item('desklamp', 'Настольная лампа', s(20, 20, 45), 'tabletop'),
  item('ceilinglamp', 'Люстра', s(40, 40, 30), 'ceiling'),
];

const byId = new Map(testItems.map((i) => [i.id, i]));
export const testCatalog = (id: string) => byId.get(id);
