import type { Page } from '@playwright/test';

type W = {
  __stores: {
    project: { getState(): { load(a: unknown): void } };
    ui: { getState(): { setActiveRoom(id: string): void; setStage(s: string): void; setTemplateId(id: string): void } };
  };
  __tech: Record<string, () => unknown>;
};

/** Открыть техническую сцену в режиме интерьера (минуя стартовый сценарий). */
export async function openTech(
  page: Page,
  kind: 'createTechApartment' | 'createTechTwoRooms' = 'createTechApartment',
  roomId = kind === 'createTechApartment' ? 'tech-room' : 'b',
  stage: 'interior' | 'setup' = 'interior',
) {
  await page.goto('/');
  await page.waitForFunction(() => '__stores' in window);
  await page.evaluate(
    ([k, r, st]) => {
      const w = window as unknown as W;
      w.__stores.project.getState().load(w.__tech[k]());
      w.__stores.ui.getState().setTemplateId('tech');
      w.__stores.ui.getState().setActiveRoom(r);
      w.__stores.ui.getState().setStage(st);
    },
    [kind, roomId, stage] as const,
  );
  // Ждать, пока камера встанет на вид этой комнаты (CameraRig), иначе экранные точки 3D считаются по старой камере.
  if (stage === 'interior') await page.waitForFunction((r) => (window as unknown as { __view?: string }).__view === r, roomId);
}
