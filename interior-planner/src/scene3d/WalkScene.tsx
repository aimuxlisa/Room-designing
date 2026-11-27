/**
 * Режим «Прогулка» (этап 24, D-17): вид от первого лица на высоте глаз по всей квартире — все комнаты
 * с потолками, окна, проёмы межкомнатных дверей без створок (входная дверь закрыта), мебель и отделка.
 * W A S D и стрелки — шаг, Shift — быстрее, мышь — обзор (щелчок захватывает указатель; без захвата —
 * перетаскивание). Шаг считается по времени кадра; столкновения — domain/walk. Проект не меняется.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useApartment, useCatalog, useStores, useUi } from '../app/stores';
import { PROBE } from '../app/probe';
import { openingFinish } from '../catalog/openingFinishes';
import { daylight } from '../domain/daylight';
import { apartmentLightSources, isItemLit, roomLightSources } from '../domain/lighting';
import { openingSpan } from '../domain/openings';
import { apartmentRect, roomClearRect, roomsOfWall, wallFootprint } from '../domain/rooms';
import type { Apartment, DoorOpening, Id, Room } from '../domain/types';
import { cmToScene } from '../domain/units';
import {
  entryDoors,
  EYE_HEIGHT_CM,
  PITCH_LIMIT,
  roomAt,
  RUN_SPEED_CM_S,
  walkDelta,
  WALK_SPEED_CM_S,
  walkObstacles,
  walkStart,
  walkStep,
  type Obstacle,
} from '../domain/walk';
import { wallBlocks, wallSpanRect } from '../domain/wallBlocks';
import { rectDepth, rectWidth } from '../geometry/rect';
import { themeTokens } from '../ui/themeTokens';
import { DaylightControl } from '../ui/DaylightControl';
import { LightControl } from '../ui/LightControl';
import { FurnitureModel } from './FurnitureModel';
import { OutdoorWorld } from './OutdoorWorld';
import { BlockMesh, center, FloorMesh, NO_RAYCAST, WallBlockMesh, wallFace, WindowMesh } from './RoomParts';
import { LightPool, RoomFixtures } from './RoomLights';
import { SceneLighting } from './SceneLighting';

/** Доля дневного рассеянного света, которую получает потолок как отражённую от пола и стен. */
const CEILING_BOUNCE = 0.35;
/** Чувствительность обзора, рад на пиксель. */
const LOOK_SPEED = 0.0025;

/**
 * Потолок комнаты. Снизу его освещает только нижний цвет полусферы (тёплая «земля»), а отражённого света
 * от пола и стен в интерактивном виде нет — поэтому потолку добавлен рассеянный подсвет по силе дневного света.
 */
function Ceiling({ ap, room }: { ap: Apartment; room: Room }) {
  const hour = useUi((s) => s.hour);
  const r = roomClearRect(ap, room);
  const c = center(r);
  return (
    <mesh name={`ceiling-${room.id}`} rotation-x={Math.PI / 2} position={[cmToScene(c.x), cmToScene(ap.ceilingCm), cmToScene(c.z)]} raycast={NO_RAYCAST} receiveShadow>
      <planeGeometry args={[cmToScene(rectWidth(r)), cmToScene(rectDepth(r))]} />
      <meshStandardMaterial color="#f2efe9" emissive="#e8e6e2" emissiveIntensity={CEILING_BOUNCE * daylight(hour).fill.intensity} roughness={0.9} />
    </mesh>
  );
}

/** Закрытая входная дверь: полотно в проёме. */
function EntryDoor({ ap, door }: { ap: Apartment; door: DoorOpening }) {
  const [s0, s1] = openingSpan(door);
  const f = openingFinish(door);
  return (
    <BlockMesh name={`entry-door-${door.id}`} rect={wallSpanRect(ap, ap.walls[door.wallId], s0, s1, 4)} bottomCm={0} topCm={door.heightCm}>
      <meshStandardMaterial color={f.color} roughness={f.roughness} />
    </BlockMesh>
  );
}

/** Вся квартира: стены каждая один раз, отделка обеих сторон; окна; полы, потолки, светильники и мебель всех комнат. */
function Apartment3D() {
  const ap = useApartment();
  const catalog = useCatalog();
  const lights = useUi((s) => s.lights);
  const rooms = Object.values(ap.rooms);
  return (
    <>
      {rooms.map((room) => (
        <group key={room.id} name={`room-${room.id}`}>
          <FloorMesh ap={ap} room={room} />
          <Ceiling ap={ap} room={room} />
          <RoomFixtures room={room} sources={roomLightSources(ap, room, catalog, lights)} />
        </group>
      ))}
      {Object.values(ap.walls).map((wall) => {
        const fp = wallFootprint(ap, wall);
        const vertical = rectWidth(fp) < rectDepth(fp);
        const faces = roomsOfWall(ap, wall.id).map((room) => wallFace(ap, wall, room));
        return (
          <group key={wall.id} name={`wall-${wall.id}`}>
            {wallBlocks(ap, wall).map((b, i) => (
              <WallBlockMesh key={i} name={`wall-${wall.id}-block-${i}`} block={b} vertical={vertical} faces={faces} />
            ))}
            {Object.values(ap.openings)
              .filter((o) => o.wallId === wall.id && o.kind === 'window')
              .map((o) => (
                <WindowMesh key={o.id} ap={ap} wall={wall} o={o} />
              ))}
          </group>
        );
      })}
      {entryDoors(ap).map((door) => (
        <EntryDoor key={door.id} ap={ap} door={door} />
      ))}
      <Suspense fallback={null}>
        {Object.values(ap.furniture).map((f) => {
          const item = catalog(f.catalogItemId);
          return item ? <FurnitureModel key={f.id} item={item} instance={f} lit={isItemLit(item, f, lights)} /> : null;
        })}
      </Suspense>
    </>
  );
}

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * Камера игрока: клавиши, обзор мышью, шаг по времени кадра со столкновениями (24.1, 24.3).
 * Сообщает комнату, в которой стоит игрок, и захват указателя.
 */
function WalkController(props: { start: { x: number; z: number; yaw: number }; obstacles: readonly Obstacle[]; onRoom: (id: Id | null) => void; onLock: (locked: boolean) => void }) {
  const { ui } = useStores();
  const ap = useApartment();
  const getThree = useThree((s) => s.get);
  const state = useRef({ x: props.start.x, z: props.start.z, yaw: props.start.yaw, pitch: 0, room: null as Id | null });
  const keys = useRef(new Set<string>());
  const { onRoom, onLock } = props;

  useEffect(() => {
    const canvas = getThree().gl.domElement;
    const pressed = keys.current;
    const look = (dx: number, dy: number) => {
      const s = state.current;
      s.yaw -= dx * LOOK_SPEED;
      s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch - dy * LOOK_SPEED));
    };
    const locked = () => document.pointerLockElement === canvas;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      // Esc при захвате освобождает указатель (это делает браузер); без захвата — выход из прогулки.
      if (e.code === 'Escape' && !locked()) return ui.getState().setWalking(false);
      if (Object.values(MOVE_KEYS).some((k) => (k as readonly string[]).includes(e.code))) e.preventDefault();
      pressed.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.code);
    const onBlur = () => pressed.clear();
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      // Захват указателя — по жесту пользователя; если браузер отказал, обзор работает перетаскиванием.
      canvas.requestPointerLock?.()?.catch?.(() => {});
    };
    const onUp = () => void (dragging = false);
    const onMove = (e: PointerEvent) => {
      if (locked() || dragging) look(e.movementX, e.movementY);
    };
    const onLockChange = () => onLock(locked());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (locked()) document.exitPointerLock();
      if (PROBE) Reflect.deleteProperty(window, '__walk');
    };
  }, [getThree, ui, onLock]);

  useFrame(({ camera }, dt) => {
    const s = state.current;
    const k = keys.current;
    const held = (codes: readonly string[]) => (codes.some((c) => k.has(c)) ? 1 : 0);
    const input = { forward: held(MOVE_KEYS.forward) - held(MOVE_KEYS.back), right: held(MOVE_KEYS.right) - held(MOVE_KEYS.left) };
    // Длинный кадр (вкладка была скрыта) не переносит игрока далеко.
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED_CM_S : WALK_SPEED_CM_S;
    const next = walkStep(s, walkDelta(s.yaw, input, speed * Math.min(dt, 0.1)), props.obstacles);
    s.x = next.x;
    s.z = next.z;
    camera.position.set(cmToScene(s.x), cmToScene(EYE_HEIGHT_CM), cmToScene(s.z));
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    const room = roomAt(ap, s);
    if (room !== s.room) {
      s.room = room;
      onRoom(room);
    }
    if (PROBE) Object.assign(window, { __walk: { x: s.x, z: s.z, yaw: s.yaw, pitch: s.pitch, room } });
  });
  return null;
}

/** Сцена прогулки с подсказкой, выключателем комнаты игрока и выходом. */
export function WalkView() {
  const ap = useApartment();
  const catalog = useCatalog();
  const { ui } = useStores();
  const activeRoomId = useUi((s) => s.activeRoomId);
  const lights = useUi((s) => s.lights);
  const obstacles = useMemo(() => walkObstacles(ap, catalog), [ap, catalog]);
  const [start] = useState(() => (activeRoomId && ap.rooms[activeRoomId] ? walkStart(ap, activeRoomId, obstacles) : { ...center(apartmentRect(ap)), yaw: 0 }));
  const [room, setRoom] = useState<Id | null>(null);
  const [locked, setLocked] = useState(false);
  const bounds = apartmentRect(ap);
  const sources = apartmentLightSources(ap, catalog, lights);
  return (
    <>
      <Canvas
        data-testid="walk-scene"
        shadows
        gl={{ stencil: true }}
        camera={{ fov: 70, near: 0.05, far: 2000, position: [cmToScene(start.x), cmToScene(EYE_HEIGHT_CM), cmToScene(start.z)] }}
        onCreated={(s) => {
          if (PROBE) Object.assign(window, { __scene: s.scene, __camera: s.camera, __gl: s.gl });
        }}
      >
        <color attach="background" args={[themeTokens.sceneBg]} />
        <SceneLighting clear={bounds} ceilingCm={ap.ceilingCm} />
        <OutdoorWorld />
        <LightPool sources={sources} near />
        <Apartment3D />
        <WalkController start={start} obstacles={obstacles} onRoom={setRoom} onLock={setLocked} />
      </Canvas>
      <div className="walk-hud" data-testid="walk-hud">
        <p className="walk-room" data-testid="walk-room">
          Прогулка{room ? ` · «${ap.rooms[room]?.name}»` : ''}
        </p>
        <p className="muted">
          W A S D или стрелки — идти, Shift — быстрее. {locked ? 'Мышь — смотреть, Esc — освободить мышь.' : 'Щёлкните по сцене или тяните мышью — смотреть. Esc — выйти.'}
        </p>
        <button type="button" data-testid="walk-exit" onClick={() => ui.getState().setWalking(false)}>
          Выйти из прогулки
        </button>
      </div>
      <div className="scene-controls">
        <DaylightControl />
        <LightControl roomId={room} />
      </div>
    </>
  );
}
