# Планировщик квартиры

Требования: Node.js 22.12+ (проверено на 22.16.0), npm, системные Google Chrome и Microsoft Edge (для браузерных проверок).
Документы проекта: `../PRD-interior-planner.md`, `../SPEC.md`, `../Tasks.md`.

Все команды выполняются в папке `interior-planner` (здесь лежит package.json):

| Действие | Команда |
|---|---|
| Установка зависимостей по lock-файлу | `npm ci` |
| Запуск для разработки (http://localhost:5173) | `npm run dev` |
| Проверка типов | `npm run typecheck` |
| Модульные тесты (Vitest) | `npm test` |
| Браузерные проверки (Playwright, Chrome и Edge) | `npm run e2e -- --workers=1` |
| Сборка | `npm run build` |

Стек: React 19.3, TypeScript 7.0, Vite 8.3, Three.js 0.187, React Three Fiber 9.8, Drei 10.7, Zustand 5.1, Vitest 5.1, Playwright 1.65.
