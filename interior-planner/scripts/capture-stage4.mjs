// Кадры и замеры технической сцены (задача 4.5). Нужен запущенный `npm run dev`.
// Запуск: node scripts/capture-stage4.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'docs/stage-4';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const t0 = Date.now();
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => '__stores' in window);
await page.evaluate(() => { const w = window; w.__stores.project.getState().load(w.__tech.createTechApartment()); w.__stores.ui.getState().setTemplateId('tech'); w.__stores.ui.getState().setActiveRoom('tech-room'); w.__stores.ui.getState().setStage('interior'); });
await page.waitForFunction(() => '__camera' in window && window.__scene.getObjectByName('floor'));
const sceneReadyMs = Date.now() - t0;

const gpu = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});

// Расстановка: диван у стены, кресло, стол.
const t1 = Date.now();
await page.evaluate(() => {
  const d = window.__stores.drag.getState();
  const put = (id, x, z, a = 0) => {
    d.startFromCatalog(id);
    d.pointAt({ x, z }, false);
    if (a) d.rotate(a);
    d.finish();
  };
  put('sofa_03', 225, 70);
  put('modern_arm_chair_01', 80, 230, 90);
  put('modern_coffee_table_01', 225, 200, 90);
});
await page.waitForFunction(() => {
  let n = 0;
  window.__scene.traverse((o) => o.name.startsWith('item-') && n++);
  return n === 3;
});
const firstModelsMs = Date.now() - t1;

async function measure(seconds = 5) {
  return page.evaluate(
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
            const sorted = [...times].sort((a, b) => a - b);
            resolve({
              fps: Math.round((times.length / sec) * 10) / 10,
              p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}

// Непрерывная перерисовка для замера: медленное вращение камеры.
await page.evaluate(() => {
  const cam = window.__camera;
  const r = Math.hypot(cam.position.x - 2.25, cam.position.z - 1.9);
  let a = Math.atan2(cam.position.z - 1.9, cam.position.x - 2.25);
  const spin = () => {
    a += 0.003;
    cam.position.x = 2.25 + r * Math.cos(a);
    cam.position.z = 1.9 + r * Math.sin(a);
    cam.lookAt(2.25, 0.8, 1.9);
    window.__spin = requestAnimationFrame(spin);
  };
  spin();
});
const perf = await measure(5);
await page.evaluate(() => cancelAnimationFrame(window.__spin));

const views = [
  ['01-overview', [6.0, 4.2, 6.6]],
  ['02-corner', [0.6, 1.6, 3.4]],
  ['03-top', [2.25, 6.5, 2.0]],
];
for (const [name, pos] of views) {
  await page.evaluate((p) => {
    window.__camera.position.set(...p);
    window.__camera.lookAt(2.25, 0.6, 1.9);
  }, pos);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

const result = {
  date: new Date().toISOString(),
  viewport: '1920x1080',
  browser: 'Chrome (system)',
  gpu,
  sceneReadyMs,
  firstModelsMs,
  ...perf,
  note: 'Техническая сцена: одна комната, 3 модели Poly Haven 1k, тени от одного источника.',
};
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
