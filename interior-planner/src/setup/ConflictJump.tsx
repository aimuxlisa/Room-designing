/**
 * Конфликт изменения с мебелью (15.4): называет предмет и его комнату и переводит в интерьер к нему,
 * чтобы переставить предмет без потери остальных данных; квартира при отказе не меняется.
 */
import { enterInterior } from '../app/flow';
import { useApartment, useStores } from '../app/stores';
import type { Id } from '../domain/types';

export function ConflictJump({ objectIds }: { objectIds: readonly Id[] }) {
  const stores = useStores();
  const ap = useApartment();
  const f = objectIds.map((id) => ap.furniture[id]).find(Boolean);
  if (!f) return null;
  const name = stores.catalog(f.catalogItemId)?.name ?? 'предмет';
  const room = ap.rooms[f.roomId]?.name ?? '';
  return (
    <button
      type="button"
      data-testid="conflict-jump"
      onClick={() => {
        stores.ui.getState().setActiveRoom(f.roomId);
        enterInterior(stores);
        stores.ui.getState().select(f.id);
      }}
    >
      Показать «{name}» в комнате «{room}»
    </button>
  );
}
