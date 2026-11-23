/**
 * Рабочий каталог (этап 13, D-07; расширен по D-24): 101 изделие без брендов. 21 модель Poly Haven (CC0, GLB после
 * scripts/optimize-models.mjs; габариты измерены, ASSETS.md) и 18 собственных моделей (src/catalog/ownModels.ts)
 * там, где у Poly Haven нет подходящего: сантехника, кухонные модули, шкаф, торшер, ковёр, прихожая.
 * Способы установки — D-05: пол, стена, потолок (только светильники), столешница (только настольная лампа).
 */
import type { CatalogItem, ColliderBox, Id, Mounting, RoomType, Size3Cm } from '../domain/types';
import { OWN_MODELS, ownModelFrame } from './ownModels';

const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number): ColliderBox => ({
  center: { xCm: cx, yCm: cy, zCm: cz },
  size: { widthCm: w, depthCm: d, heightCm: h },
});
const solid = (s: Size3Cm) => [box(0, s.heightCm / 2, 0, s.widthCm, s.heightCm, s.depthCm)];
/** Стул и кресло: сиденье и спинка сзади — под столом помещается сиденье (D-05). */
const chair = (s: Size3Cm, seatCm: number) => [
  box(0, seatCm / 2, 0, s.widthCm, seatCm, s.depthCm),
  box(0, (seatCm + s.heightCm) / 2, -s.depthCm / 2 + 6, s.widthCm, s.heightCm - seatCm, 12),
];
/** Стол: только столешница — под ней стул и ковёр (D-05). */
const table = (s: Size3Cm, topCm = 5) => [box(0, s.heightCm - topCm / 2, 0, s.widthCm, topCm, s.depthCm)];

const LIVING: RoomType[] = ['living', 'kitchen-living'];
const BED: RoomType[] = ['bedroom'];
const KITCHEN: RoomType[] = ['kitchen', 'kitchen-living'];
const BATH: RoomType[] = ['bathroom', 'combined-bathroom'];
const WC: RoomType[] = ['toilet', 'combined-bathroom'];
const HALL: RoomType[] = ['hallway'];
/** Жилые помещения и прихожая — для декора, техники, растений (D-24). */
const HOME: RoomType[] = ['living', 'kitchen-living', 'bedroom', 'hallway', 'kitchen'];
const EVERY: RoomType[] = [...HOME, 'bathroom', 'toilet', 'combined-bathroom'];

interface Spec {
  readonly name: string;
  readonly category: string;
  readonly rooms: readonly RoomType[];
  readonly mounting?: Mounting;
  readonly mountHeightCm?: number;
  readonly layer?: CatalogItem['layer'];
  readonly colliders?: (s: Size3Cm) => readonly ColliderBox[];
  /** Поворот модели в файле, чтобы лицевая сторона смотрела в +Z. */
  readonly yaw?: number;
  /** Можно вешать поверх окна (шторы, тюль) — D-24. */
  readonly overOpenings?: boolean;
}

const polyHaven = (id: string, size: Size3Cm, spec: Spec): CatalogItem => ({
  id,
  version: 1,
  category: spec.category,
  name: spec.name,
  roomTypes: spec.rooms,
  size,
  modelUrl: `/models/${id}/${id}.glb`,
  modelUnit: 'm',
  previewUrl: `/previews/${id}.jpg`,
  mounting: spec.mounting ?? 'floor',
  mountHeightCm: spec.mountHeightCm,
  modelYawDeg: spec.yaw,
  overOpenings: spec.overOpenings,
  layer: spec.layer ?? 'item',
  colliders: (spec.colliders ?? solid)(size),
  license: 'CC0 1.0',
  source: `https://polyhaven.com/a/${id}`,
});

const own = (id: string, spec: Spec): CatalogItem => {
  const { size } = ownModelFrame(OWN_MODELS[id]);
  return {
    id,
    version: 1,
    category: spec.category,
    name: spec.name,
    roomTypes: spec.rooms,
    size,
    modelUrl: `own:${id}`,
    modelUnit: 'cm',
    previewUrl: `/previews/${id}.jpg`,
    mounting: spec.mounting ?? 'floor',
    mountHeightCm: spec.mountHeightCm,
  modelYawDeg: spec.yaw,
  overOpenings: spec.overOpenings,
    layer: spec.layer ?? 'item',
    colliders: (spec.colliders ?? solid)(size),
    license: 'собственная',
    source: 'Собственная модель: src/catalog/ownModels.ts',
  };
};

const s = (widthCm: number, depthCm: number, heightCm: number): Size3Cm => ({ widthCm, depthCm, heightCm });

export const catalog: readonly CatalogItem[] = [
  // Гостиная
  polyHaven('sofa_03', s(273.1, 92.5, 111.8), { name: 'Диван угловой', category: 'Диваны', rooms: LIVING }),
  polyHaven('sofa_02', s(180.7, 81.8, 71), { name: 'Диван', category: 'Диваны', rooms: LIVING }),
  polyHaven('modern_arm_chair_01', s(82, 98.7, 102.3), { name: 'Кресло', category: 'Кресла и стулья', rooms: LIVING, colliders: (x) => chair(x, 42) }),
  polyHaven('ArmChair_01', s(84.8, 76.6, 106.5), { name: 'Кресло классическое', category: 'Кресла и стулья', rooms: [...LIVING, ...BED], colliders: (x) => chair(x, 45) }),
  polyHaven('GreenChair_01', s(67.3, 66.4, 105.9), { name: 'Кресло зелёное', category: 'Кресла и стулья', rooms: [...LIVING, ...BED], colliders: (x) => chair(x, 45) }),
  polyHaven('modern_coffee_table_01', s(60, 120.2, 39), { name: 'Журнальный стол', category: 'Столы', rooms: LIVING, colliders: (x) => table(x) }),
  polyHaven('CoffeeTable_01', s(154, 97.3, 52.3), { name: 'Журнальный стол большой', category: 'Столы', rooms: LIVING, colliders: (x) => table(x) }),
  own('tv_stand', { name: 'Тумба под ТВ', category: 'Хранение', rooms: LIVING }),
  own('rug', { name: 'Ковёр', category: 'Ковры', rooms: [...LIVING, ...BED, ...HALL], layer: 'floor-covering' }),
  own('floor_lamp', { name: 'Торшер', category: 'Светильники', rooms: [...LIVING, ...BED] }),
  polyHaven('Chandelier_02', s(67.9, 61.9, 84.8), { name: 'Люстра', category: 'Светильники', rooms: [...LIVING, ...BED], mounting: 'ceiling' }),
  polyHaven('vintage_oil_lamp', s(22, 22, 80.2), { name: 'Настольная лампа', category: 'Светильники', rooms: [...LIVING, ...BED], mounting: 'tabletop' }),
  // Спальня
  polyHaven('GothicBed_01', s(149.4, 204, 153.4), { name: 'Кровать двуспальная', category: 'Кровати', rooms: BED }),
  polyHaven('ClassicNightstand_01', s(56.8, 42.4, 70), { name: 'Тумба прикроватная', category: 'Хранение', rooms: BED }),
  polyHaven('painted_wooden_nightstand', s(50.5, 50.9, 61.6), { name: 'Тумба крашеная', category: 'Хранение', rooms: BED }),
  polyHaven('GothicCommode_01', s(120.1, 58.1, 121.2), { name: 'Комод', category: 'Хранение', rooms: BED }),
  polyHaven('Ottoman_01', s(88.5, 62.1, 62.4), { name: 'Пуф', category: 'Кресла и стулья', rooms: [...BED, ...LIVING] }),
  own('wardrobe', { name: 'Шкаф платяной', category: 'Хранение', rooms: [...BED, ...HALL] }),
  // Кухня
  polyHaven('round_wooden_table_02', s(79.6, 79.6, 74.6), { name: 'Стол круглый', category: 'Столы', rooms: KITCHEN, colliders: (x) => table(x) }),
  polyHaven('dining_chair_02', s(43.4, 57.6, 97.3), { name: 'Стул', category: 'Кресла и стулья', rooms: KITCHEN, colliders: (x) => chair(x, 46) }),
  polyHaven('electric_stove', s(50.3, 64.8, 85.9), { name: 'Плита электрическая', category: 'Кухня', rooms: KITCHEN }),
  own('fridge', { name: 'Холодильник', category: 'Кухня', rooms: KITCHEN }),
  own('kitchen_sink_cabinet', { name: 'Тумба с мойкой', category: 'Кухня', rooms: KITCHEN }),
  own('kitchen_base_cabinet', { name: 'Тумба кухонная', category: 'Кухня', rooms: KITCHEN }),
  own('kitchen_wall_cabinet', { name: 'Шкаф навесной кухонный', category: 'Кухня', rooms: KITCHEN, mounting: 'wall', mountHeightCm: 145 }),
  polyHaven('modern_ceiling_lamp_01', s(43.2, 43.2, 95.2), { name: 'Подвесной светильник', category: 'Светильники', rooms: [...KITCHEN, ...HALL], mounting: 'ceiling' }),
  // Ванная и туалет
  own('bathtub', { name: 'Ванна', category: 'Сантехника', rooms: BATH }),
  own('shower', { name: 'Душевой уголок', category: 'Сантехника', rooms: BATH }),
  own('vanity_sink', { name: 'Тумба с раковиной', category: 'Сантехника', rooms: BATH }),
  own('towel_rail', { name: 'Полотенцесушитель', category: 'Сантехника', rooms: [...BATH, ...WC], mounting: 'wall', mountHeightCm: 90 }),
  own('toilet', { name: 'Унитаз', category: 'Сантехника', rooms: WC }),
  own('small_sink', { name: 'Раковина малая', category: 'Сантехника', rooms: WC }),
  own('wall_cabinet_wc', { name: 'Шкафчик навесной', category: 'Хранение', rooms: [...WC, ...BATH], mounting: 'wall', mountHeightCm: 140 }),
  // Прихожая
  polyHaven('ClassicConsole_01', s(154.3, 58.9, 94.9), { name: 'Консоль', category: 'Хранение', rooms: [...HALL, ...LIVING] }),
  polyHaven('Shelf_01', s(100.3, 25.7, 208), { name: 'Стеллаж', category: 'Хранение', rooms: [...HALL, ...LIVING] }),
  polyHaven('painted_wooden_cabinet_02', s(99.7, 72.3, 256.9), { name: 'Шкаф высокий', category: 'Хранение', rooms: HALL }),
  own('coat_rack', { name: 'Вешалка напольная', category: 'Прихожая', rooms: HALL }),
  own('shoe_cabinet', { name: 'Обувница', category: 'Прихожая', rooms: HALL }),
  own('wall_sconce', { name: 'Бра', category: 'Светильники', rooms: [...HALL, ...BED, ...LIVING], mounting: 'wall', mountHeightCm: 165 }),
  // ---- Расширение каталога (D-24): декор, картины, часы, растения, техника, мебель, свет — Poly Haven ----
  polyHaven('ceramic_vase_01', s(20.4, 20.4, 40), { name: 'Ваза керамическая', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('ceramic_vase_02', s(21.8, 21.8, 30.9), { name: 'Ваза керамическая круглая', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('ceramic_vase_03', s(11.2, 11.2, 41.4), { name: 'Ваза узкая', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('ceramic_vase_04', s(18.1, 18.1, 34.2), { name: 'Ваза керамическая малая', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('antique_ceramic_vase_01', s(25.5, 25.5, 44), { name: 'Ваза антикварная', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('brass_vase_01', s(22.7, 22.7, 69.2), { name: 'Ваза латунная напольная', category: 'Вазы', rooms: HOME }),
  polyHaven('brass_vase_02', s(21, 21, 52.9), { name: 'Ваза латунная', category: 'Вазы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('marble_bust_01', s(27.2, 30, 51.5), { name: 'Бюст мраморный', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('horse_statue_01', s(16.3, 10.8, 22), { name: 'Статуэтка «Лошадь»', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('carved_wooden_elephant', s(10.9, 5.8, 9.6), { name: 'Статуэтка «Слон»', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('concrete_cat_statue', s(15.3, 25, 28.3), { name: 'Статуэтка «Кошка»', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('bronze_shark_statue', s(35.2, 76, 43.2), { name: 'Скульптура «Акула»', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('book_encyclopedia_set_01', s(55.1, 16.3, 23.7), { name: 'Книги', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('wooden_bowl_01', s(31.3, 30.9, 9.4), { name: 'Чаша деревянная', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('carved_wooden_plate', s(27.2, 26.9, 3.8), { name: 'Блюдо резное', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('tea_set_01', s(91.8, 48.4, 16.5), { name: 'Чайный сервиз на подносе', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('wooden_candlestick', s(9.7, 9.9, 22), { name: 'Подсвечник', category: 'Декор', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('hanging_picture_frame_01', s(59.4, 1.6, 84.1), { name: 'Картина вертикальная', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 120 }),
  polyHaven('hanging_picture_frame_02', s(75.2, 3.3, 50), { name: 'Картина горизонтальная', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 140 }),
  polyHaven('hanging_picture_frame_03', s(38.5, 3.2, 50.2), { name: 'Картина малая', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 140 }),
  polyHaven('fancy_picture_frame_01', s(60.3, 2, 46.4), { name: 'Картина в багете', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 140 }),
  polyHaven('fancy_picture_frame_02', s(66.1, 8.9, 77.1), { name: 'Картина в резной раме', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 130 }),
  polyHaven('standing_picture_frame_01', s(20.1, 10, 25), { name: 'Фоторамка', category: 'Картины и зеркала', rooms: HOME, mounting: 'tabletop', yaw: -90 }),
  polyHaven('standing_picture_frame_02', s(21.7, 10.2, 26.6), { name: 'Фоторамка резная', category: 'Картины и зеркала', rooms: HOME, mounting: 'tabletop', yaw: -90 }),
  polyHaven('ornate_mirror_01', s(48.7, 2.6, 74.4), { name: 'Зеркало в раме', category: 'Картины и зеркала', rooms: EVERY, mounting: 'wall', mountHeightCm: 110 }),
  polyHaven('wall_clock', s(32, 4.7, 32), { name: 'Часы настенные', category: 'Часы', rooms: EVERY, mounting: 'wall', mountHeightCm: 170 }),
  polyHaven('mantel_clock_01', s(34.2, 12.6, 16), { name: 'Часы каминные', category: 'Часы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('alarm_clock_01', s(13.2, 6.7, 17.4), { name: 'Будильник', category: 'Часы', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('vintage_grandfather_clock_01', s(62.6, 42.7, 219.1), { name: 'Часы напольные', category: 'Часы', rooms: HOME }),
  polyHaven('potted_plant_01', s(58.7, 63.4, 135), { name: 'Растение в кадке большое', category: 'Растения', rooms: EVERY }),
  polyHaven('potted_plant_02', s(70.1, 65.7, 84.1), { name: 'Растение в кадке', category: 'Растения', rooms: EVERY }),
  polyHaven('potted_plant_04', s(16.8, 18.5, 26.7), { name: 'Суккулент в горшке', category: 'Растения', rooms: EVERY, mounting: 'tabletop' }),
  polyHaven('Television_01', s(60, 47.1, 45.7), { name: 'Телевизор ретро', category: 'Техника', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('television_02', s(40, 35, 41.1), { name: 'Телевизор ретро малый', category: 'Техника', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('boombox', s(72.4, 18.6, 47), { name: 'Магнитола', category: 'Техника', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('gaming_console', s(32.5, 31.9, 10), { name: 'Игровая приставка', category: 'Техника', rooms: HOME, mounting: 'tabletop' }),
  polyHaven('ceiling_fan', s(146.3, 146.3, 51.6), { name: 'Потолочный вентилятор', category: 'Техника', rooms: HOME, mounting: 'ceiling' }),
  polyHaven('Sofa_01', s(157.1, 65.8, 79.7), { name: 'Диван двухместный', category: 'Диваны', rooms: [...LIVING, ...BED] }),
  polyHaven('chinese_sofa', s(228.5, 96.9, 86), { name: 'Диван резной', category: 'Диваны', rooms: LIVING }),
  polyHaven('Rockingchair_01', s(70.8, 83.4, 99.5), { name: 'Кресло-качалка', category: 'Кресла и стулья', rooms: [...LIVING, ...BED], colliders: (x) => chair(x, 42) }),
  polyHaven('chinese_stool', s(59.9, 50.6, 63.1), { name: 'Табурет резной', category: 'Кресла и стулья', rooms: HOME }),
  polyHaven('metal_stool_02', s(44.8, 47.3, 45.8), { name: 'Табурет металлический', category: 'Кресла и стулья', rooms: [...KITCHEN, ...HALL] }),
  polyHaven('side_table_01', s(55, 45, 55.1), { name: 'Столик приставной', category: 'Столы', rooms: HOME, colliders: (x) => table(x) }),
  polyHaven('small_wooden_table_01', s(91.6, 44, 53.3), { name: 'Столик деревянный', category: 'Столы', rooms: HOME, colliders: (x) => table(x) }),
  polyHaven('coffee_table_round_01', s(130.1, 130.1, 49.1), { name: 'Журнальный стол круглый', category: 'Столы', rooms: LIVING, colliders: (x) => table(x) }),
  polyHaven('modern_coffee_table_02', s(119.9, 120, 36.9), { name: 'Журнальный стол квадратный', category: 'Столы', rooms: LIVING, colliders: (x) => table(x) }),
  polyHaven('chinese_console_table', s(172, 33.9, 66.1), { name: 'Консоль узкая', category: 'Хранение', rooms: [...HALL, ...LIVING] }),
  polyHaven('WoodenTable_03', s(132.7, 57.5, 83), { name: 'Буфет', category: 'Хранение', rooms: [...LIVING, ...KITCHEN] }),
  polyHaven('drawer_cabinet', s(114.1, 48.8, 188.1), { name: 'Шкаф с ящиками', category: 'Хранение', rooms: HOME }),
  polyHaven('GothicCabinet_01', s(171.9, 111.7, 236.1), { name: 'Шкаф-витрина', category: 'Хранение', rooms: LIVING }),
  polyHaven('wooden_display_shelves_01', s(107.8, 37.1, 155.6), { name: 'Полки-витрина', category: 'Хранение', rooms: HOME, yaw: -90 }),
  polyHaven('Chandelier_01', s(74.6, 81.6, 79.8), { name: 'Люстра классическая', category: 'Светильники', rooms: [...LIVING, ...BED], mounting: 'ceiling' }),
  polyHaven('Chandelier_03', s(78, 78.5, 104.1), { name: 'Люстра большая', category: 'Светильники', rooms: LIVING, mounting: 'ceiling' }),
  polyHaven('chinese_chandelier', s(87.8, 87.9, 74.8), { name: 'Люстра-фонарь', category: 'Светильники', rooms: [...LIVING, ...BED], mounting: 'ceiling' }),
  polyHaven('hanging_industrial_lamp', s(55, 55, 135.5), { name: 'Подвесной светильник лофт', category: 'Светильники', rooms: [...KITCHEN, ...LIVING, ...HALL], mounting: 'ceiling' }),
  polyHaven('desk_lamp_arm_01', s(20.2, 61.4, 89.3), { name: 'Лампа настольная на кронштейне', category: 'Светильники', rooms: HOME, mounting: 'tabletop' }),
  // ---- Собственные: шторы, ковры, плоские телевизоры (D-24) ----
  own('curtains', { name: 'Шторы', category: 'Шторы', rooms: HOME, mounting: 'wall', mountHeightCm: 2, overOpenings: true }),
  own('tulle', { name: 'Тюль', category: 'Шторы', rooms: HOME, mounting: 'wall', mountHeightCm: 2, overOpenings: true }),
  own('rug_round', { name: 'Ковёр круглый', category: 'Ковры', rooms: HOME, layer: 'floor-covering' }),
  own('rug_runner', { name: 'Ковровая дорожка', category: 'Ковры', rooms: [...HALL, ...LIVING, ...BED], layer: 'floor-covering' }),
  own('tv_flat', { name: 'Телевизор плоский 55″ на подставке', category: 'Техника', rooms: HOME, mounting: 'tabletop' }),
  own('tv_wall', { name: 'Телевизор плоский 55″ настенный', category: 'Техника', rooms: HOME, mounting: 'wall', mountHeightCm: 100 }),
];

const byId = new Map(catalog.map((i) => [i.id, i]));
export const getCatalogItem = (id: Id): CatalogItem | undefined => byId.get(id);

/** Подходит ли предмет комнате: совмещённые помещения получают предметы обеих частей. */
export function itemFitsRoom(item: CatalogItem, roomType: RoomType): boolean {
  return item.roomTypes.includes(roomType);
}
