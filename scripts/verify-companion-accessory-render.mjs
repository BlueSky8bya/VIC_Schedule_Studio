// Read-only visual QA. Actual Chromium, product painter and public CSS/assets;
// no application server, account, state, random decision or database involved.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { chromium } from '@playwright/test';

const root = process.cwd(), flag = process.argv.find(value => value.startsWith('--out=')), compact = process.argv.includes('--compact');
const output = path.resolve(root, flag?.slice(6) ?? '.scratch-pw/companion-110/accessories');
if (!output.startsWith(path.join(root, '.scratch-pw') + path.sep)) throw Error('QA output must stay in workspace .scratch-pw');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const product = ['lib/ui/viewer-companion/accessory.ts', 'lib/ui/viewer-companion/accessory-catalog.ts', 'lib/ui/viewer-companion/accessory-art.ts', 'lib/ui/viewer-companion/collection-art.ts', 'lib/ui/viewer-companion/accessory-motion.ts', 'lib/ui/viewer-companion/gifts.ts', 'lib/ui/viewer-companion/collection-texture.ts', 'lib/ui/viewer-companion/sprite-quality.ts'];
const jsonNames = ['accessory-anchors', 'mouth-anchors', 'hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite', 'accessory-vector-114', 'accessory-vector-115'];
const sources = new Map(), compiled = {};
for (const name of product) {
  const source = await fs.readFile(path.join(root, name), 'utf8'); sources.set(name, source);
  compiled[name] = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
}
const json = {};
for (const name of jsonNames) {
  const file = `lib/ui/viewer-companion/${name}.json`, bytes = await fs.readFile(file, 'utf8'); sources.set(file, bytes); json[file] = JSON.parse(bytes);
}
const cssPath = 'components/poster/viewer-companion/viewer-companion.css', css = await fs.readFile(cssPath, 'utf8'); sources.set(cssPath, css);
const metadata = { atlases: [], frames: [], rows: [] };
for (const name of ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite']) {
  const pack = json[`lib/ui/viewer-companion/${name}.json`], offset = metadata.atlases.length, indexOffset = metadata.frames.length;
  metadata.atlases.push(...pack.atlases); metadata.frames.push(...pack.frames.map(frame => ({ ...frame, atlas: frame.atlas + offset })));
  metadata.rows.push(...pack.rows.map(row => row.map(index => index + indexOffset)));
}
const anchors = json['lib/ui/viewer-companion/accessory-anchors.json'];
if (metadata.frames.length !== 520 || anchors.frameCount !== 520 || metadata.rows.length !== 41) throw Error('Audit domain changed; review coverage');
const publicHashes = new Map();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1664, height: 2300 }, deviceScaleFactor: 1 });
  const errors = [], unknownRequests = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://companion.test' || !url.pathname.startsWith('/companion/') || route.request().method() !== 'GET') { unknownRequests.push(route.request().url()); return route.abort(); }
    const file = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(root, 'public', 'companion') + path.sep)) throw Error('Asset escaped companion directory');
    const bytes = await fs.readFile(file); publicHashes.set(file, hash(bytes));
    await route.fulfill({ status: 200, contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/webp', body: bytes });
  });
  await page.setContent(`<base href="http://companion.test/"><style>${css}\nhtml,body{margin:0;background:#f4eddd;color:#302b26;font:12px sans-serif}.audit-grid{display:grid;grid-template-columns:repeat(16,104px)}figure{margin:0;width:104px;height:130px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}figure:nth-child(4n+3),figure:nth-child(4n+4){background:#e8dfcd}.audit-stage{position:relative;width:92px;height:92px}.vc-pose{position:relative}.vc-texture{width:800%;height:200%}figcaption{height:30px;text-align:center;padding:4px 0}.audit-label{padding:10px;background:#e5d9c0;font-size:16px}.audit-grid .vc-wearable{filter:none}</style><div class="audit-label"></div><div class="audit-grid"></div>`);
  await page.evaluate(({ compiled, json, metadata, anchors }) => {
    const cache = new Map();
    const normalize = value => { const parts = []; for (const part of value.split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); } return parts.join('/'); };
    const load = name => {
      if (cache.has(name)) return cache.get(name).exports;
      if (json[name]) return json[name];
      if (!compiled[name]) throw Error('Unknown QA module ' + name);
      const qaModule = { exports: {} }; cache.set(name, qaModule);
      new Function('require', 'exports', 'module', compiled[name])(request => load(normalize((request.startsWith('@/') ? request.slice(2) : name.slice(0, name.lastIndexOf('/') + 1) + request) + (request.endsWith('.json') ? '' : '.ts'))), qaModule.exports, qaModule);
      return qaModule.exports;
    };
    const { companionAccessoryPlacement, createCompanionAccessoryPainter } = load('lib/ui/viewer-companion/accessory.ts');
    const { COMPANION_WEARABLE_IDS: ids } = load('lib/ui/viewer-companion/gifts.ts');
    const { COMPANION_ACCESSORIES: catalogue } = load('lib/ui/viewer-companion/accessory-catalog.ts');
    const { sampleCompanionAccessoryMotion } = load('lib/ui/viewer-companion/accessory-motion.ts');
    const { selectCompanionSprite: selected } = load('lib/ui/viewer-companion/sprite-quality.ts');
    const host = () => document.createElement('span');
    let cssWrites = 0, checks = 0, motionChecks = 0;
    const detached = { back: host(), front: host(), gift: host() }, painter = createCompanionAccessoryPainter(detached);
    for (const node of Object.values(detached)) { node.hidden = true; const set = node.style.setProperty.bind(node.style); node.style.setProperty = (...args) => { cssWrites++; return set(...args); }; }
    const domain = [];
    for (const id of ids) for (let index = 0; index < metadata.frames.length; index++) {
      const pick = selected(index), placement = companionAccessoryPlacement(pick, id);
      if (!placement || ![placement.x, placement.y, placement.width, placement.rotation].every(Number.isFinite) || placement.width <= 0) throw Error(`Bad placement ${id}:${index}`);
      if (companionAccessoryPlacement({ ...pick, src: '/unadopted.webp' }, id) !== null) throw Error('Unadopted source accepted');
      painter.paint(pick, id, false);
      if (!CSS.supports('transform', detached.front.style.transform) || !CSS.supports('clip-path', detached.front.style.clipPath)) throw Error(`Invalid browser style ${id}:${index}`);
      const before = cssWrites; for (let count = 0; count < 5; count++) painter.paint(pick, id, false);
      if (before !== cssWrites) throw Error('Unchanged pose rewrites styles');
      domain.push({ id, physicalIndex: index, orientation: anchors.frames[index].orientation, mirror: placement.mirror, layers: { back: !detached.back.hidden, front: !detached.front.hidden }, clips: placement.clips ?? null }); checks++;
    }
    for (const id of ['propeller-hat', 'magic-pocket']) for (let index = 0; index < metadata.frames.length; index++) for (const age of [0, 450, 900, 1300, 1600, 2000, 2400, 2600]) {
      const pick = selected(index), motion = sampleCompanionAccessoryMotion(id, age).accessory, placement = companionAccessoryPlacement(pick, id, motion);
      if (!placement || ![placement.x, placement.y, placement.width, placement.rotation].every(Number.isFinite)) throw Error(`Bad special attachment ${id}:${index}:${age}`);
      painter.paint(pick, id, false, motion);
      for (const node of [detached.front, detached.back]) if (!node.hidden && (!CSS.supports('transform', node.style.transform) || !CSS.supports('clip-path', node.style.clipPath))) throw Error('Invalid special browser style');
      const before = cssWrites; painter.paint(pick, id, false, motion); if (before !== cssWrites) throw Error('Unchanged special pose rewrites styles');
      motionChecks++;
    }
    painter.clear();
    const allYaw = anchors.frames.filter(frame => frame.orientation !== 'front').map(frame => frame.physicalIndex);
    const critical = [...new Set([...metadata.rows.flatMap(row => [row[0], row[Math.floor(row.length / 2)], row.at(-1)]), ...allYaw])].sort((a, b) => a - b);
    const snapshots = [];
    window.accessoryQA = {
      ids, critical, domain, checks, motionChecks, snapshots,
      render(id, indexes, label, ages, append = false, facings = [1, -1], humanLabels = false) {
        document.querySelector('.audit-label').textContent = label;
        const grid = document.querySelector('.audit-grid'); if (!append) grid.replaceChildren();
        const samples = ages ? ages.map(age => { const motion = sampleCompanionAccessoryMotion(id, age), row = metadata.rows[motion.row], index = row[Math.min(row.length - 1, Math.round(motion.frame / 15 * (row.length - 1)))]; return { index, motion, age }; }) : indexes.map(index => ({ index }));
        for (const { index, motion, age } of samples) for (const facing of facings) {
          const pick = selected(index), figure = document.createElement('figure'), stage = host(), pose = host(), back = host(), front = host(), gift = host(), body = host(), image = new Image();
          stage.className = 'audit-stage'; stage.style.transform = `scaleX(${facing})`; pose.className = 'vc-pose';
          if (motion) { figure.style.height = '190px'; pose.style.transform = `translateY(${-motion.bodyLift}px) rotate(${motion.bodyLean}deg)`; }
          back.className = 'vc-wearable vc-wearable-back'; front.className = 'vc-wearable vc-wearable-front'; gift.className = 'vc-wearable vc-gift-prop'; body.className = 'vc-sprite'; image.className = 'vc-texture'; image.src = pick.src;
          image.style.transform = `translate(${-pick.index % 8 / 8 * 100}%,${-Math.floor(pick.index / 8) / 2 * 100}%)`;
          body.style.transform = `translate(${pick.frame.x / 80 * 100}%,${pick.frame.y / 80 * 100}%)`; body.style.clipPath = `inset(${pick.frame.clip.map(value => `${value / 80 * 100}%`).join(' ')})`;
          body.append(image); pose.append(back, body, front, gift); stage.append(pose);
          const caption = document.createElement('figcaption'); caption.textContent = humanLabels ? catalogue[id].name : `${id}\n${index} ${facing > 0 ? 'right' : 'left'}${motion ? ` ${age}ms` : ''}`;
          figure.append(stage, caption); grid.append(figure);
          const renderer = createCompanionAccessoryPainter({ back, front, gift }); renderer.paint(pick, id, false, motion?.accessory); snapshots.push({ id, physicalIndex: index, facing, ...(motion ? { age, motion } : {}), frontClip: front.style.clipPath, backClip: back.style.clipPath, frontTransform: front.style.transform });
        }
        const textures = [...new Set([...grid.querySelectorAll('.vc-wearable')].map(node => node.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]).filter(Boolean))];
        // A contact sheet reuses the same large body atlas hundreds of times.
        // Decode each actual source once, then require every DOM adoption to
        // be complete. Hundreds of concurrent decode() calls for that same
        // atlas can exceed Chromium's pending decoder limit in QA itself.
        const bodies = [...new Map([...document.images].map(image => [image.src, image])).values()];
        return Promise.all(bodies.map(image => image.decode().catch(() => { throw Error(`Body texture cannot decode: ${image.src}`); })).concat(textures.map(src => { const image = new Image(); image.src = src; return image.decode().catch(() => { throw Error(`Accessory texture cannot decode: ${src}`); }); }))).then(() => new Promise((resolve, reject) => requestAnimationFrame(() => requestAnimationFrame(() => {
          const missing = [...document.images].find(image => !image.complete || !image.naturalWidth);
          if (missing) reject(Error(`Body adoption not complete: ${missing.src}`));
          else resolve();
        }))));
      },
    };
  }, { compiled, json, metadata, anchors });
  const domain = await page.evaluate(() => ({ ids: window.accessoryQA.ids, critical: window.accessoryQA.critical, checks: window.accessoryQA.checks, motionChecks: window.accessoryQA.motionChecks, domain: window.accessoryQA.domain }));
  await fs.mkdir(output, { recursive: true });
  let sheets = 0;
  if (compact) {
    const indexes = [0, 304, 323, 326, 404, 440, 500, 513];
    for (const [index, id] of domain.ids.entries()) await page.evaluate(({ id, indexes, append }) => window.accessoryQA.render(id, indexes, '115: all active fittings,8 representative adopted poses, both facings', undefined, append), { id, indexes, append: index > 0 });
    await page.locator('.audit-grid').screenshot({ path: path.join(output, 'all-active-contact.png') }); sheets++;
  } else for (const id of domain.ids) for (let offset = 0; offset < domain.critical.length; offset += 128) {
    const indexes = domain.critical.slice(offset, offset + 128), name = `wear-${id}-${offset / 128 + 1}.png`;
    await page.evaluate(({ id, indexes }) => window.accessoryQA.render(id, indexes, `${id}: exact adopted painter, native source yaw; each pair right/left`), { id, indexes });
    await page.locator('.audit-grid').screenshot({ path: path.join(output, name) }); sheets++;
  }
  for (const id of ['propeller-hat', 'magic-pocket']) {
    await page.evaluate(id => window.accessoryQA.render(id, [], `${id}: finite shared-source special sequence,11 ages, both facings`, [0, 260, 520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600]), id);
    await page.locator('.audit-grid').screenshot({ path: path.join(output, `special-${id}.png`) }); sheets++;
  }
  await page.evaluate(async ids => {
    const grid = document.querySelector('.audit-grid'); grid.style.gridTemplateColumns = 'repeat(5,104px)'; grid.style.width = '520px';
    for (const [index, id] of ids.entries()) await window.accessoryQA.render(id, [0], `115:${ids.length} active accessories, actual92px default body`, undefined, index > 0, [1], true);
  }, domain.ids);
  await page.locator('.audit-grid').screenshot({ path: path.join(output, 'all-active-neutral-92px.png') }); sheets++;
  const rendered = await page.evaluate(() => window.accessoryQA.snapshots);
  if (errors.length || unknownRequests.length) throw Error(JSON.stringify({ errors, unknownRequests }));
  for (const [name, source] of sources) if (await fs.readFile(name, 'utf8') !== source) throw Error('Source changed during audit: ' + name);
  for (const [file, before] of publicHashes) if (hash(await fs.readFile(file)) !== before) throw Error('Public image changed during audit');
  const evidence = { method: 'Actual headless Chromium CSS painter and unchanged source pixels, static parent facing both directions', limitation: 'Static attachment/occlusion and sampled finite-sequence audit; no live runtime planner, broadcaster hardware or owner art approval is claimed', checks: domain.checks, motionChecks: domain.motionChecks, frames: 520, accessories: domain.ids.length, criticalFrames: domain.critical.length, renderedStates: rendered.length, sheets, repeatedPainterCssWrites: 0, unknownRequests, pageErrors: errors, sourcesUnchanged: true, modules: Object.fromEntries([...sources].map(([name, source]) => [name, hash(Buffer.from(source))])), publicAssets: Object.fromEntries([...publicHashes].map(([file, sha]) => [path.relative(root, file), sha])), domain: domain.domain, rendered };
  await fs.writeFile(path.join(output, 'wearable-qa.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ checks: evidence.checks, motionChecks: evidence.motionChecks, frames: evidence.frames, accessories: evidence.accessories, criticalFrames: evidence.criticalFrames, renderedStates: evidence.renderedStates, sheets, repeatedPainterCssWrites: 0, pageErrors: 0, sourcesUnchanged: true }));
} finally { await browser.close(); }
