/** Слои SVG-плана. Каждый слой только рисует то, что выводят функции domain (SRP, DRY). */
import type { PointerEvent } from 'react';
import { instanceCorners } from '../domain/furniture';
import { getWallMaterial } from '../catalog/materials';
import { clearOffsetCm, clearSpan, doorSwing, openingFootprint, wallAxis, wallPoint, normalIntoRoom, openingSpan } from '../domain/openings';
import { roomClearAreaCm2, roomClearRect, roomsOfWall, surfaceKey, wallFootprint } from '../domain/rooms';
import type { Apartment, CatalogItem, FurnitureInstance, Opening, Room, WallSurfaceRef } from '../domain/types';
import { formatCm, formatM2 } from '../domain/units';
import { rectDepth, rectWidth, type Point, type Rect } from '../geometry/rect';
import { toScreen, type ViewTransform } from './viewTransform';

type T = { t: ViewTransform };

const pts = (t: ViewTransform, ps: readonly Point[]) =>
  ps.map((c) => toScreen(t, c)).map((p) => `${p.x},${p.y}`).join(' ');

export function SvgRect({ r, t, className, testId }: T & { r: Rect; className: string; testId?: string }) {
  const p = toScreen(t, { x: r.minX, z: r.minZ });
  return (
    <rect data-testid={testId} className={className} x={p.x} y={p.y} width={rectWidth(r) * t.scale} height={rectDepth(r) * t.scale} />
  );
}

export function RoomFloor({ ap, room, t, active, onSelect }: T & { ap: Apartment; room: Room; active: boolean; onSelect?: () => void }) {
  return (
    <g data-testid={`plan-room-${room.id}`} onPointerDown={onSelect} className={onSelect ? 'plan-room clickable' : 'plan-room'}>
      <SvgRect r={roomClearRect(ap, room)} t={t} className={active ? 'plan-floor active' : 'plan-floor'} testId={active ? 'plan-floor' : undefined} />
    </g>
  );
}

export function Walls({
  ap,
  t,
  wallIds,
  selected,
  onWallDown,
}: T & {
  ap: Apartment;
  wallIds: readonly string[];
  /** Подсвеченные стены (выбранная прямая в настройке). */
  selected?: ReadonlySet<string>;
  /** Нажатие на стену — только в настройке квартиры. */
  onWallDown?: (wallId: string, e: PointerEvent<SVGGElement>) => void;
}) {
  return (
    <>
      {wallIds.map((id) => {
        const cls = ['plan-wall', roomsOfWall(ap, id).length > 1 && 'shared', selected?.has(id) && 'selected', onWallDown && 'editable']
          .filter(Boolean)
          .join(' ');
        return (
          <g key={id} data-testid={`plan-wall-${id}`} onPointerDown={onWallDown && ((e) => onWallDown(id, e))}>
            <SvgRect r={wallFootprint(ap, ap.walls[id])} t={t} className={cls} />
          </g>
        );
      })}
    </>
  );
}

/** Полоса шириной 2·halfPx вокруг отрезка на экране: зона выбора полотна двери (у линии нулевая высота bbox). */
function leafBand(a: { x: number; y: number }, b: { x: number; y: number }, halfPx: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / len) * halfPx;
  const ny = ((b.x - a.x) / len) * halfPx;
  return [
    [a.x + nx, a.y + ny],
    [b.x + nx, b.y + ny],
    [b.x - nx, b.y - ny],
    [a.x - nx, a.y - ny],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

/** Проём: разрыв в стене; дверь — полотно и дуга створки; окно — две линии остекления. */
export function OpeningSymbol({
  ap,
  o,
  t,
  selected,
  onSelect,
}: T & { ap: Apartment; o: Opening; selected?: boolean; onSelect?: () => void }) {
  const gap = <polygon className="plan-opening-gap" points={pts(t, openingFootprint(ap, o))} />;
  // Выбор проёма — только по невидимой зоне (полотно двери или контур окна), не по разрыву: клик по стене рядом с дверью выбирает стену.
  const select = onSelect && ((e: PointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
  });
  const cls = (base: string) => (selected ? `${base} selected` : base);
  if (o.kind === 'door') {
    const s = doorSwing(ap, o);
    const [h, e] = [toScreen(t, s.hinge), toScreen(t, s.leafEnd)];
    return (
      <g data-testid={`plan-opening-${o.id}`} className={cls('plan-door')}>
        {gap}
        <line x1={h.x} y1={h.y} x2={e.x} y2={e.y} className="plan-door-leaf" />
        <polyline points={pts(t, s.arc)} className="plan-door-arc" />
        {select && <polygon points={leafBand(h, e, 7)} className="plan-opening-hit" onPointerDown={select} />}
      </g>
    );
  }
  const wall = ap.walls[o.wallId];
  const axis = wallAxis(ap, wall);
  const n = { x: -axis.dir.z, z: axis.dir.x };
  const [s0, s1] = openingSpan(o);
  const line = (d: number) => {
    const [a, b] = [toScreen(t, wallPoint(axis, s0, n, d)), toScreen(t, wallPoint(axis, s1, n, d))];
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="plan-window-line" />;
  };
  return (
    <g data-testid={`plan-opening-${o.id}`} className={cls('plan-window')}>
      {gap}
      {line(-wall.thicknessCm / 6)}
      {line(wall.thicknessCm / 6)}
      {select && <polygon points={pts(t, openingFootprint(ap, o))} className="plan-opening-hit" onPointerDown={select} />}
    </g>
  );
}

/** Подпись проёма в комнате: чистый отступ от угла и ширина, см. */
export function OpeningLabel({ ap, o, room, t }: T & { ap: Apartment; o: Opening; room: Room }) {
  const wall = ap.walls[o.wallId];
  const axis = wallAxis(ap, wall);
  const n = normalIntoRoom(ap, wall, room);
  const [s0, s1] = openingSpan(o);
  const p = toScreen(t, wallPoint(axis, (s0 + s1) / 2, n, wall.thicknessCm / 2 + 14 / t.scale));
  return (
    <text className="plan-dim small" x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" data-testid={`plan-opening-label-${o.id}-${room.id}`}>
      {`${formatCm(clearOffsetCm(ap, o, room))} · ${formatCm(o.widthCm)}`}
    </text>
  );
}

/** Размеры комнаты снаружи контура (не перекрываются мебелью) — для крупного вида комнаты. */
export function RoomDimensions({ ap, room, t, outsideCm }: T & { ap: Apartment; room: Room; outsideCm: number }) {
  const r = roomClearRect(ap, room);
  const top = toScreen(t, { x: (r.minX + r.maxX) / 2, z: r.minZ - outsideCm });
  const left = toScreen(t, { x: r.minX - outsideCm, z: (r.minZ + r.maxZ) / 2 });
  return (
    <>
      <text className="plan-dim" x={top.x} y={top.y - 8} textAnchor="middle" data-testid="plan-dim-width">
        {formatCm(rectWidth(r))}
      </text>
      <text className="plan-dim" x={left.x - 8} y={left.y} textAnchor="end" dominantBaseline="middle" data-testid="plan-dim-depth">
        {formatCm(rectDepth(r))}
      </text>
    </>
  );
}

/** Название, размеры и площадь в центре помещения — для вида всей квартиры. */
export function RoomCaption({ ap, room, t }: T & { ap: Apartment; room: Room }) {
  const r = roomClearRect(ap, room);
  const c = toScreen(t, { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
  return (
    <text className="plan-caption" x={c.x} y={c.y} textAnchor="middle" data-testid={`plan-caption-${room.id}`}>
      <tspan x={c.x} dy="-0.4em">{room.name}</tspan>
      <tspan x={c.x} dy="1.3em" className="muted">{`${formatCm(rectWidth(r))} × ${formatCm(rectDepth(r))} · ${formatM2(roomClearAreaCm2(ap, room))}`}</tspan>
    </text>
  );
}

export function FurnitureShape(props: T & {
  item: CatalogItem;
  f: Pick<FurnitureInstance, 'position' | 'angleDeg'>;
  className: string;
  testId?: string;
  onPointerDown?: (e: PointerEvent<SVGPolygonElement>) => void;
}) {
  return (
    <polygon
      data-testid={props.testId}
      className={props.className}
      points={pts(props.t, instanceCorners(props.f, props.item))}
      onPointerDown={props.onPointerDown}
    />
  );
}

/**
 * Отделка внутренних поверхностей (12.6): полоса вдоль чистой грани стены со стороны комнаты цветом
 * материала; выбранная поверхность — пунктиром акцента. Другая сторона общей стены рисуется отдельно.
 */
export function WallFinishes({ ap, rooms, t, selected }: T & { ap: Apartment; rooms: readonly Room[]; selected: WallSurfaceRef | null }) {
  const strips = rooms.flatMap((room) =>
    room.boundary.map(({ wallId }) => {
      const material = getWallMaterial(ap.finishes.walls[surfaceKey(wallId, room.id)] ?? '');
      const isSelected = selected?.wallId === wallId && selected.roomId === room.id;
      if (!material && !isSelected) return null;
      const wall = ap.walls[wallId];
      const axis = wallAxis(ap, wall);
      const n = normalIntoRoom(ap, wall, room);
      const [s0, s1] = clearSpan(ap, wall, room);
      const d = wall.thicknessCm / 2 + 3 / t.scale;
      const [a, b] = [toScreen(t, wallPoint(axis, s0, n, d)), toScreen(t, wallPoint(axis, s1, n, d))];
      return (
        <g key={`${wallId}-${room.id}`}>
          {material && (
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="plan-finish"
              stroke={material.color}
              data-testid={`plan-finish-${wallId}-${room.id}`}
              data-material={material.id}
            />
          )}
          {isSelected && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="plan-surface-selected" data-testid="plan-surface-selected" />}
        </g>
      );
    }),
  );
  return <>{strips}</>;
}
