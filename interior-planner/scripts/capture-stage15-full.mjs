// Этап 15.5 и 15.6: полный сценарий для схем 1/2/3 комнат и отмена/повтор по всему сценарию.
// Нужен запущенный `npm run dev`. Печатает проверки (ok / FAIL) и сохраняет кадры в docs/stage-15.
import { chromium } from '@playwright/test';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);

/** Снимок проекта: мебель, отделка, геометрия. */
const snap = () =>
  p.evaluate(() => {
    const ap = window.__stores.project.getState().history.present;
    return JSON.stringify({ f: ap.furniture, fi: ap.finishes, v: ap.vertices, o: ap.openings, c: ap.ceilingCm });
  });
const steps = () => p.evaluate(() => window.__stores.project.getState().history.past.length);
const furnitureCount = () => p.evaluate(() => Object.keys(window.__stores.project.getState().history.present.furniture).length);

for (const [rooms, area] of [[1, '38'], [2, '55'], [3, '78']]) {
  const tag = `${rooms} комн.`;
  await p.goto('http://localhost:5173/');
  // AC-13: некорректный ввод не разрушает работу.
  const label = rooms === 1 ? '1 комната' : rooms === 2 ? '2 комнаты' : '3 комнаты';
  await p.getByRole('radio', { name: label }).click();
  await p.getByLabel('Примерная площадь квартиры, м²').fill('abc');
  check(
    `${tag} AC-13 ввод «abc» отклонён`,
    (await p.getByRole('alert').count()) === 1 && (await p.getByRole('button', { name: 'Подобрать схемы' }).isDisabled()),
  );
  await p.getByLabel('Примерная площадь квартиры, м²').fill(area);
  await p.getByRole('button', { name: 'Подобрать схемы' }).click();
  const cards = await p.locator('.scheme-card').count();
  check(`${tag} схемы подобраны`, cards > 0, `${cards} шт.`);
  await p.locator('.scheme-card').first().getByRole('button', { name: 'Выбрать схему' }).click();
  check(`${tag} AC-01 настройка без мебели`, (await p.getByTestId('setup-furniture-count').textContent()) === '0');
  await p.getByRole('button', { name: 'К интерьеру →' }).click();
  await p.waitForFunction(() => '__view' in window);
  check(`${tag} AC-01 интерьер без мебели`, (await furnitureCount()) === 0);
  const initial = await snap();

  // AC-06/AC-08: установка из каталога; невалидное отпускание за стеной не ставит предмет.
  const box = await p.evaluate(() => {
    const { project, ui } = window.__stores;
    const ap = project.getState().history.present;
    const room = ui.getState().activeRoomId;
    const vs = ap.rooms[room].boundary.flatMap((e) => [ap.walls[e.wallId].startId, ap.walls[e.wallId].endId]).map((id) => ap.vertices[id]);
    const xs = vs.map((v) => v.xCm), zs = vs.map((v) => v.zCm);
    return { room, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  });
  const put = (item, x, z) =>
    p.evaluate(([item, x, z]) => {
      const { drag } = window.__stores;
      drag.getState().startFromCatalog(item);
      drag.getState().pointAt({ x, z }, false);
      const r = drag.getState().finish();
      return r?.ok ? 'ok' : r ? r.issues[0].message : 'нет кандидата';
    }, [item, x, z]);
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const bad = await put('sofa_02', box.x0 - 40, cz);
  check(`${tag} AC-08 отпускание за стеной отклонено`, bad !== 'ok' && (await furnitureCount()) === 0, bad);
  check(`${tag} AC-06 ковёр поставлен`, (await put('rug_round', cx, cz)) === 'ok');
  check(`${tag} AC-06 столик поставлен`, (await put('modern_coffee_table_02', cx, cz)) === 'ok');

  // AC-11/AC-19: отделка стены и покрытие пола через панель.
  const wallId = await p.evaluate(() => {
    const { project, ui } = window.__stores;
    const ap = project.getState().history.present;
    const room = ui.getState().activeRoomId;
    const w = ap.rooms[room].boundary[0].wallId;
    ui.getState().selectSurface({ wallId: w, roomId: room });
    return w;
  });
  await p.getByTestId('finish-panel').getByRole('button', { name: /Шалфей/ }).first().click();
  await p.evaluate(() => window.__stores.ui.getState().selectFloor(window.__stores.ui.getState().activeRoomId));
  await p.getByTestId('finish-panel').getByRole('button', { name: /Паркет ёлочка/ }).first().click();
  const fin = await p.evaluate((w) => {
    const ap = window.__stores.project.getState().history.present;
    return Object.entries(ap.finishes.walls).filter(([k]) => k.startsWith(`${w}|`));
  }, wallId);
  check(`${tag} AC-11 отделка только на одной стороне`, fin.length === 1 && fin[0][1] === 'paint-sage', JSON.stringify(fin));
  const floorOk = await p.evaluate(() => {
    const { project, ui } = window.__stores;
    return project.getState().history.present.finishes.floors[ui.getState().activeRoomId] === 'floor-herringbone_parquet';
  });
  check(`${tag} AC-19 пол сменён`, floorOk);

  // AC-05/AC-04: переход в соседнюю комнату через дверь и обратно — мебель и отделка на месте.
  const doorBtn = p.locator('[data-testid^="nav-door-"]').first();
  if (await doorBtn.count()) {
    const before = await snap();
    await doorBtn.click();
    const other = await p.evaluate(() => window.__stores.ui.getState().activeRoomId);
    await p.waitForFunction((r) => window.__view === r, other);
    const back = p.locator('[data-testid^="nav-door-"]').filter({ hasText: '' });
    await p.evaluate((r) => window.__stores.ui.getState().setActiveRoom(r), box.room);
    await p.waitForFunction((r) => window.__view === r, box.room);
    check(`${tag} AC-05 переход ${box.room} → ${other} → ${box.room} без потерь`, other !== box.room && (await snap()) === before);
    void back;
  } else check(`${tag} AC-05 есть дверь в соседнюю комнату`, false);
  await p.screenshot({ path: `docs/stage-15/full-${rooms}.png` });

  // AC-03/AC-09: в настройке стена сдвигается; конфликт с мебелью отклоняется без изменения квартиры.
  await p.getByTestId('to-setup').click();
  check(`${tag} 15.2 мебель сохранена в настройке`, (await p.getByTestId('setup-furniture-count').textContent()) === '2');
  const geo = await p.evaluate(({ room }) => {
    const { project, setup } = window.__stores;
    const ap = project.getState().history.present;
    const area = (a, r) => {
      const vs = a.rooms[r].boundary.flatMap((e) => [a.walls[e.wallId].startId, a.walls[e.wallId].endId]).map((id) => a.vertices[id]);
      const xs = vs.map((v) => v.xCm), zs = vs.map((v) => v.zCm);
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    };
    const res = { moved: null, rejected: null };
    for (const e of ap.rooms[room].boundary) {
      for (const d of [10, -10]) {
        setup.getState().selectWall(e.wallId);
        setup.getState().setDelta(d);
        const pr = setup.getState().proposal;
        if (pr?.ok && !res.moved) {
          const a0 = area(ap, room);
          setup.getState().apply();
          const a1 = area(project.getState().history.present, room);
          res.moved = { wall: e.wallId, d, changed: a0 !== a1 };
          break;
        }
      }
      if (res.moved) break;
    }
    // Конфликт: двигать каждую стену комнаты внутрь, пока не упрётся в мебель.
    for (const e of project.getState().history.present.rooms[room].boundary) {
      for (const d of [-300, 300]) {
        setup.getState().selectWall(e.wallId);
        setup.getState().setDelta(d);
        const pr = setup.getState().proposal;
        if (pr && !pr.ok && pr.issues.some((i) => i.objectIds.some((id) => id in project.getState().history.present.furniture))) {
          const before = JSON.stringify(project.getState().history.present);
          setup.getState().apply();
          res.rejected = { msg: setup.getState().lastIssue, same: before === JSON.stringify(project.getState().history.present) };
          break;
        }
      }
      if (res.rejected) break;
    }
    setup.getState().selectWall(null);
    return res;
  }, box);
  check(`${tag} AC-03 стена сдвинута, площадь изменилась`, !!geo.moved?.changed, JSON.stringify(geo.moved));
  check(`${tag} AC-09 конфликт с мебелью отклонён, квартира прежняя`, !!geo.rejected?.same, geo.rejected?.msg ?? 'конфликт не найден');

  // AC-10: окно не выходит за стену.
  const win = await p.evaluate(() => {
    const { project, setup } = window.__stores;
    const ap = project.getState().history.present;
    const o = Object.values(ap.openings).find((x) => x.kind === 'window');
    setup.getState().selectOpening(o.id);
    setup.getState().editOpening({ offsetCm: o.offsetCm + 2000 });
    const pr = setup.getState().openingProposal;
    setup.getState().resetOpening();
    setup.getState().selectOpening(null);
    return pr ? (pr.ok ? 'принято' : pr.issues[0].message) : 'нет';
  });
  check(`${tag} AC-10 окно за пределами стены отклонено`, win !== 'принято' && win !== 'нет', win);
  await p.getByRole('button', { name: 'К интерьеру →' }).click();

  // 15.6 / AC-16: Ctrl+Z до начала, Ctrl+Y до конца; горячие клавиши не работают в поле ввода.
  const final = await snap();
  const n = await steps();
  await p.locator('body').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < n; i++) await p.keyboard.press('Control+KeyZ');
  check(`${tag} AC-16 отмена ${n} шагов вернула исходное состояние`, (await snap()) === initial);
  for (let i = 0; i < n; i++) await p.keyboard.press('Control+KeyY');
  check(`${tag} AC-16 повтор вернул итог (мебель, отделка, геометрия)`, (await snap()) === final);
  await p.getByTestId('to-setup').click();
  const field = p.locator('input').first();
  await field.focus();
  await p.keyboard.press('Control+KeyZ');
  check(`${tag} AC-16 Ctrl+Z в поле ввода не отменяет`, (await snap()) === final);
}

// AC-12: каталог реальных моделей с источниками.
const cat = await p.evaluate(() => window.__catalogIds.length);
check('AC-12 каталог загружен', cat > 50, `${cat} предметов`);
console.log(results.join('\n'));
console.log(`\nИтого: ${results.filter((r) => r.startsWith('ok')).length}/${results.length}`);
await b.close();
