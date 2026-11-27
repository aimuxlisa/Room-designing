// Этап 18.5: матрица совместимости — Chrome и Edge, размеры окна, отсутствие 3D.
// Нужен запущенный `npm run dev`. Печатает матрицу (ok / FAIL), кадры — docs/stage-18/compat-*.png.
import { chromium } from '@playwright/test';

const URL = 'http://localhost:5173/';
const SIZES = [[1920, 1080], [2560, 1440], [1600, 900], [1366, 768], [1280, 720]];
const rows = [];

/** Полный путь до интерьера и проверки раскладки на одном размере. */
async function probe(browser, label, [w, h], shot) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const res = {};
  await p.goto(URL);
  await p.getByRole('radio', { name: '2 комнаты' }).click();
  await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
  await p.getByRole('button', { name: 'Подобрать схемы' }).click();
  await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  res.setupFits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.getByRole('button', { name: 'К интерьеру →' }).click();
  const unavailable = p.getByTestId('scene-unavailable');
  await Promise.race([p.waitForFunction(() => '__view' in window && window.__scene), unavailable.waitFor()]).catch(() => {});
  res.no3d = await unavailable.count() === 1;
  const box = async (sel) => (await p.locator(sel).first().boundingBox()) ?? { width: 0, height: 0, x: 0, y: 0 };
  const [plan, scene, cat] = [await box('[data-testid="plan"]'), await box('.pane-scene'), await box('.catalog')];
  res.noHScroll = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  res.noVScroll = await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  res.panes = `план ${Math.round(plan.width)}×${Math.round(plan.height)}, 3D ${Math.round(scene.width)}×${Math.round(scene.height)}, каталог ${Math.round(cat.width)}`;
  res.panesOk = plan.width >= 300 && plan.height >= 300 && scene.width >= 300 && cat.width >= 200;
  // Перенос мышью из каталога на план.
  const item = p.getByTestId('catalog-modern_coffee_table_02');
  await item.scrollIntoViewIfNeeded();
  const ib = await item.boundingBox();
  await p.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await p.mouse.down();
  await p.mouse.move(plan.x + plan.width / 2, plan.y + plan.height / 2, { steps: 8 });
  await p.mouse.up();
  res.placed = (await p.locator('[data-testid^="plan-item-"]').count()) === 1;
  res.headerOneLine = await p.evaluate(() => document.querySelector('.app-header').getBoundingClientRect().height <= 60);
  // Переход через дверь (работает и без 3D).
  const before = await p.locator('.app-header .muted').textContent();
  await p.locator('[data-testid^="nav-door-"]').first().click();
  res.doorNav = (await p.locator('.app-header .muted').textContent()) !== before;
  res.errors = errors.length ? errors.join('; ').slice(0, 120) : '';
  if (shot) await p.screenshot({ path: `docs/stage-18/compat-${shot}.png` });
  await p.close();
  const ok = res.setupFits && res.noHScroll && res.panesOk && res.placed && res.doorNav && !res.errors && (res.no3d || label.includes('без 3D') === false);
  rows.push(`${ok ? 'ok  ' : 'FAIL'} ${label} ${w}×${h} — ${res.panes}; прокрутка: гор. ${res.noHScroll ? 'нет' : 'ЕСТЬ'}, верт. ${res.noVScroll ? 'нет' : 'есть'}; шапка ${res.headerOneLine ? 'в строку' : 'в 2 строки'}; предмет ${res.placed ? 'поставлен' : 'НЕ поставлен'}; дверь ${res.doorNav ? 'ведёт' : 'НЕ ведёт'}${res.no3d ? '; 3D недоступен — сообщение' : ''}${res.errors ? '; ошибки: ' + res.errors : ''}`);
  return res;
}

for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel });
  const version = browser.version();
  for (const size of SIZES) await probe(browser, `${channel} ${version}`, size, `${channel}-${size[0]}`);
  await browser.close();
}
// Без 3D: WebGL выключен — сообщение вместо сцены, план и каталог работают.
const no3d = await chromium.launch({ channel: 'chrome', args: ['--disable-3d-apis'] });
const r = await probe(no3d, 'chrome без 3D', [1920, 1080], 'no-webgl');
rows.push(`${r.no3d ? 'ok  ' : 'FAIL'} chrome без 3D — сообщение «3D-вид недоступен» ${r.no3d ? 'показано' : 'НЕ показано'}`);
await no3d.close();

console.log(rows.join('\n'));
console.log(`\nИтого: ${rows.filter((x) => x.startsWith('ok')).length}/${rows.length}`);
