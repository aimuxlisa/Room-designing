# Реестр ассетов

Правила — SPEC §12. Рабочий каталог этапа 13 (D-07): 39 изделий — 21 модель Poly Haven и 18 собственных; расширен 23.11.2026 до 101 изделия (D-24, раздел «Расширение каталога» ниже). Перечень и загрузка утверждены пользователем 23.11.2026 («давай делай его» в ответ на предложенный план 13.1; черновик — docs/stage-13/candidates.md). Код каталога — `src/catalog/catalog.ts`.

## Модели Poly Haven

Лицензия Poly Haven — CC0 1.0 (https://polyhaven.com/license): любое использование, в том числе коммерческое; указание авторства не требуется. Автор — из API `https://api.polyhaven.com/info/<id>`.

| Предмет | id | Источник | Автор | Лицензия | Указание авторства | Использование в веб-приложении | Габариты, см (Ш × Г × В) | glTF 1k → GLB, байт | Получено |
|---|---|---|---|---|---|---|---|---|---|
| Диван угловой | sofa_03 | https://polyhaven.com/a/sofa_03 | Fran Calvente | CC0 1.0 | не требуется | разрешено | 273,1 × 92,5 × 111,8 | 668 285 → 298 112 | 20.11.2026 |
| Диван | sofa_02 | https://polyhaven.com/a/sofa_02 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 180,7 × 81,8 × 71,0 | 427 171 → 169 304 | 23.11.2026 |
| Кресло | modern_arm_chair_01 | https://polyhaven.com/a/modern_arm_chair_01 | Vibrant Nordic | CC0 1.0 | не требуется | разрешено | 82,0 × 98,7 × 102,3 | 2 698 299 → 326 416 | 20.11.2026 |
| Кресло классическое | ArmChair_01 | https://polyhaven.com/a/ArmChair_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 84,8 × 76,6 × 106,5 | 769 144 → 425 524 | 23.11.2026 |
| Кресло зелёное | GreenChair_01 | https://polyhaven.com/a/GreenChair_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 67,3 × 66,4 × 105,9 | 608 044 → 281 156 | 23.11.2026 |
| Журнальный стол | modern_coffee_table_01 | https://polyhaven.com/a/modern_coffee_table_01 | Amin | CC0 1.0 | не требуется | разрешено | 60,0 × 120,2 × 39,0 | 1 331 452 → 173 288 | 20.11.2026 |
| Журнальный стол большой | CoffeeTable_01 | https://polyhaven.com/a/CoffeeTable_01 | Fernando Quinn | CC0 1.0 | не требуется | разрешено | 154,0 × 97,3 × 52,3 | 957 812 → 367 172 | 23.11.2026 |
| Люстра | Chandelier_02 | https://polyhaven.com/a/Chandelier_02 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 67,9 × 61,9 × 84,8 | 1 182 054 → 459 396 | 23.11.2026 |
| Настольная лампа | vintage_oil_lamp | https://polyhaven.com/a/vintage_oil_lamp | Monsta3D | CC0 1.0 | не требуется | разрешено | 22,0 × 22,0 × 80,2 | 2 070 002 → 283 792 | 23.11.2026 |
| Кровать двуспальная | GothicBed_01 | https://polyhaven.com/a/GothicBed_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 149,4 × 204,0 × 153,4 | 1 155 213 → 407 080 | 23.11.2026 |
| Тумба прикроватная | ClassicNightstand_01 | https://polyhaven.com/a/ClassicNightstand_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 56,8 × 42,4 × 70,0 | 444 940 → 162 084 | 23.11.2026 |
| Тумба крашеная | painted_wooden_nightstand | https://polyhaven.com/a/painted_wooden_nightstand | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 50,5 × 50,9 × 61,6 | 2 151 507 → 274 112 | 23.11.2026 |
| Комод | GothicCommode_01 | https://polyhaven.com/a/GothicCommode_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 120,1 × 58,1 × 121,2 | 604 161 → 218 364 | 23.11.2026 |
| Пуф | Ottoman_01 | https://polyhaven.com/a/Ottoman_01 | Caspian Fortune | CC0 1.0 | не требуется | разрешено | 88,5 × 62,1 × 62,4 | 652 112 → 319 880 | 23.11.2026 |
| Стол круглый | round_wooden_table_02 | https://polyhaven.com/a/round_wooden_table_02 | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 79,6 × 79,6 × 74,6 | 1 921 292 → 232 892 | 23.11.2026 |
| Стул | dining_chair_02 | https://polyhaven.com/a/dining_chair_02 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 43,4 × 57,6 × 97,3 | 921 075 → 291 320 | 23.11.2026 |
| Плита электрическая | electric_stove | https://polyhaven.com/a/electric_stove | Kuutti Siitonen | CC0 1.0 | не требуется | разрешено | 50,3 × 64,8 × 85,9 | 2 045 696 → 292 668 | 23.11.2026 |
| Подвесной светильник | modern_ceiling_lamp_01 | https://polyhaven.com/a/modern_ceiling_lamp_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 43,2 × 43,2 × 95,2 | 436 065 → 157 844 | 23.11.2026 |
| Консоль | ClassicConsole_01 | https://polyhaven.com/a/ClassicConsole_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 154,3 × 58,9 × 94,9 | 740 693 → 341 804 | 23.11.2026 |
| Стеллаж | Shelf_01 | https://polyhaven.com/a/Shelf_01 | Gabriel Radić | CC0 1.0 | не требуется | разрешено | 100,3 × 25,7 × 208,0 | 605 448 → 324 352 | 23.11.2026 |
| Шкаф высокий | painted_wooden_cabinet_02 | https://polyhaven.com/a/painted_wooden_cabinet_02 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 99,7 × 72,3 × 256,9 | 1 596 230 → 153 660 | 23.11.2026 |

Всего 23 986 695 → 5 960 220 байт (25 %). Файлы: `public/models/<id>/<id>.glb`.

Конвейер (воспроизводимый, SPEC §12):

1. Загрузка: `node scripts/fetch-polyhaven.mjs <id> …` — API `files/<id>` → `gltf.1k` со всеми файлами `include`; размер каждого файла сверяется с API.
2. Оптимизация: `node scripts/optimize-models.mjs <id> …` — `gltf-transform optimize` (@gltf-transform/cli 4.5.1): один GLB, геометрия meshopt, текстуры WebP 1024, без упрощения геометрии. Габариты до и после сравниваются (допуск 0,5 см; фактически ≤ 0,1 см), исходники после проверки удаляются — их можно получить шагом 1.
3. Габариты — по границам сцены (`getBounds`), единицы файлов — метры. Опора и центр нормализуются при загрузке один раз: центр основания модели совмещается с точкой предмета. Лицевая сторона моделей — +Z (проверено по превью).
4. Превью: `node scripts/capture-previews.mjs` при запущенном dev-сервере → `public/previews/<id>.jpg` (160 × 120).

Blender на компьютере не установлен; SPEC §12 допускает эквивалентный конвейер — gltf-transform.

## Собственные модели

Ванна (`bathtub`), Душевой уголок (`shower`), Тумба с раковиной (`vanity_sink`), Полотенцесушитель (`towel_rail`), Унитаз (`toilet`), Раковина малая (`small_sink`), Шкафчик навесной (`wall_cabinet_wc`), Холодильник (`fridge`), Тумба с мойкой (`kitchen_sink_cabinet`), Тумба кухонная (`kitchen_base_cabinet`), Шкаф навесной кухонный (`kitchen_wall_cabinet`), Шкаф платяной (`wardrobe`), Торшер (`floor_lamp`), Настольная лампа с абажуром (`table_lamp`, этап 21), Тумба под ТВ (`tv_stand`), Ковёр (`rug`), Вешалка напольная (`coat_rack`), Обувница (`shoe_cabinet`), Бра (`wall_sconce`). Детали (коробки, цилиндры, тор, конус) и материалы — `src/catalog/ownModels.ts`; габариты вычисляются из деталей (`ownModelFrame`), поэтому размер в каталоге совпадает с геометрией. Лицензия — собственная. Сделаны по решению пользователя закрыть пробелы Poly Haven (нет сантехники, кухонных модулей, платяного шкафа, торшера, ковров, вешалки и обувницы); светильники собственные по D-11.

## Текстуры обоев (этап 12.2)

Роль обоев выполняют ткани Poly Haven (решение пользователя, SPEC §13). Загрузка разрешена пользователем 23.11.2026. Лицензия CC0 1.0 (https://polyhaven.com/license): любое использование, указание авторства не требуется. Файлы — диффузная карта 1k, переведена в WebP (23.11.2026), `public/textures/<id>.webp`; URL — из API `https://api.polyhaven.com/files/<id>` → `Diffuse.1k.jpg` (у fabric_pattern_05 ключа Diffuse нет — взята `col_01`). Размер повтора — `dimensions` из API, мм.

| Материал | Файл | Источник | Повтор, см | Размер файла, байт | Средний цвет | Получено |
|---|---|---|---|---|---|---|
| Терленка, бежевая | terlenka.webp | https://polyhaven.com/a/terlenka | 26,57 × 26,63 | 691 195 | #c5ae99 | 23.11.2026 |
| Ёлочка, серая | poly_wool_herringbone.webp | https://polyhaven.com/a/poly_wool_herringbone | 27,01 × 27,57 | 942 966 | #797571 | 23.11.2026 |
| Клетка виши | gingham_check.webp | https://polyhaven.com/a/gingham_check | 28,37 × 29,68 | 965 725 | #799184 | 23.11.2026 |
| Шотландка оливковая | fabric_pattern_05.webp | https://polyhaven.com/a/fabric_pattern_05 | 50 × 50 | 797 220 | #949785 | 23.11.2026 |
| Вафельный хлопок | waffle_pique_cotton.webp | https://polyhaven.com/a/waffle_pique_cotton | 28,08 × 27,68 | 764 042 | #e19c04 | 23.11.2026 |
| Жаккард бордовый | quatrefoil_jacquard_fabric.webp | https://polyhaven.com/a/quatrefoil_jacquard_fabric | 28,01 × 28,38 | 581 799 | #930320 | 23.11.2026 |

Всего 4 742 947 байт. Карты рельефа (nor_gl) не загружались. Средний цвет посчитан в браузере по уменьшенному изображению 64 × 64 и используется для полосы на плане.

## Расширение каталога (D-24), 23.11.2026

Запрос пользователя: «скачай больше товаров мебели, декоров, растений… занавески, телек, картинки». Загрузка разрешена этим запросом. Конвейер тот же (fetch-polyhaven → optimize-models, проверка габаритов ≤ 0,5 см). Исключены: chess_set (после упаковки габариты 108 × 108 × 200 см вместо 55 × 55 × 11 — проверка конвейера остановила), vintage_microwave (масштаб модели — 107 см шириной). Повёрнуты на −90° по превью (modelYawDeg): standing_picture_frame_01/02, wooden_display_shelves_01.

| Предмет | id | Источник | Автор | Лицензия | Указание авторства | Использование в веб-приложении | Габариты, см (Ш × Г × В в файле) | glTF 1k → GLB, байт | Получено |
|---|---|---|---|---|---|---|---|---|---|
| ceramic_vase_01 | ceramic_vase_01 | https://polyhaven.com/a/ceramic_vase_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 20,4 × 20,4 × 40 | 418 457 → 104 256 | 23.11.2026 |
| ceramic_vase_02 | ceramic_vase_02 | https://polyhaven.com/a/ceramic_vase_02 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 21,8 × 21,8 × 30,9 | 750 161 → 290 352 | 23.11.2026 |
| ceramic_vase_03 | ceramic_vase_03 | https://polyhaven.com/a/ceramic_vase_03 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 11,2 × 11,2 × 41,4 | 765 159 → 313 532 | 23.11.2026 |
| ceramic_vase_04 | ceramic_vase_04 | https://polyhaven.com/a/ceramic_vase_04 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 18,1 × 18,1 × 34,2 | 596 053 → 198 180 | 23.11.2026 |
| antique_ceramic_vase_01 | antique_ceramic_vase_01 | https://polyhaven.com/a/antique_ceramic_vase_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 25,5 × 25,5 × 44 | 525 941 → 180 212 | 23.11.2026 |
| brass_vase_01 | brass_vase_01 | https://polyhaven.com/a/brass_vase_01 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 22,7 × 22,7 × 69,2 | 842 226 → 244 152 | 23.11.2026 |
| brass_vase_02 | brass_vase_02 | https://polyhaven.com/a/brass_vase_02 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 21 × 21 × 52,9 | 1 830 716 → 251 228 | 23.11.2026 |
| marble_bust_01 | marble_bust_01 | https://polyhaven.com/a/marble_bust_01 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 27,2 × 30 × 51,5 | 898 283 → 358 312 | 23.11.2026 |
| horse_statue_01 | horse_statue_01 | https://polyhaven.com/a/horse_statue_01 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 16,3 × 10,8 × 22 | 1 283 596 → 359 504 | 23.11.2026 |
| carved_wooden_elephant | carved_wooden_elephant | https://polyhaven.com/a/carved_wooden_elephant | Greg Zaal | CC0 1.0 | не требуется | разрешено | 10,9 × 5,8 × 9,6 | 1 863 924 → 315 940 | 23.11.2026 |
| concrete_cat_statue | concrete_cat_statue | https://polyhaven.com/a/concrete_cat_statue | Rico Cilliers, Riley Queen | CC0 1.0 | не требуется | разрешено | 15,3 × 25 × 28,3 | 3 098 337 → 721 500 | 23.11.2026 |
| bronze_shark_statue | bronze_shark_statue | https://polyhaven.com/a/bronze_shark_statue | Tina | CC0 1.0 | не требуется | разрешено | 35,2 × 76 × 43,2 | 2 070 550 → 288 544 | 23.11.2026 |
| book_encyclopedia_set_01 | book_encyclopedia_set_01 | https://polyhaven.com/a/book_encyclopedia_set_01 | John Malcolm | CC0 1.0 | не требуется | разрешено | 55,1 × 16,3 × 23,7 | 3 261 046 → 717 224 | 23.11.2026 |
| wooden_bowl_01 | wooden_bowl_01 | https://polyhaven.com/a/wooden_bowl_01 | Oliver Harries | CC0 1.0 | не требуется | разрешено | 31,3 × 30,9 × 9,4 | 1 823 237 → 318 184 | 23.11.2026 |
| carved_wooden_plate | carved_wooden_plate | https://polyhaven.com/a/carved_wooden_plate | Jan Martens | CC0 1.0 | не требуется | разрешено | 27,2 × 26,9 × 3,8 | 1 564 238 → 163 600 | 23.11.2026 |
| tea_set_01 | tea_set_01 | https://polyhaven.com/a/tea_set_01 | James Ray Cock, Rico Cilliers, Jurita Burger | CC0 1.0 | не требуется | разрешено | 91,8 × 48,4 × 16,5 | 2 282 591 → 382 340 | 23.11.2026 |
| wooden_candlestick | wooden_candlestick | https://polyhaven.com/a/wooden_candlestick | Josh Dean | CC0 1.0 | не требуется | разрешено | 9,7 × 9,9 × 22 | 8 429 072 → 1 432 052 | 23.11.2026 |
| hanging_picture_frame_01 | hanging_picture_frame_01 | https://polyhaven.com/a/hanging_picture_frame_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 59,4 × 1,6 × 84,1 | 397 466 → 107 896 | 23.11.2026 |
| hanging_picture_frame_02 | hanging_picture_frame_02 | https://polyhaven.com/a/hanging_picture_frame_02 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 75,2 × 3,3 × 50 | 696 031 → 212 484 | 23.11.2026 |
| hanging_picture_frame_03 | hanging_picture_frame_03 | https://polyhaven.com/a/hanging_picture_frame_03 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 38,5 × 3,2 × 50,2 | 1 262 176 → 405 728 | 23.11.2026 |
| fancy_picture_frame_01 | fancy_picture_frame_01 | https://polyhaven.com/a/fancy_picture_frame_01 | Rob Tuytel, Rico Cilliers | CC0 1.0 | не требуется | разрешено | 60,3 × 2 × 46,4 | 741 506 → 336 772 | 23.11.2026 |
| fancy_picture_frame_02 | fancy_picture_frame_02 | https://polyhaven.com/a/fancy_picture_frame_02 | Rob Tuytel, Rico Cilliers | CC0 1.0 | не требуется | разрешено | 66,1 × 8,9 × 77,1 | 1 728 120 → 681 404 | 23.11.2026 |
| standing_picture_frame_01 | standing_picture_frame_01 | https://polyhaven.com/a/standing_picture_frame_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 10 × 20,1 × 25 | 447 425 → 142 992 | 23.11.2026 |
| standing_picture_frame_02 | standing_picture_frame_02 | https://polyhaven.com/a/standing_picture_frame_02 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 10,2 × 21,7 × 26,6 | 569 572 → 200 876 | 23.11.2026 |
| ornate_mirror_01 | ornate_mirror_01 | https://polyhaven.com/a/ornate_mirror_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 48,7 × 2,6 × 74,4 | 677 241 → 232 040 | 23.11.2026 |
| wall_clock | wall_clock | https://polyhaven.com/a/wall_clock | PierreB3D | CC0 1.0 | не требуется | разрешено | 32 × 4,7 × 32 | 1 564 880 → 177 628 | 23.11.2026 |
| mantel_clock_01 | mantel_clock_01 | https://polyhaven.com/a/mantel_clock_01 | Yann Kervran, Rico Cilliers | CC0 1.0 | не требуется | разрешено | 34,2 × 12,6 × 16 | 2 427 220 → 380 888 | 23.11.2026 |
| alarm_clock_01 | alarm_clock_01 | https://polyhaven.com/a/alarm_clock_01 | Yann Kervran, James Ray Cock | CC0 1.0 | не требуется | разрешено | 13,2 × 6,7 × 17,4 | 1 657 651 → 247 164 | 23.11.2026 |
| vintage_grandfather_clock_01 | vintage_grandfather_clock_01 | https://polyhaven.com/a/vintage_grandfather_clock_01 | Yann Kervran, James Ray Cock | CC0 1.0 | не требуется | разрешено | 62,6 × 42,7 × 219,1 | 2 362 182 → 367 176 | 23.11.2026 |
| potted_plant_01 | potted_plant_01 | https://polyhaven.com/a/potted_plant_01 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 58,7 × 63,4 × 135 | 6 325 139 → 1 750 072 | 23.11.2026 |
| potted_plant_02 | potted_plant_02 | https://polyhaven.com/a/potted_plant_02 | Rico Cilliers | CC0 1.0 | не требуется | разрешено | 70,1 × 65,7 × 84,1 | 2 634 698 → 890 828 | 23.11.2026 |
| potted_plant_04 | potted_plant_04 | https://polyhaven.com/a/potted_plant_04 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 16,8 × 18,5 × 26,7 | 2 122 625 → 399 744 | 23.11.2026 |
| Television_01 | Television_01 | https://polyhaven.com/a/Television_01 | Gabriel Radić | CC0 1.0 | не требуется | разрешено | 60 × 47,1 × 45,7 | 531 294 → 217 156 | 23.11.2026 |
| television_02 | television_02 | https://polyhaven.com/a/television_02 | Benny Weimer | CC0 1.0 | не требуется | разрешено | 40 × 35 × 41,1 | 1 239 955 → 151 468 | 23.11.2026 |
| boombox | boombox | https://polyhaven.com/a/boombox | Thomas Paul Mouilleron | CC0 1.0 | не требуется | разрешено | 72,4 × 18,6 × 47 | 3 068 296 → 493 696 | 23.11.2026 |
| gaming_console | gaming_console | https://polyhaven.com/a/gaming_console | Sean Buckley | CC0 1.0 | не требуется | разрешено | 32,5 × 31,9 × 10 | 2 979 450 → 499 592 | 23.11.2026 |
| ceiling_fan | ceiling_fan | https://polyhaven.com/a/ceiling_fan | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 146,3 × 146,3 × 51,6 | 1 872 498 → 267 660 | 23.11.2026 |
| Sofa_01 | Sofa_01 | https://polyhaven.com/a/Sofa_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 157,1 × 65,8 × 79,7 | 517 935 → 207 592 | 23.11.2026 |
| chinese_sofa | chinese_sofa | https://polyhaven.com/a/chinese_sofa | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 228,5 × 96,9 × 86 | 1 572 057 → 169 536 | 23.11.2026 |
| Rockingchair_01 | Rockingchair_01 | https://polyhaven.com/a/Rockingchair_01 | Jorge Camacho | CC0 1.0 | не требуется | разрешено | 70,8 × 83,4 × 99,5 | 804 765 → 290 500 | 23.11.2026 |
| side_table_01 | side_table_01 | https://polyhaven.com/a/side_table_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 55 × 45 × 55,1 | 505 268 → 189 756 | 23.11.2026 |
| small_wooden_table_01 | small_wooden_table_01 | https://polyhaven.com/a/small_wooden_table_01 | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 91,6 × 44 × 53,3 | 414 763 → 143 104 | 23.11.2026 |
| coffee_table_round_01 | coffee_table_round_01 | https://polyhaven.com/a/coffee_table_round_01 | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 130,1 × 130,1 × 49,1 | 1 563 153 → 193 884 | 23.11.2026 |
| modern_coffee_table_02 | modern_coffee_table_02 | https://polyhaven.com/a/modern_coffee_table_02 | Amin | CC0 1.0 | не требуется | разрешено | 119,9 × 120 × 36,9 | 2 955 725 → 484 332 | 23.11.2026 |
| WoodenTable_03 | WoodenTable_03 | https://polyhaven.com/a/WoodenTable_03 | Gabriel Radić | CC0 1.0 | не требуется | разрешено | 132,7 × 57,5 × 83 | 638 291 → 274 312 | 23.11.2026 |
| drawer_cabinet | drawer_cabinet | https://polyhaven.com/a/drawer_cabinet | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 114,1 × 48,8 × 188,1 | 1 143 429 → 317 280 | 23.11.2026 |
| GothicCabinet_01 | GothicCabinet_01 | https://polyhaven.com/a/GothicCabinet_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 171,9 × 111,7 × 236,1 | 1 015 446 → 359 804 | 23.11.2026 |
| wooden_display_shelves_01 | wooden_display_shelves_01 | https://polyhaven.com/a/wooden_display_shelves_01 | James Ray Cock | CC0 1.0 | не требуется | разрешено | 37,1 × 107,8 × 155,6 | 471 129 → 171 068 | 23.11.2026 |
| chinese_console_table | chinese_console_table | https://polyhaven.com/a/chinese_console_table | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 172 × 33,9 × 66,1 | 2 792 195 → 489 220 | 23.11.2026 |
| chinese_stool | chinese_stool | https://polyhaven.com/a/chinese_stool | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 59,9 × 50,6 × 63,1 | 1 793 116 → 173 936 | 23.11.2026 |
| metal_stool_02 | metal_stool_02 | https://polyhaven.com/a/metal_stool_02 | Ulan Cabanilla | CC0 1.0 | не требуется | разрешено | 44,8 × 47,3 × 45,8 | 2 540 986 → 419 332 | 23.11.2026 |
| Chandelier_01 | Chandelier_01 | https://polyhaven.com/a/Chandelier_01 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 74,6 × 81,6 × 79,8 | 1 306 295 → 424 276 | 23.11.2026 |
| Chandelier_03 | Chandelier_03 | https://polyhaven.com/a/Chandelier_03 | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 78 × 78,5 × 104,1 | 1 364 013 → 498 656 | 23.11.2026 |
| chinese_chandelier | chinese_chandelier | https://polyhaven.com/a/chinese_chandelier | Kirill Sannikov | CC0 1.0 | не требуется | разрешено | 87,8 × 87,9 × 74,8 | 2 159 286 → 349 840 | 23.11.2026 |
| desk_lamp_arm_01 | desk_lamp_arm_01 | https://polyhaven.com/a/desk_lamp_arm_01 | Yann Kervran, Kuutti Siitonen | CC0 1.0 | не требуется | разрешено | 20,2 × 61,4 × 89,3 | 2 875 984 → 527 168 | 23.11.2026 |
| hanging_industrial_lamp | hanging_industrial_lamp | https://polyhaven.com/a/hanging_industrial_lamp | Kuutti Siitonen | CC0 1.0 | не требуется | разрешено | 55 × 55 × 135,5 | 3 243 654 → 505 164 | 23.11.2026 |

Всего 97 286 502 → 20 991 136 байт.

Собственные модели (D-24): Шторы (`curtains`), Тюль (`tulle`), Ковёр круглый (`rug_round`), Ковровая дорожка (`rug_runner`), Телевизор плоский 55″ на подставке (`tv_flat`) и настенный (`tv_wall`) — `src/catalog/ownModels.ts`.

## Текстуры пола и стен (D-25), 23.11.2026

Запрос пользователя: «полы, выбор пола, обои». Диффузная карта 1k JPG из API (Diffuse, иначе col_*) → WebP качество 82 (`node scripts/fetch-textures.mjs <id> …`, sharp); размер повтора — `dimensions` API; средний цвет — по пикселям текстуры. Лицензия CC0 1.0. Прежние 6 тканей переведены в WebP тем же способом.

| Текстура | Файл | Источник | Автор | Повтор, см | JPG → WebP, байт | Средний цвет | Получено |
|---|---|---|---|---|---|---|---|
| Laminate Floor | laminate_floor.webp | https://polyhaven.com/a/laminate_floor | Dario Barresi, Dimitrios Savva | 200 × 200 | 525 944 → 54 988 | #957345 | 23.11.2026 |
| Laminate Floor 02 | laminate_floor_02.webp | https://polyhaven.com/a/laminate_floor_02 | Dario Barresi, Charlotte Baglioni | 170 × 170 | 721 641 → 145 440 | #9b8063 | 23.11.2026 |
| Laminate Floor 03 | laminate_floor_03.webp | https://polyhaven.com/a/laminate_floor_03 | Dario Barresi, Charlotte Baglioni | 208 × 208 | 701 368 → 115 556 | #9a7248 | 23.11.2026 |
| Herringbone Parquet | herringbone_parquet.webp | https://polyhaven.com/a/herringbone_parquet | Jenelle van Heerden, Sergej Majboroda | 340 × 340 | 829 046 → 166 064 | #93704d | 23.11.2026 |
| Diagonal Parquet | diagonal_parquet.webp | https://polyhaven.com/a/diagonal_parquet | Jenelle van Heerden, Sergej Majboroda | 236 × 236 | 734 933 → 105 978 | #a46636 | 23.11.2026 |
| Rectangular Parquet | rectangular_parquet.webp | https://polyhaven.com/a/rectangular_parquet | Jenelle van Heerden, Sergej Majboroda | 225 × 225 | 632 054 → 79 966 | #775c33 | 23.11.2026 |
| Oak Wood Planks | oak_wood_planks.webp | https://polyhaven.com/a/oak_wood_planks | Dimitrios Savva | 120 × 120 | 696 814 → 117 420 | #a27554 | 23.11.2026 |
| Wood Floor | wood_floor.webp | https://polyhaven.com/a/wood_floor | Dimitrios Savva | 170 × 170 | 734 493 → 129 764 | #806042 | 23.11.2026 |
| White Planks Clean | white_planks_clean.webp | https://polyhaven.com/a/white_planks_clean | Rob Tuytel | 180 × 180 | 473 124 → 25 326 | #b4a69d | 23.11.2026 |
| Dark Wooden Planks | dark_wooden_planks.webp | https://polyhaven.com/a/dark_wooden_planks | Amal Kumar | 200 × 200 | 701 221 → 125 408 | #534a3f | 23.11.2026 |
| Floor Tiles 06 | floor_tiles_06.webp | https://polyhaven.com/a/floor_tiles_06 | Rob Tuytel | 300 × 300 | 356 257 → 71 990 | #796f6b | 23.11.2026 |
| Interior Tiles | interior_tiles.webp | https://polyhaven.com/a/interior_tiles | Charlotte Baglioni | 190 × 190 | 694 562 → 105 868 | #aa9884 | 23.11.2026 |
| Marble 01 | marble_01.webp | https://polyhaven.com/a/marble_01 | Rob Tuytel | 150 × 150 | 305 029 → 58 852 | #b19d7a | 23.11.2026 |
| Marble Mosaic Tiles | marble_mosaic_tiles.webp | https://polyhaven.com/a/marble_mosaic_tiles | Amal Kumar | 200 × 200 | 960 485 → 256 150 | #816d5e | 23.11.2026 |
| Terrazzo Tiles | terrazzo_tiles.webp | https://polyhaven.com/a/terrazzo_tiles | Amal Kumar | 200 × 200 | 1 166 107 → 361 696 | #896d57 | 23.11.2026 |
| Terracotta Floor Tiles | terracotta_floor_tiles.webp | https://polyhaven.com/a/terracotta_floor_tiles | Dimitrios Savva | 208 × 208 | 649 304 → 51 260 | #4d271a | 23.11.2026 |
| Square Tiles 02 | square_tiles_02.webp | https://polyhaven.com/a/square_tiles_02 | Charlotte Baglioni | 240 × 240 | 802 181 → 179 420 | #504942 | 23.11.2026 |
| Granite Tile | granite_tile.webp | https://polyhaven.com/a/granite_tile | Charlotte Baglioni | 230 × 230 | 676 597 → 122 594 | #4e4e4f | 23.11.2026 |
| Linoleum Brown | linoleum_brown.webp | https://polyhaven.com/a/linoleum_brown | Rob Tuytel | 200 × 200 | 684 269 → 127 018 | #997a59 | 23.11.2026 |
| Curly Teddy Natural | curly_teddy_natural.webp | https://polyhaven.com/a/curly_teddy_natural | colormass, Rico Cilliers | 33,6 × 33,1 | 673 494 → 105 090 | #e9d3bb | 23.11.2026 |
| Wool Boucle | wool_boucle.webp | https://polyhaven.com/a/wool_boucle | colormass, Rico Cilliers | 31,5 × 39 | 1 284 379 → 366 520 | #766d61 | 23.11.2026 |
| Caban | caban.webp | https://polyhaven.com/a/caban | colormass, Rico Cilliers | 27,4 × 27,3 | 715 554 → 87 664 | #ce6604 | 23.11.2026 |
| Long White Tiles | long_white_tiles.webp | https://polyhaven.com/a/long_white_tiles | Jenelle van Heerden, Sergej Majboroda | 127 × 127 | 619 644 → 73 132 | #cdc6b6 | 23.11.2026 |
| Rounded Square Tiled Wall | rounded_square_tiled_wall.webp | https://polyhaven.com/a/rounded_square_tiled_wall | Charlotte Baglioni | 200 × 200 | 706 150 → 127 314 | #857665 | 23.11.2026 |
| Stone Tile Wall | stone_tile_wall.webp | https://polyhaven.com/a/stone_tile_wall | Charlotte Baglioni | 200 × 200 | 640 274 → 102 630 | #aaa5a0 | 23.11.2026 |
| Plastered Wall | plastered_wall.webp | https://polyhaven.com/a/plastered_wall | Amal Kumar | 200 × 200 | 617 080 → 96 262 | #b0a89c | 23.11.2026 |
| White Stucco | white_stucco.webp | https://polyhaven.com/a/white_stucco | Amal Kumar | 199,8 × 199,8 | 557 550 → 58 002 | #d7d3d0 | 23.11.2026 |
| Patterned Plaster Wall | patterned_plaster_wall.webp | https://polyhaven.com/a/patterned_plaster_wall | Amal Kumar | 180 × 180 | 899 541 → 225 306 | #b59a85 | 23.11.2026 |
| Brick Wall 13 | brick_wall_13.webp | https://polyhaven.com/a/brick_wall_13 | Rob Tuytel | 200 × 200 | 729 931 → 120 316 | #7f776c | 23.11.2026 |
| Whitewashed Brick | whitewashed_brick.webp | https://polyhaven.com/a/whitewashed_brick | Charlotte Baglioni | 200 × 200 | 844 123 → 197 396 | #a6998c | 23.11.2026 |
| Red Brick | red_brick.webp | https://polyhaven.com/a/red_brick | Rob Tuytel | 140 × 140 | 766 044 → 119 418 | #8e6750 | 23.11.2026 |
| Fabric Pattern 07 | fabric_pattern_07.webp | https://polyhaven.com/a/fabric_pattern_07 | Rob Tuytel | 40 × 40 | 887 747 → 417 088 | #5d7173 | 23.11.2026 |
| Rough Linen | rough_linen.webp | https://polyhaven.com/a/rough_linen | colormass, Rico Cilliers | 27,1 × 27,1 | 835 801 → 234 840 | #91abcd | 23.11.2026 |
| Curly Teddy Checkered | curly_teddy_checkered.webp | https://polyhaven.com/a/curly_teddy_checkered | colormass, Rico Cilliers | 56,2 × 47,4 | 696 159 → 167 030 | #8e9b90 | 23.11.2026 |

Всего 24 518 900 → 4 898 766 байт.
