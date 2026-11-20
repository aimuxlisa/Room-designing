/** Ввод примерной площади и подбор схем (задачи 7.1, 7.3). */
import type { LayoutTemplate } from '../domain/types';
import { cm2ToM2 } from '../domain/units';
import { layoutTemplates, templateAreaCm2 } from './templates';

export const AREA_RANGE_M2 = { min: 15, max: 250 } as const;

export type AreaInput = { readonly ok: true; readonly m2: number } | { readonly ok: false; readonly error: string };

/** Площадь в м²: запятая и точка, до одного знака после запятой. */
export function parseAreaM2(text: string): AreaInput {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return { ok: false, error: 'Введите площадь в м², например 45 или 45,5' };
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, error: 'Только число в м², например 45 или 45,5' };
  const m2 = Math.round(Number(normalized) * 10) / 10;
  if (m2 < AREA_RANGE_M2.min || m2 > AREA_RANGE_M2.max)
    return { ok: false, error: `Площадь должна быть от ${AREA_RANGE_M2.min} до ${AREA_RANGE_M2.max} м²` };
  return { ok: true, m2 };
}

export interface Candidate {
  readonly template: LayoutTemplate;
  readonly areaM2: number;
  readonly diffM2: number;
}

/** Схемы выбранной комнатности по близости площади к введённой. */
export function rankTemplates(livingRooms: 1 | 2 | 3, targetM2: number): Candidate[] {
  return layoutTemplates
    .filter((t) => t.livingRooms === livingRooms)
    .map((template) => {
      const areaM2 = Math.round(cm2ToM2(templateAreaCm2(template)) * 10) / 10;
      return { template, areaM2, diffM2: Math.round((areaM2 - targetM2) * 10) / 10 };
    })
    .sort((a, b) => Math.abs(a.diffM2) - Math.abs(b.diffM2));
}
