/** Команды над квартирой в целом. */
import type { CatalogLookup } from '../domain/furniture';
import type { Apartment } from '../domain/types';
import type { Command } from './change';

/**
 * Высота потолка одна на квартиру (D-04); проверки проёмов и 3D берут её из модели.
 * С каталогом потолочные светильники и люстры остаются на потолке: их высота пересчитывается.
 */
export const setCeilingHeight = (ceilingCm: number, getItem?: CatalogLookup): Command => ({
  label: 'Высота потолка',
  apply(ap) {
    if (!getItem) return { ...ap, ceilingCm };
    const furniture: Apartment['furniture'] = Object.fromEntries(
      Object.values(ap.furniture).map((f) => {
        const item = getItem(f.catalogItemId);
        return [f.id, item?.mounting === 'ceiling' ? { ...f, position: { ...f.position, yCm: ceilingCm - item.size.heightCm } } : f];
      }),
    );
    return { ...ap, ceilingCm, furniture };
  },
});
