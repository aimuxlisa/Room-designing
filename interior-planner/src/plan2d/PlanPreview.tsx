/** Неинтерактивное превью квартиры (выбор схемы). Те же слои, что и у плана (DRY). */
import type { Apartment } from '../domain/types';
import { OpeningSymbol, RoomFloor, Walls } from './PlanLayers';
import { contentRect } from './planContent';
import { fitTransform } from './viewTransform';

export function PlanPreview({ ap, width, height }: { ap: Apartment; width: number; height: number }) {
  const rooms = Object.values(ap.rooms);
  const t = fitTransform(contentRect(ap, rooms), width, height, 8);
  const wallIds = [...new Set(rooms.flatMap((r) => r.boundary.map((e) => e.wallId)))];
  return (
    <svg width={width} height={height} className="plan-preview" aria-hidden="true">
      {rooms.map((r) => (
        <RoomFloor key={r.id} ap={ap} room={r} t={t} active={false} />
      ))}
      <Walls ap={ap} t={t} wallIds={wallIds} />
      {Object.values(ap.openings).map((o) => (
        <OpeningSymbol key={o.id} ap={ap} o={o} t={t} />
      ))}
    </svg>
  );
}
