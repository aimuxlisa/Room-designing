/**
 * Панель отделки (SPEC §13): стена — краска, обои, плитка, штукатурка, кирпич (12.1, D-24);
 * пол — ламинат, паркет, плитка и камень, линолеум, ковролин (D-16, D-25).
 * Назначение — одна команда в истории; другая сторона общей стены не меняется (AC-11).
 */
import { useApartment, useStores, useUi } from '../app/stores';
import { FLOOR_GROUPS, WALL_GROUPS, floorMaterials, getMaterial, wallMaterials } from '../catalog/materials';
import { setFloorFinish, setWallFinish } from '../commands/finishes';
import { surfaceKey } from '../domain/rooms';
import { surfaceLabel } from '../domain/surfaces';
import type { Id, MaterialDefinition } from '../domain/types';

function Swatches({ items, current, onPick }: { items: readonly MaterialDefinition[]; current: Id | null; onPick: (id: Id) => void }) {
  return (
    <div className="swatches">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          className="swatch"
          aria-pressed={current === m.id}
          aria-label={m.name}
          title={m.name}
          data-testid={`swatch-${m.id}`}
          style={m.textureUrl ? { backgroundImage: `url("${m.textureUrl}")`, backgroundSize: 'cover' } : { background: m.color }}
          onClick={() => onPick(m.id)}
        />
      ))}
    </div>
  );
}

export function FinishPanel() {
  const { project, ui } = useStores();
  const ap = useApartment();
  const wall = useUi((st) => st.selectedSurface);
  const floor = useUi((st) => st.selectedFloor);
  const isWall = !!wall && !!ap.walls[wall.wallId] && !!ap.rooms[wall.roomId];
  const isFloor = !isWall && !!floor && !!ap.rooms[floor];
  if (!isWall && !isFloor) return null;

  const current = isWall ? (ap.finishes.walls[surfaceKey(wall!.wallId, wall!.roomId)] ?? null) : (ap.finishes.floors[floor!] ?? null);
  const apply = (id: Id | null) =>
    project.getState().execute(isWall ? setWallFinish(wall!.wallId, wall!.roomId, id) : setFloorFinish(floor!, id));
  const groups = isWall ? WALL_GROUPS : FLOOR_GROUPS;
  const all = isWall ? wallMaterials : floorMaterials;
  return (
    <section className="finish-panel" aria-label={isWall ? 'Отделка стены' : 'Покрытие пола'} data-testid="finish-panel">
      <h2>{isWall ? 'Отделка стены' : 'Покрытие пола'}</h2>
      <p className="muted" data-testid="finish-surface">
        {isWall ? surfaceLabel(ap, wall!.wallId, wall!.roomId) : `Пол комнаты «${ap.rooms[floor!].name}»`}
      </p>
      <p data-testid="finish-current">Сейчас: {(current && getMaterial(current)?.name) ?? 'без отделки'}</p>
      {groups.map((g) => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          <Swatches items={all.filter((m) => g.kinds.includes(m.kind))} current={current} onPick={apply} />
        </div>
      ))}
      <div className="actions">
        <button type="button" disabled={!current} onClick={() => apply(null)}>
          Сбросить
        </button>
        <button type="button" onClick={() => (isWall ? ui.getState().selectSurface(null) : ui.getState().selectFloor(null))}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
