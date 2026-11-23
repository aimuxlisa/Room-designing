/**
 * Панель проёма в настройке квартиры (SPEC §9, D-04, 9.1–9.5): положение от угла комнаты, ширина,
 * высота, подоконник окна, петля и направление открывания двери. Перенос на другую стену и смена
 * связанной комнаты не предлагаются (D-04). Значения копятся в черновике и применяются кнопкой или Enter.
 */
import { useState } from 'react';
import { useApartment, useSetup, useStores } from '../app/stores';
import type { OpeningPatch } from '../commands/openings';
import { LIMITS } from '../domain/limits';
import { clearOffsetCm, isExteriorWall, offsetFromClearCm } from '../domain/openings';
import { roomsOfWall } from '../domain/rooms';
import { parseCmInput } from '../domain/units';
import { DOOR_FINISHES, WINDOW_FINISHES, openingFinish } from '../catalog/openingFinishes';
import { ConflictJump } from './ConflictJump';
import { conflictObjectIds } from './setupStore';

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onValue: (cm: number | null) => void;
  readonly onEnter: () => void;
}

/** Поле в сантиметрах: текст ведётся локально, чтобы промежуточный ввод (например «1,») не сбрасывался. */
function NumberField({ id, label, value, onValue, onEnter }: NumberFieldProps) {
  const shown = String(Math.round(value));
  const [text, setText] = useState(shown);
  // Новое действующее значение (применение, отмена Ctrl+Z) заменяет введённый текст.
  const [prev, setPrev] = useState(shown);
  if (prev !== shown) {
    setPrev(shown);
    setText(shown);
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onValue(parseCmInput(e.target.value));
        }}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      />
    </div>
  );
}

export function OpeningPanel() {
  const { setup } = useStores();
  const ap = useApartment();
  const openingId = useSetup((s) => s.openingId);
  const draft = useSetup((s) => s.openingDraft);
  const proposal = useSetup((s) => s.openingProposal);
  const lastIssue = useSetup((s) => s.lastIssue);
  const lastObjectIds = useSetup((s) => s.lastObjectIds);
  const [bad, setBad] = useState<readonly string[]>([]);
  const [nonce, setNonce] = useState(0);
  const o = openingId ? ap.openings[openingId] : undefined;
  if (!o) return null;

  const wall = ap.walls[o.wallId];
  const rooms = roomsOfWall(ap, wall.id);
  const ref = rooms[0];
  const exterior = isExteriorWall(ap, wall.id);
  const lim = o.kind === 'door' ? LIMITS.door : LIMITS.window;
  const edit = (patch: OpeningPatch) => setup.getState().editOpening(patch);
  const mark = (field: string, ok: boolean) =>
    setBad((prev) => (ok ? prev.filter((f) => f !== field) : [...prev.filter((f) => f !== field), field]));
  const numeric = (field: string, toPatch: (cm: number) => OpeningPatch) => (cm: number | null) => {
    mark(field, cm !== null);
    if (cm !== null) edit(toPatch(cm));
  };
  const apply = () => {
    if (bad.length === 0 && proposal?.ok) setup.getState().applyOpening();
  };
  const cancel = () => {
    setup.getState().resetOpening();
    setBad([]);
    setNonce((n) => n + 1);
  };
  const issue = bad.length ? 'Введите целое число сантиметров' : proposal && !proposal.ok ? proposal.issues[0].message : lastIssue;

  const title =
    o.kind === 'window' ? 'Окно' : rooms.length === 2 ? `Дверь между «${rooms[0].name}» и «${rooms[1].name}»` : 'Входная дверь';
  const hinge = draft.hinge ?? (o.kind === 'door' ? o.hinge : undefined);
  const into = draft.opensIntoRoomId !== undefined ? draft.opensIntoRoomId : o.kind === 'door' ? o.opensIntoRoomId : undefined;

  return (
    <div className="panel" data-testid="opening-panel">
      <h3>{title}</h3>
      <p className="hint">Положение задаётся чистым расстоянием от угла комнаты «{ref.name}». Размеры — в сантиметрах.</p>
      <NumberField
        key={`offset-${nonce}`}
        id="op-offset"
        label={`От угла «${ref.name}», см`}
        value={clearOffsetCm(ap, o, ref)}
        onValue={numeric('offset', (cm) => ({ offsetCm: offsetFromClearCm(ap, wall, ref, cm) }))}
        onEnter={apply}
      />
      <NumberField
        key={`width-${nonce}`}
        id="op-width"
        label={`Ширина, см (${lim.widthCm.min}–${lim.widthCm.max})`}
        value={o.widthCm}
        onValue={numeric('width', (cm) => ({ widthCm: cm }))}
        onEnter={apply}
      />
      <NumberField
        key={`height-${nonce}`}
        id="op-height"
        label={`Высота, см (${lim.heightCm.min}–${lim.heightCm.max})`}
        value={o.heightCm}
        onValue={numeric('height', (cm) => ({ heightCm: cm }))}
        onEnter={apply}
      />
      {o.kind === 'window' && (
        <NumberField
          key={`sill-${nonce}`}
          id="op-sill"
          label={`Подоконник, см (${LIMITS.window.sillCm.min}–${LIMITS.window.sillCm.max})`}
          value={o.sillCm}
          onValue={numeric('sill', (cm) => ({ sillCm: cm }))}
          onEnter={apply}
        />
      )}
      {/* Отделка полотна двери или рамы окна (D-26): через тот же черновик и «Применить». */}
      <div className="field" role="group" aria-label={o.kind === 'door' ? 'Отделка двери' : 'Рама окна'}>
        <span>{o.kind === 'door' ? 'Отделка двери' : 'Рама окна'}</span>
        <div className="swatches">
          {(o.kind === 'door' ? DOOR_FINISHES : WINDOW_FINISHES).map((f) => (
            <button
              key={f.id}
              type="button"
              className="swatch"
              title={f.name}
              aria-label={f.name}
              aria-pressed={(draft.finishId ?? openingFinish(o).id) === f.id}
              data-testid={`opening-finish-${f.id}`}
              style={{ background: f.color }}
              onClick={() => edit({ finishId: f.id })}
            />
          ))}
        </div>
      </div>
      {o.kind === 'door' && (
        <>
          <div className="field" role="group" aria-label="Петля">
            <span>Петля</span>
            {(['left', 'right'] as const).map((side) => (
              <button key={side} type="button" aria-pressed={hinge === side} onClick={() => edit({ hinge: side })}>
                {side === 'left' ? 'слева' : 'справа'}
              </button>
            ))}
          </div>
          <div className="field" role="group" aria-label="Открывается">
            <span>Открывается</span>
            {rooms.map((r) => (
              <button key={r.id} type="button" aria-pressed={into === r.id} onClick={() => edit({ opensIntoRoomId: r.id })}>
                в «{r.name}»
              </button>
            ))}
            {exterior && (
              <button type="button" aria-pressed={into === null} onClick={() => edit({ opensIntoRoomId: null })}>
                наружу
              </button>
            )}
          </div>
        </>
      )}
      {issue && (
        <p className="hint error" role="alert" data-testid="opening-issue">
          {issue}
        </p>
      )}
      {issue && !bad.length && <ConflictJump objectIds={conflictObjectIds({ proposal: null, openingProposal: proposal, lastObjectIds })} />}
      <div className="actions">
        <button type="button" className="primary" disabled={bad.length > 0 || !proposal?.ok} onClick={apply}>
          Применить
        </button>
        <button type="button" disabled={Object.keys(draft).length === 0 && bad.length === 0} onClick={cancel}>
          Отменить
        </button>
      </div>
    </div>
  );
}
