/**
 * SVG-план (SPEC §10.1): активная комната крупно или вся квартира. Колесо — масштаб вокруг
 * указателя, средняя кнопка — сдвиг, «Вписать» — исходный вид. Указатель переводится в см
 * одной функцией toWorld с текущим преобразованием.
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { useApartment, useCatalog, useDrag, useSetup, useStores, useUi } from '../app/stores';
import { collinearChain } from '../commands/walls';
import { wallAxis } from '../domain/openings';
import type { Point } from '../geometry/rect';
import { snapCm } from '../geometry/placement';
import { roomsOfWall } from '../domain/rooms';
import { FurnitureShape, OpeningLabel, OpeningSymbol, RoomCaption, RoomDimensions, RoomFloor, WallFinishes, Walls } from './PlanLayers';
import { contentRect } from './planContent';
import { fitTransform, panBy, toWorld, zoomAt, type ViewTransform } from './viewTransform';

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 600, h: 400 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Шаг сдвига стены мышью, см; с Alt — 1 см (D-10). */
const WALL_SNAP_CM = 5;

/**
 * mode='setup' — настройка квартиры: вся квартира, стены выбираются и перетаскиваются,
 * показывается кандидат изменения. mode='interior' — геометрия заблокирована, переносится мебель.
 */
export function PlanView({ mode = 'interior' }: { mode?: 'setup' | 'interior' }) {
  const base = useApartment();
  const catalog = useCatalog();
  const { drag, ui, setup } = useStores();
  const draft = useDrag((s) => s.draft);
  const roomId = useUi((s) => s.activeRoomId);
  const uiScope = useUi((s) => s.planScope);
  const scope = mode === 'setup' ? 'apartment' : uiScope;
  const selectedWall = useSetup((s) => s.wallId);
  const selectedOpening = useSetup((s) => s.openingId);
  const proposal = useSetup((s) => s.proposal);
  const ap = mode === 'setup' && proposal?.ok ? proposal.candidate : base;
  const wallDrag = useRef<{ wallId: string; start: Point; vertical: boolean } | null>(null);
  const selectedId = useUi((s) => s.selectedId);
  const selectedSurface = useUi((s) => s.selectedSurface);
  const ref = useRef<HTMLDivElement>(null);
  const size = useSize(ref);
  /** Пользовательский вид; null — вписанный. Сбрасывается при смене комнаты или режима. */
  const [custom, setCustom] = useState<ViewTransform | null>(null);
  const pan = useRef<{ x: number; y: number } | null>(null);

  const active = roomId ? ap.rooms[roomId] : undefined;
  const rooms = scope === 'apartment' ? Object.values(ap.rooms) : active ? [active] : [];
  // Вписывается действующая квартира, чтобы вид не прыгал во время предпросмотра.
  const baseRooms = scope === 'apartment' ? Object.values(base.rooms) : base.rooms[roomId ?? ''] ? [base.rooms[roomId!]] : [];
  const fit = baseRooms.length ? fitTransform(contentRect(base, baseRooms), size.w, size.h) : null;
  const t = custom ?? fit;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => setCustom(null), [roomId, scope]);

  // Колесо — нативный слушатель, чтобы отменить прокрутку страницы.
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      const cur = tRef.current;
      if (!cur) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      setCustom(zoomAt(cur, { x: e.clientX - box.left, y: e.clientY - box.top }, Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toCm = (e: PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    return toWorld(t!, { x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const wallIds = [...new Set(rooms.flatMap((r) => r.boundary.map((e) => e.wallId)))];
  const openings = Object.values(ap.openings).filter((o) => wallIds.includes(o.wallId));
  const roomIds = new Set(rooms.map((r) => r.id));
  const furniture = Object.values(ap.furniture).filter((f) => roomIds.has(f.roomId));
  const draftItem = draft?.position ? catalog(draft.itemId) : undefined;
  const selectedChain = new Set(selectedWall && base.walls[selectedWall] ? collinearChain(base, selectedWall).map((w) => w.id) : []);

  return (
    <div className="plan-wrap">
      <div className="plan-toolbar" role="toolbar" aria-label="Вид плана">
        {mode === 'interior' && (
          <>
            <button type="button" aria-pressed={scope === 'room'} onClick={() => ui.getState().setPlanScope('room')}>
              Комната
            </button>
            <button type="button" aria-pressed={scope === 'apartment'} onClick={() => ui.getState().setPlanScope('apartment')}>
              Вся квартира
            </button>
          </>
        )}
        <button type="button" onClick={() => setCustom(null)} disabled={!custom}>
          Вписать
        </button>
      </div>
      <div
        ref={ref}
        className="plan"
        data-testid="plan"
        data-scale={t?.scale}
        data-offset-x={t?.offsetX}
        data-offset-y={t?.offsetY}
        onPointerMove={(e) => {
          if (pan.current) {
            setCustom(panBy(t!, e.clientX - pan.current.x, e.clientY - pan.current.y));
            pan.current = { x: e.clientX, y: e.clientY };
            return;
          }
          const w = wallDrag.current;
          if (w && t) {
            const p = toCm(e);
            const raw = w.vertical ? p.x - w.start.x : p.z - w.start.z;
            setup.getState().setDelta(snapCm(raw, e.altKey ? 1 : WALL_SNAP_CM));
            return;
          }
          if (t) drag.getState().pointAt(toCm(e), !e.altKey);
        }}
        onPointerLeave={() => drag.getState().pointAt(null)}
        onPointerDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            pan.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          } else if (e.button === 0 && e.target === e.currentTarget.querySelector('svg')) ui.getState().select(null);
        }}
        onPointerUp={(e) => {
          if (e.button === 1) pan.current = null;
          // Предмет ставится в точку отпускания, даже если браузер объединил последние движения
          // (обработчик React срабатывает раньше завершения переноса на window).
          if (e.button === 0 && t && drag.getState().draft) drag.getState().pointAt(toCm(e), !e.altKey);
          if (e.button === 0 && wallDrag.current) {
            wallDrag.current = null;
            setup.getState().apply(); // перетаскивание применяется при отпускании (SPEC §9)
          }
        }}
      >
        {t && (
          <svg width={size.w} height={size.h}>
            {rooms.map((r) => (
              <RoomFloor
                key={r.id}
                ap={ap}
                room={r}
                t={t}
                active={r.id === roomId}
                onSelect={mode === 'interior' && scope === 'apartment' && r.id !== roomId ? () => ui.getState().setActiveRoom(r.id) : undefined}
              />
            ))}
            <Walls
              ap={ap}
              t={t}
              wallIds={wallIds}
              selected={selectedChain}
              onWallDown={
                mode === 'setup'
                  ? (wallId, e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      e.currentTarget.ownerSVGElement?.parentElement?.setPointerCapture(e.pointerId);
                      setup.getState().selectWall(wallId);
                      const axis = wallAxis(base, base.walls[wallId]);
                      wallDrag.current = { wallId, start: toCm(e), vertical: Math.abs(axis.dir.x) < 0.5 };
                    }
                  : (wallId, e) => {
                      // Интерьер: геометрия не меняется; нажатие выбирает поверхность стены активной комнаты для отделки (12.1).
                      if (e.button !== 0 || !active?.boundary.some((b) => b.wallId === wallId) || draft) return;
                      e.stopPropagation();
                      ui.getState().selectSurface({ wallId, roomId: active.id });
                    }
              }
            />
            {mode === 'interior' && <WallFinishes ap={ap} rooms={rooms} t={t} selected={selectedSurface} />}
            {openings.map((o) => (
              <OpeningSymbol
                key={o.id}
                ap={ap}
                o={o}
                t={t}
                selected={mode === 'setup' && selectedOpening === o.id}
                onSelect={mode === 'setup' ? () => setup.getState().selectOpening(o.id) : undefined}
              />
            ))}
            {furniture.map((f) => {
              const item = catalog(f.catalogItemId);
              if (!item || draft?.instanceId === f.id) return null;
              return (
                <FurnitureShape
                  key={f.id}
                  t={t}
                  item={item}
                  f={f}
                  testId={`plan-item-${f.id}`}
                  className={f.id === selectedId ? 'plan-item selected' : 'plan-item'}
                  onPointerDown={(e) => {
                    if (mode === 'setup' || e.button !== 0 || f.roomId !== roomId) return;
                    e.stopPropagation();
                    ui.getState().select(f.id);
                    drag.getState().startMove(f.id, toCm(e));
                  }}
                />
              );
            })}
            {draft?.position && draftItem && (
              <FurnitureShape
                t={t}
                item={draftItem}
                f={{ position: draft.position, angleDeg: draft.angleDeg }}
                testId="plan-draft"
                className={draft.proposal?.ok ? 'plan-item draft' : 'plan-item draft invalid'}
              />
            )}
            {scope === 'room' && active && (
              <>
                <RoomDimensions ap={ap} room={active} t={t} outsideCm={Math.max(...active.boundary.map((e) => ap.walls[e.wallId].thicknessCm))} />
                {openings.flatMap((o) =>
                  roomsOfWall(ap, o.wallId)
                    .filter((r) => r.id === active.id)
                    .map((r) => <OpeningLabel key={`${o.id}-${r.id}`} ap={ap} o={o} room={r} t={t} />),
                )}
              </>
            )}
            {scope === 'apartment' && rooms.map((r) => <RoomCaption key={r.id} ap={ap} room={r} t={t} />)}
          </svg>
        )}
      </div>
    </div>
  );
}
