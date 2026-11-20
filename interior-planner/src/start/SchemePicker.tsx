/** Шаг 2 (7.3): подбор и превью схем; приблизительный характер и фактическая площадь. */
import { chooseTemplate } from '../app/flow';
import { useStores, useUi } from '../app/stores';
import { AREA_LABELS, roomClearAreaCm2 } from '../domain/rooms';
import { formatM2 } from '../domain/units';
import { parseAreaM2, rankTemplates } from '../layouts/match';
import { PlanPreview } from '../plan2d/PlanPreview';

const m2 = (v: number) => `${v.toFixed(1).replace('.', ',')} м²`;

export function SchemePicker() {
  const stores = useStores();
  const start = useUi((s) => s.start);
  const chosen = useUi((s) => s.templateId);
  const area = parseAreaM2(start.areaText);
  if (!start.livingRooms || !area.ok) return null;
  const candidates = rankTemplates(start.livingRooms, area.m2);

  return (
    <section className="schemes" aria-labelledby="schemes-title">
      <div className="schemes-head">
        <h2 id="schemes-title">Схемы для {start.livingRooms}-комнатной квартиры около {m2(area.m2)}</h2>
        <p className="hint">
          Схемы приблизительные: это типовые планировки, а не восстановление вашей квартиры. Площадь схемы может
          отличаться от введённой; размеры стен и проёмов уточняются на следующем шаге.
        </p>
      </div>
      <ul className="scheme-list">
        {candidates.map(({ template, areaM2, diffM2 }, i) => {
          const ap = template.apartment;
          return (
            <li key={template.id} className={chosen === template.id ? 'scheme-card chosen' : 'scheme-card'} data-testid={`scheme-${template.code}`}>
              <PlanPreview ap={ap} width={300} height={170} />
              <div className="scheme-body">
                <h3>
                  Схема {template.code} {i === 0 && <span className="badge">ближе всего</span>}
                  {chosen === template.id && <span className="badge accent">выбрана</span>}
                </h3>
                <p>{template.description}</p>
                <p className="scheme-area">
                  {AREA_LABELS.clear}: <strong data-testid="scheme-area">{m2(areaM2)}</strong>{' '}
                  <span className="muted">
                    ({diffM2 === 0 ? 'как введено' : `на ${m2(Math.abs(diffM2))} ${diffM2 > 0 ? 'больше' : 'меньше'} введённой`})
                  </span>
                </p>
                <ul className="scheme-rooms">
                  {Object.values(ap.rooms).map((r) => (
                    <li key={r.id}>
                      {r.name} <span className="muted">{formatM2(roomClearAreaCm2(ap, r))}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    chooseTemplate(stores, template.id, () =>
                      window.confirm('Заменить квартиру другой схемой? Все изменения текущей схемы и история отмены будут потеряны.'),
                    )
                  }
                >
                  {chosen === template.id ? 'Продолжить с этой схемой' : 'Выбрать схему'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
