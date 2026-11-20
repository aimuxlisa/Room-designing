import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) =>
  page.evaluate(() => {
    type S = { history: { past: unknown[]; present: { id: string; furniture: object; rooms: object } } };
    const w = window as unknown as { __stores: { project: { getState(): S }; ui: { getState(): { stage: string; templateId: string | null; activeRoomId: string | null } } } };
    const p = w.__stores.project.getState();
    const u = w.__stores.ui.getState();
    return { id: p.history.present.id, past: p.history.past.length, furniture: Object.keys(p.history.present.furniture).length, rooms: Object.keys(p.history.present.rooms).length, stage: u.stage, templateId: u.templateId, room: u.activeRoomId };
  });

async function params(page: Page, rooms: 1 | 2 | 3, area: string) {
  await page.getByRole('radio', { name: `${rooms} комнат` }).click();
  await page.getByLabel('Примерная площадь квартиры, м²').fill(area);
  await page.getByRole('button', { name: 'Подобрать схемы' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Какая у вас квартира?' })).toBeVisible();
});

test('7.1: понятные ошибки ввода площади; кнопка недоступна без данных', async ({ page }) => {
  const input = page.getByLabel('Примерная площадь квартиры, м²');
  const go = page.getByRole('button', { name: 'Подобрать схемы' });
  await expect(go).toBeDisabled();
  await page.getByRole('radio', { name: '2 комнаты' }).click();
  await input.fill('сорок');
  await expect(page.getByRole('alert')).toHaveText('Только число в м², например 45 или 45,5');
  await input.fill('5');
  await expect(page.getByRole('alert')).toHaveText('Площадь должна быть от 15 до 250 м²');
  await expect(go).toBeDisabled();
  await input.fill('64,5');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(go).toBeEnabled();
});

for (const [rooms, area] of [[1, '45'], [2, '70'], [3, '95']] as const) {
  test(`AC-01: ${rooms} комн. → площадь → схема → квартира → интерьер без мебели`, async ({ page }) => {
    await params(page, rooms, area);
    await expect(page.getByText('Схемы приблизительные')).toBeVisible();
    const cards = page.locator('[data-testid^="scheme-"].scheme-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('ближе всего');
    await cards.first().getByRole('button', { name: 'Выбрать схему' }).click();
    await expect(page.getByRole('heading', { name: 'Настройка квартиры' })).toBeVisible();
    await expect(page.getByTestId('setup-furniture-count')).toHaveText('0');
    await page.getByRole('button', { name: 'К интерьеру →' }).click();
    await expect(page.getByTestId('plan-floor')).toBeVisible();
    const s = await state(page);
    expect(s).toMatchObject({ stage: 'interior', furniture: 0, past: 0 });
    expect(s.room).not.toBeNull();
  });
}

test('7.3: площадь схемы показана как фактическая, не как введённая', async ({ page }) => {
  await params(page, 1, '45');
  const first = page.locator('.scheme-card').first();
  await expect(first.getByTestId('scheme-area')).not.toHaveText('45,0 м²');
  await expect(first).toContainText(/на \d+,\d м² (больше|меньше) введённой/);
});

test('7.5: возврат не теряет данные; та же схема — продолжение; другая с правками — только после подтверждения', async ({ page }) => {
  await params(page, 2, '70');
  const cards = page.locator('.scheme-card');
  await cards.nth(0).getByRole('button', { name: 'Выбрать схему' }).click();
  const chosen = (await state(page)).templateId;

  // Возврат к параметрам и обратно: ввод и выбор сохранены.
  await page.getByRole('button', { name: /Параметры/ }).click();
  await expect(page.getByRole('radio', { name: '2 комнаты' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Примерная площадь квартиры, м²')).toHaveValue('70');
  await page.getByRole('button', { name: /Схема/ }).click();
  await expect(page.locator('.scheme-card.chosen')).toHaveCount(1);

  // Правка проекта: ставим кресло в интерьере (история не пуста).
  await page.getByRole('button', { name: /Квартира/ }).click();
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __stores: { drag: { getState(): { startFromCatalog(id: string): void; pointAt(p: { x: number; z: number }, s: boolean): void; finish(): void } }; ui: { getState(): { activeRoomId: string } }; project: { getState(): { history: { present: { rooms: Record<string, { boundary: unknown }> } } } } } };
    const d = w.__stores.drag.getState();
    d.startFromCatalog('modern_arm_chair_01');
    d.pointAt({ x: 250, z: 250 }, false);
    d.finish();
  });
  expect((await state(page)).furniture).toBe(1);

  // Та же схема — продолжение без потери мебели.
  await page.getByRole('button', { name: /Схема/ }).click();
  await page.locator('.scheme-card.chosen').getByRole('button', { name: 'Продолжить с этой схемой' }).click();
  expect(await state(page)).toMatchObject({ templateId: chosen, furniture: 1, stage: 'setup' });

  // Другая схема: отказ — ничего не меняется.
  await page.getByRole('button', { name: /Схема/ }).click();
  page.once('dialog', (d) => d.dismiss());
  await page.locator('.scheme-card:not(.chosen)').first().getByRole('button', { name: 'Выбрать схему' }).click();
  expect(await state(page)).toMatchObject({ templateId: chosen, furniture: 1, stage: 'scheme' });

  // Другая схема: подтверждение — замена и очистка истории.
  page.once('dialog', (d) => d.accept());
  await page.locator('.scheme-card:not(.chosen)').first().getByRole('button', { name: 'Выбрать схему' }).click();
  const after = await state(page);
  expect(after.templateId).not.toBe(chosen);
  expect(after).toMatchObject({ furniture: 0, past: 0, stage: 'setup' });
});
