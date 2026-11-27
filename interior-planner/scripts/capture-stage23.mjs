// Этап 23: покрытия пола — выбор через план и панель «Покрытие пола», снимки 3D по группам покрытий днём и ночью,
// цвет на плане, шаг истории и отмена, перебор всех покрытий без утечки текстур, замер D-08 (23.5).
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage23.mjs [chrome|msedge]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const channel = process.argv[2] ?? 'chrome';
mkdirSync('docs/stage-23', { recursive: true });
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

// Немного мебели, чтобы покрытие читалось рядом с предметами.
const room = await p.evaluate(() => {
  const w = window;
  const ap = w.__stores.project.getState().history.present;
  const room = w.__stores.ui.getState().activeRoomId;
  const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
  const cx = (Math.min(...vs.map((v) => v.xCm)) + Math.max(...vs.map((v) => v.xCm))) / 2;
  const cz = (Math.min(...vs.map((v) => v.zCm)) + Math.max(...vs.map((v) => v.zCm))) / 2;
  const put = (id, item, x, z, angleDeg = 0) => ({ [id]: { id, catalogItemId: item, assetVersion: 1, roomId: room, position: { xCm: x, yCm: 0, zCm: z }, angleDeg, variantId: null } });
  w.__stores.project.getState().load({
    ...ap,
    furniture: { ...put('sofa', 'sofa_02', cx, cz + 110, 180), ...put('table', 'modern_coffee_table_01', cx, cz, 90), ...put('flamp', 'floor_lamp', cx + 150, cz + 120) },
  });
  return room;
});
await p.waitForTimeout(2000);

const box = await p.getByTestId('scene').boundingBox();
const floorMaterial = () => p.evaluate((r) => window.__scene.getObjectByName(`floor-${r}`)?.material?.name ?? '', room);
const textureReady = () =>
  p.waitForFunction((r) => {
    const m = window.__scene.getObjectByName(`floor-${r}`)?.material;
    return !m?.map || !!m.map.image?.complete;
  }, room);

// Выбор пола щелчком по комнате на плане открывает панель (23.3).
await p.getByTestId(`plan-room-${room}`).click({ position: { x: 30, y: 30 } });
await p.getByTestId('finish-panel').waitFor();
const panelTitle = await p.getByTestId('finish-surface').textContent();
const groups = await p.locator('[data-testid="finish-panel"] h3').allTextContents();
const swatchIds = await p.locator('[data-testid="finish-panel"] .swatch').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('swatch-', '')));

const history0 = await p.evaluate(() => window.__stores.project.getState().history.past.length);
// По одному покрытию из каждой группы: снимок 3D и проверка плана.
const picks = await p.evaluate(() =>
  [...document.querySelectorAll('[data-testid="finish-panel"] h3')].map((h) => ({
    group: h.textContent,
    id: h.nextElementSibling?.querySelector('.swatch')?.dataset.testid.replace('swatch-', ''),
  })),
);
const shots = [];
for (const [i, pick] of picks.entries()) {
  await p.getByTestId(`swatch-${pick.id}`).click();
  await textureReady();
  await p.waitForTimeout(700);
  const plan = await p.getByTestId(`plan-floor-finish-${room}`).getAttribute('data-material');
  const material = await floorMaterial();
  const current = await p.getByTestId('finish-current').textContent();
  await p.screenshot({ path: `docs/stage-23/floor-${i + 1}.png`, clip: box });
  shots.push({ ...pick, plan, material, current, file: `floor-${i + 1}.png` });
}
const history1 = await p.evaluate(() => window.__stores.project.getState().history.past.length);

// Ночь с включённым светом (этапы 20–21): покрытие под искусственным светом.
await p.getByRole('button', { name: 'Ночь', exact: true }).click();
await p.evaluate((r) => {
  const ui = window.__stores.ui.getState();
  if (!ui.lights.rooms[r]) ui.toggleRoomLight(r);
  if (!ui.lights.lamps.flamp) window.__stores.ui.getState().toggleLamp('flamp');
}, room);
await p.waitForTimeout(2500);
await p.screenshot({ path: 'docs/stage-23/night-lit.png', clip: box });
await p.getByRole('button', { name: 'День', exact: true }).click();

// Отмена — один шаг на выбор; после отмены всех шагов пол без покрытия и на плане, и в 3D.
await p.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__stores.project.getState().undo();
}, history1 - history0);
await p.waitForTimeout(400);
const afterUndo = {
  floorFinish: await p.evaluate((r) => window.__stores.project.getState().history.present.finishes.floors[r] ?? null, room),
  planFinish: await p.getByTestId(`plan-floor-finish-${room}`).count(),
  material: await floorMaterial(),
};

// Перебор всех покрытий: текстуры освобождаются, программ не прибавляется (D-08).
const mem = () => p.evaluate(() => ({ ...window.__gl.info.memory, programs: window.__gl.info.programs.length }));
await p.getByTestId(`swatch-${swatchIds[0]}`).click();
await textureReady();
await p.waitForTimeout(500);
const memBefore = await mem();
for (const id of [...swatchIds, swatchIds[0]]) {
  await p.getByTestId(`swatch-${id}`).click();
  await textureReady();
  await p.waitForTimeout(150);
}
await p.waitForTimeout(500);
const memAfter = await mem();

const perf = await p.evaluate(async () => {
  const times = [];
  let last = performance.now();
  for (let i = 0; i < 240; i++) {
    await new Promise((res) => requestAnimationFrame(res));
    const now = performance.now();
    times.push(now - last);
    last = now;
  }
  times.sort((a, b) => a - b);
  return { fps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1), p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1) };
});

// Покрытие задаётся на комнату: в другой комнате пол без покрытия.
const otherRoom = await p.evaluate((r) => {
  const ap = window.__stores.project.getState().history.present;
  const other = Object.keys(ap.rooms).find((id) => id !== r);
  return { other, finish: ap.finishes.floors[other] ?? null };
}, room);

const result = {
  channel,
  panelTitle,
  groups,
  swatchCount: swatchIds.length,
  shots,
  historySteps: history1 - history0,
  afterUndo,
  memBefore,
  memAfter,
  perf,
  otherRoom,
  errors,
};
writeFileSync(`docs/stage-23/measure-${channel}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
await b.close();
