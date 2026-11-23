// Кадр каталога (этап 13): панель с превью и фильтром по комнате, предметы Poly Haven и собственные в 3D.
// Нужен запущенный `npm run dev`.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
await p.getByRole('button', { name: 'Подобрать схемы' }).click();
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForFunction(() => '__view' in window);
await p.evaluate(() => {
  const w = window;
  const ap = w.__stores.project.getState().history.present;
  const room = w.__stores.ui.getState().activeRoomId;
  const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
  const [x0, x1] = [Math.min(...vs.map((v) => v.xCm)), Math.max(...vs.map((v) => v.xCm))];
  const [z0, z1] = [Math.min(...vs.map((v) => v.zCm)), Math.max(...vs.map((v) => v.zCm))];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const put = (id, item, x, z, angleDeg = 0, y = 0) => ({ [id]: { id, catalogItemId: item, assetVersion: 1, roomId: room, position: { xCm: x, yCm: y, zCm: z }, angleDeg, variantId: null } });
  w.__stores.project.getState().load({
    ...ap,
    furniture: {
      ...put('rug', 'rug', cx, cz),
      ...put('sofa', 'sofa_02', cx, cz + 110, 180),
      ...put('table', 'modern_coffee_table_01', cx, cz, 90),
      ...put('arm', 'ArmChair_01', cx - 150, cz, 90),
      ...put('tv', 'tv_stand', cx, z0 + 45, 0),
      ...put('lamp', 'floor_lamp', cx + 150, cz + 120),
      ...put('chand', 'Chandelier_02', cx, cz, 0, ap.ceilingCm - 84.8),
      ...put('fridge', 'fridge', x1 - 60, z0 + 50, 0),
      ...put('sink', 'kitchen_sink_cabinet', x1 - 150, z0 + 50, 0),
    },
  });
});
await p.waitForTimeout(2500);
await p.screenshot({ path: 'docs/stage-13/interior.png' });
await b.close();
console.log('saved docs/stage-13/interior.png');
