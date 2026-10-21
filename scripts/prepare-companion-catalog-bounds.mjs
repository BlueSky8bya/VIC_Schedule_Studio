// Read approved pixels only. Keep catalog centering metadata current for new art.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const bundle = buildSync({stdin: {contents: `
  import {COMPANION_FOOD_KINDS} from './lib/ui/viewer-companion/snacks';
  import {COMPANION_TOY_KINDS,getCompanionToyArt} from './lib/ui/viewer-companion/toy-catalog';
  import {getCompanionCollectionArtFrame} from './lib/ui/viewer-companion/collection-art';
  export const foods=COMPANION_FOOD_KINDS.map(id=>({id,frame:getCompanionCollectionArtFrame('food',id)}));
  export const toys=COMPANION_TOY_KINDS.map(id=>({id,src:getCompanionToyArt(id)}));
`, resolveDir: root, loader: 'ts'}, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent'});
const registryModule = {exports: {}};
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(registryModule, registryModule.exports, require);
const {foods, toys} = registryModule.exports;
const result = {food: {}, toy: {}};
for (const [kind, entries] of [['food', foods], ['toy', toys]]) for (const {id, frame, src} of entries) {
  const source = src ?? frame?.src;
  if (!source?.startsWith('/companion/') || source.includes('..')) throw Error('Invalid catalog source: ' + id);
  let image = sharp(path.join(root, 'public', source));
  if (kind === 'food') {
    if (!frame) throw Error('Missing food frame: ' + id);
    image = image.extract({left: frame.x, top: frame.y, width: frame.width, height: frame.height});
  }
  const {data, info} = await image.ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 16) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (!right || !bottom) throw Error('Empty catalog object: ' + id);
  result[kind][id] = {src: source, width: info.width, height: info.height, x: left, y: top, contentWidth: right - left, contentHeight: bottom - top};
}
const file = path.join(root, 'lib/ui/viewer-companion/catalog-display-bounds.json');
const text = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(file, 'utf8') !== text) throw Error('Catalog display bounds are stale; run node scripts/prepare-companion-catalog-bounds.mjs');
} else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
console.log(`Catalog bounds: ${foods.length} foods / ${toys.length} toys; source pixels unchanged.`);
