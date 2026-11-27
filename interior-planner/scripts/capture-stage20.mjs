// Этап 20: время суток и мир за окнами — снимки одной камеры в четыре момента суток (20.3, 20.4, 20.5).
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage20.mjs [chrome|msedge]
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const channel = process.argv[2] ?? 'chrome';
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
// Та же эталонная комната, что на этапе 16, без светильников.
await p.evaluate(() => {
  const w = window;
  const ap = w.__stores.project.getState().history.present;
  const room = w.__stores.ui.getState().activeRoomId;
  const walls = ap.rooms[room].boundary.map((e) => e.wallId);
  const vs = walls.flatMap((id) => [ap.walls[id].startId, ap.walls[id].endId]).map((id) => ap.vertices[id]);
  const [x0, x1] = [Math.min(...vs.map((v) => v.xCm)), Math.max(...vs.map((v) => v.xCm))];
  const [z0, z1] = [Math.min(...vs.map((v) => v.zCm)), Math.max(...vs.map((v) => v.zCm))];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const put = (id, item, x, z, angleDeg = 0) => ({ [id]: { id, catalogItemId: item, assetVersion: 1, roomId: room, position: { xCm: x, yCm: 0, zCm: z }, angleDeg, variantId: null } });
  w.__stores.project.getState().load({
    ...ap,
    furniture: { ...put('rug', 'rug', cx, cz), ...put('sofa', 'sofa_02', cx, cz + 110, 180), ...put('table', 'modern_coffee_table_01', cx, cz, 90), ...put('arm', 'ArmChair_01', cx - 150, cz, 90) },
  });
});
await p.waitForTimeout(2500);
const box = await p.getByTestId('scene').boundingBox();
const shots = [
  ['morning', 'Утро'],
  ['day', 'День'],
  ['evening', 'Вечер'],
  ['night', 'Ночь'],
];
const history0 = await p.evaluate(() => window.__stores.project.getState().history.past.length);
// Кадр 1: обзорная камера комнаты; кадр 2: взгляд из комнаты на окно.
for (const view of ['overview', 'window']) {
  if (view === 'window') {
    const ok = await p.evaluate(() => {
      const w = window;
      // Стекло окна активной комнаты: имя window-<id> без суффиксов рамы и маски.
      const win = [];
      w.__scene.traverse((o) => o.name.startsWith('window-') && !o.name.startsWith('window-frame-') && !o.name.endsWith('-mask') && win.push(o));
      if (!win.length) return false;
      const t = win[0].getWorldPosition(new w.__camera.position.constructor());
      const c = w.__controls.target.clone();
      const dir = c.clone().sub(t).setY(0).normalize();
      w.__camera.position.set(c.x + dir.x * 1.2, 1.4, c.z + dir.z * 1.2);
      w.__controls.target.set(t.x, 1.3, t.z);
      w.__controls.update();
      return true;
    });
    if (!ok) continue;
  }
  for (const [file, label] of shots) {
    await p.getByRole('button', { name: label, exact: true }).click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: `docs/stage-20/${view}-${file}.png`, clip: box });
  }
}
// 20.6: смена часа без утечек и частота кадров во время непрерывной смены часа (как при движении ползунка).
const perf = await p.evaluate(async () => {
  const w = window;
  const mem = () => ({ ...w.__gl.info.memory, programs: w.__gl.info.programs.length });
  const frames = async (step) => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 240; i++) {
      step(i);
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    times.sort((a, b) => a - b);
    return { fps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1), p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1) };
  };
  const before = mem();
  const idle = await frames(() => {});
  const slider = await frames((i) => w.__stores.ui.getState().setHour((i * 0.1) % 24));
  return { before, after: mem(), idle, slider };
});
const history1 = await p.evaluate(() => window.__stores.project.getState().history.past.length);
const result = { channel, historyUnchanged: history0 === history1, perf, errors };
writeFileSync(`docs/stage-20/measure-${channel}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await b.close();
