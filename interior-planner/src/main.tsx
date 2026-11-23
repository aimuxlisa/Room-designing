import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './App';
import { emptyApartment } from './app/flow';
import { createStores, StoresProvider } from './app/stores';
import { catalog, getCatalogItem } from './catalog/catalog';
import { createTechApartment, createTechTwoRooms } from './tech/techApartment';

const stores = createStores(emptyApartment(), null, getCatalogItem);
// Доступ к состоянию для браузерных проверок; только в режиме разработки.
if (import.meta.env.DEV)
  Object.assign(window, { __stores: stores, __tech: { createTechApartment, createTechTwoRooms }, __catalogIds: catalog.map((i) => i.id) });

const root = createRoot(document.getElementById('root')!);
const previewId = import.meta.env.DEV ? new URLSearchParams(location.search).get('preview') : null;

if (previewId) {
  // Экран превью предмета для scripts/capture-previews.mjs (только разработка, в сборку не попадает).
  void import('./scene3d/PreviewStage').then(({ PreviewStage }) => root.render(<PreviewStage id={previewId} />));
} else {
  root.render(
    <StrictMode>
      <StoresProvider stores={stores}>
        <App />
      </StoresProvider>
    </StrictMode>,
  );
}
