// Габариты glTF-модели по min/max атрибута POSITION с учётом матриц узлов.
// Запуск: node scripts/measure-model.mjs public/models/<id>/<id>.gltf
import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

const file = process.argv[2];
const gltf = JSON.parse(readFileSync(file, 'utf8'));
const box = new Box3();

function localMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3(...(node.translation ?? [0, 0, 0])),
    new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new Vector3(...(node.scale ?? [1, 1, 1])),
  );
}

function visit(index, parent) {
  const node = gltf.nodes[index];
  const world = parent.clone().multiply(localMatrix(node));
  if (node.mesh !== undefined) {
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      const local = new Box3(new Vector3(...acc.min), new Vector3(...acc.max));
      box.union(local.applyMatrix4(world));
    }
  }
  for (const child of node.children ?? []) visit(child, world);
}

for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new Matrix4());
const size = box.getSize(new Vector3());
const cm = (m) => Math.round(m * 1000) / 10;
console.log(JSON.stringify({
  file,
  sizeCm: { widthCm: cm(size.x), heightCm: cm(size.y), depthCm: cm(size.z) },
  minCm: { x: cm(box.min.x), y: cm(box.min.y), z: cm(box.min.z) },
  maxCm: { x: cm(box.max.x), y: cm(box.max.y), z: cm(box.max.z) },
}));
