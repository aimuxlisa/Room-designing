import { useApartment, useDrag, useStores, useUi } from './app/stores';
import { useDragLifecycle } from './interaction/useDragLifecycle';
import { PlanView } from './plan2d/PlanView';
import { RoomScene } from './scene3d/RoomScene';
import { SetupScreen } from './setup/SetupScreen';
import { SchemePicker } from './start/SchemePicker';
import { StartParams } from './start/StartParams';
import type { EditorStage } from './store/uiStore';
import { CatalogPanel } from './ui/CatalogPanel';
import { FinishPanel } from './ui/FinishPanel';
import { useEditorHotkeys } from './ui/useEditorHotkeys';

const STEPS: readonly { stage: EditorStage; label: string }[] = [
  { stage: 'params', label: 'Параметры' },
  { stage: 'scheme', label: 'Схема' },
  { stage: 'setup', label: 'Квартира' },
  { stage: 'interior', label: 'Интерьер' },
];

/** Шаги: вернуться можно на любой пройденный; вперёд — только на доступный. */
function Stepper() {
  const { ui } = useStores();
  const stage = useUi((s) => s.stage);
  const hasTemplate = useUi((s) => s.templateId !== null);
  const hasParams = useUi((s) => s.start.livingRooms !== null && s.start.areaText.trim() !== '');
  const available = (s: EditorStage) =>
    s === 'params' || (s === 'scheme' && hasParams) || ((s === 'setup' || s === 'interior') && hasTemplate);
  return (
    <nav className="stepper" aria-label="Шаги">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.stage}>
            <button
              type="button"
              aria-current={stage === s.stage ? 'step' : undefined}
              disabled={!available(s.stage)}
              onClick={() => ui.getState().setStage(s.stage)}
            >
              <span className="step-n">{i + 1}</span> {s.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StatusBar() {
  const draft = useDrag((s) => s.draft);
  const lastIssue = useDrag((s) => s.lastIssue);
  const selected = useUi((s) => s.selectedId);
  const reason = draft?.proposal && !draft.proposal.ok ? draft.proposal.issues[0].message : null;
  const hint = !draft
    ? selected
      ? 'Выбран предмет: перетащите его, стрелки — 1 см (Shift — 10 см), R / Shift+R — поворот, ручка или кольцо — поворот мышью, Delete — удалить'
      : 'Перетащите предмет из каталога на план или в 3D'
    : draft.mode === 'rotate'
      ? 'Поворот: тяните, шаг 15°, Alt — свободный угол, Esc — отмена'
      : 'R / Shift+R — поворот на 15°, Alt — без привязки, Esc — отмена';
  const text = reason ?? (draft ? hint : (lastIssue ?? hint));
  return (
    <footer className={reason || (!draft && lastIssue) ? 'status error' : 'status'} data-testid="status" role="status">
      {text}
    </footer>
  );
}

function Interior() {
  return (
    <>
      <main className="app-main">
        <div className="side-col">
          <FinishPanel />
          <CatalogPanel />
        </div>
        <section className="pane pane-plan" aria-label="План">
          <PlanView />
        </section>
        <section className="pane pane-scene" aria-label="3D">
          <RoomScene />
        </section>
      </main>
      <StatusBar />
    </>
  );
}

export function App() {
  const stores = useStores();
  useEditorHotkeys(stores);
  useDragLifecycle(stores);
  const ap = useApartment();
  const stage = useUi((s) => s.stage);
  const roomId = useUi((s) => s.activeRoomId);
  const roomName = stage === 'interior' && roomId ? ap.rooms[roomId]?.name : '';
  return (
    <div className="app">
      <header className="app-header">
        <h1>Планировщик квартиры</h1>
        <Stepper />
        {roomName && <span className="muted">{roomName}</span>}
      </header>
      {stage === 'params' && (
        <main className="page">
          <StartParams />
        </main>
      )}
      {stage === 'scheme' && (
        <main className="page">
          <SchemePicker />
        </main>
      )}
      {stage === 'setup' && <SetupScreen />}
      {stage === 'interior' && <Interior />}
    </div>
  );
}
