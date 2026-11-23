/**
 * Единое освещение интерактивного вида (16.1): рассеянный свет полусферы, солнце с мягкими тенями,
 * привязанное к активной комнате (тени не обрезаются в дальних комнатах), и окружение для отражений
 * металла, стекла и керамики из процедурных световых панелей — без загрузки HDRI.
 * Цветопередача — по умолчанию R3F: ACES Filmic и вывод в sRGB; текстуры цвета помечены sRGB.
 */
import { Environment, Lightformer } from '@react-three/drei';
import { useMemo } from 'react';
import { Object3D } from 'three';
import type { Point } from '../geometry/rect';
import { cmToScene } from '../domain/units';

export function SceneLighting({ center, spanCm }: { center: Point; spanCm: number }) {
  const target = useMemo(() => new Object3D(), []);
  const c: [number, number, number] = [cmToScene(center.x), 0, cmToScene(center.z)];
  const half = cmToScene(spanCm) / 2 + 1.5;
  return (
    <>
      <hemisphereLight args={['#ffffff', '#5a534c', 1.0]} />
      <primitive object={target} position={c} />
      <directionalLight
        position={[c[0] + 3, 8, c[2] + 4]}
        target={target}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
      />
      <Environment resolution={256} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={1.5} color="#fff6ea" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#dfe8ff" position={[8, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={0.5} position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#b39b7a" position={[0, -1, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
      </Environment>
    </>
  );
}
