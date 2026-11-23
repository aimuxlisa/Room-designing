/**
 * Экран превью одного предмета (13.5), только в режиме разработки: /?preview=<id>.
 * scripts/capture-previews.mjs снимает кадр 160 × 120 и сохраняет public/previews/<id>.jpg.
 */
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { getCatalogItem } from '../catalog/catalog';
import { cmToScene } from '../domain/units';
import { themeTokens } from '../ui/themeTokens';
import { FurnitureModel } from './FurnitureModel';

function Ready() {
  useEffect(() => {
    // Кадр отрисован после загрузки модели — можно снимать.
    requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(window, { __previewReady: true })));
  }, []);
  return null;
}

export function PreviewStage({ id }: { id: string }) {
  const item = getCatalogItem(id);
  if (!item) return <p>Нет предмета {id}</p>;
  const { widthCm, depthCm, heightCm } = item.size;
  const span = Math.max(widthCm, depthCm, heightCm);
  const target: [number, number, number] = [0, cmToScene(heightCm / 2), 0];
  // Вид спереди-справа сверху; расстояние по наибольшему размеру.
  const d = cmToScene(span * 1.55);
  return (
    <div style={{ width: '100vw', height: '100vh', background: themeTokens.surface2 }}>
      <Canvas
        data-testid="preview"
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [d * 0.62, target[1] + d * 0.42, d * 0.8], fov: 35 }}
        onCreated={({ camera }) => camera.lookAt(...target)}
      >
        <color attach="background" args={[themeTokens.surface2]} />
        <hemisphereLight args={['#ffffff', '#5a534c', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.8} />
        <Suspense fallback={null}>
          <FurnitureModel item={item} instance={{ id: 'preview', position: { xCm: 0, yCm: 0, zCm: 0 }, angleDeg: 0 }} />
          <Ready />
        </Suspense>
      </Canvas>
    </div>
  );
}
