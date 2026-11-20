/** Осевые прямоугольники в плоскости XZ, см. Без зависимости от модели квартиры. */

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface Point {
  readonly x: number;
  readonly z: number;
}

export const rectWidth = (r: Rect): number => r.maxX - r.minX;
export const rectDepth = (r: Rect): number => r.maxZ - r.minZ;
export const rectArea = (r: Rect): number => rectWidth(r) * rectDepth(r);

export function boundingRect(points: readonly Point[]): Rect {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** Сдвиг каждой стороны внутрь на свою величину. */
export const insetRect = (
  r: Rect,
  inset: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number },
): Rect => ({
  minX: r.minX + inset.minX,
  maxX: r.maxX - inset.maxX,
  minZ: r.minZ + inset.minZ,
  maxZ: r.maxZ - inset.maxZ,
});

/** Расширение во все стороны (отрезок по оси → полоса шириной 2d, точка → квадрат). */
export const expandRect = (r: Rect, d: number): Rect => insetRect(r, { minX: -d, maxX: -d, minZ: -d, maxZ: -d });

/** Площадь объединения прямоугольников (сжатие координат). */
export function unionArea(rects: readonly Rect[]): number {
  const xs = [...new Set(rects.flatMap((r) => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap((r) => [r.minZ, r.maxZ]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      if (rects.some((r) => cx > r.minX && cx < r.maxX && cz > r.minZ && cz < r.maxZ)) {
        area += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j]);
      }
    }
  }
  return area;
}
