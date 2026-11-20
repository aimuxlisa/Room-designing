/** Шаг 1 (7.1): число жилых комнат и примерная площадь в м². */
import { useId } from 'react';
import { useStores, useUi } from '../app/stores';
import { AREA_RANGE_M2, parseAreaM2 } from '../layouts/match';

const OPTIONS = [
  { n: 1, label: '1 комната' },
  { n: 2, label: '2 комнаты' },
  { n: 3, label: '3 комнаты' },
] as const;

export function StartParams() {
  const { ui } = useStores();
  const start = useUi((s) => s.start);
  const areaId = useId();
  const errorId = useId();
  const area = parseAreaM2(start.areaText);
  const showError = start.areaText.trim() !== '' && !area.ok;
  const ready = start.livingRooms !== null && area.ok;

  return (
    <section className="start" aria-labelledby="start-title">
      <h2 id="start-title">Какая у вас квартира?</h2>
      <fieldset className="start-field">
        <legend>Жилых комнат</legend>
        <div className="segmented" role="radiogroup" aria-label="Жилых комнат">
          {OPTIONS.map((o) => (
            <button
              key={o.n}
              type="button"
              role="radio"
              aria-checked={start.livingRooms === o.n}
              onClick={() => ui.getState().setStart({ livingRooms: o.n })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint">Кухня-гостиная считается одной жилой комнатой.</p>
      </fieldset>
      <div className="start-field">
        <label htmlFor={areaId}>Примерная площадь квартиры, м²</label>
        <input
          id={areaId}
          inputMode="decimal"
          autoComplete="off"
          placeholder="например, 45"
          value={start.areaText}
          aria-invalid={showError}
          aria-describedby={errorId}
          onChange={(e) => ui.getState().setStart({ areaText: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && ready && ui.getState().setStage('scheme')}
        />
        <p id={errorId} className={showError ? 'hint error' : 'hint'} role={showError ? 'alert' : undefined}>
          {showError && !area.ok
            ? area.error
            : `От ${AREA_RANGE_M2.min} до ${AREA_RANGE_M2.max} м². Площадь — ориентир для подбора схемы, а не точный размер.`}
        </p>
      </div>
      <button type="button" className="primary" disabled={!ready} onClick={() => ui.getState().setStage('scheme')}>
        Подобрать схемы
      </button>
    </section>
  );
}
