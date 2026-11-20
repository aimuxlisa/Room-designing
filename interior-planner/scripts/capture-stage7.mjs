// Кадры стартового сценария (этап 7). Нужен запущенный `npm run dev`.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5173/');
await p.getByRole('radio', { name: '2 комнаты' }).click();
await p.getByLabel('Примерная площадь квартиры, м²').fill('70');
await p.screenshot({ path: 'docs/stage-7/01-params.png' });
await p.getByRole('button', { name: 'Подобрать схемы' }).click();
await p.screenshot({ path: 'docs/stage-7/02-schemes.png', fullPage: true });
await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
await p.screenshot({ path: 'docs/stage-7/03-setup.png' });
await p.getByRole('button', { name: 'К интерьеру →' }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: 'docs/stage-7/04-interior.png' });
await b.close();
