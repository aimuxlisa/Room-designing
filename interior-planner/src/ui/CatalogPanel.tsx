import { useStores } from '../app/stores';
import { techCatalog } from '../catalog/techCatalog';
import { formatCm } from '../domain/units';

/** Каталог: нажатие начинает перенос, предмет ставится отпусканием над планом или 3D. */
export function CatalogPanel() {
  const { drag } = useStores();
  return (
    <aside className="catalog" aria-label="Каталог">
      <h2>Каталог <span className="badge">технический</span></h2>
      <ul>
        {techCatalog.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="catalog-item"
              data-testid={`catalog-${item.id}`}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                drag.getState().startFromCatalog(item.id);
              }}
            >
              <span>{item.name}</span>
              <span className="muted">
                {formatCm(item.size.widthCm)} × {formatCm(item.size.depthCm)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
