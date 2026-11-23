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

## Текстуры обоев (этап 12.2)

Роль обоев выполняют ткани Poly Haven (решение пользователя, SPEC §13). Загрузка разрешена пользователем 23.11.2026. Лицензия CC0 1.0 (https://polyhaven.com/license): любое использование, указание авторства не требуется. Файлы — диффузная карта 1k JPG без изменений, `public/textures/`; URL — из API `https://api.polyhaven.com/files/<id>` → `Diffuse.1k.jpg` (у fabric_pattern_05 ключа Diffuse нет — взята `col_01`). Размер повтора — `dimensions` из API, мм.

| Материал | Файл | Источник | Повтор, см | Размер файла, байт | Средний цвет | Получено |
|---|---|---|---|---|---|---|
| Терленка, бежевая | terlenka_diff_1k.jpg | https://polyhaven.com/a/terlenka | 26,57 × 26,63 | 691 195 | #c5ae99 | 23.11.2026 |
| Ёлочка, серая | poly_wool_herringbone_diff_1k.jpg | https://polyhaven.com/a/poly_wool_herringbone | 27,01 × 27,57 | 942 966 | #797571 | 23.11.2026 |
| Клетка виши | gingham_check_diff_1k.jpg | https://polyhaven.com/a/gingham_check | 28,37 × 29,68 | 965 725 | #799184 | 23.11.2026 |
| Шотландка оливковая | fabric_pattern_05_col_01_1k.jpg | https://polyhaven.com/a/fabric_pattern_05 | 50 × 50 | 797 220 | #949785 | 23.11.2026 |
| Вафельный хлопок | waffle_pique_cotton_diff_1k.jpg | https://polyhaven.com/a/waffle_pique_cotton | 28,08 × 27,68 | 764 042 | #e19c04 | 23.11.2026 |
| Жаккард бордовый | quatrefoil_jacquard_fabric_diff_1k.jpg | https://polyhaven.com/a/quatrefoil_jacquard_fabric | 28,01 × 28,38 | 581 799 | #930320 | 23.11.2026 |

Всего 4 742 947 байт. Карты рельефа (nor_gl) не загружались. Средний цвет посчитан в браузере по уменьшенному изображению 64 × 64 и используется для полосы на плане.
