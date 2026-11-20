import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

const project = (page: Page) =>
  page.evaluate(() => {
    type H = { past: unknown[]; present: { ceilingCm: number; vertices: Record<string, { xCm: number }> } };
    const w = window as unknown as { __stores: { project: { getState(): { history: H } } } };
    const h = w.__stores.project.getState().history;
    return { past: h.past.length, ceiling: h.present.ceilingCm, v1x: h.present.vertices.v1.xCm, v2x: h.present.vertices.v2.xCm };
  });

/** Экранная точка плана для координат проекта, см. */
async function planPoint(page: Page, xCm: number, zCm: number) {
  const plan = page.getByTestId('plan');
  const [s, ox, oy] = await Promise.all(['data-scale', 'data-offset-x', 'data-offset-y'].map((a) => plan.getAttribute(a)));
  const box = (await plan.boundingBox())!;
  return { x: box.x + xCm * Number(s) + Number(ox), y: box.y + zCm * Number(s) + Number(oy) };
}

test.beforeEach(async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'setup');
  await expect(page.getByRole('heading', { name: 'Настройка квартиры' })).toBeVisible();
});

test('8.1, 8.2, 8.4: выбор общей стены, размер числом, предпросмотр и применение (AC-03)', async ({ page }) => {
  await page.getByTestId('plan-wall-w7').click();
  await expect(page.getByTestId('plan-wall-w7').locator('rect')).toHaveClass(/selected/);
  await expect(page.getByTestId('wall-panel')).toContainText('Стена между «Комната А» и «Коридор Б»');

  await page.getByLabel('Комната А: ширина, см').fill('430');
  const preview = page.getByTestId('setup-preview');
  await expect(preview).toContainText('Комната А: 400 см × 300 см → 430 см × 300 см');
  await expect(preview).toContainText('Коридор Б: 200 см × 300 см → 170 см × 300 см');
  await expect(page.getByTestId('preview-area')).toHaveText('18,0 м²');
  await expect(page.getByTestId('plan-caption-a')).toContainText('430 см × 300 см'); // план показывает кандидата
  expect((await project(page)).past).toBe(0); // предпросмотр не в истории

  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  expect(await project(page)).toMatchObject({ past: 1, v2x: 450 });
  await expect(page.getByTestId('setup-clear-area')).toHaveText('18,0 м²');

  await page.getByRole('heading', { name: 'Настройка квартиры' }).click();
  await page.keyboard.press('Control+z');
  expect(await project(page)).toMatchObject({ past: 0, v2x: 420 });
});

test('8.3: перетаскивание внешней стены наружу на 50 см — площадь растёт, применяется при отпускании', async ({ page }) => {
  const from = await planPoint(page, 0, 165);
  const to = await planPoint(page, -50, 165);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.getByTestId('wall-panel')).toContainText('Внешняя стена');
  await expect(page.getByTestId('preview-area')).toHaveText('19,5 м²');
  await page.mouse.up();
  expect(await project(page)).toMatchObject({ past: 1, v1x: -50 });
  await expect(page.getByTestId('setup-clear-area')).toHaveText('19,5 м²');
});

test('8.5: невалидный размер — конкретная причина, применить нельзя, квартира прежняя', async ({ page }) => {
  await page.getByTestId('plan-wall-w7').click();
  await page.getByLabel('Комната А: ширина, см').fill('650');
  await expect(page.getByTestId('setup-issue')).toContainText('Коридор Б');
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toBeDisabled();
  await page.getByLabel('Комната А: ширина, см').press('Enter');
  expect(await project(page)).toMatchObject({ past: 0, v2x: 420 });
  await expect(page.getByTestId('setup-issue')).toContainText('Коридор Б');
});

test('8.6: высота потолка — пределы и применение; 3D использует новую высоту', async ({ page }) => {
  const input = page.getByLabel(/Высота потолка, см/);
  await input.fill('450');
  await expect(page.getByTestId('ceiling-issue')).toHaveText('Высота потолка должна быть от 220 до 400 см');
  await input.fill('300');
  await page.getByRole('button', { name: 'Применить высоту' }).click();
  expect((await project(page)).ceiling).toBe(300);
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.waitForFunction(() => '__scene' in window);
  await expect
    .poll(() =>
      page.evaluate(() => {
        let max = 0;
        type O = { geometry?: { type: string; parameters: { height: number } } };
        (window as unknown as { __scene: { traverse(f: (o: O) => void): void } }).__scene.traverse((o) => {
          if (o.geometry?.type === 'BoxGeometry') max = Math.max(max, o.geometry.parameters.height);
        });
        return max;
      }),
    )
    .toBeCloseTo(3, 6);
});

test('8.6: конфликт высоты с окном схемы блокирует изменение', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: '1 комната' }).click();
  await page.getByLabel('Примерная площадь квартиры, м²').fill('40');
  await page.getByRole('button', { name: 'Подобрать схемы' }).click();
  await page.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  await page.getByLabel(/Высота потолка, см/).fill('225');
  await expect(page.getByTestId('ceiling-issue')).toHaveText('Окно выше потолка');
  await expect(page.getByRole('button', { name: 'Применить высоту' })).toBeDisabled();
});

test('интерьер: геометрия заблокирована — стены не выбираются', async ({ page }) => {
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.getByRole('button', { name: 'Вся квартира' }).click();
  await page.getByTestId('plan-wall-w7').click({ force: true });
  await expect(page.getByTestId('plan-wall-w7').locator('rect')).not.toHaveClass(/selected/);
});
