/**
 * 3D активной комнаты (SPEC §10.2): пол, стены с реальными проёмами, окна, полотна дверей и мебель —
 * из тех же функций domain, что и план. Видна ровно одна комната (AC-05); переход — через дверь (10.4).
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { DoubleSide, Mesh, Plane, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, Vector3, type Group } from 'three';
import { getWallMaterial } from '../catalog/materials';
import { surfaceKey } from '../domain/rooms';
import { tileUv, type TileUv } from '../domain/surfaces';
import type { MaterialDefinition } from '../domain/types';
import type { WallBlock } from '../domain/wallBlocks';
import { useApartment, useCatalog, useDrag, useStores, useUi } from '../app/stores';
import { doorLinks, type DoorLink } from '../domain/navigation';
import { doorSwing, openingSpan, openingVerticalRange } from '../domain/openings';
import { roomClearRect, wallFootprint } from '../domain/rooms';
import { instanceCorners } from '../domain/furniture';
import type { Apartment, CatalogItem, DoorOpening, FurnitureInstance, Opening, Room, Wall } from '../domain/types';
import { themeTokens } from '../ui/themeTokens';
import { cmToScene, sceneToCm } from '../domain/units';
import { wallBlocks, wallSpanRect } from '../domain/wallBlocks';
import { rotatePoint } from '../geometry/placement';
import { rectDepth, rectWidth, type Point, type Rect } from '../geometry/rect';
import { useAssetStatus } from './assetStatus';
import { FurnitureModel } from './FurnitureModel';
import { roomView } from './roomView';
import { SceneLighting } from './SceneLighting';
import { openingFinish } from '../catalog/openingFinishes';

const center = (r: Rect) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const NO_RAYCAST = () => {};
const WALL_COLOR = '#d9d4cb';

/** Точка пола под указателем: пересечение луча с плоскостью y = 0 (а не точка на поверхности модели). */
function floorPoint(e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>): Point {
  const p = e.ray.intersectPlane(FLOOR, new Vector3()) ?? e.point;
  return { x: sceneToCm(p.x), z: sceneToCm(p.z) };
}

/** Коробка по контуру в плане и высотному диапазону, см. */
function BlockMesh({ rect, bottomCm, topCm, name, children }: { rect: Rect; bottomCm: number; topCm: number; name?: string; children: ReactNode }) {
  const c = center(rect);
  return (
    <mesh name={name} position={[cmToScene(c.x), cmToScene((bottomCm + topCm) / 2), cmToScene(c.z)]} castShadow receiveShadow>
      <boxGeometry args={[cmToScene(rectWidth(rect)), cmToScene(topCm - bottomCm), cmToScene(rectDepth(rect))]} />
      {children}
    </mesh>
  );
}

/** Окно — стекло в отверстии; дверь — полотно, открытое на 90° в эту комнату (та же створка, что на плане). */
/** Рама окна (D-26): обвязка по контуру и вертикальный импост, толщина 6 см, по центру стены. */
function WindowFrame({ ap, wall, o }: { ap: Apartment; wall: Wall; o: Opening }) {
  const [s0, s1] = openingSpan(o);
  const [bottom, top] = openingVerticalRange(o);
  const f = openingFinish(o);
  const bar = 6;
  const mid = (s0 + s1) / 2;
  const parts: [number, number, number, number][] = [
    [s0, s0 + bar, bottom, top],
    [s1 - bar, s1, bottom, top],
    [s0, s1, bottom, bottom + bar],
    [s0, s1, top - bar, top],
    [mid - bar / 2, mid + bar / 2, bottom, top],
  ];
  return (
    <>
      {parts.map(([a, b, lo, hi], i) => (
        <BlockMesh key={i} name={`window-frame-${o.id}-${i}`} rect={wallSpanRect(ap, wall, a, b, 8)} bottomCm={lo} topCm={hi}>
          <meshStandardMaterial color={f.color} roughness={f.roughness} />
        </BlockMesh>
      ))}
    </>
  );
}

function OpeningMesh({ ap, wall, o, room }: { ap: Apartment; wall: Wall; o: Opening; room: Room }) {
  const [s0, s1] = openingSpan(o);
  if (o.kind === 'window') {
    const [bottom, top] = openingVerticalRange(o);
    return (
      <>
        <BlockMesh name={`window-${o.id}`} rect={wallSpanRect(ap, wall, s0, s1, 2)} bottomCm={bottom} topCm={top}>
          <meshStandardMaterial color="#9fc6e0" transparent opacity={0.25} depthWrite={false} />
        </BlockMesh>
        <WindowFrame ap={ap} wall={wall} o={o} />
      </>
    );
  }
  if (o.opensIntoRoomId !== room.id) return null;
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

/** Грань блока, обращённая в комнату (группа BoxGeometry), и направление оси u текстуры на ней. */
function innerFace(vertical: boolean, inward: number): { index: number; udir: 1 | -1 } {
  // BoxGeometry: 0 = +x, 1 = −x, 4 = +z, 5 = −z; u на +x растёт к −z, на −x к +z, на +z к +x, на −z к −x.
  if (vertical) return inward > 0 ? { index: 0, udir: -1 } : { index: 1, udir: 1 };
  return inward > 0 ? { index: 4, udir: 1 } : { index: 5, udir: -1 };
}

/** Обои: своя копия текстуры на блок, повтор и сдвиг — из размеров в см (12.4). */
function WallpaperMaterial({ attach, m, uv }: { attach: string; m: MaterialDefinition; uv: TileUv }) {
  const tex = useMemo(() => {
    const t = new TextureLoader().load(m.textureUrl!);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [m.textureUrl]);
  useEffect(() => () => tex.dispose(), [tex]);
  tex.repeat.set(uv.repeat[0], uv.repeat[1]);
  tex.offset.set(uv.offset[0], uv.offset[1]);
  return <meshStandardMaterial attach={attach} name={`finish:${m.id}`} map={tex} roughness={m.roughness} />;
}

/** Блок стены: внутренняя грань получает отделку этой комнаты, остальные — базовый цвет (AC-11). */
function WallBlockMesh(props: {
  block: WallBlock;
  name: string;
  vertical: boolean;
  inward: number;
  finish: MaterialDefinition | undefined;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { block, vertical, inward, finish } = props;
  const { rect, bottomCm, topCm } = block;
  const c = center(rect);
  const face = innerFace(vertical, inward);
  const [min, max] = vertical ? [rect.minZ, rect.maxZ] : [rect.minX, rect.maxX];
  const uv = finish?.tileSizeCm ? tileUv(face.udir * (face.udir > 0 ? min : max), max - min, bottomCm, topCm - bottomCm, finish.tileSizeCm) : null;
  return (
    <mesh
      name={props.name}
      userData={{ pick: true }}
      position={[cmToScene(c.x), cmToScene((bottomCm + topCm) / 2), cmToScene(c.z)]}
      castShadow
      receiveShadow
      onClick={props.onSelect}
    >
      <boxGeometry args={[cmToScene(rectWidth(rect)), cmToScene(topCm - bottomCm), cmToScene(rectDepth(rect))]} />
      {[0, 1, 2, 3, 4, 5].map((i) =>
        i === face.index && finish ? (
          finish.textureUrl && uv ? (
            <WallpaperMaterial key={`${i}-${finish.id}`} attach={`material-${i}`} m={finish} uv={uv} />
          ) : (
            <meshStandardMaterial key={`${i}-${finish.id}`} attach={`material-${i}`} name={`finish:${finish.id}`} color={finish.color} roughness={finish.roughness} />
          )
        ) : (
          <meshStandardMaterial key={i} attach={`material-${i}`} color={WALL_COLOR} />
        ),
      )}
    </mesh>
  );
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
  const fp = wallFootprint(ap, wall);
  const c = center(fp);
  const rc = center(roomClearRect(ap, room));
  const vertical = rectWidth(fp) < rectDepth(fp);
  const inward = vertical ? Math.sign(rc.x - c.x) : Math.sign(rc.z - c.z);

  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const camCm = sceneToCm(vertical ? camera.position.x : camera.position.z) - (vertical ? c.x : c.z);
    const visible = camCm * inward > -wall.thicknessCm / 2;
    g.visible = visible;
    for (const o of g.children) if (o.userData.pick) (o as Mesh).raycast = visible ? Mesh.prototype.raycast : NO_RAYCAST;
  });

  const finish = getWallMaterial(ap.finishes.walls[surfaceKey(wall.id, room.id)] ?? '');
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
          inward={inward}
          finish={finish}
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
    if (import.meta.env.DEV) Object.assign(window, { __view: roomId, __controls: controls });
  }, [roomId, controls, camera, project]);
  return null;
}

/** Пол комнаты: покрытие (D-16, D-25) с физическим повтором текстуры или базовый цвет. */
function FloorMesh({ ap, room, clear }: { ap: Apartment; room: Room; clear: Rect }) {
  const c = center(clear);
  const [w, d] = [rectWidth(clear), rectDepth(clear)];
  const finish = getWallMaterial(ap.finishes.floors[room.id] ?? '');
  return (
    <mesh name={`floor-${room.id}`} rotation-x={-Math.PI / 2} position={[cmToScene(c.x), 0, cmToScene(c.z)]} receiveShadow>
      <planeGeometry args={[cmToScene(w), cmToScene(d)]} />
      {finish?.textureUrl && finish.tileSizeCm ? (
        <WallpaperMaterial key={finish.id} attach="material" m={finish} uv={tileUv(clear.minX, w, clear.minZ, d, finish.tileSizeCm)} />
      ) : (
        <meshStandardMaterial color={finish?.color ?? '#b89a74'} />
      )}
    </mesh>
  );
}

function RoomContent() {
  const ap = useApartment();
  const { drag, ui } = useStores();
  const dragging = useDrag((s) => s.draft !== null);
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  if (!room) return null;
  const clear = roomClearRect(ap, room);
  const c = center(clear);
  const links = doorLinks(ap, room.id);
  const view = roomView(ap, room);
  return (
    <>
      <SceneLighting center={c} spanCm={Math.max(rectWidth(clear), rectDepth(clear))} />
      <FloorMesh ap={ap} room={room} clear={clear} />
      {/* Невидимая плоскость пола для указателя, в том числе за пределами комнаты. */}
      <mesh
        name="pick-plane"
        rotation-x={-Math.PI / 2}
        position={[cmToScene(c.x), 0.001, cmToScene(c.z)]}
        onPointerMove={(e) => drag.getState().pointAt(floorPoint(e), !e.nativeEvent.altKey)}
        // Точка отпускания — окончательная, даже если последние движения объединены браузером.
        onPointerUp={(e) => drag.getState().draft && drag.getState().pointAt(floorPoint(e), !e.nativeEvent.altKey)}
        // Щелчок по полу комнаты (не перенос, ничего перед полом) — выбор покрытия пола (D-16).
        onClick={(e) => {
          if (e.delta > 2 || e.intersections[0]?.object !== e.object || drag.getState().draft) return;
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
          <span>
            Не удалось загрузить «{e.name}»: {e.message}. Проект и остальные предметы сохранены.
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

export function RoomScene() {
  const ap = useApartment();
  const { drag } = useStores();
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  const initial = room ? roomView(ap, room).position : ([4, 4.5, 5] as const);
  return (
    <div className="scene-wrap">
      <Canvas
        data-testid="scene"
        shadows
        onPointerLeave={() => drag.getState().pointAt(null)}
        onCreated={(state) => {
          // Доступ к сцене для браузерных проверок; только в режиме разработки.
          if (!import.meta.env.DEV) return;
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
        <color attach="background" args={['#14161a']} />
        <RoomContent />
      </Canvas>
      <DoorNav />
      <AssetErrors />
    </div>
  );
}
