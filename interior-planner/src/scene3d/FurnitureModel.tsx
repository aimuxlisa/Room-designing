/**
 * Модель предмета. Импорт нормализуется один раз (SPEC §5.5): масштаб по единицам файла,
 * центр основания модели совмещается с опорной точкой предмета.
 */
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import type { CatalogItem, FurnitureInstance } from '../domain/types';
import { assetToSceneScale, cmToScene } from '../domain/units';
import { degToRad } from '../geometry/placement';

export type GhostState = 'none' | 'valid' | 'invalid';

/** Копия сцены; для призрака материалы клонируются, чтобы не менять общие (SPEC §12). */
function prepare(source: Object3D, ghost: GhostState): Object3D {
  const copy = source.clone(true);
  copy.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.castShadow = ghost === 'none';
    o.receiveShadow = true;
    if (ghost === 'none') return;
    const m = (o.material as MeshStandardMaterial).clone();
    m.transparent = true;
    m.opacity = 0.55;
    m.depthWrite = false;
    if (ghost === 'invalid') m.color = new Color('#ff5a5a');
    o.material = m;
  });
  return copy;
}

export function FurnitureModel(props: {
  item: CatalogItem;
  instance: Pick<FurnitureInstance, 'id' | 'position' | 'angleDeg'>;
  ghost?: GhostState;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const { item, instance, ghost = 'none' } = props;
  const { scene } = useGLTF(item.modelUrl);
  const scale = assetToSceneScale(item.modelUnit);
  const { object, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const c = box.getCenter(new Vector3());
    return { object: prepare(scene, ghost), offset: new Vector3(-c.x, -box.min.y, -c.z) };
  }, [scene, ghost]);

  return (
    <group
      name={ghost === 'none' ? `item-${instance.id}` : 'draft'}
      position={[cmToScene(instance.position.xCm), cmToScene(instance.position.yCm), cmToScene(instance.position.zCm)]}
      rotation-y={degToRad(instance.angleDeg)}
      onPointerDown={props.onPointerDown}
    >
      <group scale={scale}>
        <primitive object={object} position={offset} />
      </group>
    </group>
  );
}
