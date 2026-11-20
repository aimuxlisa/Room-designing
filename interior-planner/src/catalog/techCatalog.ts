/** ТЕХНИЧЕСКИЙ каталог этапа 4 (D-07: утверждённый перечень — задача 13.1). Габариты — из ASSETS.md. */
import type { CatalogItem, Id, Size3Cm } from '../domain/types';

const poly = (id: string, name: string, category: string, size: Size3Cm, author: string): CatalogItem => ({
  id,
  version: 1,
  category,
  name,
  roomTypes: ['living'],
  size,
  modelUrl: `/models/${id}/${id}.gltf`,
  modelUnit: 'm',
  previewUrl: '',
  mounting: 'floor',
  layer: 'item',
  colliders: [{ center: { xCm: 0, yCm: size.heightCm / 2, zCm: 0 }, size }],
  license: 'CC0 1.0',
  source: `https://polyhaven.com/a/${id} (${author})`,
});

export const techCatalog: readonly CatalogItem[] = [
  poly('sofa_03', 'Диван', 'Диваны', { widthCm: 273.1, depthCm: 92.5, heightCm: 111.8 }, 'Poly Haven'),
  poly('modern_arm_chair_01', 'Кресло', 'Кресла', { widthCm: 82, depthCm: 98.7, heightCm: 102.3 }, 'Vibrant Nordic'),
  poly('modern_coffee_table_01', 'Журнальный стол', 'Столы', { widthCm: 60, depthCm: 120.2, heightCm: 39 }, 'Amin'),
];

const byId = new Map(techCatalog.map((i) => [i.id, i]));
export const getCatalogItem = (id: Id): CatalogItem | undefined => byId.get(id);
