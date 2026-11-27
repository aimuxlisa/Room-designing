// Этап 25: тёмная тема на всех экранах — снимки до/после при 1280×720 и 1920×1080, контраст текста (AA),
// отсутствие горизонтальной прокрутки, видимый фокус при обходе клавишей Tab.
// Нужен запущенный `npm run dev`. Запуск: node scripts/capture-stage25.mjs <before|after> [chrome|msedge]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const label = process.argv[2] ?? 'after';
const channel = process.argv[3] ?? 'chrome';
const dir = `docs/stage-25/${label}`;
mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });

/** Контраст текста к фактическому фону (полупрозрачные фоны смешиваются с нижележащими). Только видимые узлы с текстом. */
const auditContrast = (page) =>
  page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const lum = ([r, g, b]) => {
      const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const blend = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let acc = parse(getComputedStyle(document.body).backgroundColor);
      for (const l of layers.reverse()) acc = blend(l, acc);
      return acc;
    };
    const bad = [];
    let checked = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg, canvas')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || +st.opacity === 0) continue;
      // Отключённые элементы по WCAG не обязаны иметь контраст AA.
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      const fg = blend(parse(st.color), bgOf(el));
      const bg = bgOf(el);
      const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const size = parseFloat(st.fontSize);
      const large = size >= 24 || (size >= 18.66 && +st.fontWeight >= 700);
      checked++;
      if (ratio < (large ? 3 : 4.5)) bad.push({ text: el.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), cls: el.className?.toString?.() ?? '' });
    }
    return { checked, bad: bad.slice(0, 30), badCount: bad.length };
  });

const layout = (page) =>
  page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > innerWidth + 1,
    vScrollPage: document.documentElement.scrollHeight > innerHeight + 1,
  }));

/** Tab по экрану: доля сфокусированных элементов с видимым кольцом фокуса (outline или box-shadow). */
const tabAudit = async (page, n = 25) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  const seen = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    seen.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const st = getComputedStyle(el);
        const ring = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || st.boxShadow !== 'none';
        return { tag: el.tagName, name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), ring };
      }),
    );
  }
  const items = seen.filter(Boolean);
  return { focused: items.length, withRing: items.filter((x) => x.ring).length, without: items.filter((x) => !x.ring).map((x) => `${x.tag} ${x.name}`).slice(0, 10) };
};

const result = { label, channel, sizes: {} };
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const size = `${w}x${h}`;
  const screens = {};
  const snap = async (name, opts = {}) => {
    await p.waitForTimeout(opts.wait ?? 400);
    await p.screenshot({ path: `${dir}/${size}-${name}.png` });
    screens[name] = { ...(await layout(p)), contrast: await auditContrast(p), ...(opts.tab ? { tab: await tabAudit(p) } : {}) };
  };
  await p.goto('http://localhost:5173/');
  await p.getByRole('radio', { name: '2 комнаты' }).click();
  await p.getByLabel('Примерная площадь квартиры, м²').fill('55');
  await snap('1-params', { tab: true });
  await p.getByRole('button', { name: 'Подобрать схемы' }).click();
  await snap('2-schemes', { tab: true });
  await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  // Настройка: выбрана стена, открыта её панель.
  await p.waitForTimeout(500);
  const wall = p.locator('.plan-wall.editable').first();
  if (await wall.count()) await wall.click({ force: true });
  await snap('3-setup', { tab: true });
  await p.getByRole('button', { name: 'К интерьеру →' }).click();
  await p.waitForFunction(() => '__view' in window);
  // Интерьер: мебель, выбранный торшер, вечер.
  await p.evaluate(() => {
    const w = window;
    const ap = w.__stores.project.getState().history.present;
    const room = w.__stores.ui.getState().activeRoomId;
    const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((v) => ap.vertices[v]);
    const cx = (Math.min(...vs.map((v) => v.xCm)) + Math.max(...vs.map((v) => v.xCm))) / 2;
    const cz = (Math.min(...vs.map((v) => v.zCm)) + Math.max(...vs.map((v) => v.zCm))) / 2;
    const put = (id, item, x, z, a = 0) => ({ [id]: { id, catalogItemId: item, assetVersion: 1, roomId: room, position: { xCm: x, yCm: 0, zCm: z }, angleDeg: a, variantId: null } });
    w.__stores.project.getState().load({
      ...ap,
      furniture: { ...put('sofa', 'sofa_02', cx, cz + 110, 180), ...put('table', 'modern_coffee_table_01', cx, cz, 90), ...put('flamp', 'floor_lamp', cx + 150, cz + 120) },
      finishes: { ...ap.finishes, floors: { [room]: 'floor-herringbone_parquet' } },
    });
    w.__stores.ui.getState().select('flamp');
  });
  await snap('4-interior', { wait: 2500, tab: true });
  // Отделка: выбран пол.
  await p.evaluate(() => window.__stores.ui.getState().selectFloor(window.__stores.ui.getState().activeRoomId));
  await snap('5-finish', { wait: 1200 });
  await p.getByRole('button', { name: 'Вечер', exact: true }).click();
  await p.evaluate(() => window.__stores.ui.getState().selectFloor(null));
  await p.getByRole('button', { name: 'Вся квартира' }).click().catch(() => {});
  await snap('6-evening-apartment', { wait: 1500 });
  await p.getByTestId('walk-enter').click();
  await p.waitForFunction(() => window.__walk?.room);
  await snap('7-walk', { wait: 2000 });
  await p.getByTestId('walk-exit').click();
  result.sizes[size] = { screens, errors };
  await p.close();
}
writeFileSync(`${dir}/audit-${channel}.json`, JSON.stringify(result, null, 2));
const short = Object.fromEntries(
  Object.entries(result.sizes).map(([s, v]) => [
    s,
    Object.fromEntries(Object.entries(v.screens).map(([k, x]) => [k, { h: x.hScroll, bad: x.contrast.badCount, of: x.contrast.checked, tab: x.tab ? `${x.tab.withRing}/${x.tab.focused}` : undefined }])),
  ]),
);
console.log(JSON.stringify(short, null, 1));
await b.close();
