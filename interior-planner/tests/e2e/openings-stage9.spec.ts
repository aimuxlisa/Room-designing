import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

/** Состояние проекта: число шагов истории и параметры двери d1 (общая дверь Комнаты А и Коридора Б). */
const doorState = (page: Page) =>
  page.evaluate(() => {
    type O = { offsetCm: number; widthCm: number; hinge: string; opensIntoRoomId: string | null };
    const w = window as unknown as { __stores: { project: { getState(): { history: { past: unknown[]; present: { openings: Record<string, O> } } } } } };
    const h = w.__stores.project.getState().history;
    const d = h.present.openings.d1;
    return { past: h.past.length, offsetCm: d.offsetCm, widthCm: d.widthCm, hinge: d.hinge, opensIntoRoomId: d.opensIntoRoomId };
  });

test.beforeEach(async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'setup');
  await expect(page.getByRole('heading', { name: 'Настройка квартиры' })).toBeVisible();
});

test('9.1, 9.2: дверь выбирается на плане по полотну; ширина меняется; общая дверь одна', async ({ page }) => {
  await page.getByTestId('plan-opening-d1').locator('.plan-opening-hit').click();
  const panel = page.getByTestId('opening-panel');
  await expect(panel).toContainText('Дверь между «Комната А» и «Коридор Б»');
  await expect(page.getByTestId('wall-panel')).toHaveCount(0);
  expect(await doorState(page)).toMatchObject({ past: 0, widthCm: 80, hinge: 'left', opensIntoRoomId: 'a' });

  await page.getByLabel('Ширина, см (60–200)').fill('250');
  await expect(page.getByTestId('opening-issue')).toContainText('Дверь: ширина 250 см вне пределов 60–200 см');
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toBeDisabled();

  await page.getByLabel('Ширина, см (60–200)').fill('90');
  await expect(page.getByTestId('opening-issue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  expect(await doorState(page)).toMatchObject({ past: 1, widthCm: 90 });
});

test('9.5: петля переключается, применяется и отменяется Ctrl+Z', async ({ page }) => {
  await page.getByTestId('plan-opening-d1').locator('.plan-opening-hit').click();
  await page.getByRole('button', { name: 'справа', exact: true }).click();
  await expect(page.getByRole('button', { name: 'справа', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await doorState(page)).toMatchObject({ past: 0, hinge: 'left' }); // предпросмотр не в истории

  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  expect(await doorState(page)).toMatchObject({ past: 1, hinge: 'right' });

  await page.getByRole('heading', { name: 'Настройка квартиры' }).click();
  await page.keyboard.press('Control+z');
  expect(await doorState(page)).toMatchObject({ past: 0, hinge: 'left' });
});

test('9.4: в панели двери нет переноса на другую стену и подоконника', async ({ page }) => {
  await page.getByTestId('plan-opening-d1').locator('.plan-opening-hit').click();
  const panel = page.getByTestId('opening-panel');
  await expect(panel.getByLabel(/Подоконник/)).toHaveCount(0);
  await expect(panel.getByText(/на другую стену/i)).toHaveCount(0);
});
