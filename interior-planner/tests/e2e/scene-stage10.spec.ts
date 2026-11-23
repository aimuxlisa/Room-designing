import { expect, test, type Page } from '@playwright/test';
import { openTech } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any -- доступ к сцене Three.js из страницы */
type W = any;

/** Имена объектов сцены по шаблону. */
const sceneNames = (page: Page, pattern: string) =>
  page.evaluate((p) => {
    const re = new RegExp(p);
    const out: string[] = [];
    (window as W).__scene.traverse((o: W) => o.name && re.test(o.name) && out.push(o.name));
    return out.sort();
  }, pattern);

const visibleOf = (page: Page, name: string) => page.evaluate((n) => (window as W).__scene.getObjectByName(n)?.visible ?? null, name);

/** Точка проекта (см) в координатах экрана (NDC) текущей камеры. */
const ndcOf = (page: Page, xCm: number, yCm: number, zCm: number) =>
  page.evaluate(([x, y, z]) => {
    const cam = (window as W).__camera;
    const v = new cam.position.constructor(x / 100, y / 100, z / 100).project(cam);
    return { x: v.x as number, y: v.y as number };
  }, [xCm, yCm, zCm] as const);

/** Объекты под точкой экрана по лучу из камеры, ближние первыми (raycast без учёта visible — как в three). */
const pick = (page: Page, ndc: { x: number; y: number }) => page.evaluate(({ x, y }) => (window as W).__pick(x, y) as string[], ndc);

const activeRoom = (page: Page) => page.evaluate(() => (window as W).__stores.ui.getState().activeRoomId as string);

/** Ровно одна комната в 3D: пол и стены только её границы. */
async function expectOnlyRoom(page: Page, roomId: string, walls: string[]) {
  await expect.poll(() => sceneNames(page, '^floor-')).toEqual([`floor-${roomId}`]);
  await expect.poll(() => sceneNames(page, '^wall-w\\d+$')).toEqual(walls.map((w) => `wall-${w}`).sort());
}

test.beforeEach(async ({ page }) => {
  await openTech(page, 'createTechTwoRooms', 'a', 'interior');
});

test('10.1, 10.3: в 3D только активная комната; камера напротив двери — ближняя стена скрыта, дверь видна', async ({ page }) => {
  await expectOnlyRoom(page, 'a', ['w1', 'w5', 'w6', 'w7']);
  await expect.poll(() => visibleOf(page, 'wall-w6')).toBe(false); // камера за западной стеной
  await expect.poll(() => visibleOf(page, 'wall-w7')).toBe(true); // стена с дверью d1
  expect(await sceneNames(page, '^door-')).toEqual(['door-leaf-d1', 'door-portal-d1']);
});

test('10.2: реальное отверстие двери — луч проходит в проём; после сдвига двери отверстие на новом месте', async ({ page }) => {
  const firstOnDoorWall = async (zCm: number) => {
    const hits = await pick(page, await ndcOf(page, 420, 105, zCm));
    return hits.find((n) => n === 'door-portal-d1' || n.startsWith('wall-w7-block'));
  };
  await expect.poll(() => firstOnDoorWall(140)).toBe('door-portal-d1');

  await page.evaluate(() => {
    const w = window as W;
    const ap = w.__tech.createTechTwoRooms();
    ap.openings.d1 = { ...ap.openings.d1, offsetCm: 200 };
    w.__stores.project.getState().load(ap);
  });
  await expect.poll(() => firstOnDoorWall(140)).toMatch(/^wall-w7-block-/);
  await expect.poll(() => firstOnDoorWall(240)).toBe('door-portal-d1');
});

test('10.4: переход через дверь в 3D и обратно кнопкой; входная дверь ведёт наружу', async ({ page }) => {
  // Нажатие мышью на проём в 3D.
  const ndc = await ndcOf(page, 420, 105, 140);
  const box = (await page.getByTestId('scene').boundingBox())!;
  await page.mouse.click(box.x + ((ndc.x + 1) / 2) * box.width, box.y + ((1 - ndc.y) / 2) * box.height);
  await expect.poll(() => activeRoom(page)).toBe('b');
  await expectOnlyRoom(page, 'b', ['w2', 'w3', 'w4', 'w7']);
  await expect(page.getByTestId('nav-entry-entry')).toHaveText('Входная дверь — выход наружу');
  await expect(page.locator('.app-header')).toContainText('Коридор Б');

  await page.getByTestId('nav-door-d1').click();
  await expect.poll(() => activeRoom(page)).toBe('a');
  await expectOnlyRoom(page, 'a', ['w1', 'w5', 'w6', 'w7']);
  await expect(page.getByTestId('nav-door-d1')).toHaveText('В «Коридор Б»');
});

test('10.5: скрытая стена не перехватывает указатель; выбор сбрасывается при смене комнаты', async ({ page }) => {
  // Камера за стеной с дверью: стена скрыта, зона двери не попадает под луч.
  await page.evaluate(() => (window as W).__camera.position.set(7, 2.5, 1.4));
  await expect.poll(() => visibleOf(page, 'wall-w7')).toBe(false);
  const hits = await pick(page, await ndcOf(page, 420, 105, 140));
  expect(hits).toContain('floor-a'); // луч действительно проходит через проём в комнату
  expect(hits).not.toContain('door-portal-d1');

  await page.evaluate(() => (window as W).__stores.ui.getState().select('some-item'));
  await page.getByTestId('nav-door-d1').click();
  expect(await page.evaluate(() => (window as W).__stores.ui.getState().selectedId)).toBeNull();
});

test('10.6, AC-05: мебель сохраняется при переходах туда и обратно; ресурсы не копятся', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as W;
    const ap = w.__tech.createTechTwoRooms();
    ap.furniture = {
      chair: { id: 'chair', catalogItemId: 'modern_arm_chair_01', assetVersion: 1, roomId: 'a', position: { xCm: 200, yCm: 0, zCm: 160 }, angleDeg: 0, variantId: null },
    };
    w.__stores.project.getState().load(ap);
  });
  await expect.poll(() => sceneNames(page, '^item-')).toEqual(['item-chair']);
  const geometries = () => page.evaluate(() => (window as W).__gl.info.memory.geometries as number);
  const go = async (door: string, room: string) => {
    await page.getByTestId(`nav-door-${door}`).click();
    await expect.poll(() => activeRoom(page)).toBe(room);
  };

  await go('d1', 'b');
  await expect.poll(() => sceneNames(page, '^item-')).toEqual([]);
  await go('d1', 'a');
  await expect.poll(() => sceneNames(page, '^item-')).toEqual(['item-chair']);
  await page.waitForTimeout(300);
  const before = await geometries();

  for (let i = 0; i < 3; i++) {
    await go('d1', 'b');
    await go('d1', 'a');
  }
  await expect.poll(() => sceneNames(page, '^item-')).toEqual(['item-chair']);
  await page.waitForTimeout(300);
  expect(await geometries()).toBe(before);
  const chair = await page.evaluate(() => (window as W).__stores.project.getState().history.present.furniture.chair.position);
  expect(chair).toEqual({ xCm: 200, yCm: 0, zCm: 160 });
});
