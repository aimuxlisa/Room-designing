/**
 * Собственные модели каталога (этап 13; D-11 — светильники собственные). Закрывают то, чего нет
 * у Poly Haven: сантехника, кухонные модули, шкаф, торшер, ковёр, прихожая. Чистые данные без Three.js:
 * детали в сантиметрах, начало координат — центр основания, лицевая сторона +Z, задняя −Z (к стене).
 */

export type OwnMaterial =
  | 'ceramic'
  | 'chrome'
  | 'glass'
  | 'white'
  | 'oak'
  | 'walnut'
  | 'graphite'
  | 'stone'
  | 'shade'
  | 'brass'
  | 'rug'
  | 'rugBorder'
  | 'seam'
  | 'water'
  | 'curtain'
  | 'tulle'
  | 'screen'
  | 'rugBlue';

export type OwnPart =
  | { readonly shape: 'box'; readonly at: readonly [number, number, number]; readonly size: readonly [number, number, number]; readonly mat: OwnMaterial }
  /** Цилиндр по вертикали (или по оси axis); r2 — радиус верха (конус/абажур). */
  | { readonly shape: 'cyl'; readonly at: readonly [number, number, number]; readonly r: number; readonly r2?: number; readonly h: number; readonly axis?: 'x' | 'y' | 'z'; readonly mat: OwnMaterial }
  /** Тор в горизонтальной плоскости (сиденье унитаза). */
  | { readonly shape: 'torus'; readonly at: readonly [number, number, number]; readonly r: number; readonly tube: number; readonly scaleZ?: number; readonly mat: OwnMaterial };

const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: OwnMaterial): OwnPart => ({
  shape: 'box',
  at: [x, y, z],
  size: [w, h, d],
  mat,
});
const cyl = (x: number, y: number, z: number, r: number, h: number, mat: OwnMaterial, r2?: number, axis?: 'x' | 'y' | 'z'): OwnPart => ({
  shape: 'cyl',
  at: [x, y, z],
  r,
  r2,
  h,
  axis,
  mat,
});

/** Корпус с фасадом: короб, швы между дверцами и ручки на лицевой стороне. */
function cabinet(w: number, d: number, h: number, body: OwnMaterial, doors: number, y0 = 0): OwnPart[] {
  const parts: OwnPart[] = [box(0, y0 + h / 2, 0, w, h, d, body)];
  for (let i = 1; i < doors; i++) parts.push(box(-w / 2 + (w * i) / doors, y0 + h / 2, d / 2 + 0.1, 0.4, h - 4, 0.3, 'seam'));
  for (let i = 0; i < doors; i++) {
    const cx = -w / 2 + (w * (i + 0.5)) / doors;
    const hx = doors === 1 ? cx + w / 2 - 6 : cx + (i % 2 === 0 ? w / doors / 2 - 5 : -(w / doors / 2 - 5));
    parts.push(box(hx, y0 + h * 0.6, d / 2 + 1, 1.2, Math.min(14, h / 3), 1.5, 'chrome'));
  }
  return parts;
}

function faucet(x: number, y: number, z: number): OwnPart[] {
  return [cyl(x, y + 8, z, 1.3, 16, 'chrome'), box(x, y + 16, z + 6, 2.4, 2.4, 12, 'chrome')];
}

/** Габаритный короб детали, см: [min, max] по x, y, z. */
function partBounds(p: OwnPart): [[number, number, number], [number, number, number]] {
  const [x, y, z] = p.at;
  let half: [number, number, number];
  if (p.shape === 'box') half = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
  else if (p.shape === 'torus') half = [p.r + p.tube, p.tube, (p.r + p.tube) * (p.scaleZ ?? 1)];
  else {
    const r = Math.max(p.r, p.r2 ?? p.r);
    half = p.axis === 'x' ? [p.h / 2, r, r] : p.axis === 'z' ? [r, r, p.h / 2] : [r, p.h / 2, r];
  }
  return [
    [x - half[0], y - half[1], z - half[2]],
    [x + half[0], y + half[1], z + half[2]],
  ];
}

/**
 * Габариты модели и сдвиг, ставящий центр основания в начало координат (как нормализация GLB).
 * Каталог берёт размер отсюда — размер и геометрия не расходятся (DRY).
 */
export function ownModelFrame(parts: readonly OwnPart[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const [a, b] = partBounds(p);
    for (let i = 0; i < 3; i++) [min[i], max[i]] = [Math.min(min[i], a[i]), Math.max(max[i], b[i])];
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    size: { widthCm: r(max[0] - min[0]), depthCm: r(max[2] - min[2]), heightCm: r(max[1] - min[1]) },
    offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2] as const,
  };
}

/** Предмет каталога нарисован из собственных деталей, а не загружен из файла. */
export const isOwnModel = (item: { readonly modelUrl: string }) => item.modelUrl.startsWith('own:');

export const OWN_MODELS: Readonly<Record<string, readonly OwnPart[]>> = {
  // ---- Ванная ----
  bathtub: [
    box(0, 4, 0, 170, 8, 75, 'ceramic'),
    box(0, 33, 34.5, 170, 50, 6, 'ceramic'),
    box(0, 33, -34.5, 170, 50, 6, 'ceramic'),
    box(82, 33, 0, 6, 50, 63, 'ceramic'),
    box(-82, 33, 0, 6, 50, 63, 'ceramic'),
    box(0, 9, 0, 158, 2, 63, 'water'),
    ...faucet(-70, 58, -30),
  ],
  vanity_sink: [
    ...cabinet(80, 44, 70, 'white', 2, 12),
    box(0, 6, -2, 76, 12, 40, 'graphite'),
    box(0, 84, 0, 80, 4, 46, 'ceramic'),
    cyl(0, 85, 3, 17, 1, 'water'),
    ...faucet(0, 86, -15),
  ],
  shower: [
    box(0, 4, 0, 90, 8, 90, 'ceramic'),
    box(0, 104, 44.5, 90, 192, 1, 'glass'),
    box(44.5, 104, 0, 1, 192, 90, 'glass'),
    box(0, 200, 44.5, 90, 2, 2, 'chrome'),
    cyl(-30, 110, -43, 1.2, 100, 'chrome'),
    cyl(-30, 186, -36, 10, 1.5, 'chrome'),
    box(-30, 186, -40, 2, 2, 8, 'chrome'),
  ],
  towel_rail: [
    cyl(-23, 40, 0, 1.6, 80, 'chrome'),
    cyl(23, 40, 0, 1.6, 80, 'chrome'),
    ...[6, 20, 34, 48, 62, 76].map((y) => cyl(0, y, 0, 1.1, 46, 'chrome', undefined, 'x')),
    box(-23, 70, -4, 3, 3, 6, 'chrome'),
    box(23, 70, -4, 3, 3, 6, 'chrome'),
  ],
  // ---- Туалет ----
  toilet: [
    cyl(0, 20, 6, 13, 40, 'ceramic', 15),
    cyl(0, 38, 8, 18, 4, 'ceramic'),
    { shape: 'torus', at: [0, 41, 8], r: 15, tube: 3, scaleZ: 1.2, mat: 'ceramic' },
    box(0, 41, 8, 26, 0.5, 30, 'water'),
    box(0, 60, -23, 38, 36, 18, 'ceramic'),
    box(0, 78.5, -23, 38, 1, 18, 'ceramic'),
    cyl(0, 79.2, -22, 3, 0.6, 'chrome'),
  ],
  small_sink: [
    cyl(0, 38, -6, 7, 76, 'ceramic', 8),
    box(0, 80, 0, 45, 10, 32, 'ceramic'),
    cyl(0, 85.1, 2, 12, 0.4, 'water'),
    ...faucet(0, 85, -12),
  ],
  wall_cabinet_wc: cabinet(60, 20, 60, 'white', 2),
  // ---- Кухня ----
  fridge: [
    box(0, 92.5, 0, 60, 185, 63, 'white'),
    box(0, 125, 31.6, 58, 0.5, 0.4, 'seam'),
    box(-24, 155, 33, 2, 40, 2.5, 'chrome'),
    box(-24, 80, 33, 2, 50, 2.5, 'chrome'),
    box(0, 2, 30, 56, 4, 3, 'graphite'),
  ],
  kitchen_sink_cabinet: [
    ...cabinet(80, 56, 76, 'white', 2, 10),
    box(0, 5, -2, 76, 10, 52, 'graphite'),
    box(0, 88, 0, 82, 4, 62, 'stone'),
    box(0, 88.2, 4, 48, 4, 36, 'chrome'),
    box(0, 86.4, 4, 44, 0.5, 32, 'water'),
    ...faucet(0, 90, -22),
  ],
  kitchen_base_cabinet: [
    box(0, 48, 0, 60, 76, 56, 'white'),
    ...[30, 54, 72].map((y) => box(0, y + 10, 28.2, 56, 0.4, 0.4, 'seam')),
    ...[24, 46, 66, 80].map((y) => box(0, y, 29.5, 18, 1.2, 1.5, 'chrome')),
    box(0, 5, -2, 56, 10, 52, 'graphite'),
    box(0, 88, 0, 62, 4, 62, 'stone'),
  ],
  kitchen_wall_cabinet: cabinet(60, 35, 70, 'white', 2),
  // ---- Спальня ----
  wardrobe: [...cabinet(120, 58, 210, 'oak', 2, 8), box(0, 4, -2, 116, 8, 54, 'walnut'), box(0, 219, 0, 122, 2, 60, 'oak')],
  // ---- Гостиная ----
  floor_lamp: [
    cyl(0, 1.5, 0, 16, 3, 'graphite'),
    cyl(0, 76, 0, 1.4, 146, 'brass'),
    cyl(0, 147, 0, 20, 26, 'shade', 14),
  ],
  tv_stand: [
    box(0, 27, 0, 160, 38, 40, 'walnut'),
    ...[-26.7, 26.7].map((x) => box(x, 27, 20.2, 0.5, 34, 0.4, 'seam')),
    ...[-70, 70].flatMap((x) => [-15, 15].map((z) => box(x, 4, z, 4, 8, 4, 'graphite'))),
  ],
  rug: [box(0, 0.5, 0, 200, 1, 140, 'rugBorder'), box(0, 0.55, 0, 184, 1, 124, 'rug')],
  // ---- Прихожая ----
  coat_rack: [
    cyl(0, 1.5, 0, 22, 3, 'walnut'),
    cyl(0, 91, 0, 2.2, 176, 'walnut'),
    ...[0, 90, 180, 270].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return box(Math.sin(a) * 9, 170, Math.cos(a) * 9, deg % 180 === 0 ? 2 : 16, 2, deg % 180 === 0 ? 16 : 2, 'walnut');
    }),
  ],
  shoe_cabinet: [
    ...cabinet(80, 30, 96, 'white', 2, 4),
    box(0, 2, 0, 76, 4, 26, 'graphite'),
    box(0, 100.5, 0, 82, 1, 32, 'oak'),
  ],
  // Настольная лампа с абажуром (21.2): основание, стойка, абажур.
  table_lamp: [cyl(0, 1, 0, 8, 2, 'graphite'), cyl(0, 15, 0, 1.2, 26, 'brass'), cyl(0, 36, 0, 14, 18, 'shade', 10)],
  wall_sconce: [
    box(0, 10, -8.5, 10, 20, 3, 'brass'),
    cyl(0, 10, -1, 1, 14, 'brass', undefined, 'z'),
    cyl(0, 12, 4, 7, 14, 'shade', 5),
  ],
  // ---- Текстиль (D-24): шторы и тюль висят на стене, в том числе поверх окна ----
  curtains: [
    cyl(0, 246, -2, 1.5, 230, 'brass', undefined, 'x'),
    ...[-1, 1].flatMap((side) => [0, 1, 2, 3, 4, 5, 6].map((i) => cyl(side * (40 + i * 10), 122, i % 2 ? 1 : -1, 5.5, 240, 'curtain'))),
  ],
  tulle: [cyl(0, 246, -2, 1.5, 230, 'brass', undefined, 'x'), box(0, 123, 1, 210, 242, 0.6, 'tulle')],
  // ---- Ковры ----
  rug_round: [cyl(0, 0.5, 0, 90, 1, 'rugBorder'), cyl(0, 0.55, 0, 80, 1, 'rugBlue')],
  rug_runner: [box(0, 0.5, 0, 250, 1, 80, 'rugBorder'), box(0, 0.55, 0, 236, 1, 66, 'rug')],
  // ---- Техника: плоские телевизоры ----
  tv_flat: [
    box(0, 1, 0, 40, 2, 22, 'graphite'),
    box(0, 8, -2, 6, 14, 4, 'graphite'),
    box(0, 50.5, 0, 123, 71, 4, 'graphite'),
    box(0, 50.5, 2.1, 119, 67, 0.3, 'screen'),
  ],
  tv_wall: [box(0, 35.5, -4, 30, 30, 4, 'graphite'), box(0, 35.5, 0, 123, 71, 4, 'graphite'), box(0, 35.5, 2.1, 119, 67, 0.3, 'screen')],
};
