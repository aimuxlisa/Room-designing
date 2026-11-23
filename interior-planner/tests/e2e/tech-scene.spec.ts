import { expect, test } from '@playwright/test';
import { openTech } from './helpers';

test('4.1: техническая комната 420 × 350 см одинакова на плане и в 3D', async ({ page }) => {
  await openTech(page);
  const plan = page.getByTestId('plan');
  const floor = page.getByTestId('plan-floor');
  await expect(floor).toBeVisible();
  const scale = Number(await plan.getAttribute('data-scale'));
  expect(Number(await floor.getAttribute('width')) / scale).toBeCloseTo(420, 6);
  expect(Number(await floor.getAttribute('height')) / scale).toBeCloseTo(350, 6);
  await expect(plan.getByText('420 см')).toBeVisible();

  const floor3d = await page.waitForFunction(() => {
    type Obj = { name: string; userData: Record<string, number>; geometry?: { parameters: { width: number; height: number } } };
    const scene = (window as unknown as { __scene?: { getObjectByName(n: string): Obj | undefined } }).__scene;
    const f = scene?.getObjectByName('floor-tech-room');
    return f ? { w: f.geometry!.parameters.width, h: f.geometry!.parameters.height } : null;
  });
  const dims = await floor3d.jsonValue();
  expect(dims!.w * 100).toBeCloseTo(420, 6);
  expect(dims!.h * 100).toBeCloseTo(350, 6);
});
