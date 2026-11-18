// Offline Chromium proof of the real renderer. No app server, DB or account.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { writeReport } from './report.mjs';

const root = process.cwd();
const out = path.resolve(root, '.scratch-pw/companion-consistency/runs/20261118');
await fs.mkdir(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = name => name.replaceAll('\\', '/');
async function bundle(revision) {
  const modules = {}, json = {}, provenance = {};
  async function load(name) {
    if (modules[name] || json[name]) return;
    const bytes = revision ? execFileSync('git', ['show', `${revision}:${name}`], { cwd: root, maxBuffer: 20e6 }) : await fs.readFile(path.join(root, name));
    provenance[name] = sha(bytes);
    if (name.endsWith('.json')) { json[name] = JSON.parse(bytes); return; }
    const code = ts.transpileModule(bytes.toString(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    modules[name] = code;
    for (const [, request] of code.matchAll(/require\("([^"]+)"\)/g)) {
      if (!request.startsWith('.') && !request.startsWith('@/')) throw Error(`Unexpected dependency ${request}`);
      await load(normalize(path.posix.normalize(request.startsWith('@/') ? request.slice(2) : path.posix.join(path.posix.dirname(name), request))) + (request.endsWith('.json') ? '' : '.ts'));
    }
  }
  for (const name of ['sprite-quality', 'expression-painter', 'material-scale', 'accessory']) await load(`lib/ui/viewer-companion/${name}.ts`);
  return { modules, json, provenance };
}
const browser = await chromium.launch();
const errors = [], requests = [], results = {};
try {
  for (const edition of ['before', 'after']) {
    const data = await bundle(edition === 'before' ? 'origin/main' : undefined);
    data.earPilots = JSON.parse(await fs.readFile('scripts/companion-consistency/ear-pilots.json'));
    data.earTips = {};
    if (edition === 'after') for (const spec of data.earPilots.poses) for (const side of ['left', 'right']) {
      data.earTips[`${spec.physicalIndex}-${side}`] = 'data:image/png;base64,' + (await fs.readFile(path.join(out, `ear-${spec.physicalIndex}-${side}-tip.png`))).toString('base64');
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 425 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://companion.test' || !url.pathname.startsWith('/companion/') || route.request().method() !== 'GET') { requests.push(url.href); return route.abort(); }
      const file = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(path.join(root, 'public/companion') + path.sep)) throw Error('Asset escaped root');
      const bytes = edition === 'before' ? execFileSync('git', ['show', `origin/main:${normalize(path.relative(root, file))}`], { cwd: root, maxBuffer: 20e6 }) : await fs.readFile(file);
      data.provenance[normalize(path.relative(root, file))] = sha(bytes);
      await route.fulfill({ body: bytes, headers: { 'access-control-allow-origin': '*' }, contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/webp' });
    });
    await page.setContent('<base href="http://companion.test/"><style>body{margin:0;background:#f5eedf;color:#514133;font:16px sans-serif}h1{font-size:23px;margin:24px}h2{font-size:16px;margin:12px 24px}.grid{display:grid;grid-template-columns:repeat(6,220px);gap:12px;margin:24px}figure{margin:0;background:#fffaf0;border:1px solid #dacdb8;border-radius:16px;text-align:center;padding:8px}canvas{width:200px;height:220px}figcaption{height:38px;font-size:14px}.source-grid{display:grid;grid-template-columns:repeat(8,164px);gap:6px;margin:18px}.source-grid canvas{width:144px;height:144px}.source-grid figure{padding:3px}.source-grid figcaption{height:20px}</style><h1>빅타민 · 같은 원화 / 같은 시점 / 같은 크기</h1><h2>정지·달리기 기준 / 합산 변형 / 표정 / 귀 레이어 검토</h2><div class="grid"></div>');
    const proof = await page.evaluate(async data => {
      const cache = new Map();
      const norm = name => { const parts = []; for (const p of name.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); } return parts.join('/'); };
      const load = name => {
        if (data.json[name]) return data.json[name];
        if (cache.has(name)) return cache.get(name).exports;
        if (!data.modules[name]) throw Error(`Missing ${name}`);
        const loaded = { exports: {} }; cache.set(name, loaded);
        new Function('require', 'exports', 'module', data.modules[name])(request => load(norm(request.startsWith('@/') ? request.slice(2) : name.slice(0, name.lastIndexOf('/') + 1) + request) + (request.endsWith('.json') ? '' : '.ts')), loaded.exports, loaded);
        return loaded.exports;
      };
      const sprite = load('lib/ui/viewer-companion/sprite-quality.ts'), material = load('lib/ui/viewer-companion/material-scale.ts'), face = load('lib/ui/viewer-companion/expression-painter.ts');
      const images = new Map();
      const image = async src => {
        if (!images.has(src)) { const node = new Image(); node.crossOrigin = 'anonymous'; node.src = src; await node.decode(); images.set(src, node); }
        return images.get(src);
      };
      await image(face.COMPANION_EXPRESSION_REFERENCE_SRC);
      const cells = [], scans = [], petMouths = [], source9Expressions = [];
      const add = (caption, className = '.grid') => { const figure = document.createElement('figure'), canvas = document.createElement('canvas'), label = document.createElement('figcaption'); canvas.width = 240; canvas.height = 264; label.textContent = caption; figure.append(canvas, label); document.querySelector(className).append(figure); return canvas; };
      const raw = (selected, canvas, image) => { const ctx = canvas.getContext('2d'), cell = image.naturalWidth / selected.grid; ctx.drawImage(image, selected.index % selected.grid * cell, Math.floor(selected.index / selected.grid) * cell, cell, cell, 0, 0, canvas.width, canvas.height); };
      for (const [label, row, verticals, expression] of [
        ['정지 기준', 0, [1], null], ['달리기 기준', 20, [1], null],
        ['잡힘 + 관성 (동시 부하)', 0, [1.315, 1, 1, 1.075], null],
        ['접촉 + 착지 (동시 부하)', 0, [.94, .87, .91, 1], null],
        ['시무룩 + 표정', 28, [1], 'sorry'], ['감은 눈 → 반가움', 9, [1], 'greeting'],
      ]) {
        const selected = sprite.selectCompanionSprite(sprite.companionSpriteMetadata.rows[row][0]), img = await image(selected.src), canvas = add(label), ctx = canvas.getContext('2d');
        const source = document.createElement('canvas'); source.width = source.height = 192; raw(selected, source, img);
        let painted = false;
        if (expression) { const overlay = document.createElement('canvas'); const painter = face.createCompanionExpressionPainter(overlay, src => images.get(src)); painted = painter.paint(selected, { id: expression, progress: .5 }); if (painted) { source.getContext('2d').clearRect(0, 0, 192, 192); source.getContext('2d').drawImage(overlay, 0, 0); } }
        const scales = material.companionMaterialStack ? material.companionMaterialStack(verticals) : verticals.map(material.companionMaterialScale);
        const sx = scales.reduce((n, s) => n * s.scaleX, 1), sy = scales.reduce((n, s) => n * s.scaleY, 1);
        ctx.translate(120, 230); ctx.scale(sx, sy); ctx.drawImage(source, -110, -220, 220, 220);
        cells.push({ label, physicalIndex: selected.physicalIndex, src: selected.src, sx, sy, painted });
      }
      // The complete source catalogue uses no corrective scaling. Comparing
      // within pose families avoids mistaking a sleeping ball for a tall head.
      const grid = document.createElement('div'); grid.className = 'source-grid'; document.body.append(grid);
      for (let row = 0; row < sprite.companionSpriteMetadata.rows.length; row++) {
        for (const column of [0, 4]) {
          const selected = sprite.selectCompanionSprite(sprite.companionSpriteMetadata.rows[row][column]), img = await image(selected.src), canvas = add(`행${row} · 프레임${selected.physicalIndex}`, '.source-grid');
          canvas.width = canvas.height = 192; raw(selected, canvas, img);
        }
      }
      // Sweep every calibrated cell; a late fixture exposes missing sources
      // and unilateral admission rather than quietly calling all faces PASS.
      for (const pose of data.json['lib/ui/viewer-companion/expression-anchors-161.json'].frames) {
        const selected = sprite.selectCompanionSprite(pose.physicalIndex); await image(selected.src);
        const canvas = document.createElement('canvas'), painter = face.createCompanionExpressionPainter(canvas, src => images.get(src));
        const painted = painter.paint(selected, { id: 'melt', progress: .5 });
        let alphaChanges = 0;
        if (painted) {
          const original = document.createElement('canvas'); original.width = original.height = 192; raw(selected, original, images.get(selected.src));
          const a = original.getContext('2d').getImageData(0, 0, 192, 192).data, b = canvas.getContext('2d').getImageData(0, 0, 192, 192).data;
          for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) alphaChanges++;
        }
        scans.push({ physicalIndex: pose.physicalIndex, painted, alphaChanges });
        if (pose.source === 9 && painted) {
          const final = canvas.getContext('2d').getImageData(0, 0, 192, 192).data, m = pose.mouth;
          const ink = new Set(), width = 192;
          for (let y = Math.ceil((Math.max(...pose.eyes.map(e => e.center[1])) + 1.6) * 2.4); y <= Math.ceil((m.bounds[3] + 2) * 2.4); y++) for (let x = Math.floor((m.bounds[0] - 2) * 2.4); x <= Math.ceil((m.bounds[2] + 2) * 2.4); x++) {
            const k = (y * width + x) * 4;
            if (final[k + 3] > 240 && final[k] < 205 && final[k + 1] < 180 && final[k + 2] < 155) ink.add(y * width + x);
          }
          const components = [];
          while (ink.size) {
            const queue = [ink.values().next().value]; ink.delete(queue[0]);
            for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
              const next = queue[i] + dy * width + dx; if (ink.delete(next)) queue.push(next);
            }
            components.push(queue.length);
          }
          petMouths.push({ physicalIndex: pose.physicalIndex, components });
          const original = document.createElement('canvas'); original.width = original.height = 192; raw(selected, original, images.get(selected.src));
          const alpha = original.getContext('2d').getImageData(0, 0, 192, 192).data;
          const ids = load('lib/ui/viewer-companion/expressions.ts').COMPANION_EXPRESSIONS;
          for (const [id] of ids) for (const progress of [.2, .5, .8]) {
            const visible = painter.paint(selected, { id, progress }); let changed = 0;
            if (visible) { const rgba = canvas.getContext('2d').getImageData(0, 0, 192, 192).data; for (let k = 3; k < rgba.length; k += 4) if (rgba[k] !== alpha[k]) changed++; }
            source9Expressions.push({ physicalIndex: pose.physicalIndex, id, progress, visible, alphaChanges: changed });
          }
        }
      }
      window.consistency = { load, sprite, face, images, image };
      const earsGrid = document.createElement('div'); earsGrid.className = 'grid ears-grid'; document.body.append(earsGrid);
      const accessory = load('lib/ui/viewer-companion/accessory.ts');
      const catalogue = load('lib/ui/viewer-companion/accessory-catalog.ts').COMPANION_ACCESSORIES;
      const hatIds = Object.entries(catalogue).filter(([, item]) => item.family === 'head' && !item.retired).map(([id]) => id);
      for (const spec of data.earPilots.poses) for (const id of hatIds) {
        const selected = sprite.selectCompanionSprite(spec.physicalIndex), canvas = add(`${spec.physicalIndex} · ${id}`, '.ears-grid');
        canvas.width = canvas.height = 192; raw(selected, canvas, await image(selected.src));
        const p = accessory.companionAccessoryPlacement(selected, id), art = p.art, ctx = canvas.getContext('2d'), scale = p.width / art.content.width;
        if (p.rearArt) {
          const rear = p.rearArt, anchor = accessory.companionAccessoryAnchor(selected, id, 'rotor'), scale = p.width / rear.content.width;
          ctx.clearRect(0, 0, 192, 192); ctx.save(); ctx.scale(192 / 80, 192 / 80); ctx.translate(anchor.x, anchor.y); ctx.rotate(anchor.roll * Math.PI / 180); ctx.scale(p.mirror ?? 1, 1);
          ctx.drawImage(await image(rear.src), rear.x, rear.y, rear.width, rear.height, -(art.content.x + art.content.width / 2) * scale, -22 * scale, rear.width * scale, rear.height * scale); ctx.restore(); raw(selected, canvas, await image(selected.src));
        }
        ctx.save(); ctx.scale(192 / 80, 192 / 80); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180); ctx.scale(p.mirror ?? 1, 1);
        ctx.drawImage(await image(art.src), art.x, art.y, art.width, art.height, (-art.content.x - art.content.width / 2) * scale, (-art.content.y - art.content.height / 2) * scale, art.width * scale, art.height * scale); ctx.restore();
        for (const side of ['left', 'right']) if (spec[side].tipInFront && data.earTips[`${spec.physicalIndex}-${side}`]) ctx.drawImage(await image(data.earTips[`${spec.physicalIndex}-${side}`]), 0, 0, 192, 192);
      }
      const petGrid = document.createElement('div'); petGrid.className = 'grid pet-grid'; document.body.append(petGrid);
      for (const row of [0, 9]) for (const progress of [.08, .2, .35, .5, .75, .92]) {
        const selected = sprite.selectCompanionSprite(sprite.companionSpriteMetadata.rows[row][0]), canvas = add(`원화${row} · 쓰담 ${progress}`, '.pet-grid');
        canvas.width = canvas.height = 192; raw(selected, canvas, await image(selected.src));
        const overlay = document.createElement('canvas'), painter = face.createCompanionExpressionPainter(overlay, src => images.get(src));
        const paintedProgress = material.companionMaterialStack ? Math.min(.5, progress) : progress;
        if (painter.paint(selected, { id: 'melt', progress: paintedProgress })) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 192, 192); ctx.drawImage(overlay, 0, 0); }
      }
      const crownGrid = document.createElement('div'); crownGrid.className = 'grid crown-grid'; crownGrid.style.gridTemplateColumns = 'repeat(4,220px)'; crownGrid.style.width = '916px'; document.body.append(crownGrid);
      const artModule = load('lib/ui/viewer-companion/accessory-art.ts');
      for (const view of ['front', 'quarter', 'side', 'back']) {
        const art = artModule.getCompanionAccessoryArtFrame('tiny-crown', view), canvas = add(`왕관 · ${view}`, '.crown-grid');
        canvas.width = canvas.height = 192; canvas.getContext('2d').drawImage(await image(art.src), art.x, art.y, art.width, art.height, 0, 0, 192, 192);
      }
      return { cells, scans, hats: hatIds, petMouths, source9Expressions };
    }, data);
    await page.screenshot({ path: path.join(out, `${edition}-CONSISTENCY.png`) });
    await page.locator('.source-grid').screenshot({ path: path.join(out, `${edition}-SOURCES.png`) });
    await page.locator('.ears-grid').screenshot({ path: path.join(out, `${edition}-EARS.png`) });
    await page.locator('.pet-grid').screenshot({ path: path.join(out, `${edition}-PETTING.png`) });
    await page.locator('.crown-grid').screenshot({ path: path.join(out, `${edition}-CROWN.png`) });
    results[edition] = { ...proof, provenance: data.provenance };
    await page.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(out, 'proof.json'), JSON.stringify({ baseline: execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root }).toString().trim(), results, errors, rejectedRequests: requests, scope: 'Actual product modules in Chromium; source catalogue and synthetic simultaneous deformation loads. No real-life trigger or all-pose art approval.' }, null, 2));
await writeReport(out);
const panels = await Promise.all(['before', 'after'].map(edition => sharp(path.join(out, `${edition}-CONSISTENCY.png`)).resize(720).png().toBuffer()));
await sharp({ create: { width: 1440, height: 253, channels: 4, background: '#f5eedf' } }).composite([
  { input: Buffer.from('<svg width="1440" height="40"><text x="24" y="27" font-size="22" fill="#514133">전 · origin/main</text><text x="744" y="27" font-size="22" fill="#514133">후 · 작업 브랜치</text></svg>'), top: 0, left: 0 },
  { input: panels[0], top: 40, left: 0 }, { input: panels[1], top: 40, left: 720 },
]).png().toFile(path.join(out, 'comparison.png'));
if (errors.length || requests.length) throw Error('Chromium errors or external requests; inspect proof.json');
if (results.after.scans.some(scan => scan.alphaChanges)) throw Error('Expression changed source alpha');
if (results.after.petMouths.length !== 16 || results.after.petMouths.some(sample => sample.components.length !== 1)) throw Error('Petting smile contains isolated old mouth ink; inspect petMouths in proof.json');
if (results.after.source9Expressions.length !== 1728 || results.after.source9Expressions.some(sample => !sample.visible || sample.alphaChanges)) throw Error('Petting source/36-expression compatibility regression');
for (const id of [160, 178, 257, 432]) if (results.after.scans.find(scan => scan.physicalIndex === id)?.painted !== false) throw Error(`Ambiguous native eye state must stay intact: ${id}`);
if (!results.after.scans.find(scan => scan.physicalIndex === 0)?.painted) throw Error('Standing face unexpectedly disabled');
console.log(JSON.stringify({ out, beforePainted: results.before.scans.filter(x => x.painted).length, afterPainted: results.after.scans.filter(x => x.painted).length, cells: results.after.cells }));
