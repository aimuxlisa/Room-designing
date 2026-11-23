// Превью предметов каталога (этап 13.5): public/previews/<id>.jpg, 160 × 120. Нужен запущенный `npm run dev`.
// Запуск: node scripts/capture-previews.mjs [<id> ...] — без аргументов снимаются все предметы каталога.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

mkdirSync('public/previews', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 160, height: 120 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => '__catalogIds' in window);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : await p.evaluate(() => window.__catalogIds);
for (const id of ids) {
  await p.goto(`http://localhost:5173/?preview=${id}`);
  await p.waitForFunction(() => window.__previewReady === true, null, { timeout: 30_000 });
  await p.screenshot({ path: `public/previews/${id}.jpg`, type: 'jpeg', quality: 85 });
  console.log(id);
}
await b.close();
