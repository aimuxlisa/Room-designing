/**
 * Материалы отделки (SPEC §13, этапы 12 и 23; D-24, D-25). Краски — собственные образцы цвета.
 * Текстуры — Poly Haven (CC0): диффузная карта 1k в WebP (scripts/fetch-textures.mjs), размер повтора —
 * физические размеры из API Poly Haven, цвет — средний цвет текстуры (полоса и заливка на плане, образец).
 */
import type { FinishKind, Id, MaterialDefinition } from '../domain/types';

const paint = (id: string, name: string, color: string): MaterialDefinition => ({
  id: `paint-${id}`,
  kind: 'paint',
  name,
  color,
  roughness: 0.92,
});

/** Текстура Poly Haven: id материала = `${prefix}-${id ассета}`, файл public/textures/<id>.webp. */
const ph =
  (prefix: string, kind: FinishKind, roughness: number) =>
  (id: string, name: string, color: string, widthCm: number, heightCm = widthCm): MaterialDefinition => ({
    id: `${prefix}-${id}`,
    kind,
    name,
    color,
    textureUrl: `/textures/${id}.webp`,
    tileSizeCm: { widthCm, heightCm },
    roughness,
    source: `https://polyhaven.com/a/${id} (CC0)`,
  });

const fabric = ph('wallpaper', 'wallpaper', 0.85);
const tile = ph('wall', 'tile', 0.35);
const plaster = ph('wall', 'plaster', 0.9);
const brick = ph('wall', 'brick', 0.85);

export const wallMaterials: readonly MaterialDefinition[] = [
  paint('white', 'Белая', '#f2f0eb'),
  paint('warm', 'Тёплая белая', '#efe6d6'),
  paint('grey', 'Светло-серая', '#c9c9c4'),
  paint('beige', 'Бежевая', '#d8c6a8'),
  paint('sage', 'Шалфей', '#a9b59a'),
  paint('blue', 'Голубая', '#a8c0d6'),
  paint('terracotta', 'Терракота', '#c07a5c'),
  paint('graphite', 'Графит', '#4a4d52'),
  // Обои — ткани Poly Haven (решение пользователя, SPEC §13).
  fabric('terlenka', 'Терленка, бежевая', '#c5ae99', 26.571, 26.63),
  fabric('poly_wool_herringbone', 'Ёлочка, серая', '#797571', 27.008, 27.57),
  fabric('gingham_check', 'Клетка виши', '#799184', 28.365, 29.68),
  fabric('fabric_pattern_05', 'Шотландка оливковая', '#949785', 50, 50),
  fabric('fabric_pattern_07', 'Клетка тканая', '#5d7173', 40, 40),
  fabric('rough_linen', 'Лён голубой', '#91abcd', 27.1, 27.1),
  fabric('curly_teddy_checkered', 'Тедди в клетку', '#8e9b90', 56.2, 47.4),
  fabric('waffle_pique_cotton', 'Вафельный хлопок', '#e19c04', 28.079, 27.68),
  fabric('quatrefoil_jacquard_fabric', 'Жаккард бордовый', '#930320', 28.012, 28.38),
  // Плитка, штукатурка, кирпич (D-24).
  tile('long_white_tiles', 'Плитка белая вытянутая', '#cdc6b6', 127),
  tile('rounded_square_tiled_wall', 'Плитка квадратная', '#857665', 200),
  tile('stone_tile_wall', 'Плитка каменная', '#aaa5a0', 200),
  plaster('plastered_wall', 'Штукатурка', '#b0a89c', 200),
  plaster('white_stucco', 'Штукатурка белая', '#d7d3d0', 199.8),
  plaster('patterned_plaster_wall', 'Штукатурка под кирпич', '#b59a85', 180),
  brick('brick_wall_13', 'Кирпич серый', '#7f776c', 200),
  brick('whitewashed_brick', 'Кирпич белёный', '#a6998c', 200),
  brick('red_brick', 'Кирпич красный', '#8e6750', 140),
];

const laminate = ph('floor', 'laminate', 0.6);
const parquet = ph('floor', 'parquet', 0.55);
const stone = ph('floor', 'stone', 0.3);
const linoleum = ph('floor', 'linoleum', 0.5);
const carpet = ph('floor', 'carpet', 0.95);

/** Покрытия пола на комнату (D-16, источник текстур — D-25). */
export const floorMaterials: readonly MaterialDefinition[] = [
  laminate('laminate_floor', 'Ламинат светлый', '#957345', 200),
  laminate('laminate_floor_02', 'Ламинат серо-бежевый', '#9b8063', 170),
  laminate('laminate_floor_03', 'Ламинат медовый', '#9a7248', 208),
  laminate('oak_wood_planks', 'Доска дубовая', '#a27554', 120),
  laminate('wood_floor', 'Доска тёмная', '#806042', 170),
  laminate('white_planks_clean', 'Доска белёная', '#b4a69d', 180),
  laminate('dark_wooden_planks', 'Доска венге', '#534a3f', 200),
  parquet('herringbone_parquet', 'Паркет ёлочка', '#93704d', 340),
  parquet('diagonal_parquet', 'Паркет диагональный', '#a46636', 236),
  parquet('rectangular_parquet', 'Паркет прямоугольный', '#775c33', 225),
  stone('floor_tiles_06', 'Плитка серая', '#796f6b', 300),
  stone('interior_tiles', 'Плитка бежевая', '#aa9884', 190),
  stone('square_tiles_02', 'Плитка тёмная квадратная', '#504942', 240),
  stone('marble_01', 'Мрамор', '#b19d7a', 150),
  stone('marble_mosaic_tiles', 'Мозаика мраморная', '#816d5e', 200),
  stone('terrazzo_tiles', 'Терраццо', '#896d57', 200),
  stone('terracotta_floor_tiles', 'Терракота', '#4d271a', 208),
  stone('granite_tile', 'Гранит', '#4e4e4f', 230),
  linoleum('linoleum_brown', 'Линолеум', '#997a59', 200),
  carpet('curly_teddy_natural', 'Ковролин натуральный', '#e9d3bb', 33.6, 33.1),
  carpet('wool_boucle', 'Ковролин букле', '#766d61', 31.5, 39),
  carpet('caban', 'Ковролин оранжевый', '#ce6604', 27.4, 27.3),
];

const byId = new Map([...wallMaterials, ...floorMaterials].map((m) => [m.id, m]));
export const getWallMaterial = (id: Id): MaterialDefinition | undefined => byId.get(id);
export const getMaterial = getWallMaterial;

/** Группы образцов в панели отделки. */
export const WALL_GROUPS: readonly { title: string; kinds: readonly FinishKind[] }[] = [
  { title: 'Краска', kinds: ['paint'] },
  { title: 'Обои (ткани Poly Haven)', kinds: ['wallpaper'] },
  { title: 'Плитка, штукатурка, кирпич', kinds: ['tile', 'plaster', 'brick'] },
];
export const FLOOR_GROUPS: readonly { title: string; kinds: readonly FinishKind[] }[] = [
  { title: 'Ламинат и доска', kinds: ['laminate'] },
  { title: 'Паркет', kinds: ['parquet'] },
  { title: 'Плитка и камень', kinds: ['stone'] },
  { title: 'Линолеум', kinds: ['linoleum'] },
  { title: 'Ковролин', kinds: ['carpet'] },
];
