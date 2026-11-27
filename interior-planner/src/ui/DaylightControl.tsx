/** Время суток в интерьере (20.2, D-12): ползунок 0–24 ч и быстрые кнопки. Не входит в проект и в историю отмены. */
import { useStores, useUi } from '../app/stores';
import { DAY_PRESETS, formatHour } from '../domain/daylight';

export function DaylightControl() {
  const { ui } = useStores();
  const hour = useUi((s) => s.hour);
  return (
    <div className="daylight" role="group" aria-label="Время суток">
      <label>
        <span>Время суток</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={hour}
          aria-valuetext={formatHour(hour)}
          onChange={(e) => ui.getState().setHour(Number(e.target.value))}
        />
        <output data-testid="daylight-hour">{formatHour(hour)}</output>
      </label>
      <div className="daylight-presets">
        {DAY_PRESETS.map((p) => (
          <button key={p.label} type="button" aria-pressed={hour === p.hour} onClick={() => ui.getState().setHour(p.hour)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
