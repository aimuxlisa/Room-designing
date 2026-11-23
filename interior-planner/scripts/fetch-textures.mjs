// Текстуры Poly Haven (CC0) для отделки: диффузная карта 1k → WebP (качество 82) в public/textures/<id>.webp.
// Печатает JSON-строку на текстуру: id, размер повтора из API (см), средний цвет, байты до/после.
// Запуск: node scripts/fetch-textures.mjs <id> [<id> ...]
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const headers = { 'User-Agent': 'interior-planner-asset-fetch' };
const ids = process.argv.slice(2);
await mkdir('public/textures', { recursive: true });
const hex = (v) => Math.round(v).toString(16).padStart(2, '0');

for (const id of ids) {
  const [files, info] = await Promise.all(
    [`https://api.polyhaven.com/files/${id}`, `https://api.polyhaven.com/info/${id}`].map(async (u) => {
      const r = await fetch(u, { headers });
      if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
      return r.json();
    }),
  );
  // Диффузная карта: Diffuse, иначе первая карта цвета (col_*).
  const key = files.Diffuse ? 'Diffuse' : Object.keys(files).find((k) => /^col/i.test(k));
  const entry = key && files[key]?.['1k']?.jpg;
  if (!entry) throw new Error(`${id}: нет диффузной карты 1k jpg`);
  const res = await fetch(entry.url, { headers });
  const jpg = Buffer.from(await res.arrayBuffer());
  if (jpg.length !== entry.size) throw new Error(`${id}: ${jpg.length} байт, ожидалось ${entry.size}`);
  const webp = await sharp(jpg).webp({ quality: 82 }).toBuffer();
  await writeFile(`public/textures/${id}.webp`, webp);
  const { channels } = await sharp(jpg).stats();
  const [w, h] = info.dimensions ?? [2000, 2000];
  console.log(
    JSON.stringify({
      id,
      name: info.name,
      tileCm: [Math.round(w) / 10, Math.round(h) / 10],
      color: `#${hex(channels[0].mean)}${hex(channels[1].mean)}${hex(channels[2].mean)}`,
      jpg: jpg.length,
      webp: webp.length,
      authors: Object.keys(info.authors ?? {}).join(', '),
      categories: info.categories,
    }),
  );
}
