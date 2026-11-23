/**
 * Материалы отделки стен (SPEC §13, этап 12). Краски — собственные образцы цвета.
 * Обои — бесплатные ткани Poly Haven (решение пользователя, CC0): диффузная карта 1k, размер повтора —
 * физические размеры из API Poly Haven (мм → см). Цвет — средний цвет текстуры (полоса на плане, образец).
 */
import type { Id, MaterialDefinition } from '../domain/types';

const paint = (id: string, name: string, color: string): MaterialDefinition => ({
  id: `paint-${id}`,
  kind: 'paint',
  name,
  color,
  roughness: 0.92,
});

const fabric = (id: string, file: string, name: string, color: string, widthMm: number, heightMm: number): MaterialDefinition => ({
  id: `wallpaper-${id}`,
  kind: 'wallpaper',
  name,
  color,
  textureUrl: `/textures/${file}`,
  tileSizeCm: { widthCm: widthMm / 10, heightCm: heightMm / 10 },
  roughness: 0.85,
  source: `https://polyhaven.com/a/${id} (CC0)`,
});

export const wallMaterials: readonly MaterialDefinition[] = [
  paint('white', 'Белая', '#f2f0eb'),
  paint('warm', 'Тёплая белая', '#efe6d6'),
  paint('grey', 'Светло-серая', '#c9c9c4'),
  paint('beige', 'Бежевая', '#d8c6a8'),
  paint('sage', 'Шалфей', '#a9b59a'),
  paint('blue', 'Голубая', '#a8c0d6'),
  paint('terracotta', 'Терракота', '#c07a5c'),
  paint('graphite', 'Графит', '#4a4d52'),
  fabric('terlenka', 'terlenka_diff_1k.jpg', 'Терленка, бежевая', '#c5ae99', 265.71, 266.3),
  fabric('poly_wool_herringbone', 'poly_wool_herringbone_diff_1k.jpg', 'Ёлочка, серая', '#797571', 270.08, 275.7),
  fabric('gingham_check', 'gingham_check_diff_1k.jpg', 'Клетка виши', '#799184', 283.65, 296.8),
  fabric('fabric_pattern_05', 'fabric_pattern_05_col_01_1k.jpg', 'Шотландка оливковая', '#949785', 500, 500),
  fabric('waffle_pique_cotton', 'waffle_pique_cotton_diff_1k.jpg', 'Вафельный хлопок', '#e19c04', 280.79, 276.8),
  fabric('quatrefoil_jacquard_fabric', 'quatrefoil_jacquard_fabric_diff_1k.jpg', 'Жаккард бордовый', '#930320', 280.12, 283.8),
];

const byId = new Map(wallMaterials.map((m) => [m.id, m]));
export const getWallMaterial = (id: Id): MaterialDefinition | undefined => byId.get(id);
