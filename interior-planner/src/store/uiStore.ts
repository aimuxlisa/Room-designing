/** Состояние интерфейса: не входит в проект и в историю отмены (SPEC §6 EditorState, §8). */
import { create } from 'zustand';
import type { Id, WallSurfaceRef } from '../domain/types';

/** Шаги приложения (SPEC §8). */
export type EditorStage = 'params' | 'scheme' | 'setup' | 'interior';

/** Что показывает план: активную комнату крупно или всю квартиру (SPEC §10.1). */
export type PlanScope = 'room' | 'apartment';

export interface CameraState {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** Ввод стартового сценария; сохраняется при возврате между шагами (7.5). */
export interface StartInput {
  readonly livingRooms: 1 | 2 | 3 | null;
  readonly areaText: string;
}

export interface UiState {
  readonly stage: EditorStage;
  readonly start: StartInput;
  /** Схема, загруженная в проект; null — ещё не выбрана. */
  readonly templateId: Id | null;
  readonly planScope: PlanScope;
  readonly activeRoomId: Id | null;
  readonly selectedId: Id | null;
  /** Выбранная внутренняя поверхность стены для отделки (этап 12); исключает выбор предмета. */
  readonly selectedSurface: WallSurfaceRef | null;
  readonly camera: CameraState | null;
  setStage(stage: EditorStage): void;
  setStart(patch: Partial<StartInput>): void;
  setTemplateId(id: Id | null): void;
  setPlanScope(scope: PlanScope): void;
  /** Смена комнаты сбрасывает выбор. */
  setActiveRoom(roomId: Id | null): void;
  select(id: Id | null): void;
  selectSurface(surface: WallSurfaceRef | null): void;
  setCamera(camera: CameraState): void;
}

export const createUiStore = () =>
  create<UiState>()((set) => ({
    stage: 'params',
    start: { livingRooms: null, areaText: '' },
    templateId: null,
    planScope: 'room',
    activeRoomId: null,
    selectedId: null,
    selectedSurface: null,
    camera: null,
    setStage: (stage) => set({ stage }),
    setStart: (patch) => set((s) => ({ start: { ...s.start, ...patch } })),
    setTemplateId: (templateId) => set({ templateId }),
    setPlanScope: (planScope) => set({ planScope }),
    setActiveRoom: (activeRoomId) => set({ activeRoomId, selectedId: null, selectedSurface: null }),
    select: (selectedId) => set(selectedId ? { selectedId, selectedSurface: null } : { selectedId }),
    selectSurface: (selectedSurface) => set(selectedSurface ? { selectedSurface, selectedId: null } : { selectedSurface }),
    setCamera: (camera) => set({ camera }),
  }));
