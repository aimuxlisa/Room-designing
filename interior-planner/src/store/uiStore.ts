/** Состояние интерфейса: не входит в проект и в историю отмены (SPEC §6 EditorState, §8). */
import { create } from 'zustand';
import type { Id, WallSurfaceRef } from '../domain/types';
import { DEFAULT_HOUR } from '../domain/daylight';
import type { LightSwitches } from '../domain/lighting';

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
  /** Выбранный пол комнаты для покрытия (D-16); исключает выбор предмета и стены. */
  readonly selectedFloor: Id | null;
  readonly camera: CameraState | null;
  /** Время суток, ч (D-12): не входит в проект и в историю отмены. */
  readonly hour: number;
  /** Выключатели света (D-11, D-14): часть вида, не проекта; сохраняются при переходах между комнатами. */
  readonly lights: LightSwitches;
  /** Режим «Прогулка» (D-17): вид от первого лица по всей квартире; активная комната и проект не меняются. */
  readonly walking: boolean;
  setStage(stage: EditorStage): void;
  setStart(patch: Partial<StartInput>): void;
  setTemplateId(id: Id | null): void;
  setPlanScope(scope: PlanScope): void;
  /** Смена комнаты сбрасывает выбор. */
  setActiveRoom(roomId: Id | null): void;
  select(id: Id | null): void;
  selectSurface(surface: WallSurfaceRef | null): void;
  selectFloor(roomId: Id | null): void;
  setCamera(camera: CameraState): void;
  setHour(hour: number): void;
  toggleRoomLight(roomId: Id): void;
  toggleLamp(instanceId: Id): void;
  /** Вход в прогулку снимает выбор; выход возвращает редактор в ту же активную комнату (24.5). */
  setWalking(on: boolean): void;
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
    selectedFloor: null,
    camera: null,
    hour: DEFAULT_HOUR,
    lights: { rooms: {}, lamps: {} },
    walking: false,
    setStage: (stage) => set({ stage, walking: false }),
    setStart: (patch) => set((s) => ({ start: { ...s.start, ...patch } })),
    setTemplateId: (templateId) => set({ templateId }),
    setPlanScope: (planScope) => set({ planScope }),
    setActiveRoom: (activeRoomId) => set({ activeRoomId, selectedId: null, selectedSurface: null, selectedFloor: null }),
    select: (selectedId) => set(selectedId ? { selectedId, selectedSurface: null, selectedFloor: null } : { selectedId }),
    selectSurface: (selectedSurface) =>
      set(selectedSurface ? { selectedSurface, selectedId: null, selectedFloor: null } : { selectedSurface }),
    selectFloor: (selectedFloor) => set(selectedFloor ? { selectedFloor, selectedId: null, selectedSurface: null } : { selectedFloor }),
    setCamera: (camera) => set({ camera }),
    setHour: (hour) => set({ hour: Math.min(24, Math.max(0, hour)) }),
    toggleRoomLight: (roomId) => set((s) => ({ lights: { ...s.lights, rooms: { ...s.lights.rooms, [roomId]: !s.lights.rooms[roomId] } } })),
    setWalking: (walking) => set(walking ? { walking, selectedId: null, selectedSurface: null, selectedFloor: null } : { walking }),
    toggleLamp: (id) => set((s) => ({ lights: { ...s.lights, lamps: { ...s.lights.lamps, [id]: !s.lights.lamps[id] } } })),
  }));
