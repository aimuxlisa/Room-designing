// Этап 18.2: фокус полей, клавиатура, все способы завершить перенос, камера во время переноса.
// Реальные события мыши и клавиатуры. Нужен запущенный `npm run dev`. Печатает отчёт (ok / FAIL).
import { chromium } from '@playwright/test';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message));
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);

await p.goto('http://localhost:5173/');
await p.waitForFunction(() => '__stores' in window);
await p.evaluate(() => {
  const { project, ui } = window.__stores;
  project.getState().load(window.__tech.createTechTwoRooms());
  ui.getState().setTemplateId('tech');
  ui.getState().setActiveRoom('a');
  ui.getState().setStage('interior');
});
await p.waitForFunction(() => window.__view === 'a');

const st = () =>
  p.evaluate(() => {
    const { project, ui, drag } = window.__stores;
    const ap = project.getState().history.present;
    return {
      n: Object.keys(ap.furniture).length,
      steps: project.getState().history.past.length,
      draft: !!drag.getState().draft,
      selected: ui.getState().selectedId,
      camera: window.__controls?.enabled,
      f: JSON.stringify(ap.furniture),
    };
  });
const plan = await p.getByTestId('plan').boundingBox();
const planC = { x: plan.x + plan.width / 2, y: plan.y + plan.height / 2 };
const scene = await p.getByTestId('scene').boundingBox();
const item = async (id) => {
  await p.getByTestId(`catalog-${id}`).scrollIntoViewIfNeeded();
  const r = await p.getByTestId(`catalog-${id}`).boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

// 1. Перенос из каталога мышью на план: во время переноса камера выключена, после — включена.
let a = await item('modern_coffee_table_02');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
await p.mouse.move(planC.x, planC.y, { steps: 8 });
const during = await st();
await p.mouse.up();
const after1 = await st();
check('перенос: камера выключена во время переноса', during.draft && during.camera === false);
check('перенос на план ставит предмет и выбирает его', after1.n === 1 && !after1.draft && !!after1.selected);
check('после переноса камера снова управляется', after1.camera === true);

// 2. Esc во время переноса из каталога: ничего не создаётся, история не меняется.
a = await item('modern_arm_chair_01');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
await p.mouse.move(planC.x + 60, planC.y + 40, { steps: 6 });
await p.keyboard.press('Escape');
const esc = await st();
await p.mouse.up();
const after2 = await st();
check('Esc отменяет перенос из каталога', !esc.draft && after2.n === 1 && after2.steps === after1.steps && after2.camera === true);

// 3. Перенос существующего предмета и Esc — предмет на прежнем месте.
const box = await p.locator('[data-testid^="plan-item-"]').first().boundingBox();
const f0 = (await st()).f;
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 30, { steps: 6 });
await p.keyboard.press('Escape');
await p.mouse.up();
check('Esc при переносе существующего — прежнее положение', (await st()).f === f0);

// 4. Отпускание за пределами комнаты (над каталогом): нового предмета нет, существующий не тронут.
a = await item('modern_arm_chair_01');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
await p.mouse.move(planC.x, planC.y, { steps: 4 });
await p.mouse.move(a.x, a.y + 200, { steps: 4 });
await p.mouse.up();
const after4 = await st();
check('отпускание над каталогом не создаёт предмет', after4.n === 1 && !after4.draft && after4.camera === true);

// 5. Невалидное отпускание (за стеной): предмет не ставится, причина в строке состояния, камера включена.
a = await item('modern_arm_chair_01');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
await p.mouse.move(plan.x + 30, planC.y, { steps: 6 });
await p.mouse.up();
const after5 = await st();
const status5 = await p.getByTestId('status').textContent();
check('невалидное отпускание: предмет не ставится, причина видна', after5.n === 1 && after5.camera === true && /пересекает|вне|стен/i.test(status5), status5);

// 6. Потеря фокуса окна во время переноса — отмена.
a = await item('modern_arm_chair_01');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
await p.mouse.move(planC.x, planC.y + 50, { steps: 4 });
await p.evaluate(() => window.dispatchEvent(new Event('blur')));
const blur = await st();
await p.mouse.up();
check('потеря фокуса окна отменяет перенос', !blur.draft && (await st()).n === 1 && blur.camera === true);

// 7. Перенос из каталога в 3D.
a = await item('modern_arm_chair_01');
await p.mouse.move(a.x, a.y);
await p.mouse.down();
// Экранная точка свободного места пола (x 90, z 80 см) по камере сцены.
const free = await p.evaluate(() => {
  const v = window.__camera.position.clone().set(0.9, 0, 0.8).project(window.__camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
});
await p.mouse.move(scene.x + scene.width * free.x, scene.y + scene.height * free.y, { steps: 10 });
const d3 = await st();
await p.mouse.up();
const after7 = await st();
const status7 = await p.getByTestId('status').textContent();
check('перенос в 3D: камера выключена во время, предмет поставлен', d3.camera === false && after7.camera === true && !after7.draft && after7.n === 2, `предметов ${after7.n}; ${status7.slice(0, 80)}`);

// 8. Клавиатура: выбранный предмет — стрелки, R, Delete; Ctrl+Z.
await p.evaluate(() => {
  const { project, ui } = window.__stores;
  ui.getState().select(Object.keys(project.getState().history.present.furniture)[0]);
});
await p.locator('body').click({ position: { x: 1700, y: 1060 } }).catch(() => {});
const sel = await st();
const pos = () => p.evaluate((id) => window.__stores.project.getState().history.present.furniture[id], sel.selected);
const k0 = await pos();
if (!sel.selected) check('клавиатура: есть выбранный предмет', false);
else {
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Shift+ArrowDown');
  const k1 = await pos();
  check('стрелки: +1 см по X, Shift — +10 см по Z', k1.position.xCm === k0.position.xCm + 1 && k1.position.zCm === k0.position.zCm + 10);
  await p.keyboard.press('KeyR');
  const k2 = await pos();
  check('R поворачивает выбранный предмет', k2.angleDeg !== k1.angleDeg, `${k1.angleDeg} → ${k2.angleDeg}`);
  await p.keyboard.press('Control+KeyZ');
  await p.keyboard.press('Control+KeyZ');
  await p.keyboard.press('Control+KeyZ');
  check('Ctrl+Z ×3 возвращает положение', JSON.stringify((await pos()).position) === JSON.stringify(k0.position) && (await pos()).angleDeg === k0.angleDeg);
}

// 9. Клавиатура в каталоге: Tab к предмету, Enter ставит в центр комнаты и выбирает.
const nBefore = (await st()).n;
await p.getByTestId('catalog-floor_lamp').focus().catch(() => {});
const focused = await p.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
await p.keyboard.press('Enter');
const kb = await st();
const status9 = await p.getByTestId('status').textContent();
check('Enter на предмете каталога ставит его с клавиатуры', kb.n === nBefore + 1 || /пересекает|занят|вне/i.test(status9), `фокус ${focused}; ${kb.n - nBefore} новых; ${status9.slice(0, 80)}`);
const focusRing = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
check('фокус с клавиатуры виден (outline)', focusRing !== 'none', focusRing);

// 10. Поля ввода: в настройке R, Delete, стрелки и Ctrl+Z не действуют на проект.
await p.evaluate(() => window.__stores.ui.getState().select(Object.keys(window.__stores.project.getState().history.present.furniture)[0]));
await p.getByTestId('to-setup').click();
const ceiling = p.getByLabel(/Высота потолка, см/);
await ceiling.focus();
const fBefore = (await st()).f;
await ceiling.press('End');
await ceiling.press('KeyR');
await ceiling.press('Delete');
await ceiling.press('ArrowLeft');
await ceiling.press('Control+KeyZ');
check('в поле ввода горячие клавиши не трогают проект', (await st()).f === fBefore);
check('поле принимает ввод с клавиатуры', (await ceiling.inputValue()).length > 0, await ceiling.inputValue());

// 11. Tab по шагам: порядок фокуса.
// С начала страницы: первый Tab — шаги, дальше — выбор комнатности; Enter на варианте выбирает его.
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => '__stores' in window);
const tabs = [];
for (let i = 0; i < 6; i++) {
  await p.keyboard.press('Tab');
  tabs.push(await p.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 20)));
}
check('Tab начинается со шагов и доходит до полей', /Параметры/.test(tabs[0]) && tabs.some((t) => /комнат/.test(t)), tabs.join(' → '));

check('нет ошибок страницы', pageErrors.length === 0, pageErrors.join('; '));
console.log(results.join('\n'));
console.log(`\nИтого: ${results.filter((r) => r.startsWith('ok')).length}/${results.length}`);
await b.close();
