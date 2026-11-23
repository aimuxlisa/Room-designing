// Кадры отделки стен (этап 12): краска на плане и в 3D; шесть тканей Poly Haven при текущем свете.
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

/** Отделка трёх видимых стен активной комнаты (кроме первой, скрытой за камерой); выбрана средняя. */
const finish = (ids) =>
  p.evaluate((ids) => {
    const w = window;
    const ap = w.__stores.project.getState().history.present;
    const room = w.__stores.ui.getState().activeRoomId;
    const walls = ap.rooms[room].boundary.map((e) => e.wallId);
    const map = Object.fromEntries(ids.map((id, i) => [`${walls[i + 1]}|${room}`, id]));
    w.__stores.project.getState().load({ ...ap, finishes: { ...ap.finishes, walls: map } });
    w.__stores.ui.getState().selectSurface({ wallId: walls[2], roomId: room });
  }, ids);

await finish(['paint-sage', 'wallpaper-fabric_pattern_05', 'paint-terracotta']);
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/stage-12/finishes.png' });

const scene = await p.getByTestId('scene').boundingBox();
for (const [name, ids] of [
  ['fabrics-1', ['wallpaper-terlenka', 'wallpaper-poly_wool_herringbone', 'wallpaper-gingham_check']],
  ['fabrics-2', ['wallpaper-fabric_pattern_05', 'wallpaper-waffle_pique_cotton', 'wallpaper-quatrefoil_jacquard_fabric']],
]) {
  await finish(ids);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/stage-12/${name}.png`, clip: scene });
}
await b.close();
console.log('saved docs/stage-12/finishes.png, fabrics-1.png, fabrics-2.png');
