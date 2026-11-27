/**
 * 3D активной комнаты (SPEC §10.2): пол, стены с реальными проёмами, окна, полотна дверей и мебель —
 * из тех же функций domain, что и план. Видна ровно одна комната (AC-05); переход — через дверь (10.4).
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { DoubleSide, Mesh, Plane, Vector2, Vector3, type Group } from 'three';
import { useApartment, useCatalog, useDrag, useStores, useUi } from '../app/stores';
import { doorLinks, type DoorLink } from '../domain/navigation';
import { doorSwing, openingSpan } from '../domain/openings';
import { roomClearRect } from '../domain/rooms';
import { instanceCorners } from '../domain/furniture';
import type { Apartment, CatalogItem, DoorOpening, FurnitureInstance, Opening, Room, Wall } from '../domain/types';
import { themeTokens } from '../ui/themeTokens';
import { cmToScene, sceneToCm } from '../domain/units';
import { wallBlocks, wallSpanRect } from '../domain/wallBlocks';
import { rotatePoint } from '../geometry/placement';
import { rectDepth, rectWidth, type Point } from '../geometry/rect';
import { assetErrorReason, useAssetStatus } from './assetStatus';
import { FurnitureModel } from './FurnitureModel';
import { roomView } from './roomView';
import { SceneLighting } from './SceneLighting';
import { OutdoorWorld } from './OutdoorWorld';
import { openingFinish } from '../catalog/openingFinishes';
import { PROBE } from '../app/probe';
import { DaylightControl } from '../ui/DaylightControl';
import { LightControl } from '../ui/LightControl';
import { RoomLights } from './RoomLights';
import { isItemLit } from '../domain/lighting';
import { SceneBoundary, SceneUnavailable, webglAvailable } from './SceneGuard';
import { WalkView } from './WalkScene';
import { center, FloorMesh, NO_RAYCAST, WallBlockMesh, wallFace, WindowMesh, wallOrientation } from './RoomParts';

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** Точка пола под указателем: пересечение луча с плоскостью y = 0 (а не точка на поверхности модели). */
function floorPoint(e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>): Point {
  const p = e.ray.intersectPlane(FLOOR, new Vector3()) ?? e.point;
  return { x: sceneToCm(p.x), z: sceneToCm(p.z) };
}

/** Полотно двери, открытое на 90° в комнату (та же створка, что на плане). */
function DoorLeaf({ ap, o }: { ap: Apartment; o: DoorOpening }) {
  const s = doorSwing(ap, o);
  const [dx, dz] = [s.leafEnd.x - s.hinge.x, s.leafEnd.z - s.hinge.z];
  return (
    <mesh
      name={`door-leaf-${o.id}`}
      position={[cmToScene((s.hinge.x + s.leafEnd.x) / 2), cmToScene(o.heightCm / 2), cmToScene((s.hinge.z + s.leafEnd.z) / 2)]}
      rotation-y={-Math.atan2(dz, dx)}
      castShadow
    >
      <boxGeometry args={[cmToScene(Math.hypot(dx, dz)), cmToScene(o.heightCm), cmToScene(4)]} />
      <meshStandardMaterial color={openingFinish(o).color} roughness={openingFinish(o).roughness} />
    </mesh>
  );
}

function OpeningMesh({ ap, wall, o, room }: { ap: Apartment; wall: Wall; o: Opening; room: Room }) {
  if (o.kind === 'window') return <WindowMesh ap={ap} wall={wall} o={o} />;
  return o.opensIntoRoomId === room.id ? <DoorLeaf ap={ap} o={o} /> : null;
}

/** Невидимая зона проёма межкомнатной двери: нажатие переводит в соседнюю комнату. */
function DoorPortal({ ap, wall, door, onEnter }: { ap: Apartment; wall: Wall; door: DoorOpening; onEnter: () => void }) {
  const [s0, s1] = openingSpan(door);
  const rect = wallSpanRect(ap, wall, s0, s1, wall.thicknessCm + 2);
  const c = center(rect);
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  return (
    <mesh
      name={`door-portal-${door.id}`}
      userData={{ pick: true }}
      position={[cmToScene(c.x), cmToScene(door.heightCm / 2), cmToScene(c.z)]}
      onClick={(e) => {
        e.stopPropagation();
        onEnter();
      }}
      onPointerOver={() => void (document.body.style.cursor = 'pointer')}
      onPointerOut={() => void (document.body.style.cursor = '')}
    >
      <boxGeometry args={[cmToScene(rectWidth(rect)), cmToScene(door.heightCm), cmToScene(rectDepth(rect))]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * Стена активной комнаты с проёмами. Скрывается вместе с откосами, окнами и полотнами, когда камера
 * смотрит на неё снаружи комнаты. Скрытая стена не перехватывает указатель: Raycaster в three
 * не учитывает visible, поэтому у её зон дверей отключается raycast (10.5).
 */
function WallGroup({ ap, wall, room, links }: { ap: Apartment; wall: Wall; room: Room; links: readonly DoorLink[] }) {
  const { ui } = useStores();
  const ref = useRef<Group>(null);
  const { vertical, inward, center: c } = wallOrientation(ap, wall, room);
  const face = wallFace(ap, wall, room);

  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const camCm = sceneToCm(vertical ? camera.position.x : camera.position.z) - (vertical ? c.x : c.z);
    const visible = camCm * inward > -wall.thicknessCm / 2;
    g.visible = visible;
    for (const o of g.children) if (o.userData.pick) (o as Mesh).raycast = visible ? Mesh.prototype.raycast : NO_RAYCAST;
  });

  // Выбор поверхности для отделки (12.1): только если стена — ближайший интерактивный объект и это щелчок, а не перенос.
  const selectSurface = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 2 || e.intersections[0]?.object !== e.object) return;
    e.stopPropagation();
    ui.getState().selectSurface({ wallId: wall.id, roomId: room.id });
  };

  return (
    <group ref={ref} name={`wall-${wall.id}`}>
      {wallBlocks(ap, wall).map((b, i) => (
        <WallBlockMesh
          key={i}
          name={`wall-${wall.id}-block-${i}`}
          block={b}
          vertical={vertical}
          faces={[face]}
          onSelect={selectSurface}
        />
      ))}
      {Object.values(ap.openings)
        .filter((o) => o.wallId === wall.id)
        .map((o) => (
          <OpeningMesh key={o.id} ap={ap} wall={wall} o={o} room={room} />
        ))}
      {links
        .filter((l) => l.door.wallId === wall.id && l.to)
        .map(({ door, to }) => (
          <DoorPortal key={door.id} ap={ap} wall={wall} door={door} onEnter={() => ui.getState().setActiveRoom(to!.id)} />
        ))}
    </group>
  );
}

/** Контур выбранного предмета на полу — тот же контур, что на плане (11.2). */
function SelectionOutline({ item, f }: { item: CatalogItem; f: FurnitureInstance }) {
  const positions = useMemo(
    () => new Float32Array(instanceCorners(f, item).flatMap((p) => [cmToScene(p.x), cmToScene(1), cmToScene(p.z)])),
    [f, item],
  );
  return (
    <lineLoop name={`selection-${f.id}`}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={themeTokens.accent} />
    </lineLoop>
  );
}

/**
 * Кольцо поворота вокруг выбранного предмета в 3D (14.4): тянуть по полу — лицевая сторона смотрит
 * на указатель; тот же цикл переноса, что у ручки на плане. У настенных предметов кольца нет.
 */
function RotateRing({ item, f, onStart }: { item: CatalogItem; f: FurnitureInstance; onStart: (e: ThreeEvent<PointerEvent>) => void }) {
  const inner = Math.hypot(item.size.widthCm, item.size.depthCm) / 2 + 10;
  return (
    <mesh
      name={`rotate-ring-${f.id}`}
      rotation-x={-Math.PI / 2}
      position={[cmToScene(f.position.xCm), cmToScene(1.5), cmToScene(f.position.zCm)]}
      onPointerDown={onStart}
    >
      <ringGeometry args={[cmToScene(inner), cmToScene(inner + 9), 64]} />
      <meshBasicMaterial color={themeTokens.accent} transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/**
 * Настенный предмет скрывается вместе со своей стеной, когда камера за этой стеной (как откосы и окна),
 * и тогда не перехватывает указатель (Raycaster в three не учитывает visible).
 */
function HideBehindWall({ f, item, children }: { f: FurnitureInstance; item: CatalogItem; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const shown = useRef(true);
  // Задняя сторона предмета — у стены; наружу от комнаты смотрит её нормаль.
  const r = rotatePoint({ x: 0, z: -item.size.depthCm / 2 }, f.angleDeg);
  const len = Math.hypot(r.x, r.z) || 1;
  const back = { x: f.position.xCm + r.x, z: f.position.zCm + r.z };
  const out = { x: r.x / len, z: r.z / len };
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const visible = (sceneToCm(camera.position.x) - back.x) * out.x + (sceneToCm(camera.position.z) - back.z) * out.z < 0;
    g.visible = visible;
    // Модель может догрузиться позже — пока предмет скрыт, raycast отключается у всех его мешей каждый кадр.
    if (visible === shown.current && visible) return;
    shown.current = visible;
    g.traverse((o) => {
      if (o instanceof Mesh) o.raycast = visible ? Mesh.prototype.raycast : NO_RAYCAST;
    });
  });
  return <group ref={ref}>{children}</group>;
}

function Furniture({ room }: { room: Room }) {
  const ap = useApartment();
  const catalog = useCatalog();
  const { drag, ui } = useStores();
  const draft = useDrag((s) => s.draft);
  const selectedId = useUi((s) => s.selectedId);
  const lights = useUi((s) => s.lights);
  const selected = selectedId ? ap.furniture[selectedId] : undefined;
  const selectedItem = selected && selected.roomId === room.id && !draft ? catalog(selected.catalogItemId) : undefined;
  const draftItem = draft?.position ? catalog(draft.itemId) : undefined;
  // OrbitControls получает pointerdown раньше событий сцены — отключаем его синхронно при захвате;
  // включает его снова свойство enabled={!dragging}, когда кандидата больше нет.
  const getState = useThree((s) => s.get);
  const holdCamera = () => {
    const c = getState().controls as unknown as { enabled: boolean } | null;
    if (c) c.enabled = false;
  };
  return (
    <>
      {Object.values(ap.furniture)
        .filter((f) => f.roomId === room.id && f.id !== draft?.instanceId)
        .map((f) => {
          const item = catalog(f.catalogItemId);
          if (!item) return null;
          const model = (
            <FurnitureModel
              key={f.id}
              item={item}
              instance={f}
              lit={isItemLit(item, f, lights)}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                holdCamera();
                ui.getState().select(f.id);
                drag.getState().startMove(f.id, floorPoint(e));
              }}
            />
          );
          return item.mounting === 'wall' ? (
            <HideBehindWall key={f.id} f={f} item={item}>
              {model}
            </HideBehindWall>
          ) : (
            model
          );
        })}
      {draft?.position && draftItem && (
        <FurnitureModel
          item={draftItem}
          instance={{ id: draft.instanceId, position: draft.position, angleDeg: draft.angleDeg }}
          ghost={draft.proposal?.ok ? 'valid' : 'invalid'}
        />
      )}
      {selected && selectedItem && <SelectionOutline item={selectedItem} f={selected} />}
      {selected && selectedItem && selectedItem.mounting !== 'wall' && (
        <RotateRing
          item={selectedItem}
          f={selected}
          onStart={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            holdCamera();
            drag.getState().startRotate(selected.id);
          }}
        />
      )}
    </>
  );
}

interface Controls {
  readonly target: Vector3;
  update(): void;
}

/**
 * При входе в комнату камера ставится напротив двери (10.3). Срабатывает только при смене комнаты:
 * квартира читается из хранилища в момент входа, поэтому перенос мебели камеру не сбрасывает.
 */
function CameraRig({ roomId }: { roomId: string }) {
  const { project } = useStores();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  useEffect(() => {
    const ap = project.getState().history.present;
    const room = ap.rooms[roomId];
    if (!controls || !room) return;
    const v = roomView(ap, room);
    camera.position.set(...v.position);
    controls.target.set(...v.target);
    controls.update();
    // Для браузерных проверок: вид комнаты установлен (камера и цель на месте).
    if (PROBE) Object.assign(window, { __view: roomId, __controls: controls });
  }, [roomId, controls, camera, project]);
  return null;
}

function RoomContent() {
  const ap = useApartment();
  const { drag, ui } = useStores();
  const dragging = useDrag((s) => s.draft !== null);
  const roomId = useUi((s) => s.activeRoomId);
  // Нажатие пришлось на пол. Предмет при нажатии уходит в перенос и монтируется заново, поэтому при щелчке
  // его уже нет среди попаданий R3F — щелчок по полу без этой отметки снимал бы выбор предмета.
  const floorPressed = useRef(false);
  useEffect(() => {
    const reset = () => void (floorPressed.current = false);
    window.addEventListener('pointerdown', reset, true);
    return () => window.removeEventListener('pointerdown', reset, true);
  }, []);
  const room = roomId ? ap.rooms[roomId] : undefined;
  if (!room) return null;
  const clear = roomClearRect(ap, room);
  const c = center(clear);
  const links = doorLinks(ap, room.id);
  const view = roomView(ap, room);
  return (
    <>
      <SceneLighting clear={clear} ceilingCm={ap.ceilingCm} />
      <OutdoorWorld />
      <RoomLights room={room} />
      <FloorMesh ap={ap} room={room} />
      {/* Невидимая плоскость пола для указателя, в том числе за пределами комнаты. */}
      <mesh
        name="pick-plane"
        rotation-x={-Math.PI / 2}
        position={[cmToScene(c.x), 0.001, cmToScene(c.z)]}
        onPointerMove={(e) => drag.getState().pointAt(floorPoint(e), !e.nativeEvent.altKey)}
        // Точка отпускания — окончательная, даже если последние движения объединены браузером.
        onPointerUp={(e) => drag.getState().draft && drag.getState().pointAt(floorPoint(e), !e.nativeEvent.altKey)}
        // Щелчок по полу комнаты (не перенос, ничего перед полом) — выбор покрытия пола (D-16).
        onPointerDown={(e) => void (floorPressed.current = e.intersections[0]?.object === e.object)}
        onClick={(e) => {
          if (!floorPressed.current || e.delta > 2 || e.intersections[0]?.object !== e.object || drag.getState().draft) return;
          const p = floorPoint(e);
          if (p.x < clear.minX || p.x > clear.maxX || p.z < clear.minZ || p.z > clear.maxZ) return;
          e.stopPropagation();
          ui.getState().selectFloor(room.id);
        }}
      >
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {room.boundary.map((e) => (
        <WallGroup key={e.wallId} ap={ap} wall={ap.walls[e.wallId]} room={room} links={links} />
      ))}
      <Suspense fallback={null}>
        <Furniture room={room} />
      </Suspense>
      {/* Перенос не вращает камеру (AC-08). */}
      {/* Пределы приближения — по размеру комнаты (10.3). */}
      <OrbitControls makeDefault enabled={!dragging} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={view.minDistance} maxDistance={view.maxDistance} />
      <CameraRig roomId={room.id} />
    </>
  );
}

/** Ошибки загрузки моделей с причиной и повтором (13.6); остальная сцена и проект работают. */
function AssetErrors() {
  const errors = useAssetStatus((s) => s.errors);
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div className="scene-errors" role="alert" data-testid="asset-errors">
      {entries.map(([url, e]) => (
        <p key={url}>
          <span title={e.message}>
            Не удалось загрузить «{e.name}»: {assetErrorReason(e.message)}. Проект и остальные предметы сохранены.
          </span>
          <button type="button" onClick={() => useAssetStatus.getState().retry(url)}>
            Повторить
          </button>
        </p>
      ))}
    </div>
  );
}

/** Переходы из активной комнаты: кнопки для межкомнатных дверей; входная дверь ведёт наружу (10.4). */
function DoorNav() {
  const ap = useApartment();
  const { ui } = useStores();
  const roomId = useUi((s) => s.activeRoomId);
  if (!roomId) return null;
  const links = doorLinks(ap, roomId);
  return (
    <nav className="scene-nav" aria-label="Переходы между помещениями">
      {webglAvailable() && (
        <button type="button" className="walk-enter" data-testid="walk-enter" onClick={() => ui.getState().setWalking(true)}>
          Прогулка по квартире
        </button>
      )}
      {links.map(({ door, to }) =>
        to ? (
          <button key={door.id} type="button" data-testid={`nav-door-${door.id}`} onClick={() => ui.getState().setActiveRoom(to.id)}>
            В «{to.name}»
          </button>
        ) : (
          <span key={door.id} className="scene-nav-note" data-testid={`nav-entry-${door.id}`}>
            Входная дверь — выход наружу
          </span>
        ),
      )}
    </nav>
  );
}

/** 3D-вид активной комнаты или прогулка по квартире (этап 24); без WebGL 2 — сообщение вместо сцены (18.5). */
export function RoomScene() {
  const walking = useUi((s) => s.walking);
  if (walking && webglAvailable())
    return (
      <div className="scene-wrap walking" role="region" aria-label="Прогулка по квартире">
        <SceneBoundary>
          <WalkView />
        </SceneBoundary>
      </div>
    );
  // Переходы через двери работают и без 3D.
  return (
    <div className="scene-wrap">
      {webglAvailable() ? (
        <SceneBoundary>
          <RoomCanvas />
        </SceneBoundary>
      ) : (
        <SceneUnavailable />
      )}
      <DoorNav />
      <div className="scene-controls">
        <DaylightControl />
        <LightControl />
      </div>
    </div>
  );
}

function RoomCanvas() {
  const ap = useApartment();
  const { drag } = useStores();
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  const initial = room ? roomView(ap, room).position : ([4, 4.5, 5] as const);
  return (
    <>
      <Canvas
        data-testid="scene"
        shadows
        // Трафарет — для мира за окнами (20.3).
        gl={{ stencil: true }}
        onPointerLeave={() => drag.getState().pointAt(null)}
        onCreated={(state) => {
          // Доступ к сцене для браузерных проверок (см. app/probe).
          if (!PROBE) return;
          Object.assign(window, {
            __scene: state.scene,
            __camera: state.camera,
            __gl: state.gl,
            /** Имена объектов под точкой экрана (NDC), с учётом отключённого raycast у скрытых стен. */
            __pick: (x: number, y: number) => {
              state.raycaster.setFromCamera(new Vector2(x, y), state.camera);
              return state.raycaster.intersectObjects(state.scene.children, true).map((h) => h.object.name);
            },
          });
        }}
        camera={{ position: [...initial], fov: 50 }}
      >
        <color attach="background" args={[themeTokens.sceneBg]} />
        <RoomContent />
      </Canvas>
      <AssetErrors />
    </>
  );
}
