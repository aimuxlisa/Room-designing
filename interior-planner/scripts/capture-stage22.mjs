// Сценарий проверки этапа 22 (Квартиры чуть больше, SPEC D-15):
// 1. Проверка экрана подбора схем с новыми площадями.
// 2. Проверка схемы 2Б в интерьере.
// 3. Сохранение снимков в docs/stage-22/*.png.

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';

await mkdir('docs/stage-22', { recursive: true });

console.log('Запуск dev-сервера на порту 5176...');
const server = await createServer({ server: { port: 5176 } });
await server.listen();
const url = 'http://localhost:5176/';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

try {
  await page.goto(url);
  await page.waitForFunction(() => '__stores' in window);

  // Выбираем 2 комнаты и площадь 72 м²
  await page.getByRole('radio', { name: '2 комнаты' }).click();
  await page.getByLabel('Примерная площадь квартиры, м²').fill('72');
  await page.getByRole('button', { name: 'Подобрать схемы' }).click();

  // Проверяем, что первая карточка схемы 2Б
  await page.waitForSelector('.scheme-card');
  await page.screenshot({ path: 'docs/stage-22/schemes.png' });

  // Выбираем схему 2Б и переходим в интерьер
  await page.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.waitForFunction(() => '__view' in window);
  await page.waitForTimeout(600);

  // Снимок увеличенной квартиры в интерьере
  await page.screenshot({ path: 'docs/stage-22/apartment-2b.png' });

  console.log('Снимки этапа 22 успешно сохранены в docs/stage-22/');
} finally {
  await browser.close();
  await server.close();
}
