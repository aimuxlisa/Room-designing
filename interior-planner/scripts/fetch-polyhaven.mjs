// Загрузка моделей Poly Haven (CC0) в public/models/<id>/: glTF 1k со всеми файлами из include.
// Запуск: node scripts/fetch-polyhaven.mjs <id> [<id> ...]. Источник списка — ASSETS.md (этап 13.1).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const headers = { 'User-Agent': 'interior-planner-asset-fetch' };
const ids = process.argv.slice(2);
if (!ids.length) throw new Error('Укажите id моделей Poly Haven');

async function download(url, path, expected) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (expected && buf.length !== expected) throw new Error(`${url}: ${buf.length} байт, ожидалось ${expected}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  return buf.length;
}

let total = 0;
for (const id of ids) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers });
  if (!res.ok) throw new Error(`files/${id}: HTTP ${res.status}`);
  const entry = (await res.json()).gltf?.['1k']?.gltf;
  if (!entry) throw new Error(`${id}: нет glTF 1k`);
  const dir = join('public', 'models', id);
  let bytes = await download(entry.url, join(dir, entry.url.split('/').pop()), entry.size);
  for (const [path, file] of Object.entries(entry.include ?? {})) bytes += await download(file.url, join(dir, path), file.size);
  total += bytes;
  console.log(`${id}\t${bytes}`);
}
console.log(`ИТОГО\t${total}`);
