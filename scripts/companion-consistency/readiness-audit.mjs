// Independent regression proof: real product readiness + bounded body decoder.
// Only HTTP responses are delayed. No injected expression, clock, renderer
// state, fake Image, decoded-texture stub, application server or database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { browserProduct, installBrowserProduct } from './browser-product.mjs';

const root = process.cwd();
const out = path.join(root, '.scratch-pw/companion-consistency/readiness');
await fs.mkdir(out, { recursive: true });
const product = await browserProduct(['lib/ui/viewer-companion/accessory.ts']);
const provenance = {};
for (const name of [...Object.keys(product.modules), ...Object.keys(product.json)].sort()) {
  provenance[name] = createHash('sha256').update(await fs.readFile(name)).digest('hex');
}
const source0 = product.json['lib/ui/viewer-companion/appearance-edition.json'].packets[0].src;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const within = async (promise, label) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Timed out: ${label}`)), 15_000); })]); }
  finally { clearTimeout(timer); }
};
const browser = await chromium.launch();
const cases = [];
let failure;
try {
  for (const action of ['recover', 'clear', 'replace']) {
    const hat = deferred(), body = deferred(), recoveryStarted = deferred();
    const result = { action, errors: [], rejected: [], requests: [], passed: false };
    cases.push(result);
    const page = await browser.newPage();
    let bodyRequests = 0;
    page.on('pageerror', error => result.errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== 'http://companion.test' || request.method() !== 'GET') {
        result.rejected.push(request.method() + ' ' + url.href); return route.abort();
      }
      if (url.pathname === '/qa') return route.fulfill({ contentType: 'text/html', body: '<div id="pose"><span id="back"></span><span id="front"></span><span id="gift"></span><span id="composite" hidden></span></div>' });
      const file = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(path.join(root, 'public/companion') + path.sep)) {
        result.rejected.push(url.href); return route.abort();
      }
      result.requests.push(url.pathname);
      if (url.pathname.startsWith('/companion/collection/')) await hat.promise;
      if (url.pathname === source0 && ++bodyRequests > 1) { recoveryStarted.resolve(); await body.promise; }
      const bytes = await fs.readFile(file);
      provenance[path.relative(root, file).replaceAll('\\', '/')] = createHash('sha256').update(bytes).digest('hex');
      await route.fulfill({ body: bytes, headers: { 'cache-control': 'no-store' }, contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/webp' });
    });
    try {
      await page.goto('http://companion.test/qa');
      await page.evaluate(installBrowserProduct, product);
      await page.evaluate(async () => {
        const sprite = window.product('lib/ui/viewer-companion/sprite-quality.ts');
        const accessory = window.product('lib/ui/viewer-companion/accessory.ts');
        const selected = sprite.selectCompanionSprite(0);
        if (!await sprite.decodeCompanionSprite(selected.src)) throw Error('Initial body failed to decode');
        const hosts = Object.fromEntries(['back', 'front', 'gift', 'composite'].map(name => [name, document.getElementById(name)]));
        const painter = accessory.createCompanionAccessoryPainter(hosts);
        window.readinessQA = { sprite, selected, painter, hosts };
        painter.paint(selected, 'tiny-crown', false);
      });
      result.evicted = await page.evaluate(async () => {
        const q = window.readinessQA;
        // Canvas consumers do not connect/pin an Image. Three other genuine
        // packets must evict the first one through the existing LRU policy.
        for (const id of [16, 32, 48]) if (!await q.sprite.decodeCompanionSprite(q.sprite.selectCompanionSprite(id).src)) throw Error('Eviction fixture decode failed');
        return !q.sprite.isCompanionSpriteDecoded(q.selected.src);
      });
      assert.equal(result.evicted, true, 'The test must actually evict the current unowned body');
      hat.resolve();
      await within(recoveryStarted.promise, 'real body recovery request');
      result.beforeRelease = await page.evaluate(action => {
        const q = window.readinessQA;
        if (action === 'clear') q.painter.clear();
        if (action === 'replace') q.painter.paint(q.sprite.selectCompanionSprite(16), 'tiny-crown', false);
        return { ready: q.painter.accessoryReady(), layered: q.painter.layered(), pose: q.hosts.composite.querySelector('canvas')?.dataset.pose ?? null };
      }, action);
      body.resolve();
      await page.waitForFunction(() => window.readinessQA.sprite.isCompanionSpriteDecoded(window.readinessQA.selected.src));
      // Flush the decoder promise continuation and any immediate paint. This
      // is browser scheduling, not a mocked product/animation clock.
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      if (action === 'recover') await page.waitForFunction(() => window.readinessQA.painter.layered());
      result.afterRelease = await page.evaluate(() => {
        const q = window.readinessQA;
        return { ready: q.painter.accessoryReady(), layered: q.painter.layered(), hidden: q.hosts.composite.hidden,
          parentLayered: q.hosts.composite.parentElement.hasAttribute('data-layered'),
          pose: q.hosts.composite.querySelector('canvas')?.dataset.pose ?? null,
          backHidden: q.hosts.back.hidden, frontHidden: q.hosts.front.hidden, giftHidden: q.hosts.gift.hidden };
      });
      const observed = result.afterRelease;
      if (action === 'clear') {
        assert.equal(observed.ready, false); assert.equal(observed.layered, false); assert.equal(observed.hidden, true);
        assert.equal(observed.parentLayered, false); assert.equal(observed.backHidden, true); assert.equal(observed.frontHidden, true); assert.equal(observed.giftHidden, true);
      } else {
        assert.equal(observed.ready, true); assert.equal(observed.layered, true); assert.equal(observed.hidden, false);
        assert.equal(observed.parentLayered, true); assert.equal(observed.pose, action === 'replace' ? '16' : '0');
      }
      assert.deepEqual(result.errors, []); assert.deepEqual(result.rejected, []);
      result.passed = true;
    } finally {
      hat.resolve(); body.resolve(); await page.close();
    }
  }
} catch (error) { failure = String(error?.stack ?? error); }
finally { await browser.close(); }
await fs.writeFile(path.join(out, 'proof.json'), JSON.stringify({
  scope: 'Current source modules in real Chromium. Actual texture readiness and bounded body decoder; deliberately delayed HTTP responses. Proves recovery after LRU eviction and generation cancellation on clear/new pose. Does not establish React surface integration, production-build or real-device performance.',
  cases, provenance, failure: failure ?? null,
}, null, 2));
console.log(JSON.stringify({ out, passed: cases.filter(item => item.passed).length, cases: cases.map(item => ({ action: item.action, passed: item.passed, afterRelease: item.afterRelease })) }));
if (failure) throw Error(failure);
