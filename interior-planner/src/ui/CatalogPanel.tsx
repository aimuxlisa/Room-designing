/**
 * Каталог (13.5): предметы для типа активной комнаты или все, по категориям, с превью и размерами в см.
 * Нажатие начинает перенос, предмет ставится отпусканием над планом или 3D.
 */
import { useState } from 'react';
import { useApartment, useStores, useUi } from '../app/stores';
import { catalog, itemFitsRoom } from '../catalog/catalog';
import type { CatalogItem } from '../domain/types';

const MOUNT_LABEL: Partial<Record<CatalogItem['mounting'], string>> = {
  wall: 'на стену',
  ceiling: 'на потолок',
  tabletop: 'на столешницу',
};

const sizeLabel = ({ widthCm, depthCm, heightCm }: CatalogItem['size']) =>
  `${Math.round(widthCm)} × ${Math.round(depthCm)} × ${Math.round(heightCm)} см`;

export function CatalogPanel() {
  const { drag } = useStores();
  const ap = useApartment();
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  const [scope, setScope] = useState<'room' | 'all'>('room');
  const items = scope === 'room' && room ? catalog.filter((i) => itemFitsRoom(i, room.type)) : catalog;
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <aside className="catalog" aria-label="Каталог">
      <h2>Каталог</h2>
      <div className="catalog-filter" role="group" aria-label="Какие предметы показывать">
        <button type="button" aria-pressed={scope === 'room'} disabled={!room} onClick={() => setScope('room')}>
          {room ? `Для «${room.name}»` : 'Для комнаты'}
        </button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
          Все ({catalog.length})
        </button>
      </div>
      {categories.map((category) => (
        <section key={category} className="catalog-group">
          <h3>{category}</h3>
          <ul>
            {items
              .filter((i) => i.category === category)
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="catalog-item"
                    data-testid={`catalog-${item.id}`}
                    title={item.source}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                      drag.getState().startFromCatalog(item.id);
                    }}
                  >
                    <img
                      className="catalog-preview"
                      src={item.previewUrl}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                    />
                    <span className="catalog-text">
                      <span>{item.name}</span>
                      <span className="muted">{sizeLabel(item.size)}</span>
                      {(MOUNT_LABEL[item.mounting] || item.layer === 'floor-covering') && (
                        <span className="muted small">{item.layer === 'floor-covering' ? 'на пол, под мебель' : MOUNT_LABEL[item.mounting]}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
