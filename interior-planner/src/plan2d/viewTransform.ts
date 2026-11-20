/** Преобразование план ↔ экран. Единственное место перевода координат указателя (SPEC §10.1). */
import type { Point, Rect } from '../geometry/rect';
import { rectDepth, rectWidth } from '../geometry/rect';

export interface ViewTransform {
  /** Пикселей на сантиметр. */
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export function fitTransform(content: Rect, viewW: number, viewH: number, paddingPx = 40): ViewTransform {
  const scale = Math.min((viewW - 2 * paddingPx) / rectWidth(content), (viewH - 2 * paddingPx) / rectDepth(content));
  return {
    scale,
    offsetX: (viewW - rectWidth(content) * scale) / 2 - content.minX * scale,
    offsetY: (viewH - rectDepth(content) * scale) / 2 - content.minZ * scale,
  };
}

export const toScreen = (t: ViewTransform, p: Point) => ({ x: p.x * t.scale + t.offsetX, y: p.z * t.scale + t.offsetY });
export const toWorld = (t: ViewTransform, s: { x: number; y: number }): Point => ({
  x: (s.x - t.offsetX) / t.scale,
  z: (s.y - t.offsetY) / t.scale,
});

export const panBy = (t: ViewTransform, dx: number, dy: number): ViewTransform => ({
  ...t,
  offsetX: t.offsetX + dx,
  offsetY: t.offsetY + dy,
});

/** Пределы масштаба плана, пикселей на см. */
export const SCALE_RANGE = { min: 0.05, max: 20 } as const;

/** Масштаб колесом вокруг точки экрана: точка под указателем остаётся на месте. */
export function zoomAt(t: ViewTransform, screen: { x: number; y: number }, factor: number): ViewTransform {
  const world = toWorld(t, screen);
  const scale = Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, t.scale * factor));
  return { scale, offsetX: screen.x - world.x * scale, offsetY: screen.y - world.z * scale };
}
