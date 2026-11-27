// Этап 18.3: замеры на согласованной сцене (одна комната с полной расстановкой) и сравнение с порогами D-08.
// Сборка для замеров: `VITE_PROBE=1 npx vite build --outDir dist-probe`, затем `npx vite preview --outDir dist-probe --port 4180`.
// Запуск: node scripts/measure-stage18.mjs [url] [chrome|msedge]. Пишет docs/stage-18/measure[-msedge].json и печатает сводку.
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { chromium } from '@playwright/test';

const URL = process.argv[2] ?? 'http://localhost:4180/';
const CHANNEL = process.argv[3] ?? 'chrome';
const RUNS = 3;
mkdirSync('docs/stage-18', { recursive: true });
const browser = await chromium.launch({ channel: CHANNEL, args: ['--ignore-gpu-blocklist', '--enable-precise-memory-info'] });

/**
 * Эталонная комната этапа 16 + декор, растения, обеденная зона: 20 предметов. Ставятся тем же переносом с проверкой,
 * что и мышью; если место занято, берётся ближайшее свободное по спирали. Возвращает число предметов и не вставшие.
 */
const FURNISH = () => {
  const w = window;
  const { project, ui, drag } = w.__stores;
  const ap = project.getState().history.present;
  const room = ui.getState().activeRoomId;
  const walls = ap.rooms[room].boundary.map((e) => e.wallId);
  const vs = walls.flatMap((id) => [ap.walls[id].startId, ap.walls[id].endId]).map((id) => ap.vertices[id]);
  const [x0, x1] = [Math.min(...vs.map((v) => v.xCm)), Math.max(...vs.map((v) => v.xCm))];
  const [z0, z1] = [Math.min(...vs.map((v) => v.zCm)), Math.max(...vs.map((v) => v.zCm))];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  project.getState().load({
    ...ap,
    finishes: { walls: { [`${walls[1]}|${room}`]: 'wallpaper-poly_wool_herringbone', [`${walls[2]}|${room}`]: 'paint-sage', [`${walls[3]}|${room}`]: 'paint-warm' }, floors: { [room]: 'floor-herringbone_parquet' } },
    furniture: {},
  });
  const failed = [];
  const put = (item, x, z, turn = 0) => {
    for (let k = 0; k < 40; k++) {
      const r = k === 0 ? 0 : 10 * Math.ceil(k / 8), t = (k * Math.PI) / 4;
      drag.getState().startFromCatalog(item);
      if (turn) drag.getState().rotate(turn);
      drag.getState().pointAt({ x: x + r * Math.cos(t), z: z + r * Math.sin(t) }, false);
      if (drag.getState().finish()?.ok) return;
    }
    failed.push(item);
  };
  put('rug', cx, cz);
  put('sofa_02', cx, cz + 120, 180);
  put('modern_coffee_table_01', cx, cz, 90);
  put('ArmChair_01', cx - 160, cz, 90);
  put('tv_stand', cx, z0 + 45);
  put('floor_lamp', cx + 170, cz + 130);
  put('Chandelier_02', cx, cz);
  put('fridge', x1 - 60, z0 + 50);
  put('kitchen_sink_cabinet', x1 - 150, z0 + 50);
  put('round_wooden_table_02', x1 - 130, cz + 60);
  put('dining_chair_02', x1 - 50, cz + 60, 270);
  put('side_table_01', cx - 160, cz + 90);
  put('wooden_display_shelves_01', x0 + 60, z0 + 80, 90);
  put('potted_plant_01', x0 + 70, z1 - 70);
  put('potted_plant_02', x1 - 70, z1 - 70);
  put('Ottoman_01', cx + 140, cz - 60);
  put('ceramic_vase_02', cx, cz);
  put('book_encyclopedia_set_01', cx - 160, cz + 90);
  put('mantel_clock_01', x1 - 130, cz + 60);
  put('tv_flat', cx, z0 + 45);
  return { n: Object.keys(project.getState().history.present.furniture).length, issues: failed };
};

const gpuName = (p) =>
  p.evaluate(() => {
    const gl = window.__gl.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
const frameStats = (p, sec) =>
  p.evaluate(
    (sec) =>
      new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const end = last + sec * 1000;
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else {
            const s = [...times].sort((a, b) => a - b);
            resolve({ fps: Math.round((times.length / sec) * 10) / 10, p95FrameMs: Math.round(s[Math.floor(s.length * 0.95)] * 10) / 10, maxFrameMs: Math.round(s[s.length - 1] * 10) / 10 });
          }
        };
        requestAnimationFrame(tick);
      }),
    sec,
  );
const mem = (p) =>
  p.evaluate(() => {
    const i = window.__gl.info;
    return { heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, calls: i.render.calls, triangles: i.render.triangles };
  });

/** Один холодный прогон в новом контексте (без кеша): загрузка → схема → интерьер → расстановка. */
async function run() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(URL);
  await p.getByRole('radio', { name: '2 комнаты' }).waitFor();
  const appReadyMs = Date.now() - t0;
  await p.getByRole('radio', { name: '2 комнаты' }).click();
  await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
  await p.getByRole('button', { name: 'Подобрать схемы' }).click();
  await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  const t1 = Date.now();
  await p.getByRole('button', { name: 'К интерьеру →' }).click();
  await p.waitForFunction(() => window.__scene?.getObjectByName(`floor-${window.__stores.ui.getState().activeRoomId}`));
  const interiorReadyMs = Date.now() - t1;
  // Готовность сцены с полной расстановкой: от загрузки проекта до появления всех предметов.
  const t2 = Date.now();
  const { n: count, issues } = await p.evaluate(FURNISH);
  if (issues.length) console.log('не встали:', issues.join(' | '));
  await p.waitForFunction((n) => { let k = 0; window.__scene.traverse((o) => o.name.startsWith('item-') && o.children.length && k++); return k >= n; }, count, { timeout: 30000 });
  const furnishedReadyMs = Date.now() - t2;
  // Появление новой (не загруженной) модели после отпускания.
  const t3 = Date.now();
  await p.evaluate(() => {
    const d = window.__stores.drag.getState();
    d.startFromCatalog('Rockingchair_01');
    d.pointAt({ x: 0, z: 0 }, false);
  });
  const draftPos = await p.evaluate(() => {
    const ap = window.__stores.project.getState().history.present;
    const room = window.__stores.ui.getState().activeRoomId;
    const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
    const xs = vs.map((v) => v.xCm), zs = vs.map((v) => v.zCm);
    // Свободное место в западной части комнаты, между полками и креслом.
    return { x: Math.min(...xs) + 190, z: (Math.min(...zs) + Math.max(...zs)) / 2 - 110 };
  });
  const placed = await p.evaluate(({ x, z }) => {
    const { drag } = window.__stores;
    let r = null;
    for (let k = 0; k < 40 && !r?.ok; k++) {
      const d = k === 0 ? 0 : 10 * Math.ceil(k / 8), t = (k * Math.PI) / 4;
      if (k) drag.getState().startFromCatalog('Rockingchair_01');
      drag.getState().pointAt({ x: x + d * Math.cos(t), z: z + d * Math.sin(t) }, false);
      r = drag.getState().finish();
    }
    return r;
  }, draftPos);
  const t3b = Date.now();
  let modelAppearMs = null;
  if (placed?.ok) {
    await p.waitForFunction(() => { const it = Object.values(window.__stores.project.getState().history.present.furniture).find((f) => f.catalogItemId === 'Rockingchair_01'); const o = it && window.__scene.getObjectByName(`item-${it.id}`); let mesh = false; o?.traverse((c) => c.isMesh && (mesh = true)); return mesh; }, null, { timeout: 15000 });
    modelAppearMs = Date.now() - t3b;
  }
  if (!placed?.ok) console.log('кресло-качалка не поставлено:', placed?.issues?.[0]?.message);
  const modelDropTotalMs = Date.now() - t3;
  await p.waitForTimeout(1000);
  const gpu = await gpuName(p);

  // Кадры: камера вращается вокруг комнаты (непрерывная перерисовка).
  await p.evaluate(() => {
    const k = window.__controls, c = window.__camera;
    const t = k.target.clone();
    const r = Math.hypot(c.position.x - t.x, c.position.z - t.z);
    let a = Math.atan2(c.position.z - t.z, c.position.x - t.x);
    const spin = () => { a += 0.004; c.position.x = t.x + r * Math.cos(a); c.position.z = t.z + r * Math.sin(a); c.lookAt(t); window.__spin = requestAnimationFrame(spin); };
    spin();
  });
  await frameStats(p, 1);
  const frames = await frameStats(p, 6);
  await p.evaluate(() => cancelAnimationFrame(window.__spin));

  // Отзывчивость: перенос предмета — время обработки одного движения (проверка + обновление состояния).
  const dragMs = await p.evaluate(() => {
    const { project, drag } = window.__stores;
    const sofa = Object.values(project.getState().history.present.furniture).find((f) => f.catalogItemId === 'sofa_02');
    drag.getState().startMove(sofa.id, { x: sofa.position.xCm, z: sofa.position.zCm });
    const ts = [];
    for (let i = 0; i < 60; i++) {
      const t = performance.now();
      drag.getState().pointAt({ x: sofa.position.xCm + Math.sin(i / 6) * 40, z: sofa.position.zCm - (i % 20) }, true);
      ts.push(performance.now() - t);
    }
    drag.getState().cancel();
    ts.sort((a, b) => a - b);
    return { median: +ts[30].toFixed(2), p95: +ts[57].toFixed(2), max: +ts[59].toFixed(2) };
  });
  // Перенос с отрисовкой: движения по кадрам, время кадра во время переноса.
  const dragFrames = await p.evaluate(
    () =>
      new Promise((resolve) => {
        const { project, drag } = window.__stores;
        const sofa = Object.values(project.getState().history.present.furniture).find((f) => f.catalogItemId === 'sofa_02');
        drag.getState().startMove(sofa.id, { x: sofa.position.xCm, z: sofa.position.zCm });
        const times = [];
        let last = performance.now(), i = 0;
        const tick = (now) => {
          times.push(now - last);
          last = now;
          drag.getState().pointAt({ x: sofa.position.xCm + Math.sin(i / 10) * 40, z: sofa.position.zCm - (i % 30) }, true);
          if (++i < 180) requestAnimationFrame(tick);
          else {
            drag.getState().cancel();
            const s = times.slice(1).sort((a, b) => a - b);
            resolve({ fps: Math.round((1000 * s.length) / s.reduce((a, b) => a + b, 0) * 10) / 10, p95FrameMs: Math.round(s[Math.floor(s.length * 0.95)] * 10) / 10 });
          }
        };
        requestAnimationFrame(tick);
      }),
  );

  // Память и повторные переходы между комнатами: 20 туда-обратно.
  const memBefore = await mem(p);
  const rooms = await p.evaluate(() => {
    const ap = window.__stores.project.getState().history.present;
    return [window.__stores.ui.getState().activeRoomId, ...Object.keys(ap.rooms).filter((r) => r !== window.__stores.ui.getState().activeRoomId)];
  });
  const switchMs = [];
  for (let i = 0; i < 20; i++) {
    const to = rooms[(i % (rooms.length - 1)) + 1];
    for (const r of [to, rooms[0]]) {
      const t = Date.now();
      await p.evaluate((r) => window.__stores.ui.getState().setActiveRoom(r), r);
      await p.waitForFunction((r) => window.__view === r && window.__scene.getObjectByName(`floor-${r}`), r);
      await p.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
      switchMs.push(Date.now() - t);
    }
  }
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('HeapProfiler.collectGarbage');
  await p.waitForTimeout(500);
  const memAfter = await mem(p);
  await p.screenshot({ path: 'docs/stage-18/measure-scene.png', clip: await p.getByTestId('scene').boundingBox() });
  await ctx.close();
  switchMs.sort((a, b) => a - b);
  return {
    gpu,
    items: count + (placed?.ok ? 1 : 0),
    appReadyMs,
    interiorReadyMs,
    furnishedReadyMs,
    modelAppearMs,
    modelDropTotalMs,
    frames,
    dragHandlerMs: dragMs,
    dragFrames,
    roomSwitch: { median: switchMs[20], p95: switchMs[38], max: switchMs[39] },
    memBefore,
    memAfter,
  };
}

const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(await run());
const browserVersion = browser.version();
await browser.close();

const med = (f) => { const v = runs.map(f).filter((x) => x !== null).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const summary = {
  date: new Date().toISOString().slice(0, 10),
  browser: `${CHANNEL} ${browserVersion}`,
  machine: { cpu: os.cpus()[0].model.trim(), ramGB: Math.round(os.totalmem() / 2 ** 30), gpu: runs[0].gpu, os: `${os.type()} ${os.release()}` },
  conditions: `${CHANNEL} (Playwright), 1920×1080, production-сборка с хуками замеров (VITE_PROBE), холодный кеш на каждый прогон, ${RUNS} прогона, медиана`,
  thresholds: { fps: '≥ 60', p95FrameMs: '≤ 20', sceneReadyS: '≤ 3', modelAppearS: '≤ 2' },
  median: {
    appReadyMs: med((r) => r.appReadyMs),
    interiorReadyMs: med((r) => r.interiorReadyMs),
    furnishedReadyMs: med((r) => r.furnishedReadyMs),
    modelAppearMs: med((r) => r.modelAppearMs),
    fps: med((r) => r.frames.fps),
    p95FrameMs: med((r) => r.frames.p95FrameMs),
    dragFps: med((r) => r.dragFrames.fps),
    dragP95FrameMs: med((r) => r.dragFrames.p95FrameMs),
    dragHandlerP95Ms: med((r) => r.dragHandlerMs.p95),
    roomSwitchMedianMs: med((r) => r.roomSwitch.median),
  },
  runs,
};
writeFileSync(`docs/stage-18/measure${CHANNEL === 'chrome' ? '' : '-' + CHANNEL}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ machine: summary.machine, median: summary.median, mem: runs.map((r) => ({ before: r.memBefore, after: r.memAfter })) }, null, 1));
