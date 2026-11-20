/** Команды над квартирой в целом. */
import type { Command } from './change';

/** Высота потолка одна на квартиру (D-04); проверки проёмов и 3D берут её из модели. */
export const setCeilingHeight = (ceilingCm: number): Command => ({
  label: 'Высота потолка',
  apply: (ap) => ({ ...ap, ceilingCm }),
});
