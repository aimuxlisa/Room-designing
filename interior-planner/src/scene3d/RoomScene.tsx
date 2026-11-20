/** 3D активной комнаты: пол, стены и мебель из тех же функций domain, что и план (SPEC §10.2). */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import { Plane, Vector3, type Mesh } from 'three';
import { useApartment, useCatalog, useDrag, useStores, useUi } from '../app/stores';
import { roomClearRect, wallFootprint } from '../domain/rooms';
import type { Apartment, Room, Wall } from '../domain/types';
import { cmToScene, sceneToCm } from '../domain/units';
import { rectDepth, rectWidth, type Point, type Rect } from '../geometry/rect';
import { FurnitureModel } from './FurnitureModel';

const center = (r: Rect) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
/** Точка пола под указателем: пересечение луча с плоскостью y = 0 (а не точка на поверхности модели). */
function floorPoint(e: ThreeEvent<PointerEvent>): Point {
  const p = e.ray.intersectPlane(FLOOR, new Vector3()) ?? e.point;
  return { x: sceneToCm(p.x), z: sceneToCm(p.z) };
}

/** Стена скрывается, когда камера смотрит на неё снаружи комнаты. */
function WallMesh({ ap, wall, room }: { ap: Apartment; wall: Wall; room: Room }) {
  const ref = useRef<Mesh>(null);
  const fp = wallFootprint(ap, wall);
  const c = center(fp);
  const rc = center(roomClearRect(ap, room));
  const vertical = rectWidth(fp) < rectDepth(fp);
  const inward = vertical ? Math.sign(rc.x - c.x) : Math.sign(rc.z - c.z);
  const h = ap.ceilingCm;

  useFrame(({ camera }) => {
    if (!ref.current) return;
    const camCm = sceneToCm(vertical ? camera.position.x : camera.position.z) - (vertical ? c.x : c.z);
    ref.current.visible = camCm * inward > -wall.thicknessCm / 2;
  });

  return (
    <mesh ref={ref} position={[cmToScene(c.x), cmToScene(h / 2), cmToScene(c.z)]} castShadow receiveShadow>
      <boxGeometry args={[cmToScene(rectWidth(fp)), cmToScene(h), cmToScene(rectDepth(fp))]} />
      <meshStandardMaterial color="#d9d4cb" />
    </mesh>
  );
}

function Furniture({ room }: { room: Room }) {
  const ap = useApartment();
  const catalog = useCatalog();
  const { drag, ui } = useStores();
  const draft = useDrag((s) => s.draft);
  const draftItem = draft?.position ? catalog(draft.itemId) : undefined;
  // OrbitControls получает pointerdown раньше событий сцены — отключаем его синхронно при захвате.
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  return (
    <>
      {Object.values(ap.furniture)
        .filter((f) => f.roomId === room.id && f.id !== draft?.instanceId)
        .map((f) => {
          const item = catalog(f.catalogItemId);
          return item ? (
            <FurnitureModel
              key={f.id}
              item={item}
              instance={f}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (controls) controls.enabled = false;
                ui.getState().select(f.id);
                drag.getState().startMove(f.id, floorPoint(e));
              }}
            />
          ) : null;
        })}
      {draft?.position && draftItem && (
        <FurnitureModel
          item={draftItem}
          instance={{ id: draft.instanceId, position: draft.position, angleDeg: draft.angleDeg }}
          ghost={draft.proposal?.ok ? 'valid' : 'invalid'}
        />
      )}
    </>
  );
}

function RoomContent() {
  const ap = useApartment();
  const { drag } = useStores();
  const dragging = useDrag((s) => s.draft !== null);
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  if (!room) return null;
  const clear = roomClearRect(ap, room);
  const c = center(clear);
  return (
    <>
      <mesh name="floor" rotation-x={-Math.PI / 2} position={[cmToScene(c.x), 0, cmToScene(c.z)]} receiveShadow>
        <planeGeometry args={[cmToScene(rectWidth(clear)), cmToScene(rectDepth(clear))]} />
        <meshStandardMaterial color="#b89a74" />
      </mesh>
      {/* Невидимая плоскость пола для указателя, в том числе за пределами комнаты. */}
      <mesh
        name="pick-plane"
        rotation-x={-Math.PI / 2}
        position={[cmToScene(c.x), 0.001, cmToScene(c.z)]}
        onPointerMove={(e) => drag.getState().pointAt(floorPoint(e), !e.nativeEvent.altKey)}
      >
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {room.boundary.map((e) => (
        <WallMesh key={e.wallId} ap={ap} wall={ap.walls[e.wallId]} room={room} />
      ))}
      <Suspense fallback={null}>
        <Furniture room={room} />
      </Suspense>
      {/* Перенос не вращает камеру (AC-08). */}
      <OrbitControls
        makeDefault
        enabled={!dragging}
        target={[cmToScene(c.x), 0.8, cmToScene(c.z)]}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

export function RoomScene() {
  const ap = useApartment();
  const { drag } = useStores();
  const roomId = useUi((s) => s.activeRoomId);
  const room = roomId ? ap.rooms[roomId] : undefined;
  const c = room ? center(roomClearRect(ap, room)) : { x: 0, z: 0 };
  return (
    <Canvas
      data-testid="scene"
      shadows
      onPointerLeave={() => drag.getState().pointAt(null)}
      onCreated={({ scene, camera }) => {
        // Доступ к сцене для браузерных проверок; только в режиме разработки.
        if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __camera: camera });
      }}
      camera={{ position: [cmToScene(c.x) + 4, 4.5, cmToScene(c.z) + 5], fov: 50 }}
    >
      <color attach="background" args={['#14161a']} />
      <hemisphereLight args={['#ffffff', '#3a3530', 0.8]} />
      <directionalLight position={[3, 8, 4]} intensity={1.6} castShadow />
      <RoomContent />
    </Canvas>
  );
}
