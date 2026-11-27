// Этап 21: искусственный свет — снимки ночью с выключателями в разных положениях, люстра вместо плафона,
// замер с включёнными лампами и проверка сохранения выключателей при переходах (21.1, 21.3, 21.4, 21.6).
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage21.mjs [chrome|msedge]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const channel = process.argv[2] ?? 'chrome';
mkdirSync('docs/stage-21', { recursive: true });
const b = await chromium.launch({ channel, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
await p.getByRole('button', { name: 'Подобрать схемы' }).click();
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForFunction(() => '__view' in window);

/** Расстановка гостиной: торшер, приставной столик с настольной лампой; withChandelier — люстра по центру. */
const furnish = (withChandelier) =>
  p.evaluate((chand) => {
    const w = window;
    const ap = w.__stores.project.getState().history.present;
    const room = w.__stores.ui.getState().activeRoomId;
    const walls = ap.rooms[room].boundary.map((e) => e.wallId);
    const vs = walls.flatMap((id) => [ap.walls[id].startId, ap.walls[id].endId]).map((id) => ap.vertices[id]);
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
        ...put('flamp', 'floor_lamp', cx + 150, cz + 120),
        ...put('side', 'side_table_01', cx - 150, cz + 100),
        ...put('tlamp', 'table_lamp', cx - 150, cz + 100, 0, 55.1),
        ...(chand ? put('chand', 'Chandelier_02', cx, cz, 0, ap.ceilingCm - 84.8) : {}),
      },
    });
    return room;
  }, withChandelier);

const room = await furnish(false);
await p.getByRole('button', { name: 'Ночь', exact: true }).click();
await p.waitForTimeout(2500);
const box = await p.getByTestId('scene').boundingBox();
const shot = async (name) => {
  await p.waitForTimeout(600);
  await p.screenshot({ path: `docs/stage-21/${name}.png`, clip: box });
};
const set = (roomOn, lampsOn) =>
  p.evaluate(
    ([r, on, lamps]) => {
      const ui = window.__stores.ui.getState();
      if ((ui.lights.rooms[r] ?? false) !== on) ui.toggleRoomLight(r);
      for (const id of ['flamp', 'tlamp']) if ((window.__stores.ui.getState().lights.lamps[id] ?? false) !== lamps) window.__stores.ui.getState().toggleLamp(id);
    },
    [room, roomOn, lampsOn],
  );
const history0 = await p.evaluate(() => window.__stores.project.getState().history.past.length);

await set(false, false);
await shot('night-all-off');
// Выключатель комнаты — кнопкой в интерфейсе (21.1).
await p.getByTestId('room-light').click();
await shot('night-ceiling-on');
await set(false, true);
await shot('night-lamps-on');
await set(true, true);
await shot('night-all-on');
await p.getByRole('button', { name: 'Вечер', exact: true }).click();
await shot('evening-all-on');
await p.getByRole('button', { name: 'Ночь', exact: true }).click();

// Кнопка выбранного светильника (21.4).
await p.evaluate(() => window.__stores.ui.getState().select('flamp'));
const lampButton = await p.getByTestId('lamp-light').textContent();

// 21.3: кадры при включённых лампах и смене выключателей без перекомпиляции шейдеров.
const perf = await p.evaluate(async (r) => {
  const w = window;
  const mem = () => ({ ...w.__gl.info.memory, programs: w.__gl.info.programs.length });
  const frames = async (step) => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 240; i++) {
      step(i);
      await new Promise((res) => requestAnimationFrame(res));
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    times.sort((a, b) => a - b);
    return { fps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1), p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1) };
  };
  const before = mem();
  const lit = await frames(() => {});
  const toggling = await frames((i) => i % 10 === 0 && w.__stores.ui.getState().toggleRoomLight(r));
  return { before, after: mem(), lit, toggling };
}, room);

// 21.1: выключатели сохраняются при переходе в другую комнату и обратно.
const persist = await p.evaluate(async (r) => {
  const w = window;
  const ui = () => w.__stores.ui.getState();
  if (!ui().lights.rooms[r]) ui().toggleRoomLight(r);
  const ap = w.__stores.project.getState().history.present;
  const other = Object.keys(ap.rooms).find((id) => id !== r);
  ui().setActiveRoom(other);
  await new Promise((res) => setTimeout(res, 300));
  const otherOn = ui().lights.rooms[other] ?? false;
  ui().setActiveRoom(r);
  await new Promise((res) => setTimeout(res, 300));
  return { roomOnAfterReturn: ui().lights.rooms[r] === true, lampOnAfterReturn: ui().lights.lamps.flamp === true, otherRoomUntouched: otherOn === false };
}, room);
await p.waitForFunction((r) => window.__view === r, room);

// 21.6: люстра заменяет плафон и берёт выключатель.
await furnish(true);
await p.evaluate(() => window.__stores.ui.getState().select(null));
await p.waitForTimeout(2000);
const chandelier = await p.evaluate(() => ({
  standardFixture: !!window.__scene.getObjectByName(`standard-fixture-${window.__stores.ui.getState().activeRoomId}`),
  chandelierLight: !!window.__scene.getObjectByName('light-chand'),
}));
const switchLabel = await p.getByTestId('room-light').textContent();
await set(true, false);
await shot('night-chandelier-on');

const history1 = await p.evaluate(() => window.__stores.project.getState().history.past.length);
const result = { channel, historyUnchanged: history0 === history1, lampButton, switchLabel, chandelier, persist, perf, errors };
writeFileSync(`docs/stage-21/measure-${channel}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await b.close();
