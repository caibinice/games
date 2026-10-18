/** Repackage the user's existing parking-project vehicle without changing geometry.
 * node games/racer/art/xiaomi-build.mjs --source-root E:/codes/3dSmartParking
 * The source project and its dependencies are read only. No package installation.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = key => {
  const index = process.argv.indexOf(key);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sourceRoot = path.resolve(arg('--source-root') || 'E:/codes/3dSmartParking');
const art = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(arg('--output-dir') || path.join(art, '../public/assets'));
assert.notEqual(outputDir.toLowerCase(), path.join(sourceRoot, 'public/models').toLowerCase());
const require = createRequire(path.join(sourceRoot, 'package.json'));
const { NodeIO, getBounds } = await import(pathToFileURL(require.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(require.resolve('@gltf-transform/extensions')).href);
const sharp = (await import(pathToFileURL(require.resolve('sharp')).href)).default;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha256 = data => createHash('sha256').update(data).digest('hex');
const geometrySignature = root => root.listMeshes().map(mesh => ({
  name: mesh.getName(),
  primitives: mesh.listPrimitives().map(primitive => ({
    mode: primitive.getMode(),
    indices: primitive.getIndices() ? sha256(primitive.getIndices().getArray()) : null,
    attributes: Object.fromEntries(primitive.listSemantics().sort().map(semantic => [semantic, sha256(primitive.getAttribute(semantic).getArray())])),
  })),
}));
const specs = [
  { id: 'desktop', textureSize: 1024, expectedHash: 'b2999fc50266ed789fdc1a5f8c86e5f764e936a6fa8d1475692dc7c14c8bfe4c' },
  { id: 'mobile', textureSize: 512, expectedHash: '470b1c0e6213cc225c457b341dae52bf727155867523559f254075f28d027a31' },
];
const report = {
  version: 1,
  method: 'Preserve geometry, hierarchy, indices, normals and UVs; normalized 5-unit length; PBR material finish; mobile image-only downsampling.',
  sourceProject: sourceRoot,
  sourceProvenance: 'Existing user-specified project asset; no independent upstream author/license/official model designation recorded in that project. Not relabeled CC0 or Xiaomi-official.',
  modelIdentity: 'Blender visual verification shows a two-door GT with a wing-shaped hood badge. The parking project contains no Xiaomi/SU7 identity record; the requested xiaomi filenames are integration aliases, not a certified make/model attribution.',
  forwardAxis: '+Z', upAxis: '+Y', outputLength: 5,
  colorMaterial: 'xiaomi-paint', glassMaterial: 'xiaomi-glass',
  wheelNodes: ['vehicle-wheel-0', 'vehicle-wheel-1', 'vehicle-wheel-2', 'vehicle-wheel-3'],
  sourceAppearanceReference: 'src/app/core/parking-scene.ts styleMaterials: car-body RGB(.24,.62,.75), metallic .85, roughness .85; car-glass alpha .35.',
  assets: [],
};
await mkdir(outputDir, { recursive: true });
for (const spec of specs) {
  const source = path.join(sourceRoot, `public/models/vehicle-${spec.id}-v3.glb`);
  const sourceBytes = await readFile(source);
  assert.equal(sha256(sourceBytes), spec.expectedHash, 'Source changed: inspect before updating its pinned hash.');
  const doc = await io.read(source), root = doc.getRoot(), scene = root.getDefaultScene();
  const sourceGeometry = geometrySignature(root);
  const before = getBounds(scene), base = scene.listChildren()[0];
  const scale = 5 / (before.max[2] - before.min[2]);
  base.setScale([scale, scale, scale]);
  base.setTranslation([
    -(before.min[0] + before.max[0]) / 2 * scale,
    -before.min[1] * scale,
    -(before.min[2] + before.max[2]) / 2 * scale,
  ]);
  for (const material of root.listMaterials()) {
    const original = material.getName();
    material.getExtension('KHR_materials_specular')?.setSpecularFactor(1);
    if (original.includes('car-body')) {
      material.setName('xiaomi-paint').setBaseColorFactor([.24, .62, .75, 1])
        .setMetallicFactor(.68).setRoughnessFactor(spec.id === 'mobile' ? .38 : .3);
    } else if (original.includes('car-glass')) {
      material.setName('xiaomi-glass').setBaseColorFactor([.07, .12, .16, .48])
        .setAlphaMode('BLEND').setMetallicFactor(.08).setRoughnessFactor(.15);
    } else if (original.endsWith('-0')) {
      material.setName('xiaomi-rims').setMetallicFactor(.75).setRoughnessFactor(.32);
    } else if (original.endsWith('-6')) {
      material.setName('xiaomi-tyres').setMetallicFactor(0).setRoughnessFactor(.88);
    } else {
      material.setName('xiaomi-' + original).setMetallicFactor(.08).setRoughnessFactor(.48);
    }
    // Preserve original double-sided surfaces: culling them can expose seams.
    material.setExtras({});
  }
  for (const texture of root.listTextures()) {
    const original = texture.getImage();
    assert.ok(original?.length, 'All images must remain embedded.');
    if (spec.id === 'mobile') {
      const originalSize = await sharp(original).metadata();
      const size = Math.max(originalSize.width, originalSize.height) <= 512 ? 256 : 512;
      texture.setImage(await sharp(original).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, chromaSubsampling: '4:4:4' }).toBuffer()).setMimeType('image/jpeg');
    }
  }
  const output = path.join(outputDir, `xiaomi-${spec.id}.glb`);
  await io.write(output, doc);
  // Read the actual emitted binary again, not just the in-memory document.
  const emitted = await io.read(output), emittedRoot = emitted.getRoot();
  assert.deepEqual(geometrySignature(emittedRoot), sourceGeometry, 'Geometry, UV or normal values changed.');
  const triangleCounts = emittedRoot.listMeshes().map(mesh => ({
    name: mesh.getName(), primitives: mesh.listPrimitives().length,
    triangles: mesh.listPrimitives().reduce((count, primitive) => count + (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3, 0),
  }));
  const textures = await Promise.all(emittedRoot.listTextures().map(async texture => {
    const data = texture.getImage(), meta = await sharp(data).metadata();
    assert.ok(meta.width <= spec.textureSize && meta.height <= spec.textureSize);
    return { name: texture.getName(), width: meta.width, height: meta.height, mimeType: texture.getMimeType(), embedded: true, bytes: data.length, sha256: sha256(data) };
  }));
  const triangles = triangleCounts.reduce((count, mesh) => count + mesh.triangles, 0);
  const primitives = triangleCounts.reduce((count, mesh) => count + mesh.primitives, 0);
  assert.ok(triangles < 50000 && primitives < 20);
  assert.equal(sha256(await readFile(source)), spec.expectedHash, 'Source was modified.');
  const bytes = await readFile(output), bounds = getBounds(emittedRoot.getDefaultScene());
  report.assets.push({
    id: spec.id, sourceFile: source, sourceSha256: spec.expectedHash,
    sourceBytes: sourceBytes.length, file: path.relative(path.dirname(art), output).replaceAll('\\', '/'),
    bytes: bytes.length, sha256: sha256(bytes), triangles, primitives,
    geometryAttributesAndIndicesUnchanged: true,
    drawCallEstimate: `${primitives} single color pass submissions; shadow/depth/post passes are renderer-dependent.`,
    meshes: triangleCounts, materials: emittedRoot.listMaterials().map(material => ({ name: material.getName(), alphaMode: material.getAlphaMode() })),
    textures, sourceBounds: before, bounds, scale,
    dimensions: bounds.max.map((value, index) => value - bounds.min[index]),
    textureBaseRgbaBytes: textures.reduce((count, texture) => count + texture.width * texture.height * 4, 0),
    externalResources: [],
  });
}
await writeFile(path.join(art, 'xiaomi-assets.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.assets.map(({ id, bytes, triangles, primitives, dimensions, textureBaseRgbaBytes, sha256 }) => ({ id, bytes, triangles, primitives, dimensions, textureBaseRgbaBytes, sha256 })), null, 2));
