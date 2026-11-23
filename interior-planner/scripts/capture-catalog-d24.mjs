// Расширенный каталог (D-24–D-26): шторы поверх окна, ТВ на тумбе, декор на столе, картина, растение,
// паркет, штукатурка, отделка двери и рамы окна. Предметы ставятся тем же циклом переноса, что и мышью.
// Нужен запущенный `npm run dev`. Печатает результат проверки каждого предмета и сохраняет кадр.
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
const report = await p.evaluate(() => {
  const { project, ui, drag } = window.__stores;
  let ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  const walls = ap.rooms[room].boundary.map((e) => e.wallId);
  const vs = walls.flatMap((id) => [ap.walls[id].startId, ap.walls[id].endId]).map((id) => ap.vertices[id]);
  const [x0, x1] = [Math.min(...vs.map((v) => v.xCm)), Math.max(...vs.map((v) => v.xCm))];
  const [z0, z1] = [Math.min(...vs.map((v) => v.zCm)), Math.max(...vs.map((v) => v.zCm))];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // Окно комнаты и его центр на плане.
  const win = Object.values(ap.openings).find((o) => o.kind === 'window' && walls.includes(o.wallId));
  const w = ap.walls[win.wallId];
  const [a, bb] = [ap.vertices[w.startId], ap.vertices[w.endId]];
  const len = Math.hypot(bb.xCm - a.xCm, bb.zCm - a.zCm);
  const t = (win.offsetCm + win.widthCm / 2) / len;
  const wc = { x: a.xCm + (bb.xCm - a.xCm) * t, z: a.zCm + (bb.zCm - a.zCm) * t };
  const door = Object.values(ap.openings).find((o) => o.kind === 'door' && walls.includes(o.wallId));
  // Отделка: паркет, штукатурка на одной стене, белая дверь, графитовая рама.
  project.getState().load({
    ...ap,
    openings: { ...ap.openings, [door.id]: { ...door, finishId: 'white' }, [win.id]: { ...win, finishId: 'graphite' } },
    finishes: { walls: { [`${walls[2]}|${room}`]: 'wall-patterned_plaster_wall' }, floors: { [room]: 'floor-herringbone_parquet' } },
  });
  const put = (item, x, z, turn = 0) => {
    drag.getState().startFromCatalog(item);
    if (turn) drag.getState().rotate(turn);
    drag.getState().pointAt({ x, z }, false);
    const d = drag.getState().draft;
    const res = drag.getState().finish();
    return `${item}: ${res?.ok ? 'ok' : res ? res.issues[0].message : 'нет кандидата'} (y=${d?.position?.yCm ?? '-'}, угол ${d?.angleDeg})`;
  };
  return [
    put('tulle', wc.x, wc.z + 30),
    put('curtains', wc.x, wc.z + 30),
    put('tv_stand', x1 - 45, cz, 270),
    put('tv_flat', x1 - 45, cz, 270),
    put('sofa_02', cx - 90, cz, 90),
    put('modern_coffee_table_02', cx + 40, cz),
    put('ceramic_vase_02', cx + 40, cz),
    put('hanging_picture_frame_02', x0 + 10, cz),
    put('potted_plant_01', x1 - 50, z0 + 60),
    put('rug_round', cx + 20, cz),
  ];
});
console.log(report.join('\n'));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'docs/stage-13/catalog-d24.png' });
// Вид изнутри на окно: камера у южной стены смотрит на север — шторы и тюль на окне.
await p.evaluate(() => {
  const { project, ui } = window.__stores;
  const ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
  const xs = vs.map((v) => v.xCm), zs = vs.map((v) => v.zCm);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 200, z0 = Math.min(...zs) / 100, z1 = Math.max(...zs) / 100;
  const k = window.__controls, c = window.__camera;
  k.target.set(cx, 1.3, z0);
  c.position.set(cx + 0.6, 1.7, z1 - 0.4);
  k.update();
});
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/stage-13/catalog-d24-window.png', clip: await p.getByTestId('scene').boundingBox() });
await b.close();
