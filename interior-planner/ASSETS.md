# Реестр ассетов

Правила — SPEC §12. Набор ниже **технический** (этап 4): не утверждённый каталог (D-07).

| Модель | Файлы | Источник | Автор | Лицензия | Указание авторства | Использование в веб-приложении | Получено |
|---|---|---|---|---|---|---|---|
| Sofa 03 | public/models/sofa_03/ (glTF 1k) | https://polyhaven.com/a/sofa_03 | Poly Haven | CC0 1.0 | не требуется | разрешено | 20.11.2026 |
| Modern Arm Chair 01 | public/models/modern_arm_chair_01/ (glTF 1k) | https://polyhaven.com/a/modern_arm_chair_01 | Vibrant Nordic | CC0 1.0 | не требуется | разрешено | 20.11.2026 |
| Modern Coffee Table 01 | public/models/modern_coffee_table_01/ (glTF 1k) | https://polyhaven.com/a/modern_coffee_table_01 | Amin | CC0 1.0 | не требуется | разрешено | 20.11.2026 |

Загрузка: API `https://api.polyhaven.com/files/<id>` → `gltf.1k`, файлы без изменений. Единицы файлов — метры.

Габариты (`node scripts/measure-model.mjs <gltf>`), см, ширина × глубина × высота:

| Модель | Габариты | Опора в файле |
|---|---|---|
| Sofa 03 | 273,1 × 92,5 × 111,8 | низ y = 0,1 см, центр x/z ≈ 0 |
| Modern Arm Chair 01 | 82,0 × 98,7 × 102,3 | низ y = 0, центр z смещён на −8,2 см |
| Modern Coffee Table 01 | 60,0 × 120,2 × 39,0 | низ y = 0, центр в 0 |

Смещение опоры исправляется при загрузке один раз: центр основания модели совмещается с точкой предмета.
