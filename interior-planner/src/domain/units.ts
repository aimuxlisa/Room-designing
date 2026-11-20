/**
 * Единицы и точность (SPEC §5). Единственное место преобразований см ↔ сцена и см² ↔ м².
 */

/** Геометрический допуск, см. Не связан с округлением подписей. */
export const EPS_CM = 0.01;

/** Сантиметров в одной единице сцены (сцена метрическая: 100 см = 1). */
export const CM_PER_SCENE_UNIT = 100;

export const cmToScene = (cm: number): number => cm / CM_PER_SCENE_UNIT;
export const sceneToCm = (units: number): number => units * CM_PER_SCENE_UNIT;

export const cm2ToM2 = (cm2: number): number => cm2 / 10_000;

/** Единицы длины исходного файла модели. */
export type AssetUnit = 'm' | 'cm' | 'mm';

const CM_PER_ASSET_UNIT: Record<AssetUnit, number> = { m: 100, cm: 1, mm: 0.1 };

/**
 * Масштаб, который переводит модель в единицы сцены. Применяется к ассету один раз (SPEC §5.5):
 * размер в единицах файла × масштаб = размер в единицах сцены.
 */
export const assetToSceneScale = (unit: AssetUnit): number => cmToScene(CM_PER_ASSET_UNIT[unit]);

/** Целые сантиметры для подписи; в проверках не участвует. */
export const formatCm = (cm: number): string => `${Math.round(cm)} см`;

/** Площадь в м² с одним знаком после запятой. */
export const formatM2 = (cm2: number): string =>
  `${cm2ToM2(cm2).toFixed(1).replace('.', ',')} м²`;

/**
 * Разбор пользовательского ввода (D-10): целые сантиметры, принимаются запятая и точка,
 * значение округляется. Возвращает null для пустого, нечислового или бесконечного ввода.
 */
export function parseCmInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) <= EPS_CM;
