/**
 * Модель предмета. Импорт нормализуется один раз (SPEC §5.5): масштаб по единицам файла,
 * центр основания модели совмещается с опорной точкой предмета. GLB загружается и кешируется
 * загрузчиком (копии делят геометрию и текстуры); собственные модели строятся из деталей (ownModels).
 * Ошибка загрузки показывается каркасом габарита и не роняет сцену (13.6).
 */
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Component, useMemo, type ReactNode } from 'react';
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { OWN_MODELS, ownModelFrame } from '../catalog/ownModels';
import type { CatalogItem, FurnitureInstance } from '../domain/types';
import { assetToSceneScale, cmToScene } from '../domain/units';
import { degToRad } from '../geometry/placement';
import { useAssetStatus } from './assetStatus';
import { OwnModel } from './OwnModel';

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

function GltfBody({ item, ghost }: { item: CatalogItem; ghost: GhostState }) {
  const { scene } = useGLTF(item.modelUrl);
  const scale = assetToSceneScale(item.modelUnit);
  const { object, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const c = box.getCenter(new Vector3());
    return { object: prepare(scene, ghost), offset: new Vector3(-c.x, -box.min.y, -c.z) };
  }, [scene, ghost]);
  // Модель центрируется, затем поворачивается так, чтобы лицевая сторона смотрела в +Z (modelYawDeg).
  return (
    <group scale={scale} rotation-y={((item.modelYawDeg ?? 0) * Math.PI) / 180}>
      <primitive object={object} position={offset} />
    </group>
  );
}

function OwnBody({ item, ghost }: { item: CatalogItem; ghost: GhostState }) {
  const parts = OWN_MODELS[item.modelUrl.slice('own:'.length)];
  const { offset } = ownModelFrame(parts);
  return (
    <group scale={cmToScene(1)}>
      <group position={offset as [number, number, number]}>
        <OwnModel parts={parts} ghost={ghost} />
      </group>
    </group>
  );
}

/** Каркас габарита на месте модели, которая не загрузилась (не засчитывается как модель мебели). */
function FailedBody({ item }: { item: CatalogItem }) {
  const { widthCm, depthCm, heightCm } = item.size;
  return (
    <mesh name="model-error" position={[0, cmToScene(heightCm / 2), 0]}>
      <boxGeometry args={[cmToScene(widthCm), cmToScene(heightCm), cmToScene(depthCm)]} />
      <meshBasicMaterial color="#ff5a5a" wireframe />
    </mesh>
  );
}

class ModelBoundary extends Component<{ item: CatalogItem; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    useAssetStatus.getState().report(this.props.item.modelUrl, this.props.item.name, error.message || String(error));
  }
  render() {
    return this.state.failed ? <FailedBody item={this.props.item} /> : this.props.children;
  }
}

export function FurnitureModel(props: {
  item: CatalogItem;
  instance: Pick<FurnitureInstance, 'id' | 'position' | 'angleDeg'>;
  ghost?: GhostState;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const { item, instance, ghost = 'none' } = props;
  // Повтор загрузки перемонтирует тело модели с новой попыткой.
  const attempt = useAssetStatus((s) => s.attempts[item.modelUrl] ?? 0);
  const own = item.modelUrl.startsWith('own:');
  return (
    <group
      name={ghost === 'none' ? `item-${instance.id}` : 'draft'}
      position={[cmToScene(instance.position.xCm), cmToScene(instance.position.yCm), cmToScene(instance.position.zCm)]}
      rotation-y={degToRad(instance.angleDeg)}
      onPointerDown={props.onPointerDown}
    >
      <ModelBoundary key={attempt} item={item}>
        {own ? <OwnBody item={item} ghost={ghost} /> : <GltfBody item={item} ghost={ghost} />}
      </ModelBoundary>
    </group>
  );
}
