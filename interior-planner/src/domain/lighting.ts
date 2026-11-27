/**
 * Искусственный свет комнаты (этап 21, D-11, D-14). Без Three.js.
 * В каждой комнате есть стандартный потолочный светильник (плафон в центре) и выключатель комнаты.
 * Если в комнате висит люстра или другой потолочный светильник из каталога, плафон скрывается,
 * и выключатель комнаты включает их. Торшеры, настольные лампы и бра включаются каждый отдельно.
 * Состояние выключателей — часть вида (uiStore), а не проекта: в историю отмены не входит.
 */
import type { FurnitureInstance, Id, Room, Apartment, CatalogItem } from './types';
import type { CatalogLookup } from './furniture';
import { roomClearRect } from './rooms';
import { rotatePoint } from '../geometry/placement';

/** Категория каталога, предметы которой светят. */
export const LIGHT_CATEGORY = 'Светильники';
/** Предел одновременно светящих источников в комнате (D-08, D-11); остальные включённые только светятся сами. */
export const MAX_ACTIVE_LIGHTS = 4;
/** Диаметр и толщина стандартного плафона, см. */
export const STANDARD_FIXTURE = { diameterCm: 42, heightCm: 9 } as const;

export type LightKind = 'ceiling' | 'lamp';

export interface LightSource {
  /** id предмета или `standard:<roomId>` для плафона. */
  readonly id: Id;
  readonly kind: LightKind;
  /** Точка излучения, см (y — от пола). */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  readonly on: boolean;
  /** Сила света, кд; цвет — тёплый белый. */
  readonly intensity: number;
  /** Дальность, см: дальше свет не доходит. */
  readonly rangeCm: number;
}

export interface LightSwitches {
  /** Выключатель комнаты (потолочный свет). */
  readonly rooms: Readonly<Record<Id, boolean>>;
  /** Отдельные светильники: торшеры, лампы, бра. */
  readonly lamps: Readonly<Record<Id, boolean>>;
}

export const isLightItem = (item: CatalogItem | undefined): item is CatalogItem => item?.category === LIGHT_CATEGORY;
export const isCeilingLight = (item: CatalogItem | undefined) => isLightItem(item) && item.mounting === 'ceiling';
/** Светильник с собственным выключателем (не потолочный). */
export const isLamp = (item: CatalogItem | undefined): item is CatalogItem => isLightItem(item) && item.mounting !== 'ceiling';

/** Точка излучения предмета: потолочный — нижняя часть, настенный — перед стеной, остальные — под абажуром. */
export function lightAnchor(item: CatalogItem, f: Pick<FurnitureInstance, 'position' | 'angleDeg'>) {
  const { heightCm: h, depthCm: d } = item.size;
  const local =
    item.mounting === 'ceiling' ? { x: 0, y: h * 0.3, z: 0 } : item.mounting === 'wall' ? { x: 0, y: h * 0.6, z: d * 0.3 } : { x: 0, y: h * 0.85, z: 0 };
  const r = rotatePoint({ x: local.x, z: local.z }, f.angleDeg);
  return { x: f.position.xCm + r.x, y: f.position.yCm + local.y, z: f.position.zCm + r.z };
}

export const standardFixtureId = (roomId: Id) => `standard:${roomId}`;

/** Комната освещается стандартным плафоном, если в ней нет потолочного светильника из каталога (D-14). */
export function hasStandardFixture(ap: Apartment, room: Room, getItem: CatalogLookup) {
  return !Object.values(ap.furniture).some((f) => f.roomId === room.id && isCeilingLight(getItem(f.catalogItemId)));
}

/** Включён ли светильник-предмет: потолочный — выключателем комнаты, остальные — своим. */
export function isItemLit(item: CatalogItem | undefined, f: Pick<FurnitureInstance, 'id' | 'roomId'>, sw: LightSwitches): boolean {
  if (!isLightItem(item)) return false;
  return item.mounting === 'ceiling' ? (sw.rooms[f.roomId] ?? false) : (sw.lamps[f.id] ?? false);
}

/** Все источники света комнаты: сначала потолочные, затем светильники по порядку расстановки. */
export function roomLightSources(ap: Apartment, room: Room, getItem: CatalogLookup, sw: LightSwitches): LightSource[] {
  const roomOn = sw.rooms[room.id] ?? false;
  const ceiling: LightSource[] = [];
  const lamps: LightSource[] = [];
  for (const f of Object.values(ap.furniture)) {
    if (f.roomId !== room.id) continue;
    const item = getItem(f.catalogItemId);
    if (!isLightItem(item)) continue;
    const at = lightAnchor(item, f);
    if (item.mounting === 'ceiling') ceiling.push({ id: f.id, kind: 'ceiling', at, on: roomOn, intensity: 22, rangeCm: 900 });
    else lamps.push({ id: f.id, kind: 'lamp', at, on: sw.lamps[f.id] ?? false, intensity: item.mounting === 'floor' ? 9 : 4, rangeCm: 600 });
  }
  if (!ceiling.length) {
    const r = roomClearRect(ap, room);
    ceiling.push({
      id: standardFixtureId(room.id),
      kind: 'ceiling',
      at: { x: (r.minX + r.maxX) / 2, y: ap.ceilingCm - STANDARD_FIXTURE.heightCm - 2, z: (r.minZ + r.maxZ) / 2 },
      on: roomOn,
      intensity: 25,
      rangeCm: 900,
    });
  }
  return [...ceiling, ...lamps];
}

/** Включённые источники, которые действительно освещают сцену: не больше MAX_ACTIVE_LIGHTS, потолочные — первыми. */
export const activeLightSources = (sources: readonly LightSource[]) => sources.filter((s) => s.on).slice(0, MAX_ACTIVE_LIGHTS);

/** Источники всех комнат квартиры — для прогулки (24.4). */
export const apartmentLightSources = (ap: Apartment, getItem: CatalogLookup, sw: LightSwitches): LightSource[] =>
  Object.values(ap.rooms).flatMap((room) => roomLightSources(ap, room, getItem, sw));

/**
 * Включённые источники, ближайшие к точке (см): в прогулке освещают сцену не больше MAX_ACTIVE_LIGHTS
 * источников рядом с игроком (24.4, D-08).
 */
export function nearestLightSources(sources: readonly LightSource[], at: { x: number; z: number }, max = MAX_ACTIVE_LIGHTS): LightSource[] {
  const d = (s: LightSource) => Math.hypot(s.at.x - at.x, s.at.z - at.z);
  return sources
    .filter((s) => s.on)
    .sort((a, b) => d(a) - d(b))
    .slice(0, max);
}
