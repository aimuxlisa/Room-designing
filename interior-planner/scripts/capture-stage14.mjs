// Кадр размещения (этап 14): ручка поворота на плане, кольцо в 3D, настенные предметы у стены.
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
// Настенные предметы ставятся тем же циклом переноса, что и мышью: точка рядом со стеной.
const report = await p.evaluate(() => {
  const w = window;
  const { drag, project, ui } = w.__stores;
  const ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
  const [x0, x1] = [Math.min(...vs.map((v) => v.xCm)), Math.max(...vs.map((v) => v.xCm))];
  const [z0, z1] = [Math.min(...vs.map((v) => v.zCm)), Math.max(...vs.map((v) => v.zCm))];
  const place = (item, x, z) => {
    drag.getState().startFromCatalog(item);
    drag.getState().pointAt({ x, z });
    const d = drag.getState().draft;
    const out = { item, angle: d.angleDeg, pos: d.position, ok: d.proposal.ok, why: d.proposal.ok ? null : d.proposal.issues[0].message };
    drag.getState().finish();
    return out;
  };
  const res = [
    place('kitchen_wall_cabinet', x1 - 120, z1 - 40), // у южной стены
    place('wall_sconce', x0 + 30, (z0 + z1) / 2), // у западной стены
  ];
  drag.getState().startFromCatalog('ArmChair_01');
  drag.getState().pointAt({ x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
  drag.getState().finish();
  const chair = Object.values(project.getState().history.present.furniture).find((f) => f.catalogItemId === 'ArmChair_01');
  ui.getState().select(chair.id);
  // Поворот мышью через тот же цикл: указатель справа от кресла → лицевая сторона на восток (90°).
  drag.getState().startRotate(chair.id);
  drag.getState().pointAt({ x: chair.position.xCm + 100, z: chair.position.zCm + 3 });
  const rot = drag.getState().draft.angleDeg;
  drag.getState().finish();
  ui.getState().select(chair.id);
  return { res, rot, chairAngle: project.getState().history.present.furniture[chair.id].angleDeg };
});
console.log(JSON.stringify(report));
await p.waitForTimeout(2500);
await p.screenshot({ path: 'docs/stage-14/placement.png' });
await b.close();
