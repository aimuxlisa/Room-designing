import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

/** Экранная точка плана для координат проекта, см. */
async function planPoint(page: Page, xCm: number, zCm: number) {
  const plan = page.getByTestId('plan');
  const [s, ox, oy] = await Promise.all(['data-scale', 'data-offset-x', 'data-offset-y'].map((a) => plan.getAttribute(a)));
  const box = (await plan.boundingBox())!;
  return { x: box.x + xCm * Number(s) + Number(ox), y: box.y + zCm * Number(s) + Number(oy) };
}

/** Экранная точка 3D-сцены для точки пола, см. */
async function scenePoint(page: Page, xCm: number, zCm: number, yCm = 0) {
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const ndc = await page.evaluate(
    ([x, z, y]) => {
      type V = { project(c: unknown): V; x: number; y: number };
      const w = window as unknown as { __camera: { position: { clone(): V & { set(a: number, b: number, c: number): V } } } };
      const v = w.__camera.position.clone().set(x / 100, y / 100, z / 100).project(w.__camera);
      return { x: v.x, y: v.y };
    },
    [xCm, zCm, yCm],
  );
  return { x: box.x + ((ndc.x + 1) / 2) * box.width, y: box.y + ((1 - ndc.y) / 2) * box.height };
}

async function dragFromCatalog(page: Page, itemId: string, to: { x: number; y: number }) {
  const btn = page.getByTestId(`catalog-${itemId}`);
  const b = (await btn.boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x - 30, to.y - 30, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
}

const furniture = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as unknown as { __scene: { traverse(f: (o: { name: string; position: { x: number; z: number } }) => void): void } }).__scene;
    const out: { name: string; x: number; z: number }[] = [];
    scene.traverse((o) => o.name.startsWith('item-') && out.push({ name: o.name, x: o.position.x * 100, z: o.position.z * 100 }));
    return out;
  });

test.beforeEach(async ({ page }) => {
  await openTech(page);
  await expect(page.getByTestId('plan-floor')).toBeVisible();
});

/** Габарит многоугольника по атрибуту points (без толщины обводки), см. */
async function polygonSizeCm(page: Page, testIdPrefix: string) {
  const scale = Number(await page.getByTestId('plan').getAttribute('data-scale'));
  const pts = (await page.locator(`[data-testid^="${testIdPrefix}"]`).getAttribute('points'))!
    .split(' ')
    .map((p) => p.split(',').map(Number));
  const span = (k: number) => (Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))) / scale;
  const mid = (k: number) => (Math.max(...pts.map((p) => p[k])) + Math.min(...pts.map((p) => p[k]))) / 2;
  return { w: span(0), d: span(1), cx: mid(0), cy: mid(1) };
}

test('4.3, AC-06: перенос на план — контур 273 × 93 см, модель в 3D с той же точкой и габаритом', async ({ page }) => {
  await dragFromCatalog(page, 'sofa_03', await planPoint(page, 225, 200));
  await expect(page.getByTestId('plan-draft')).toBeVisible();
  await page.mouse.up();

  await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(1);
  const fp = await polygonSizeCm(page, 'plan-item-');
  expect(fp.w).toBeCloseTo(273.1, 1);
  expect(fp.d).toBeCloseTo(92.5, 1);

  await expect.poll(async () => (await furniture(page)).length).toBe(1);
  const [item] = await furniture(page);
  expect(item.x).toBeCloseTo(225, 3);
  expect(item.z).toBeCloseTo(200, 3);
  const size = await page.evaluate((name) => {
    type O = { getObjectByName(n: string): unknown };
    const w = window as unknown as { __scene: O; __THREE_BOX?: unknown };
    const obj = w.__scene.getObjectByName(name) as { updateWorldMatrix(a: boolean, b: boolean): void };
    obj.updateWorldMatrix(true, true);
    // Box3 из three доступен через конструктор любой геометрии сцены нельзя; считаем вручную по вершинам.
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    (obj as unknown as { traverse(f: (o: any) => void): void }).traverse((o: any) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const w = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
        min = min.map((m, k) => Math.min(m, w[k]));
        max = max.map((m, k) => Math.max(m, w[k]));
      }
    });
    return { w: (max[0] - min[0]) * 100, h: (max[1] - min[1]) * 100, d: (max[2] - min[2]) * 100, minY: min[1] * 100 };
  }, item.name);
  expect(Math.abs(size.w - 273.1)).toBeLessThan(1);
  expect(Math.abs(size.d - 92.5)).toBeLessThan(1);
  expect(Math.abs(size.minY)).toBeLessThan(0.5); // опора на полу
});

test('AC-06: перенос в 3D даёт ту же точку, что и на плане', async ({ page }) => {
  await dragFromCatalog(page, 'modern_arm_chair_01', await scenePoint(page, 150, 250));
  await page.mouse.up();
  await expect.poll(async () => (await furniture(page)).length).toBe(1);
  const [item] = await furniture(page);
  expect(Math.abs(item.x - 150)).toBeLessThanOrEqual(5);
  expect(Math.abs(item.z - 250)).toBeLessThanOrEqual(5);
  const fp = await polygonSizeCm(page, 'plan-item-');
  const plan = (await page.getByTestId('plan').boundingBox())!;
  const center = await planPoint(page, item.x, item.z);
  expect(Math.abs(plan.x + fp.cx - center.x)).toBeLessThan(0.5);
  expect(Math.abs(plan.y + fp.cy - center.y)).toBeLessThan(0.5);
});

test('AC-07, AC-08: выход за стену — красный кандидат с причиной, отпускание ничего не ставит, камера управляется', async ({ page }) => {
  await dragFromCatalog(page, 'sofa_03', await planPoint(page, 40, 200));
  await expect(page.getByTestId('plan-draft')).toHaveClass(/invalid/);
  await expect(page.getByTestId('status')).toContainText('пересекает стену');
  await page.keyboard.press('KeyR');
  await page.mouse.up();
  await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('пересекает стену');

  const cam = () => page.evaluate(() => (window as unknown as { __camera: { position: { x: number; z: number } } }).__camera.position.x);
  const before = await cam();
  const c = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 + 150, c.y + c.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await cam()).not.toBeCloseTo(before, 3);
});

test('AC-08: перенос предмета в 3D не вращает камеру; неудачный перенос оставляет предмет на месте', async ({ page }) => {
  await dragFromCatalog(page, 'modern_coffee_table_01', await planPoint(page, 220, 190));
  await page.mouse.up();
  await expect.poll(async () => (await furniture(page)).length).toBe(1);
  const cam = () => page.evaluate(() => (window as unknown as { __camera: { position: { x: number; y: number; z: number } } }).__camera.position);
  const before = await cam();
  const from = await scenePoint(page, 220, 190, 35); // столешница
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const outside = await planPoint(page, -200, 190);
  await page.mouse.move(outside.x, outside.y, { steps: 8 });
  await page.mouse.up();
  expect(await cam()).toEqual(before);
  const [item] = await furniture(page);
  expect(item.x).toBeCloseTo(220, 3);
  expect(item.z).toBeCloseTo(190, 3);
});

test('5.4: предмет нельзя поставить в другой предмет', async ({ page }) => {
  await dragFromCatalog(page, 'sofa_03', await planPoint(page, 225, 150));
  await page.mouse.up();
  await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(1);
  await dragFromCatalog(page, 'modern_coffee_table_01', await planPoint(page, 225, 150));
  await expect(page.getByTestId('plan-draft')).toHaveClass(/invalid/);
  await expect(page.getByTestId('status')).toContainText('пересекается');
  await page.mouse.up();
  await expect(page.locator('[data-testid^="plan-item-"]')).toHaveCount(1);
});
