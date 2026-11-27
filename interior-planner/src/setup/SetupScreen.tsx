/**
 * Шаг «Квартира» (SPEC §8–9): выбор стены на плане, размер комнаты числом или перетаскиванием,
 * предпросмотр затронутых помещений и площади, отказ с причиной, высота потолка.
 */
import { useEffect, useState } from 'react';
import { enterInterior } from '../app/flow';
import { useApartment, useSetup, useStores } from '../app/stores';
import { setCeilingHeight } from '../commands/apartment';
import type { Proposal } from '../commands/change';
import { LIMITS } from '../domain/limits';
import {
  AREA_LABELS,
  apartmentClearAreaCm2,
  apartmentOuterAreaCm2,
  deltaForRoomSize,
  roomClearRect,
  roomsOfWall,
  sideAxis,
  wallSideInRoom,
} from '../domain/rooms';
import type { Apartment, Room } from '../domain/types';
import { formatCm, formatM2, parseCmInput } from '../domain/units';
import { rectDepth, rectWidth } from '../geometry/rect';
import { PlanView } from '../plan2d/PlanView';
import { areaChange, roomChanges } from './changes';
import { ConflictJump } from './ConflictJump';
import { OpeningPanel } from './OpeningPanel';
import { conflictObjectIds } from './setupStore';

const issueOf = (p: Proposal | null) => (p && !p.ok ? p.issues[0].message : null);

function roomSize(ap: Apartment, wallId: string, room: Room) {
  const side = wallSideInRoom(ap, wallId, room)!;
  const r = roomClearRect(ap, room);
  return sideAxis(side) === 'x'
    ? { label: 'ширина', value: rectWidth(r) }
    : { label: 'длина', value: rectDepth(r) };
}

/** Поле размера комнаты: ввод задаёт сдвиг выбранной стены, противоположная стоит на месте. */
function RoomSizeField({ ap, wallId, room }: { ap: Apartment; wallId: string; room: Room }) {
  const { setup } = useStores();
  const deltaCm = useSetup((s) => s.deltaCm);
  const { label, value } = roomSize(ap, wallId, room);
  const shown = String(Math.round(value));
  const [text, setText] = useState(shown);
  // Без изменения (сдвиг 0) поле показывает действующий размер: после применения, отмены или переноса мышью.
  const [prev, setPrev] = useState({ shown, deltaCm });
  if (prev.shown !== shown || prev.deltaCm !== deltaCm) {
    setPrev({ shown, deltaCm });
    if (deltaCm === 0) setText(shown);
  }
  const id = `size-${room.id}`;
  const cm = parseCmInput(text);
  const invalid = cm === null || cm <= 0;
  return (
    <div className="field">
      <label htmlFor={id}>
        {room.name}: {label}, см
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = parseCmInput(e.target.value);
          // Нечисловой, нулевой и отрицательный размер не предлагает изменения (18.1).
          const delta = next === null || next <= 0 ? null : deltaForRoomSize(ap, wallId, room, next);
          setup.getState().setDelta(delta === null ? 0 : Math.round(delta));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setup.getState().apply();
          if (e.key === 'Escape') setup.getState().reset();
        }}
        aria-invalid={invalid}
      />
      {invalid && (
        <p className="hint error" role="alert" data-testid="size-input-error">
          Введите размер целым числом сантиметров больше 0, например 350
        </p>
      )}
    </div>
  );
}

function WallPanel() {
  const { setup } = useStores();
  const ap = useApartment();
  const wallId = useSetup((s) => s.wallId);
  const proposal = useSetup((s) => s.proposal);
  const lastIssue = useSetup((s) => s.lastIssue);
  const lastObjectIds = useSetup((s) => s.lastObjectIds);
  const wall = wallId ? ap.walls[wallId] : undefined;
  if (!wall)
    return <p className="hint">Нажмите на стену на плане, чтобы изменить размеры. Стену можно и перетащить мышью (Alt — шаг 1 см).</p>;

  const rooms = roomsOfWall(ap, wall.id);
  const exterior = rooms.length === 1;
  const issue = issueOf(proposal) ?? lastIssue;
  const changes = proposal?.ok ? roomChanges(ap, proposal.candidate) : [];
  const area = proposal?.ok ? areaChange(ap, proposal.candidate) : null;

  return (
    <div className="panel" data-testid="wall-panel">
      <h3>{exterior ? 'Внешняя стена' : `Стена между «${rooms[0].name}» и «${rooms[1].name}»`}</h3>
      <p className="hint">
        Двигается выбранная стена (подсвечена), противоположная остаётся на месте. Стена на одной линии с соседними сдвигается целиком.
        {exterior && ' Изменится внешний контур и площадь квартиры.'}
      </p>
      {rooms.map((r) => (
        <RoomSizeField key={`${wall.id}-${r.id}`} ap={ap} wallId={wall.id} room={r} />
      ))}
      {changes.length > 0 && (
        <div className="preview" data-testid="setup-preview">
          <h4>Предпросмотр</h4>
          <ul>
            {changes.map((c) => (
              <li key={c.room.id}>
                {c.room.name}: {formatCm(c.before.w)} × {formatCm(c.before.d)} → <strong>{formatCm(c.after.w)} × {formatCm(c.after.d)}</strong>
              </li>
            ))}
          </ul>
          {area && (
            <p>
              {AREA_LABELS.clear}: {formatM2(area.clear[0])} → <strong data-testid="preview-area">{formatM2(area.clear[1])}</strong>
            </p>
          )}
        </div>
      )}
      {issue && (
        <p className="hint error" role="alert" data-testid="setup-issue">
          {issue}
        </p>
      )}
      {issue && <ConflictJump objectIds={conflictObjectIds({ proposal, openingProposal: null, lastObjectIds })} />}
      <div className="actions">
        <button type="button" className="primary" disabled={!proposal?.ok} onClick={() => setup.getState().apply()}>
          Применить
        </button>
        <button type="button" disabled={!proposal} onClick={() => setup.getState().reset()}>
          Отменить
        </button>
      </div>
    </div>
  );
}

function CeilingPanel() {
  const { project, catalog } = useStores();
  const ap = useApartment();
  const [text, setText] = useState(String(ap.ceilingCm));
  // Новая действующая высота (применение, отмена) заменяет введённый текст.
  const [prevCeiling, setPrevCeiling] = useState(ap.ceilingCm);
  if (prevCeiling !== ap.ceilingCm) {
    setPrevCeiling(ap.ceilingCm);
    setText(String(ap.ceilingCm));
  }
  const cm = parseCmInput(text);
  const preview = cm === null || cm === ap.ceilingCm ? null : project.getState().preview(setCeilingHeight(cm, catalog));
  const error = cm === null ? 'Введите целое число сантиметров' : issueOf(preview);
  const apply = () => cm !== null && preview?.ok && project.getState().execute(setCeilingHeight(cm, catalog));
  return (
    <div className="panel">
      <div className="field">
        <label htmlFor="ceiling">
          Высота потолка, см ({LIMITS.ceilingCm.min}–{LIMITS.ceilingCm.max})
        </label>
        <input
          id="ceiling"
          inputMode="numeric"
          value={text}
          aria-invalid={!!error}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
      </div>
      {error && (
        <p className="hint error" role="alert" data-testid="ceiling-issue">
          {error}
        </p>
      )}
      {preview && !preview.ok && <ConflictJump objectIds={preview.issues.flatMap((i) => i.objectIds)} />}
      <button type="button" disabled={!preview?.ok} onClick={apply}>
        Применить высоту
      </button>
    </div>
  );
}

export function SetupScreen() {
  const stores = useStores();
  const ap = useApartment();
  const openingId = useSetup((s) => s.openingId);
  useEffect(() => () => stores.setup.getState().selectWall(null), [stores]);
  return (
    <div className="setup">
      <aside className="setup-side">
        <h2>Настройка квартиры</h2>
        <dl className="facts">
          <dt>{AREA_LABELS.clear}</dt>
          <dd data-testid="setup-clear-area">{formatM2(apartmentClearAreaCm2(ap))}</dd>
          <dt>{AREA_LABELS.outer}</dt>
          <dd>{formatM2(apartmentOuterAreaCm2(ap))}</dd>
          <dt>Помещений</dt>
          <dd>{Object.keys(ap.rooms).length}</dd>
          <dt>Мебели</dt>
          <dd data-testid="setup-furniture-count">{Object.keys(ap.furniture).length}</dd>
        </dl>
        {openingId ? <OpeningPanel key={openingId} /> : <WallPanel />}
        <CeilingPanel />
        <div className="actions">
          <button type="button" onClick={() => stores.ui.getState().setStage('scheme')}>
            ← К выбору схемы
          </button>
          <button type="button" className="primary" onClick={() => enterInterior(stores)}>
            К интерьеру →
          </button>
        </div>
      </aside>
      <section className="pane pane-plan" aria-label="План квартиры">
        <PlanView mode="setup" />
      </section>
    </div>
  );
}
