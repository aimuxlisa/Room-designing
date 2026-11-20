/**
 * Модель данных (SPEC §6). Все длины — в сантиметрах, площади — в см².
 * Горизонтальная плоскость XZ, вертикаль Y (SPEC §5.3). Координаты хранятся только здесь:
 * 2D и 3D не имеют собственных копий (SPEC §4).
 */
import type { AssetUnit } from './units';

export type Id = string;

export interface Vertex {
  readonly id: Id;
  readonly xCm: number;
  readonly zCm: number;
}

/** Стена — отрезок по оси между двумя вершинами. Высота — общая высота потолка квартиры. */
export interface Wall {
  readonly id: Id;
  readonly startId: Id;
  readonly endId: Id;
  readonly thicknessCm: number;
}

/** Ориентированная ссылка на стену в обходе границы комнаты. */
export interface BoundaryEdge {
  readonly wallId: Id;
  /** true — обход идёт от конца стены к началу. */
  readonly reversed: boolean;
}

export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'kitchen-living'
  | 'bathroom'
  | 'toilet'
  | 'combined-bathroom'
  | 'hallway';

export interface Room {
  readonly id: Id;
  readonly type: RoomType;
  readonly name: string;
  /** Замкнутый обход по осям стен. Полигон пола выводится, а не хранится. */
  readonly boundary: readonly BoundaryEdge[];
}

/** Поверхность стены со стороны комнаты: две стороны перегородки независимы (SPEC §6). */
export interface WallSurfaceRef {
  readonly wallId: Id;
  readonly roomId: Id;
}

export type DoorSwing = 'left' | 'right';

interface OpeningBase {
  readonly id: Id;
  readonly wallId: Id;
  /** Чистое расстояние от начала стены до края проёма. */
  readonly offsetCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
}

export interface DoorOpening extends OpeningBase {
  readonly kind: 'door';
  readonly hinge: DoorSwing;
  /** Комната, в которую открывается створка; null — наружу (входная дверь). */
  readonly opensIntoRoomId: Id | null;
}

export interface WindowOpening extends OpeningBase {
  readonly kind: 'window';
  readonly sillCm: number;
}

export type Opening = DoorOpening | WindowOpening;

export interface Vec3Cm {
  readonly xCm: number;
  readonly yCm: number;
  readonly zCm: number;
}

export interface FurnitureInstance {
  readonly id: Id;
  readonly catalogItemId: Id;
  readonly assetVersion: number;
  readonly roomId: Id;
  /** Глобальное положение опорной точки (центр основания). */
  readonly position: Vec3Cm;
  readonly angleDeg: number;
  readonly variantId: Id | null;
}

/** Назначения отделки. Ключ стены — surfaceKey(wallId, roomId). */
export interface Finishes {
  readonly walls: Readonly<Record<string, Id>>;
  readonly floors: Readonly<Record<Id, Id>>;
}

export interface Apartment {
  readonly id: Id;
  readonly schemaVersion: 1;
  readonly ceilingCm: number;
  readonly vertices: Readonly<Record<Id, Vertex>>;
  readonly walls: Readonly<Record<Id, Wall>>;
  readonly rooms: Readonly<Record<Id, Room>>;
  readonly openings: Readonly<Record<Id, Opening>>;
  readonly furniture: Readonly<Record<Id, FurnitureInstance>>;
  readonly finishes: Finishes;
}

// ---- Каталог и материалы ----

export type Mounting = 'floor' | 'wall' | 'ceiling' | 'tabletop';
export type CatalogLayer = 'item' | 'floor-covering';

export interface Size3Cm {
  readonly widthCm: number;
  readonly depthCm: number;
  readonly heightCm: number;
}

/** Упрощённый объём коллайдера в локальных осях предмета, см. */
export interface ColliderBox {
  readonly center: Vec3Cm;
  readonly size: Size3Cm;
}

export interface CatalogItem {
  readonly id: Id;
  readonly version: number;
  readonly category: string;
  readonly name: string;
  readonly roomTypes: readonly RoomType[];
  readonly size: Size3Cm;
  readonly modelUrl: string;
  readonly modelUnit: AssetUnit;
  readonly previewUrl: string;
  readonly mounting: Mounting;
  readonly layer: CatalogLayer;
  /** Высота установки над полом для настенных предметов. */
  readonly mountHeightCm?: number;
  readonly colliders: readonly ColliderBox[];
  readonly license: string;
  readonly source: string;
}

export type FinishKind = 'paint' | 'wallpaper' | 'laminate' | 'linoleum' | 'carpet';

export interface MaterialDefinition {
  readonly id: Id;
  readonly kind: FinishKind;
  readonly name: string;
  readonly color: string;
  readonly textureUrl?: string;
  /** Физический размер одного повтора текстуры (SPEC §13). */
  readonly tileSizeCm?: { readonly widthCm: number; readonly heightCm: number };
  readonly roughness: number;
}

export interface LayoutTemplate {
  readonly id: Id;
  readonly code: string;
  readonly livingRooms: 1 | 2 | 3;
  readonly description: string;
  /** Геометрия без мебели; площадь выводится функцией, а не хранится. */
  readonly apartment: Apartment;
}
