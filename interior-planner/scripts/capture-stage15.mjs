// Сценарий этапа 15 на технической квартире: мебель → настройка → потолок, стена, конфликт → переход к предмету.
// Нужен запущенный `npm run dev`. Печатает результаты шагов и сохраняет кадры.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => '__stores' in window);
const out = {};
out.placed = await p.evaluate(() => {
  const { project, ui, drag } = window.__stores;
  project.getState().load(window.__tech.createTechTwoRooms());
  ui.getState().setTemplateId('tech');
  ui.getState().setStage('interior');
  const put = (room, item, x, z, turn = 0) => {
    ui.getState().setActiveRoom(room);
    drag.getState().startFromCatalog(item);
    if (turn) drag.getState().rotate(turn);
    drag.getState().pointAt({ x, z });
    const r = drag.getState().finish();
    return `${item}: ${r?.ok ? 'ok' : r ? r.issues[0].message : 'нет'}`;
  };
  return [put('a', 'wall_sconce', 410, 60), put('a', 'Chandelier_02', 200, 170), put('b', 'GothicCommode_01', 455, 250, 90)];
});
const state = () =>
  p.evaluate(() => {
    const ap = window.__stores.project.getState().history.present;
    const by = (item) => Object.values(ap.furniture).find((f) => f.catalogItemId === item);
    return { ceiling: ap.ceilingCm, w7x: ap.vertices.v2.xCm, sconceX: by('wall_sconce')?.position.xCm, chandY: by('Chandelier_02')?.position.yCm, furniture: Object.keys(ap.furniture).length };
  });
out.before = await state();
await p.getByTestId('to-setup').click();
await p.getByLabel(/Высота потолка, см/).fill('300');
await p.getByRole('button', { name: 'Применить высоту' }).click();
out.afterCeiling = await state();
await p.getByTestId('plan-wall-w7').click();
await p.getByLabel('Комната А: ширина, см').fill('380');
await p.getByRole('button', { name: 'Применить', exact: true }).click();
out.afterWallToA = await state();
await p.getByTestId('plan-wall-w7').click();
await p.getByLabel('Комната А: ширина, см').fill('420');
out.conflict = await p.getByTestId('setup-issue').textContent();
out.jump = await p.getByTestId('conflict-jump').textContent();
out.highlighted = await p.locator('.plan-item.conflict').count();
await p.screenshot({ path: 'docs/stage-15/conflict.png' });
await p.getByTestId('conflict-jump').click();
out.afterJump = await p.evaluate(() => {
  const { ui, project } = window.__stores;
  const s = ui.getState();
  return { stage: s.stage, room: s.activeRoomId, selected: project.getState().history.present.furniture[s.selectedId]?.catalogItemId, unchanged: project.getState().history.present.vertices.v2.xCm };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
