/**
 * Сборка зависимостей приложения (composition root) и доступ компонентов к хранилищам.
 * Компоненты зависят от интерфейсов хранилищ, а не от их создания (DIP).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { CatalogLookup } from '../domain/furniture';
import { createValidators } from '../domain/validators';
import type { Apartment } from '../domain/types';
import { createDragStore, type DragState, type DragStore } from '../interaction/dragStore';
import { createProjectStore, type ProjectState, type ProjectStore } from '../store/projectStore';
import { createUiStore, type UiState } from '../store/uiStore';
import { createSetupStore, type SetupState, type SetupStore } from '../setup/setupStore';

type UiStore = ReturnType<typeof createUiStore>;

export interface Stores {
  readonly project: ProjectStore;
  readonly ui: UiStore;
  readonly drag: DragStore;
  readonly setup: SetupStore;
  readonly catalog: CatalogLookup;
}

const StoresContext = createContext<Stores | null>(null);

export function createStores(initial: Apartment, activeRoomId: string | null, catalog: CatalogLookup): Stores {
  const ui = createUiStore();
  ui.getState().setActiveRoom(activeRoomId);
  const project = createProjectStore(initial, createValidators(catalog));
  const drag = createDragStore(project, () => ui.getState().activeRoomId, catalog);
  const setup = createSetupStore(project, catalog);
  // Отмена, повтор и загрузка меняют действующую квартиру: черновики настройки построены на старой — сбросить (15.6).
  project.subscribe((s, prev) => {
    if (s.history.present === prev.history.present) return;
    setup.getState().reset();
    setup.getState().resetOpening();
  });
  return { project, ui, drag, setup, catalog };
}

export const StoresProvider = ({ stores, children }: { stores: Stores; children: ReactNode }) => (
  <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
);

export function useStores(): Stores {
  const s = useContext(StoresContext);
  if (!s) throw new Error('StoresProvider не подключён');
  return s;
}

export const useProject = <T,>(selector: (s: ProjectState) => T): T => useStore(useStores().project, selector);
export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useStores().ui, selector);
export const useDrag = <T,>(selector: (s: DragState) => T): T => useStore(useStores().drag, selector);
export const useSetup = <T,>(selector: (s: SetupState) => T): T => useStore(useStores().setup, selector);
export const useApartment = () => useProject((s) => s.history.present);
export const useCatalog = () => useStores().catalog;
