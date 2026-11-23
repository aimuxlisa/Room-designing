/** Отделка дверей и окон (D-26): цвет полотна двери и рамы окна; без выбора — значение по умолчанию. */
import type { Id, Opening } from '../domain/types';

export interface OpeningFinish {
  readonly id: Id;
  readonly name: string;
  readonly color: string;
  readonly roughness: number;
}

export const DOOR_FINISHES: readonly OpeningFinish[] = [
  { id: 'walnut', name: 'Орех', color: '#6b4a33', roughness: 0.55 },
  { id: 'oak', name: 'Дуб', color: '#b88c5c', roughness: 0.6 },
  { id: 'white', name: 'Белая', color: '#eeede8', roughness: 0.45 },
  { id: 'graphite', name: 'Графит', color: '#3c3f44', roughness: 0.5 },
];

export const WINDOW_FINISHES: readonly OpeningFinish[] = [
  { id: 'white', name: 'Белая', color: '#f1f1ee', roughness: 0.4 },
  { id: 'graphite', name: 'Графит', color: '#3a3d42', roughness: 0.45 },
  { id: 'oak', name: 'Дерево', color: '#9a6f45', roughness: 0.6 },
];

/** Отделка проёма: выбранная или первая в списке для его вида. */
export function openingFinish(o: Opening): OpeningFinish {
  const list = o.kind === 'door' ? DOOR_FINISHES : WINDOW_FINISHES;
  return list.find((f) => f.id === o.finishId) ?? list[0];
}
