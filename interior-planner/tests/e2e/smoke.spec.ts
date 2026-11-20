import { expect, test } from '@playwright/test';
import { openTech } from './helpers';

// Проверяет только окружение: страница и WebGL2-холст. Не проверка функций.
test('страница открывается, холст с WebGL2, без ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openTech(page);
  await expect(page.getByRole('heading', { name: 'Планировщик квартиры' })).toBeVisible();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const webgl2 = await canvas.evaluate((c) => !!(c as HTMLCanvasElement).getContext('webgl2'));
  expect(webgl2).toBe(true);
  expect(errors).toEqual([]);
});
