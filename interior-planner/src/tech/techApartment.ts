/**
 * ТЕХНИЧЕСКАЯ геометрия этапа 4: одна комната 420 × 350 см (чистые), внешние стены 30 см.
 * Не является утверждённой схемой (стартовые схемы — этап 7).
 */
import type { Apartment, Vertex, Wall } from '../domain/types';

export const TECH_ROOM_ID = 'tech-room';

export function createTechApartment(): Apartment {
  const t = 30;
  const [w, d] = [420 + t, 350 + t]; // оси стен
  return {
    id: 'tech',
    schemaVersion: 1,
    ceilingCm: 270,
    vertices: {
      v1: { id: 'v1', xCm: 0, zCm: 0 },
      v2: { id: 'v2', xCm: w, zCm: 0 },
      v3: { id: 'v3', xCm: w, zCm: d },
      v4: { id: 'v4', xCm: 0, zCm: d },
    },
    walls: {
      n: { id: 'n', startId: 'v1', endId: 'v2', thicknessCm: t },
      e: { id: 'e', startId: 'v2', endId: 'v3', thicknessCm: t },
      s: { id: 's', startId: 'v3', endId: 'v4', thicknessCm: t },
      wst: { id: 'wst', startId: 'v4', endId: 'v1', thicknessCm: t },
    },
    rooms: {
      [TECH_ROOM_ID]: {
        id: TECH_ROOM_ID,
        type: 'living',
        name: 'Техническая комната',
        boundary: ['n', 'e', 's', 'wst'].map((wallId) => ({ wallId, reversed: false })),
      },
    },
    openings: {
      // Входная дверь на южной стене, открывается наружу: от x = 390 до 300 см.
      entry: { id: 'entry', kind: 'door', wallId: 's', offsetCm: 60, widthCm: 90, heightCm: 210, hinge: 'left', opensIntoRoomId: null },
    },
    furniture: {},
    finishes: { walls: {}, floors: {} },
  };
}


const v = (id: string, xCm: number, zCm: number): Vertex => ({ id, xCm, zCm });
const w = (id: string, startId: string, endId: string, thicknessCm: number): Wall => ({ id, startId, endId, thicknessCm });
const byId = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((i) => [i.id, i]));

/**
 * ТЕХНИЧЕСКАЯ квартира из двух помещений (этапы 5–6). Комната А (чистая 400 × 300) и коридор Б (200 × 300) с общей перегородкой w7.
 * Оси: внешние стены 30 см, перегородка 10 см.
 *   v1(0,0) — v2(420,0) — v3(640,0)
 *   v6(0,330) — v5(420,330) — v4(640,330)
 */
export function createTechTwoRooms(): Apartment {
  return {
    id: 'ap',
    schemaVersion: 1,
    ceilingCm: 270,
    vertices: byId([v('v1', 0, 0), v('v2', 420, 0), v('v3', 640, 0), v('v4', 640, 330), v('v5', 420, 330), v('v6', 0, 330)]),
    walls: byId([
      w('w1', 'v1', 'v2', 30),
      w('w2', 'v2', 'v3', 30),
      w('w3', 'v3', 'v4', 30),
      w('w4', 'v4', 'v5', 30),
      w('w5', 'v5', 'v6', 30),
      w('w6', 'v6', 'v1', 30),
      w('w7', 'v2', 'v5', 10),
    ]),
    rooms: {
      a: {
        id: 'a',
        type: 'living',
        name: 'Комната А',
        boundary: [
          { wallId: 'w1', reversed: false },
          { wallId: 'w7', reversed: false },
          { wallId: 'w5', reversed: false },
          { wallId: 'w6', reversed: false },
        ],
      },
      b: {
        id: 'b',
        type: 'hallway',
        name: 'Коридор Б',
        boundary: [
          { wallId: 'w2', reversed: false },
          { wallId: 'w3', reversed: false },
          { wallId: 'w4', reversed: false },
          { wallId: 'w7', reversed: true },
        ],
      },
    },
    openings: {
      entry: { id: 'entry', kind: 'door', wallId: 'w3', offsetCm: 100, widthCm: 90, heightCm: 210, hinge: 'left', opensIntoRoomId: null },
      d1: { id: 'd1', kind: 'door', wallId: 'w7', offsetCm: 100, widthCm: 80, heightCm: 210, hinge: 'left', opensIntoRoomId: 'a' },
    },
    furniture: {},
    finishes: { walls: {}, floors: {} },
  };
}
