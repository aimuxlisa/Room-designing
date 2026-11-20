/** Полный реестр проверок приложения — одно место сборки (DRY, OCP). */
import { apartmentValidators } from './apartmentChecks';
import { furnitureValidators, type CatalogLookup } from './furniture';
import { integrityValidators } from './integrity';
import { staged, type Validator } from './validation';

/** Сначала целостность данных, затем геометрия квартиры и мебели. */
export const createValidators = (catalog: CatalogLookup): readonly Validator[] => [
  staged(integrityValidators, [...apartmentValidators, ...furnitureValidators(catalog)]),
];
