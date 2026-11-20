import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './App';
import { emptyApartment } from './app/flow';
import { createStores, StoresProvider } from './app/stores';
import { getCatalogItem } from './catalog/techCatalog';
import { createTechApartment, createTechTwoRooms } from './tech/techApartment';

const stores = createStores(emptyApartment(), null, getCatalogItem);
// Доступ к состоянию для браузерных проверок; только в режиме разработки.
if (import.meta.env.DEV) Object.assign(window, { __stores: stores, __tech: { createTechApartment, createTechTwoRooms } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoresProvider stores={stores}>
      <App />
    </StoresProvider>
  </StrictMode>,
);
