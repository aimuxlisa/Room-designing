/**
 * Искусственный свет (21.1, 21.3, 21.4, 24.4): стандартный плафон, свечение включённых светильников
 * и пул точечных источников.
 * Источников всегда MAX_ACTIVE_LIGHTS, выключенные имеют силу 0: число источников в сцене не меняется,
 * поэтому включение света и движение игрока не перекомпилируют шейдеры. Тени от ламп не строятся (D-08:
 * тени точечных источников — 6 проходов на каждый), тени дают солнце и луна (этап 20).
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PointLight } from 'three';
import { useApartment, useCatalog, useUi } from '../app/stores';
import {
  activeLightSources,
  hasStandardFixture,
  MAX_ACTIVE_LIGHTS,
  nearestLightSources,
  roomLightSources,
  STANDARD_FIXTURE,
  standardFixtureId,
  type LightSource,
} from '../domain/lighting';
import type { Room } from '../domain/types';
import { isOwnModel } from '../catalog/ownModels';
import { cmToScene, sceneToCm } from '../domain/units';

const WARM = '#ffd9a8';
const NO_RAYCAST = () => {};
const pos = (s: LightSource): [number, number, number] => [cmToScene(s.at.x), cmToScene(s.at.y), cmToScene(s.at.z)];

/**
 * Точечные источники. near = false — включённые по порядку (комната редактора, 21.3);
 * near = true — ближайшие к камере (прогулка по квартире, 24.4), выбор обновляется каждый кадр.
 */
export function LightPool({ sources, near }: { sources: readonly LightSource[]; near: boolean }) {
  const refs = useRef<(PointLight | null)[]>([]);
  useFrame(({ camera }) => {
    const chosen = near ? nearestLightSources(sources, { x: sceneToCm(camera.position.x), z: sceneToCm(camera.position.z) }) : activeLightSources(sources);
    refs.current.forEach((l, i) => {
      if (!l) return;
      const s = chosen[i];
      l.name = s ? `light-${s.id}` : `light-slot-${i}`;
      l.intensity = s ? s.intensity : 0;
      l.distance = s ? cmToScene(s.rangeCm) : 1;
      const [x, y, z] = s ? pos(s) : [0, -10, 0];
      l.position.set(x, y, z);
    });
  });
  return (
    <group name="light-pool">
      {Array.from({ length: MAX_ACTIVE_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => void (refs.current[i] = l)} color={WARM} intensity={0} decay={2} position={[0, -10, 0]} />
      ))}
    </group>
  );
}

/** Плафон комнаты и тёплое ядро включённых светильников, у которых нет своего светящегося абажура. */
export function RoomFixtures({ room, sources }: { room: Room; sources: readonly LightSource[] }) {
  const ap = useApartment();
  const catalog = useCatalog();
  const standard = hasStandardFixture(ap, room, catalog) ? sources.find((s) => s.id === standardFixtureId(room.id)) : undefined;
  // Собственные модели светятся абажуром (OwnModel), остальным нужно видимое ядро.
  const ownShade = (id: string) => {
    const f = ap.furniture[id];
    const item = f && catalog(f.catalogItemId);
    return !!item && isOwnModel(item);
  };
  return (
    <group name={`fixtures-${room.id}`}>
      {standard && (
        <mesh
          name={`standard-fixture-${room.id}`}
          position={[cmToScene(standard.at.x), cmToScene(ap.ceilingCm - STANDARD_FIXTURE.heightCm / 2), cmToScene(standard.at.z)]}
          raycast={NO_RAYCAST}
        >
          <cylinderGeometry args={[cmToScene(STANDARD_FIXTURE.diameterCm / 2), cmToScene(STANDARD_FIXTURE.diameterCm / 2 - 4), cmToScene(STANDARD_FIXTURE.heightCm), 32]} />
          <meshStandardMaterial color="#f4f1ec" emissive={WARM} emissiveIntensity={standard.on ? 2.2 : 0} roughness={0.6} />
        </mesh>
      )}
      {sources
        .filter((s) => s.on && s.id !== standard?.id && !ownShade(s.id))
        .map((s) => (
          <mesh key={s.id} name={`glow-${s.id}`} position={pos(s)} raycast={NO_RAYCAST}>
            <sphereGeometry args={[cmToScene(s.kind === 'ceiling' ? 6 : 4), 16, 12]} />
            <meshBasicMaterial color={WARM} toneMapped={false} />
          </mesh>
        ))}
    </group>
  );
}

/** Свет активной комнаты редактора. */
export function RoomLights({ room }: { room: Room }) {
  const ap = useApartment();
  const catalog = useCatalog();
  const lights = useUi((s) => s.lights);
  const sources = roomLightSources(ap, room, catalog, lights);
  return (
    <group name="room-lights">
      <LightPool sources={sources} near={false} />
      <RoomFixtures room={room} sources={sources} />
    </group>
  );
}
