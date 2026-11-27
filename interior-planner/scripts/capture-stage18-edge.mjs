// Этап 18.1: крайние случаи — ввод чисел, длинные названия, пустой каталог, ошибки ассетов, неизвестный предмет.
// Нужен запущенный `npm run dev`. Печатает отчёт (ok / FAIL) и сохраняет кадры в docs/stage-18.
import { chromium } from '@playwright/test';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);

// 1. Площадь: недопустимые и дробные значения.
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
const area = p.getByLabel('Примерная площадь квартиры, м²');
const go = p.getByRole('button', { name: 'Подобрать схемы' });
for (const [text, valid] of [['', false], ['abc', false], ['-5', false], ['1e3', false], ['14,9', false], ['250,1', false], ['  55  ', true], ['55,55', true], ['55.5', true], ['9'.repeat(40), false]]) {
  await area.fill(text);
  check(`площадь «${text.length > 12 ? text.slice(0, 12) + '…' : text}»`, (await go.isEnabled()) === valid, valid ? 'принято' : (await p.getByRole('alert').textContent().catch(() => '')) || 'кнопка выключена');
}
await area.fill('55');
await go.click();
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();

// 2. Размер стены: поле ширины комнаты.
const wallId = await p.evaluate(() => {
  const { project, ui } = window.__stores;
  const ap = project.getState().history.present;
  const room = ap.rooms[ui.getState().activeRoomId] ?? Object.values(ap.rooms)[0];
  return room.boundary[1].wallId;
});
await p.getByTestId(`plan-wall-${wallId}`).click();
const sizeField = p.getByTestId('wall-panel').locator('input').first();
const apply = p.getByTestId('wall-panel').getByRole('button', { name: 'Применить', exact: true });
const geom = () => p.evaluate(() => JSON.stringify(window.__stores.project.getState().history.present.vertices));
const g0 = await geom();
for (const text of ['abc', '', '-100', '0', '1e5', '99999999', '12,5,5']) {
  await sizeField.fill(text);
  const canApply = await apply.isEnabled().catch(() => false);
  if (canApply) await apply.click();
  const issue = (await p.getByTestId('size-input-error').first().textContent().catch(() => '')) || (await p.getByTestId('setup-issue').textContent().catch(() => ''));
  check(`размер «${text}» не меняет квартиру`, (await geom()) === g0, canApply ? `кнопка активна; ${issue}` : `кнопка выключена${issue ? '; ' + issue : ''}`);
}
const before = await sizeField.inputValue();
await sizeField.fill(String(Number(before.replace(',', '.')) + 0.6).replace('.', ','));
await apply.click();
check('дробный размер округляется до см', (await geom()) !== g0);
await p.screenshot({ path: 'docs/stage-18/edge-setup.png' });

// 3. Интерьер: длинные названия, пустой каталог, неизвестный предмет, ошибка модели.
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForFunction(() => '__view' in window);
await p.evaluate(() => {
  const { project, ui } = window.__stores;
  const ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  const long = 'Очень длинное название комнаты для проверки переноса строк и обрезки в интерфейсе';
  project.getState().load({
    ...ap,
    rooms: { ...ap.rooms, [room]: { ...ap.rooms[room], name: long } },
    furniture: { ...ap.furniture, ghost: { id: 'ghost', catalogItemId: 'no_such_item', roomId: room, position: { xCm: 100, yCm: 0, zCm: 100 }, angleDeg: 0 } },
  });
});
await p.waitForTimeout(800);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('длинное название комнаты не даёт горизонтальной прокрутки', !overflow);
check('неизвестный предмет не ломает сцену', pageErrors.length === 0 && (await p.getByTestId('scene').count()) === 1, pageErrors.join('; '));
await p.screenshot({ path: 'docs/stage-18/edge-long-name.png' });

// Пустой каталог для комнаты: фильтр по типу, у которого нет предметов.
const emptyShown = await p.evaluate(() => {
  const { project, ui } = window.__stores;
  const ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  project.getState().load({ ...ap, rooms: { ...ap.rooms, [room]: { ...ap.rooms[room], type: 'no-such-type' } } });
  return true;
});
await p.waitForTimeout(300);
await p.getByRole('button', { name: /^Для «/ }).click();
const emptyText = await p.locator('.catalog').textContent();
check('пустой список каталога объяснён', emptyShown && /нет предметов/i.test(emptyText), emptyText.slice(0, 120));
await p.screenshot({ path: 'docs/stage-18/edge-catalog-empty.png' });
await p.getByRole('button', { name: /^Все \(/ }).click();

// Ошибка загрузки модели: сеть отдаёт 404 на GLB дивана с самого начала (модели подгружаются заранее).
const q = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const modelPageErrors = [];
q.on('pageerror', (e) => modelPageErrors.push(e.message));
let fail = true;
await q.route('**/sofa_02.glb', (r) => (fail ? r.fulfill({ status: 404, body: '' }) : r.continue()));
await q.goto('http://localhost:5173/');
await q.waitForFunction(() => '__stores' in window);
const placed = await q.evaluate(() => {
  const { project, ui, drag } = window.__stores;
  project.getState().load(window.__tech.createTechTwoRooms());
  ui.getState().setTemplateId('tech');
  ui.getState().setActiveRoom('a');
  ui.getState().setStage('interior');
  drag.getState().startFromCatalog('sofa_02');
  drag.getState().pointAt({ x: 200, z: 170 }, false);
  return drag.getState().finish()?.ok;
});
await q.getByTestId('asset-errors').waitFor({ timeout: 10000 }).catch(() => {});
const errText = await q.getByTestId('asset-errors').textContent().catch(() => '');
const kept = await q.evaluate(() => Object.keys(window.__stores.project.getState().history.present.furniture).length);
check('ошибка модели показана, предмет в проекте сохранён', placed && kept === 1 && /Не удалось загрузить/.test(errText), errText.slice(0, 110));
await q.screenshot({ path: 'docs/stage-18/edge-model-error.png' });
fail = false;
await q.getByTestId('asset-errors').getByRole('button', { name: 'Повторить' }).first().click().catch(() => {});
await q.waitForTimeout(3000);
check('после «Повторить» модель загрузилась', (await q.getByTestId('asset-errors').count()) === 0);

check('нет необработанных ошибок страницы', pageErrors.length === 0, pageErrors.join('; '));
// На странице с намеренным 404 допускается только отклонённая загрузка этой модели (не ломает работу).
check('при отказе модели других ошибок нет', modelPageErrors.every((m) => m.includes('sofa_02.glb')), `${modelPageErrors.length} сообщ. о sofa_02.glb`);
console.log(results.join('\n'));
console.log(`\nИтого: ${results.filter((r) => r.startsWith('ok')).length}/${results.length}`);
await b.close();
