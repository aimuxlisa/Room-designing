// Этап 24: прогулка по квартире — вход и выход, движение клавишами по времени кадра, обзор мышью,
// столкновения со стенами и мебелью, проход через двери во все комнаты, снимки из нескольких комнат,
// ближайшие источники света, замер D-08 и неизменность проекта (24.1–24.6).
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage24.mjs [chrome|msedge]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const channel = process.argv[2] ?? 'chrome';
mkdirSync('docs/stage-24', { recursive: true });
const b = await chromium.launch({ channel, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
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

// Расстановка: в кухне-гостиной диван, стол, торшер; в спальне кровать; покрытия пола и отделка стены.
const setup = await p.evaluate(() => {
  const w = window;
  const ap = w.__stores.project.getState().history.present;
  const rect = (id) => {
    const vs = ap.rooms[id].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((v) => ap.vertices[v]);
    return { cx: (Math.min(...vs.map((v) => v.xCm)) + Math.max(...vs.map((v) => v.xCm))) / 2, cz: (Math.min(...vs.map((v) => v.zCm)) + Math.max(...vs.map((v) => v.zCm))) / 2 };
  };
  const rooms = Object.values(ap.rooms);
  const living = rooms.find((r) => r.name.startsWith('Кухня')) ?? rooms[0];
  const bed = rooms.find((r) => r.name === 'Спальня') ?? rooms.find((r) => r.id !== living.id);
  const L = rect(living.id), B = rect(bed.id);
  const put = (id, item, room, x, z, angleDeg = 0) => ({ [id]: { id, catalogItemId: item, assetVersion: 1, roomId: room, position: { xCm: x, yCm: 0, zCm: z }, angleDeg, variantId: null } });
  const wall = living.boundary[0].wallId;
  w.__stores.project.getState().load({
    ...ap,
    furniture: {
      ...put('sofa', 'sofa_02', living.id, L.cx, L.cz + 110, 180),
      ...put('table', 'modern_coffee_table_01', living.id, L.cx, L.cz, 90),
      ...put('flamp', 'floor_lamp', living.id, L.cx + 150, L.cz + 120),
      ...put('bed', 'GothicBed_01', bed.id, B.cx, B.cz),
    },
    finishes: {
      walls: { [`${wall}|${living.id}`]: 'paint-sage' },
      floors: { [living.id]: 'floor-herringbone_parquet', [bed.id]: 'floor-curly_teddy_natural' },
    },
  });
  w.__stores.ui.getState().setActiveRoom(living.id);
  return { living: living.id, bed: bed.id, rooms: rooms.map((r) => ({ id: r.id, name: r.name })), tableAt: { x: L.cx, z: L.cz } };
});
await p.waitForFunction((r) => window.__view === r, setup.living);
await p.waitForTimeout(1500);
const projectBefore = await p.evaluate(() => JSON.stringify(window.__stores.project.getState().history.present));
const historyBefore = await p.evaluate(() => window.__stores.project.getState().history.past.length);

// 24.1: вход.
await p.getByTestId('walk-enter').click();
await p.waitForFunction(() => window.__walk?.room);
await p.waitForTimeout(2500);
const box = await p.getByTestId('walk-scene').boundingBox();
const walk = () => p.evaluate(() => ({ ...window.__walk }));
const shot = async (name) => {
  await p.waitForTimeout(500);
  await p.screenshot({ path: `docs/stage-24/${name}.png` });
};
const start = await walk();
const eye = await p.evaluate(() => +(window.__camera.position.y * 100).toFixed(1));
await shot('walk-start');

/** Держать клавишу ms миллисекунд. */
const hold = async (key, ms) => {
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  await p.keyboard.up(key);
  await p.waitForTimeout(50);
};
/** Повернуть взгляд на yaw (рад) перетаскиванием мышью. */
const turnTo = async (yaw) => {
  const cur = (await walk()).yaw;
  const dx = Math.round(-(yaw - cur) / 0.0025);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 40));
  for (let i = 1; i <= steps; i++) await p.mouse.move(cx + (dx * i) / steps, cy);
  await p.mouse.up();
  // Указатель мог быть захвачен — отпускаем, чтобы Esc и кнопки работали предсказуемо.
  await p.evaluate(() => document.exitPointerLock());
  await p.waitForTimeout(100);
};

// 24.1: шаг по времени кадра — 1 с клавиши W ≈ 140 см.
const a = await walk();
await hold('KeyW', 1000);
const b1 = await walk();
const stepCm = Math.hypot(b1.x - a.x, b1.z - a.z);
// Стрелка назад возвращает.
await hold('ArrowDown', 1000);
const b2 = await walk();
// Обзор мышью меняет yaw.
await turnTo(a.yaw + Math.PI / 2);
const turned = await walk();

// 24.3: стена — идём долго в одну сторону, игрок останавливается внутри квартиры.
const wallRun = [];
for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  await turnTo(yaw);
  await hold('KeyW', 4000);
  const s = await walk();
  wallRun.push({ yaw: +yaw.toFixed(2), x: Math.round(s.x), z: Math.round(s.z), room: s.room });
}

// 24.3: мебель — телепорт перед столом и шаг на него: игрок не заходит в контур стола.
// Модель движения из domain (модули из dev-сервера): шаг 300 см от точки в 100 см севернее стола на стол.
const furnitureBlock = await p.evaluate(async (t) => {
  const walkMod = await import('/src/domain/walk.ts');
  const { getCatalogItem } = await import('/src/catalog/catalog.ts');
  const ap = window.__stores.project.getState().history.present;
  const obstacles = walkMod.walkObstacles(ap, getCatalogItem);
  const from = { x: t.x, z: t.z - 100 };
  const to = walkMod.walkStep(from, { x: 0, z: 300 }, obstacles);
  return {
    obstacleIds: [...new Set(obstacles.map((o) => o.id.split('-').slice(0, 2).join('-')))].filter((id) => id.startsWith('furniture')),
    from,
    to,
    stoppedBy: walkMod.obstacleAt({ x: to.x, z: to.z + 10 }, obstacles)?.id ?? null,
    rugPassable: !obstacles.some((o) => o.id.startsWith('furniture-rug')),
  };
}, setup.tableAt);

// Проход через двери: маршрут по точкам пути из domain (поиск по сетке) — проверяем, что игрок дошёл в каждую комнату.
const visited = new Set([start.room]);
const routes = await p.evaluate(() => {
  const ap = window.__stores.project.getState().history.present;
  const doors = Object.values(ap.openings).filter((o) => o.kind === 'door');
  return doors.map((d) => {
    const w = ap.walls[d.wallId];
    const [s, e] = [ap.vertices[w.startId], ap.vertices[w.endId]];
    const len = Math.hypot(e.xCm - s.xCm, e.zCm - s.zCm);
    const t = d.offsetCm + d.widthCm / 2;
    const dir = { x: (e.xCm - s.xCm) / len, z: (e.zCm - s.zCm) / len };
    return { id: d.id, x: s.xCm + dir.x * t, z: s.zCm + dir.z * t, vertical: Math.abs(dir.z) > Math.abs(dir.x) };
  });
});
/** Дойти до точки: повернуться к ней и идти, пока не приблизимся (или не упрёмся). */
const goTo = async (x, z, maxMs = 6000) => {
  const s = await walk();
  const yaw = Math.atan2(-(x - s.x), -(z - s.z));
  await turnTo(yaw);
  const dist = Math.hypot(x - s.x, z - s.z);
  await hold('KeyW', Math.min(maxMs, (dist / 140) * 1000));
  return walk();
};
const doorTrips = [];
const shots = ['walk-start.png'];
for (const d of routes) {
  // Войти в дверь по нормали: точка перед проёмом и за ним (60 см от оси стены).
  const n = d.vertical ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const before = await walk();
  const side = Math.sign((before.x - d.x) * n.x + (before.z - d.z) * n.z) || 1;
  const near = { x: d.x + n.x * side * 60, z: d.z + n.z * side * 60 };
  const far = { x: d.x - n.x * side * 70, z: d.z - n.z * side * 70 };
  await goTo(near.x, near.z);
  await goTo(far.x, far.z);
  const after = await walk();
  if (after.room) visited.add(after.room);
  doorTrips.push({ door: d.id, from: before.room, to: after.room, at: { x: Math.round(after.x), z: Math.round(after.z) } });
  if (after.room && !shots.includes(`walk-${after.room}.png`)) {
    await hold('KeyW', 600);
    await shot(`walk-${after.room}`);
    shots.push(`walk-${after.room}.png`);
  }
}

// Повторный вход кнопкой: игрок снова в комнате, из которой вошли; смотрим вдоль комнаты на диван.
await p.getByTestId('walk-exit').click();
await p.waitForFunction(() => !window.__stores.ui.getState().walking);
await p.getByTestId('walk-enter').click();
await p.waitForFunction(() => window.__walk?.room);
const reenter = await walk();
await turnTo(Math.PI);
await hold('KeyS', 900);
await shot('walk-day');
// Сумерки (мир за окнами всех комнат, 24.4).
await p.getByRole('button', { name: 'Вечер', exact: true }).click();
await shot('walk-evening');

// 24.4: ночь, свет во всех комнатах и торшер — в сцене не больше 4 источников, выбранных по близости.
await p.getByRole('button', { name: 'Ночь', exact: true }).click();
await p.evaluate((rooms) => {
  const ui = window.__stores.ui.getState();
  for (const r of rooms) if (!window.__stores.ui.getState().lights.rooms[r.id]) ui.toggleRoomLight(r.id);
  if (!window.__stores.ui.getState().lights.lamps.flamp) ui.toggleLamp('flamp');
}, setup.rooms);
await p.waitForTimeout(1500);
const lightsNow = () =>
  p.evaluate(() => {
    const pool = window.__scene.getObjectByName('light-pool');
    return pool.children.filter((l) => l.intensity > 0).map((l) => l.name);
  });
const lightsHere = await lightsNow();
await shot('walk-night');

const mem0 = await p.evaluate(() => ({ ...window.__gl.info.memory, programs: window.__gl.info.programs.length }));
// Замер: стоим и идём по кругу (W + поворот), 240 кадров каждый.
const frames = () =>
  p.evaluate(async () => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 240; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    times.sort((x, y) => x - y);
    return { fps: +(1000 / (times.reduce((s, t) => s + t, 0) / times.length)).toFixed(1), p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1) };
  });
const idle = await frames();
await p.keyboard.down('KeyW');
await p.keyboard.down('KeyD');
const moving = await frames();
await p.keyboard.up('KeyW');
await p.keyboard.up('KeyD');
await p.getByRole('button', { name: 'День', exact: true }).click();
await p.waitForTimeout(800);
const day = await frames();
const mem1 = await p.evaluate(() => ({ ...window.__gl.info.memory, programs: window.__gl.info.programs.length }));

// 24.5: выход Esc — тот же редактор и та же комната, проект не изменился.
await p.evaluate(() => document.exitPointerLock());
await p.keyboard.press('Escape');
await p.waitForFunction(() => !window.__stores.ui.getState().walking);
await p.waitForFunction(() => '__controls' in window);
const exit = await p.evaluate(
  ([before, hist]) => ({
    activeRoom: window.__stores.ui.getState().activeRoomId,
    projectUnchanged: JSON.stringify(window.__stores.project.getState().history.present) === before,
    historyUnchanged: window.__stores.project.getState().history.past.length === hist,
    editorScene: !!document.querySelector('[data-testid="scene"]'),
  }),
  [projectBefore, historyBefore],
);
const exitButton = reenter.room === setup.living;
await p.waitForTimeout(500);
await p.screenshot({ path: 'docs/stage-24/editor-after-exit.png' });

const result = {
  channel,
  rooms: setup.rooms,
  start,
  eyeCm: eye,
  step1sCm: Math.round(stepCm),
  backAfterArrowDownCm: Math.round(Math.hypot(b2.x - a.x, b2.z - a.z)),
  yawTurned: +(turned.yaw - a.yaw).toFixed(2),
  wallRun,
  furnitureBlock,
  doorTrips,
  visitedRooms: [...visited],
  allRoomsVisited: setup.rooms.every((r) => visited.has(r.id)),
  lightsHere,
  perf: { idle, moving, day },
  memBefore: mem0,
  memAfter: mem1,
  exit: { ...exit, startedIn: setup.living },
  reenterRoom: reenter.room,
  exitButton,
  shots,
  errors,
};
writeFileSync(`docs/stage-24/measure-${channel}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
await b.close();
