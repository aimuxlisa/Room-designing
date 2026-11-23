/**
 * Команда изменения проёма (SPEC §9, D-04). Перенос на другую стену и смена связанной комнаты
 * не входят в первую версию — поля в патче только положение, ширина, высота, подоконник и створка.
 */
import type { Apartment, DoorSwing, Id, Opening } from '../domain/types';
import type { Command } from './change';

export interface OpeningPatch {
  readonly offsetCm?: number;
  readonly widthCm?: number;
  readonly heightCm?: number;
  /** Только окно. */
  readonly sillCm?: number;
  /** Только дверь: петля слева или справа по направлению стены (D-04, 9.5). */
  readonly hinge?: DoorSwing;
  /** Только дверь: комната, куда открывается створка; null — наружу. */
  readonly opensIntoRoomId?: Id | null;
}

/** Изменяет один проём; поля, не относящиеся к виду проёма, игнорируются. */
export function patchOpening(id: Id, patch: OpeningPatch): Command {
  return {
    label: 'Изменение проёма',
    apply(ap: Apartment) {
      const o = ap.openings[id];
      if (!o) throw new Error(`Проём ${id} не найден`);
      const { sillCm, hinge, opensIntoRoomId, ...common } = patch;
      const kind =
        o.kind === 'window'
          ? { sillCm: sillCm ?? o.sillCm }
          : { hinge: hinge ?? o.hinge, opensIntoRoomId: opensIntoRoomId === undefined ? o.opensIntoRoomId : opensIntoRoomId };
      const next = { ...o, ...common, ...kind } as Opening;
      return { ...ap, openings: { ...ap.openings, [id]: next } };
    },
  };
}
