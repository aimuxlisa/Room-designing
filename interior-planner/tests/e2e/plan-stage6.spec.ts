import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

async function loadTwoRooms(page: Page) {
  await openTech(page, 'createTechTwoRooms', 'b');
}

const planAttr = async (page: Page) => {
  const plan = page.getByTestId('plan');
  const [s, ox, oy] = await Promise.all(['data-scale', 'data-offset-x', 'data-offset-y'].map((a) => plan.getAttribute(a)));
  return { s: Number(s), ox: Number(ox), oy: Number(oy), box: (await plan.boundingBox())! };
};

test.beforeEach(async ({ page }) => {
  await openTech(page);
});

test('6.1: вся квартира — обе комнаты, общая дверь, входная дверь; размер коридора по пикселям', async ({ page }) => {
  await loadTwoRooms(page);
  await page.getByRole('button', { name: 'Вся квартира' }).click();
  await expect(page.getByTestId('plan-room-a')).toBeVisible();
  await expect(page.getByTestId('plan-room-b')).toBeVisible();
  await expect(page.getByTestId('plan-opening-d1')).toBeVisible();
  await expect(page.getByTestId('plan-opening-entry')).toBeVisible();
  await expect(page.getByTestId('plan-caption-a')).toContainText('400 см × 300 см');
  const { s } = await planAttr(page);
  const width = Number(await page.getByTestId('plan-floor').getAttribute('width'));
  expect(width / s).toBeCloseTo(200, 6); // коридор Б — активная комната
});

test('6.1: вид комнаты — размеры снаружи, подпись проёма: чистый отступ и ширина', async ({ page }) => {
  await loadTwoRooms(page);
  await expect(page.getByTestId('plan-dim-width')).toHaveText('200 см');
  await expect(page.getByTestId('plan-dim-depth')).toHaveText('300 см');
  // Общая дверь d1: отступ по оси 100 см, угол коридора в 15 см от начала стены → чистый 85 см.
  await expect(page.getByTestId('plan-opening-label-d1-b')).toHaveText('85 см · 80 см');
});

test('6.1: нажатие на другую комнату в виде квартиры делает её активной', async ({ page }) => {
  await loadTwoRooms(page);
  await page.getByRole('button', { name: 'Вся квартира' }).click();
  await page.getByTestId('plan-room-a').click({ position: { x: 20, y: 20 } });
  await page.getByRole('button', { name: 'Комната', exact: true }).click();
  await expect(page.getByTestId('plan-dim-width')).toHaveText('400 см');
});

test('6.2: после масштаба колесом и сдвига средней кнопкой стол ставится в (210, 175) см', async ({ page }) => {
  const p0 = await planAttr(page);
  await page.mouse.move(p0.box.x + 200, p0.box.y + 250);
  await page.mouse.wheel(0, -400);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(p0.box.x + 260, p0.box.y + 220, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  const p1 = await planAttr(page);
  expect(p1.s).not.toBeCloseTo(p0.s, 3);
  await expect(page.getByRole('button', { name: 'Вписать' })).toBeEnabled();

  const target = { x: p1.box.x + 210 * p1.s + p1.ox, y: p1.box.y + 175 * p1.s + p1.oy };
  const btn = (await page.getByTestId('catalog-modern_arm_chair_01').boundingBox())!;
  await page.mouse.move(btn.x + 20, btn.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x - 20, target.y, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  const pos = await page.evaluate(() => {
    const s = (window as unknown as { __stores: { project: { getState(): { history: { present: { furniture: Record<string, { position: { xCm: number; zCm: number } }> } } } } } }).__stores;
    return Object.values(s.project.getState().history.present.furniture)[0].position;
  });
  expect(pos).toEqual({ xCm: 210, yCm: 0, zCm: 175 });

  await page.getByRole('button', { name: 'Вписать' }).click();
  expect((await planAttr(page)).s).toBeCloseTo(p0.s, 6);
});
