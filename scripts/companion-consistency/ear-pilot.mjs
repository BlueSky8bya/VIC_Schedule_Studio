// Explicit, source-bound pixel ownership. No segmentation guesses at runtime.
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { setupEarLab } from './ear-lab.mjs';
const root = process.cwd(), out = path.join(root, '.scratch-pw/companion-consistency/runs/20261118');
const contract = JSON.parse(await fs.readFile('scripts/companion-consistency/ear-pilots.json'));
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const source = readFileSync(path.join(root, name), 'utf8');
  if (name.endsWith('.json')) return JSON.parse(source);
  const loaded = { exports: {} }; cache.set(name, loaded);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(request => {
    if (!request.startsWith('.') && !request.startsWith('@/')) throw Error('Unexpected dependency');
    return load(path.posix.normalize(request.startsWith('@/') ? request.slice(2) : path.posix.join(path.posix.dirname(name), request)) + (request.endsWith('.json') ? '' : '.ts'));
  }, loaded, loaded.exports);
  return loaded.exports;
}
const { selectCompanionSprite } = load('lib/ui/viewer-companion/sprite-quality.ts');
const { companionAccessoryPlacement, companionAccessoryAnchor } = load('lib/ui/viewer-companion/accessory.ts');
const { COMPANION_ACCESSORIES } = load('lib/ui/viewer-companion/accessory-catalog.ts');
const hatIds = Object.entries(COMPANION_ACCESSORIES).filter(([, item]) => item.family === 'head' && !item.retired).map(([id]) => id);
const inside = ([x,y], points) => {
  let found = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) found = !found;
  }
  return found;
};
const dataURL = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const proofs = [], portraits = [];
await fs.mkdir(out, { recursive: true });
for (const spec of contract.poses) {
  const selected = selectCompanionSprite(spec.physicalIndex);
  if (selected.src !== spec.src || selected.index !== spec.index) throw Error('Source registration changed');
  const bytes = await fs.readFile(path.join(root, 'public' + selected.src));
  if (createHash('sha256').update(bytes).digest('hex') !== spec.sha256) throw Error('Source hash changed; remeasure');
  const size = (await sharp(bytes).metadata()).width / selected.grid;
  const { data, info } = await sharp(bytes).extract({ left: spec.index % selected.grid * size, top: Math.floor(spec.index / selected.grid) * size, width: size, height: size }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const names = ['body', 'left-root', 'left-tip', 'right-root', 'right-tip'];
  const layers = Object.fromEntries(names.map(name => [name, Buffer.alloc(data.length)])), counts = Object.fromEntries(names.map(name => [name, 0]));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const point = [(x + .5) / size * 80, (y + .5) / size * 80], matches = ['left', 'right'].filter(side => inside(point, spec[side].polygon));
    if (matches.length > 1) throw Error('Ear ownership overlap');
    let owner = 'body';
    if (matches.length) {
      const side = matches[0], ear = spec[side], length = Math.hypot(...ear.tipAxis);
      const distance = ((point[0] - ear.hinge[0]) * ear.tipAxis[0] + (point[1] - ear.hinge[1]) * ear.tipAxis[1]) / length;
      owner = side + (distance > ear.tipDistance ? '-tip' : '-root');
    }
    const offset = (y * size + x) * 4; data.copy(layers[owner], offset, offset, offset + 4);
    if (data[offset + 3]) counts[owner]++;
  }
  const reassembled = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) reassembled[i] = names.reduce((sum, name) => sum + layers[name][i], 0);
  if (!reassembled.equals(data) || Object.values(counts).some(n => n === 0)) throw Error('Incomplete pixel partition');
  const pngs = {};
  for (const [name, data] of Object.entries(layers)) {
    const png = await sharp(data, { raw: info }).png().toBuffer();
    await fs.writeFile(path.join(out, `ear-${spec.physicalIndex}-${name}.png`), png); pngs[name] = dataURL(png);
  }
  const native = dataURL(await sharp(data, { raw: info }).png().toBuffer());
  const hats = [];
  for (const id of hatIds) {
    const placement = companionAccessoryPlacement(selected, id);
    if (!placement) throw Error('Missing real hat placement');
    const image = dataURL(await sharp(path.join(root, 'public' + placement.art.src)).png().toBuffer());
    const rear = placement.rearArt ? { art: placement.rearArt, anchor: companionAccessoryAnchor(selected, id, 'rotor'), image: dataURL(await sharp(path.join(root, 'public' + placement.rearArt.src)).png().toBuffer()), pivot: { x: placement.art.content.x + placement.art.content.width / 2, y: 22 } } : undefined;
    hats.push({ id, name: COMPANION_ACCESSORIES[id].name, placement, image, rear });
  }
  portraits.push({ spec, pngs, native, hats });
  proofs.push({ physicalIndex: spec.physicalIndex, src: spec.src, sha256: spec.sha256, counts, exactRawReassembly: true, layerOrder: ['body', 'left-root', 'right-root', 'hat', 'front-ear-tips'], status: 'prototype-only; masks and occluded anatomy require visual approval' });
}
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>귀 레이어 실험실</title><style>body{margin:24px;background:#f5eedf;color:#514133;font:16px sans-serif}h1{font-size:24px}label{margin-right:18px}canvas{display:block;background:#fffaf0;border:1px solid #dacdb8;border-radius:16px;width:220px;height:220px}.grid{display:grid;grid-template-columns:repeat(6,220px);gap:12px;margin-top:20px}figure{margin:0;text-align:center}figcaption{padding:8px}</style><h1>귀를 좌우 × 뿌리·끝으로 분할한 시제품</h1><p>원본 픽셀 보존 · 두 자세 한정 · 실제 모자 부착 계산 사용 · 제품에는 아직 적용하지 않음</p><label>모자 <select id="hat"><option value="0">베레모</option><option value="1">야구 모자</option><option value="2">마법사 모자</option></select></label><label><input id="front" type="checkbox" checked>접힌 귀 끝을 모자 앞으로</label><div class="grid"></div><script>(${setupEarLab.toString()})(${JSON.stringify(portraits)});</script></html>`;
await fs.writeFile(path.join(out, 'ear-lab.html'), html);
await fs.writeFile(path.join(out, 'ear-proof.json'), JSON.stringify(proofs, null, 2));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 440 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html); await page.waitForSelector('body[data-ready="true"]');
  await page.locator('#hat').evaluate((select, labels) => { select.innerHTML = labels.map((name, i) => `<option value="${i}">${name}</option>`).join(''); }, hatIds.map(id => COMPANION_ACCESSORIES[id].name));
  for (const hat of hatIds.map((_, i) => String(i))) {
    await page.selectOption('#hat', hat); await page.waitForSelector('body[data-ready="true"]');
    await page.screenshot({ path: path.join(out, `ear-pilot-${hat}.png`) });
    await page.locator('.grid figure').nth(3).screenshot({ path: path.join(out, `before-EARS-${hat}.png`) });
    await page.locator('.grid figure').nth(4).screenshot({ path: path.join(out, `after-EARS-${hat}.png`) });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
console.log(JSON.stringify({ out, poses: proofs }));
