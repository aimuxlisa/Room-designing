// Оптимизация моделей (этап 13.3): glTF 1k → один GLB с геометрией meshopt и текстурами WebP 1024.
// Геометрия не упрощается; габариты до и после сравниваются (допуск 0,5 см), исходники удаляются после проверки.
// Запуск: node scripts/optimize-models.mjs <id> [<id> ...]  (исходники: node scripts/fetch-polyhaven.mjs <id>)
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const dirSize = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);

async function sizeCm(file) {
  const doc = await io.read(file);
  const { min, max } = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
  return [max[0] - min[0], max[2] - min[2], max[1] - min[1]].map((m) => Math.round(m * 1000) / 10);
}

const cli = join('node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
for (const id of process.argv.slice(2)) {
  const dir = join('public', 'models', id);
  const source = readdirSync(dir).find((f) => f.endsWith('.gltf'));
  if (!source) throw new Error(`${id}: нет исходного .gltf`);
  const out = join(dir, `${id}.glb`);
  const before = dirSize(dir);
  execFileSync(
    process.execPath,
    [cli, 'optimize', join(dir, source), out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false'],
    { stdio: 'pipe' },
  );
  const [a, b] = [await sizeCm(join(dir, source)), await sizeCm(out)];
  const drift = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  if (drift > 0.5) throw new Error(`${id}: габариты изменились на ${drift} см (${a} → ${b})`);
  for (const f of readdirSync(dir)) if (f !== `${id}.glb`) rmSync(join(dir, f), { recursive: true });
  const after = statSync(out).size;
  console.log(`${id}\t${before}\t${after}\t${Math.round((100 * after) / before)}%\t${b.join(' × ')}\tΔ ${drift}`);
}
