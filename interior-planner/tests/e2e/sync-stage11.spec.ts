import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any -- доступ к сцене и хранилищам из страницы */
type W = any;

const sceneNames = (page: Page, pattern: string) =>
  page.evaluate((p) => {
    const re = new RegExp(p);
    const out: string[] = [];
    (window as W).__scene.traverse((o: W) => o.name && re.test(o.name) && out.push(o.name));
    return out.sort();
  }, pattern);

const state = (page: Page) =>
  page.evaluate(() => {
    const w = window as W;
    const chair = w.__stores.project.getState().history.present.furniture.chair;
    return { selected: w.__stores.ui.getState().selectedId as string | null, angle: chair?.angleDeg as number, room: w.__stores.ui.getState().activeRoomId as string };
  });

/** Добавить кресло в комнату А текущей квартиры (без изменения геометрии). */
const addChair = (page: Page, xCm = 200, zCm = 160) =>
  page.evaluate(
    ([x, z]) => {
      const w = window as W;
      const ap = w.__stores.project.getState().history.present;
      w.__stores.project.getState().load({
        ...ap,
        furniture: { chair: { id: 'chair', catalogItemId: 'modern_arm_chair_01', assetVersion: 1, roomId: 'a', position: { xCm: x, yCm: 0, zCm: z }, angleDeg: 0, variantId: null } },
      });
    },
    [xCm, zCm] as const,
  );

test('11.2: выбор и поворот синхронны в плане и 3D', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'interior');
  await addChair(page);
  await expect.poll(() => sceneNames(page, '^item-')).toEqual(['item-chair']);

  // Выбор на плане → контур выбора в 3D.
  const item = page.getByTestId('plan-item-chair');
  const box = (await item.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect((await state(page)).selected).toBe('chair');
  await expect(item).toHaveClass(/selected/);
  await expect.poll(() => sceneNames(page, '^selection-')).toEqual(['selection-chair']);

  // Поворот клавишей → оба вида.
  const before = await item.getAttribute('points');
  await page.keyboard.press('KeyR');
  const { angle } = await state(page);
  expect(angle).toBe(345); // R — по часовой на 15°, угол нормализуется в 0–360
  await expect.poll(() => item.getAttribute('points')).not.toBe(before);
  await expect
    .poll(() => page.evaluate(() => (window as W).__scene.getObjectByName('item-chair').rotation.y as number))
    .toBeCloseTo((angle * Math.PI) / 180, 6);

  // Снятие выбора при смене комнаты убирает контур в 3D.
  await page.getByTestId('nav-door-d1').click();
  await page.getByTestId('nav-door-d1').click();
  expect((await state(page)).selected).toBeNull();
  await expect.poll(() => sceneNames(page, '^selection-')).toEqual([]);
  await expect(page.getByTestId('plan-item-chair')).not.toHaveClass(/selected/);
});

test('11.2: выбор предмета в 3D подсвечивает его на плане', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'interior');
  await addChair(page);
  await expect.poll(() => sceneNames(page, '^item-')).toEqual(['item-chair']);
  await page.waitForTimeout(200);
  const ndc = await page.evaluate(() => {
    const cam = (window as W).__camera;
    const v = new cam.position.constructor(2, 0.5, 1.6).project(cam);
    return { x: v.x as number, y: v.y as number };
  });
  const scene = (await page.getByTestId('scene').boundingBox())!;
  await page.mouse.click(scene.x + ((ndc.x + 1) / 2) * scene.width, scene.y + ((1 - ndc.y) / 2) * scene.height);
  await expect.poll(async () => (await state(page)).selected).toBe('chair');
  await expect(page.getByTestId('plan-item-chair')).toHaveClass(/selected/);
});

test('11.3: после изменения стены в настройке план и 3D перестроены; при переходах нет лишних предметов', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'setup');
  await page.getByTestId('plan-wall-w7').click();
  await page.getByLabel('Комната А: ширина, см').fill('430');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.waitForFunction(() => '__scene' in window);
  await addChair(page);

  const floor3d = () =>
    page.evaluate(() => {
      const f = (window as W).__scene.getObjectByName('floor-a');
      return f ? Math.round(f.geometry.parameters.width * 100) : null;
    });
  await expect.poll(floor3d).toBe(430);
  const plan = page.getByTestId('plan');
  const scale = Number(await plan.getAttribute('data-scale'));
  await expect.poll(async () => Math.round(Number(await page.getByTestId('plan-floor').getAttribute('width')) / scale)).toBe(430);

  for (let i = 0; i < 2; i++) {
    await page.getByTestId('nav-door-d1').click();
    await expect.poll(() => sceneNames(page, '^(floor-|item-)')).toEqual(['floor-b']);
    await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(0);
    await page.getByTestId('nav-door-d1').click();
    await expect.poll(() => sceneNames(page, '^(floor-|item-)')).toEqual(['floor-a', 'item-chair']);
    await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(1);
  }
  await expect.poll(floor3d).toBe(430);
});
