/** Пределы ввода и размеров (SPEC §3.2). Единственный источник этих чисел. */
export const LIMITS = {
  roomSideCm: { min: 80, max: 1500 },
  ceilingCm: { min: 220, max: 400 },
  door: { widthCm: { min: 60, max: 200 }, heightCm: { min: 190, max: 260 } },
  window: {
    widthCm: { min: 40, max: 300 },
    heightCm: { min: 40, max: 260 },
    sillCm: { min: 0, max: 150 },
  },
  historySteps: 200,
} as const;

export type Range = { readonly min: number; readonly max: number };

export const inRange = (value: number, r: Range): boolean => value >= r.min && value <= r.max;
