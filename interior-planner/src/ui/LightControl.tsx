/**
 * Выключатели (21.1, 21.4): свет комнаты (стандартный плафон или люстры, D-14) и выбранный светильник.
 * Состояние — в uiStore: не входит в проект и историю отмены, сохраняется при переходах между комнатами.
 */
import { useApartment, useCatalog, useStores, useUi } from '../app/stores';
import type { Id } from '../domain/types';
import { hasStandardFixture, isLamp, MAX_ACTIVE_LIGHTS, roomLightSources } from '../domain/lighting';

/** roomId — комната выключателя; по умолчанию активная комната редактора, в прогулке — комната игрока. */
export function LightControl({ roomId: forRoom }: { roomId?: Id | null } = {}) {
  const { ui } = useStores();
  const ap = useApartment();
  const catalog = useCatalog();
  const activeRoomId = useUi((s) => s.activeRoomId);
  const roomId = forRoom === undefined ? activeRoomId : forRoom;
  const selectedId = useUi((s) => s.selectedId);
  const lights = useUi((s) => s.lights);
  const room = roomId ? ap.rooms[roomId] : undefined;
  if (!room) return null;
  const roomOn = lights.rooms[room.id] ?? false;
  const ceilingName = hasStandardFixture(ap, room, catalog) ? 'Потолочный свет' : 'Люстра';
  const selected = selectedId ? ap.furniture[selectedId] : undefined;
  const lampItem = selected && selected.roomId === room.id ? catalog(selected.catalogItemId) : undefined;
  const lampOn = selected ? (lights.lamps[selected.id] ?? false) : false;
  const onCount = roomLightSources(ap, room, catalog, lights).filter((s) => s.on).length;
  return (
    <div className="light-control" role="group" aria-label="Свет">
      <button type="button" data-testid="room-light" aria-pressed={roomOn} onClick={() => ui.getState().toggleRoomLight(room.id)}>
        {ceilingName}: {roomOn ? 'вкл' : 'выкл'}
      </button>
      {selected && isLamp(lampItem) && (
        <button type="button" data-testid="lamp-light" aria-pressed={lampOn} onClick={() => ui.getState().toggleLamp(selected.id)}>
          {lampItem.name}: {lampOn ? 'вкл' : 'выкл'}
        </button>
      )}
      {onCount > MAX_ACTIVE_LIGHTS && (
        <span className="muted" role="note">
          Освещают комнату {MAX_ACTIVE_LIGHTS} источника из {onCount}; остальные только светятся
        </span>
      )}
    </div>
  );
}
