// Этап 16: эталонная комната интерактивного вида (качественный снимок отложен, D-09; замеры — docs/stage-16/REPORT.md).
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage16.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
await p.getByRole('button', { name: 'Подобрать схемы' }).click();
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForFunction(() => '__view' in window);
// Эталонная комната: ткань (диван, кресло, ковёр), дерево (столы, тумба), металл (торшер, люстра, мойка), стекло, керамика, отделка.
const gpu = await p.evaluate(() => {
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
    finishes: { ...ap.finishes, walls: { [`${walls[1]}|${room}`]: 'wallpaper-poly_wool_herringbone', [`${walls[2]}|${room}`]: 'paint-sage', [`${walls[3]}|${room}`]: 'paint-warm' } },
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
  const gl = w.__gl.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
await p.waitForTimeout(3000);
const box = await p.getByTestId('scene').boundingBox();
await p.screenshot({ path: 'docs/stage-16/reference.png', clip: box });
writeFileSync('docs/stage-16/reference.json', JSON.stringify({ gpu }, null, 2));
console.log('saved docs/stage-16/reference.png');
await b.close();
