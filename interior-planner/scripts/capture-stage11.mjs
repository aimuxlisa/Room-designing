// Кадр прототипа плана интерьера и навигации (этап 11.1). Нужен запущенный `npm run dev`.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
await p.getByRole('button', { name: 'Подобрать схемы' }).click();
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForFunction(() => '__scene' in window);
// Кресло в центре активной комнаты и выбор — чтобы показать подсветку на плане и в 3D.
await p.evaluate(() => {
  const w = window;
  const ap = w.__stores.project.getState().history.present;
  const room = w.__stores.ui.getState().activeRoomId;
  const xs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
  const cx = (Math.min(...xs.map((v) => v.xCm)) + Math.max(...xs.map((v) => v.xCm))) / 2;
  const cz = (Math.min(...xs.map((v) => v.zCm)) + Math.max(...xs.map((v) => v.zCm))) / 2;
  w.__stores.project.getState().load({
    ...ap,
    furniture: { chair: { id: 'chair', catalogItemId: 'modern_arm_chair_01', assetVersion: 1, roomId: room, position: { xCm: cx, yCm: 0, zCm: cz }, angleDeg: 0, variantId: null } },
  });
  w.__stores.ui.getState().select('chair');
});
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/stage-11/interior.png' });
await b.close();
console.log('saved docs/stage-11/interior.png');
