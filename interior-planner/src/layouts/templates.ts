/**
 * Утверждённый перечень стартовых схем (SPEC §3.1, D-02): по 3 на 1/2/3 жилые комнаты.
 * Оси заданы до увеличения; D-15 — оси ×1,1, толщины, проёмы и высота не меняются.
 * Прихожая есть во всех схемах. Мебели нет. Площадь выводится из геометрии, а не хранится.
 */
import { apartmentClearAreaCm2 } from '../domain/rooms';
import type { LayoutTemplate, RoomType } from '../domain/types';
import { buildApartment, type LayoutSpec, type RoomSpec } from './builder';

export const LAYOUT_SCALE = 1.1;

const room = (key: string, type: RoomType, name: string, rect: RoomSpec['rect'], window?: RoomSpec['window']): RoomSpec => ({
  key, type, name, rect, window,
});

/** Нижний ряд: прихожая и санузел (совмещённый или раздельный), вход с юга. */
function serviceRow(hallEnd: number, totalEnd: number, separate: boolean): RoomSpec[] {
  if (!separate)
    return [
      room('hall', 'hallway', 'Прихожая', [0, 450, hallEnd, 650]),
      room('bath', 'combined-bathroom', 'Санузел', [hallEnd, 450, totalEnd, 650]),
    ];
  return [
    room('hall', 'hallway', 'Прихожая', [0, 450, hallEnd, 700]),
    room('bath', 'bathroom', 'Ванная', [hallEnd, 450, totalEnd, 590]),
    room('wc', 'toilet', 'Туалет', [hallEnd, 590, totalEnd, 700]),
  ];
}

const serviceDoors = (separate: boolean): [string, string][] =>
  separate ? [['bath', 'hall'], ['wc', 'hall']] : [['bath', 'hall']];

interface Def {
  readonly code: string;
  readonly livingRooms: 1 | 2 | 3;
  readonly description: string;
  readonly top: RoomSpec[];
  readonly hallEnd: number;
  readonly totalEnd: number;
  readonly separate: boolean;
}

const DEFS: readonly Def[] = [
  {
    code: '1А', livingRooms: 1, description: 'Студия: кухня-гостиная, совмещённый санузел', hallEnd: 300, totalEnd: 520, separate: false,
    top: [room('kl', 'kitchen-living', 'Кухня-гостиная', [0, 0, 520, 450], 'north')],
  },
  {
    code: '1Б', livingRooms: 1, description: 'Комната, отдельная кухня, совмещённый санузел', hallEnd: 560, totalEnd: 700, separate: false,
    top: [room('r1', 'living', 'Комната', [0, 0, 400, 450], 'north'), room('k', 'kitchen', 'Кухня', [400, 0, 700, 450], 'north')],
  },
  {
    code: '1В', livingRooms: 1, description: 'Комната, отдельная кухня, раздельный санузел', hallEnd: 560, totalEnd: 700, separate: true,
    top: [room('r1', 'living', 'Комната', [0, 0, 400, 450], 'north'), room('k', 'kitchen', 'Кухня', [400, 0, 700, 450], 'north')],
  },
  {
    code: '2А', livingRooms: 2, description: 'Кухня-гостиная и спальня, совмещённый санузел', hallEnd: 700, totalEnd: 900, separate: false,
    top: [room('kl', 'kitchen-living', 'Кухня-гостиная', [0, 0, 550, 450], 'north'), room('s1', 'bedroom', 'Спальня', [550, 0, 900, 450], 'north')],
  },
  {
    code: '2Б', livingRooms: 2, description: 'Две комнаты, отдельная кухня, совмещённый санузел', hallEnd: 880, totalEnd: 1050, separate: false,
    top: [
      room('r1', 'living', 'Комната 1', [0, 0, 400, 450], 'north'),
      room('r2', 'bedroom', 'Комната 2', [400, 0, 750, 450], 'north'),
      room('k', 'kitchen', 'Кухня', [750, 0, 1050, 450], 'north'),
    ],
  },
  {
    code: '2В', livingRooms: 2, description: 'Две комнаты, отдельная кухня, раздельный санузел', hallEnd: 880, totalEnd: 1050, separate: true,
    top: [
      room('r1', 'living', 'Комната 1', [0, 0, 400, 450], 'north'),
      room('r2', 'bedroom', 'Комната 2', [400, 0, 750, 450], 'north'),
      room('k', 'kitchen', 'Кухня', [750, 0, 1050, 450], 'north'),
    ],
  },
  {
    code: '3А', livingRooms: 3, description: 'Кухня-гостиная и две спальни, совмещённый санузел', hallEnd: 1050, totalEnd: 1250, separate: false,
    top: [
      room('kl', 'kitchen-living', 'Кухня-гостиная', [0, 0, 550, 450], 'north'),
      room('s1', 'bedroom', 'Спальня 1', [550, 0, 900, 450], 'north'),
      room('s2', 'bedroom', 'Спальня 2', [900, 0, 1250, 450], 'north'),
    ],
  },
  {
    code: '3Б', livingRooms: 3, description: 'Три комнаты, отдельная кухня, совмещённый санузел', hallEnd: 1230, totalEnd: 1400, separate: false,
    top: [
      room('r1', 'living', 'Комната 1', [0, 0, 400, 450], 'north'),
      room('r2', 'bedroom', 'Комната 2', [400, 0, 750, 450], 'north'),
      room('r3', 'bedroom', 'Комната 3', [750, 0, 1100, 450], 'north'),
      room('k', 'kitchen', 'Кухня', [1100, 0, 1400, 450], 'north'),
    ],
  },
  {
    code: '3В', livingRooms: 3, description: 'Три комнаты, отдельная кухня, раздельный санузел', hallEnd: 1230, totalEnd: 1400, separate: true,
    top: [
      room('r1', 'living', 'Комната 1', [0, 0, 400, 450], 'north'),
      room('r2', 'bedroom', 'Комната 2', [400, 0, 750, 450], 'north'),
      room('r3', 'bedroom', 'Комната 3', [750, 0, 1100, 450], 'north'),
      room('k', 'kitchen', 'Кухня', [1100, 0, 1400, 450], 'north'),
    ],
  },
];

function toSpec(d: Def): LayoutSpec {
  return {
    id: `layout-${d.code}`,
    rooms: [...d.top, ...serviceRow(d.hallEnd, d.totalEnd, d.separate)],
    // Каждая верхняя комната открывается из прихожей.
    doors: [...d.top.map((r) => [r.key, 'hall'] as [string, string]), ...serviceDoors(d.separate)],
    entrance: { room: 'hall', side: 'south' },
    scale: LAYOUT_SCALE,
  };
}

export const layoutTemplates: readonly LayoutTemplate[] = DEFS.map((d) => ({
  id: `layout-${d.code}`,
  code: d.code,
  livingRooms: d.livingRooms,
  description: d.description,
  apartment: buildApartment(toSpec(d)),
}));

export const templateAreaCm2 = (t: LayoutTemplate): number => apartmentClearAreaCm2(t.apartment);

export const getTemplate = (id: string) => layoutTemplates.find((t) => t.id === id);
