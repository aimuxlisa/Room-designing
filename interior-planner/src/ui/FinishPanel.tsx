/**
 * Панель отделки выбранной внутренней поверхности (SPEC §13, 12.1): краска и обои.
 * Назначение — одна команда в истории; другая сторона общей стены не меняется (AC-11).
 */
import { useApartment, useStores, useUi } from '../app/stores';
import { getWallMaterial, wallMaterials } from '../catalog/materials';
import { setWallFinish } from '../commands/finishes';
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
  const s = useUi((st) => st.selectedSurface);
  if (!s || !ap.walls[s.wallId] || !ap.rooms[s.roomId]) return null;
  const current = ap.finishes.walls[surfaceKey(s.wallId, s.roomId)] ?? null;
  const currentName = current ? getWallMaterial(current)?.name : null;
  const apply = (id: Id | null) => project.getState().execute(setWallFinish(s.wallId, s.roomId, id));
  const paints = wallMaterials.filter((m) => m.kind === 'paint');
  const wallpapers = wallMaterials.filter((m) => m.kind === 'wallpaper');
  return (
    <section className="finish-panel" aria-label="Отделка стены" data-testid="finish-panel">
      <h2>Отделка стены</h2>
      <p className="muted" data-testid="finish-surface">
        {surfaceLabel(ap, s.wallId, s.roomId)}
      </p>
      <p data-testid="finish-current">Сейчас: {currentName ?? 'без отделки'}</p>
      <h3>Краска</h3>
      <Swatches items={paints} current={current} onPick={apply} />
      <h3>Обои (ткани Poly Haven)</h3>
      <Swatches items={wallpapers} current={current} onPick={apply} />
      <div className="actions">
        <button type="button" disabled={!current} onClick={() => apply(null)}>
          Сбросить
        </button>
        <button type="button" onClick={() => ui.getState().selectSurface(null)}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
