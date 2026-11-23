import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any -- доступ к сцене и хранилищам из страницы */
type W = any;

/** Имена материалов граней блоков стены в 3D (null — стены нет в сцене). */
const wallMaterialNames = (page: Page, wallId: string) =>
  page.evaluate((id) => {
    const g = (window as W).__scene.getObjectByName(`wall-${id}`);
    if (!g) return null;
    const names = new Set<string>();
    g.children.filter((o: W) => o.name.startsWith(`wall-${id}-block`)).forEach((o: W) => o.material.forEach((m: W) => m.name && names.add(m.name)));
    return [...names].sort();
  }, wallId);

const surface = (page: Page) => page.evaluate(() => (window as W).__stores.ui.getState().selectedSurface);

test('12.1, 12.3, 12.6: стена выбирается на плане, краска — только сторона А, видна на плане и в 3D; отмена', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'interior');
  await page.getByTestId('plan-wall-w7').click();
  expect(await surface(page)).toEqual({ wallId: 'w7', roomId: 'a' });
  await expect(page.getByTestId('finish-surface')).toHaveText('«Комната А», восточная стена — сторона к «Коридор Б»');
  await expect(page.getByTestId('plan-surface-selected')).toHaveCount(1);

  await page.getByTestId('swatch-paint-sage').click();
  await expect(page.getByTestId('finish-current')).toHaveText('Сейчас: Шалфей');
  await expect(page.getByTestId('plan-finish-w7-a')).toHaveAttribute('data-material', 'paint-sage');
  await expect.poll(() => wallMaterialNames(page, 'w7')).toEqual(['finish:paint-sage']);

  // Сторона коридора не изменилась (AC-11), а при возврате отделка на месте (12.5).
  await page.getByTestId('nav-door-d1').click();
  await expect.poll(() => wallMaterialNames(page, 'w7')).toEqual([]);
  await expect(page.locator('[data-testid^="plan-finish-"]')).toHaveCount(0);
  await expect(page.getByTestId('finish-panel')).toHaveCount(0); // выбор сброшен сменой комнаты
  await page.getByTestId('nav-door-d1').click();
  await expect.poll(() => wallMaterialNames(page, 'w7')).toEqual(['finish:paint-sage']);

  await page.locator('.app-header h1').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => wallMaterialNames(page, 'w7')).toEqual([]);
  await expect(page.locator('[data-testid^="plan-finish-"]')).toHaveCount(0);
});

test('12.1: стена выбирается щелчком в 3D; щелчок по предмету стену не выбирает', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'interior');
  const click3d = async (xCm: number, yCm: number, zCm: number) => {
    const ndc = await page.evaluate(([x, y, z]) => {
      const cam = (window as W).__camera;
      const v = new cam.position.constructor(x / 100, y / 100, z / 100).project(cam);
      return { x: v.x as number, y: v.y as number };
    }, [xCm, yCm, zCm] as const);
    const box = (await page.getByTestId('scene').boundingBox())!;
    await page.mouse.click(box.x + ((ndc.x + 1) / 2) * box.width, box.y + ((1 - ndc.y) / 2) * box.height);
  };
  await click3d(415, 150, 50); // стена с дверью вне проёма
  await expect.poll(() => surface(page)).toEqual({ wallId: 'w7', roomId: 'a' });
  await expect(page.getByTestId('finish-surface')).toContainText('восточная стена');

  // Кресло перед стеной: щелчок выбирает кресло, а не стену за ним.
  await page.evaluate(() => {
    const w = window as W;
    const ap = w.__stores.project.getState().history.present;
    w.__stores.project.getState().load({
      ...ap,
      furniture: { chair: { id: 'chair', catalogItemId: 'modern_arm_chair_01', assetVersion: 1, roomId: 'a', position: { xCm: 200, yCm: 0, zCm: 160 }, angleDeg: 0, variantId: null } },
    });
  });
  await page.waitForFunction(() => !!(window as W).__scene.getObjectByName('item-chair'));
  await page.waitForTimeout(200);
  await click3d(200, 50, 160);
  await expect.poll(() => page.evaluate(() => (window as W).__stores.ui.getState().selectedId)).toBe('chair');
  expect(await surface(page)).toBeNull();
  await expect(page.getByTestId('finish-panel')).toHaveCount(0);
});

test('12.4: обои сохраняют физический масштаб после удлинения стены', async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'setup');
  // Обои на северную стену А.
  await page.evaluate(() => {
    const w = window as W;
    const ap = w.__stores.project.getState().history.present;
    w.__stores.project.getState().load({ ...ap, finishes: { ...ap.finishes, walls: { 'w1|a': 'wallpaper-fabric_pattern_05' } } });
  });
  const tiles = () =>
    page.evaluate(() => {
      const b = (window as W).__scene.getObjectByName('wall-w1-block-0');
      const m = b?.material.find((x: W) => x.name === 'finish:wallpaper-fabric_pattern_05');
      return m ? { lengthCm: Math.round(b.geometry.parameters.width * 100), repeat: m.map.repeat.x as number } : null;
    });

  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await page.waitForFunction(() => (window as W).__view === 'a');
  await expect.poll(tiles).not.toBeNull();
  const before = (await tiles())!;
  expect(before.lengthCm / before.repeat).toBeCloseTo(50, 3);

  // Западная стена А наружу на 50 см: северная стена длиннее на 50 см.
  await page.getByRole('button', { name: '3 Квартира' }).click();
  await page.getByTestId('plan-wall-w6').click();
  await page.getByLabel('Комната А: ширина, см').fill('450');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByRole('button', { name: 'К интерьеру →' }).click();
  await expect.poll(async () => (await tiles())?.lengthCm).toBe(before.lengthCm + 50);
  const after = (await tiles())!;
  expect(after.repeat - before.repeat).toBeCloseTo(1, 3);
  expect(after.lengthCm / after.repeat).toBeCloseTo(50, 3);
  expect(await page.evaluate(() => (window as W).__stores.project.getState().history.present.finishes.walls)).toEqual({ 'w1|a': 'wallpaper-fabric_pattern_05' });
});
