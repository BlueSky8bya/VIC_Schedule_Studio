import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { browserProduct, installBrowserProduct } from './browser-product.mjs';
const out = '.scratch-pw/companion-consistency/full'; await fs.mkdir(`${out}/styled-cells`, { recursive: true });
const metadata = JSON.parse(await fs.readFile(new URL('./input-metadata.json', import.meta.url)));
const edition = JSON.parse(await fs.readFile('lib/ui/viewer-companion/appearance-edition.json'));
const data = await browserProduct(['lib/ui/viewer-companion/expression-painter.ts']);
const browser = await chromium.launch(); const proof = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); if (url.origin !== 'http://companion.test' || !url.pathname.startsWith('/companion/')) throw Error('Unexpected network');
    const mapped=url.searchParams.has("immutable")?url.pathname:edition.packets.find(p=>p.parentSrc===url.pathname)?.src??url.pathname;
    await route.fulfill({ body: await fs.readFile('public' + mapped), headers: { 'access-control-allow-origin': '*' }, contentType: 'image/webp' });
  });
  await page.setContent('<base href="http://companion.test/">');
  await page.evaluate(installBrowserProduct, data);
  await page.evaluate(async ({ metadata, reference }) => {
    window.styleImages = new Map();const image=new Image();image.crossOrigin="anonymous";image.src=reference+"?immutable=1";await image.decode();window.immutableEyeReference=image;
    for (const atlas of metadata.atlases) { const image = new Image(); image.crossOrigin = 'anonymous'; image.src = atlas.src; await image.decode(); window.styleImages.set(atlas.src, image); }
  }, { metadata,reference:edition.eyeReference.referenceSrc });
  for (let atlas = 0; atlas < metadata.atlases.length; atlas++) {
    const batch = edition.frames.filter(frame => frame.atlas === atlas);
    const images = await page.evaluate(({ frames, metadata }) => {
      const { createCompanionExpressionPainter } = window.product('lib/ui/viewer-companion/expression-painter.ts');
      return frames.map(frame => {
        const original = metadata.frames[frame.physicalIndex], src = metadata.atlases[original.atlas].src;
        const selected = { atlas: 'hd', physicalIndex: frame.physicalIndex, index: original.index, src, grid: 8, gridRows: 2, frame: original };
        const canvas = document.createElement('canvas'), painter = createCompanionExpressionPainter(canvas, src => window.styleImages.get(src));
        const painted = painter.paint(selected, null, { native: frame.eyeState,referenceImage:window.immutableEyeReference });
        if (!painted) { canvas.width = canvas.height = 192; const image = window.styleImages.get(src); canvas.getContext('2d').drawImage(image, original.index % 8 * 192, Math.floor(original.index / 8) * 192, 192, 192, 0, 0, 192, 192); }
        return { physicalIndex: frame.physicalIndex, state: frame.eyeState, painted, png: canvas.toDataURL().split(',')[1] };
      });
    }, { frames: batch, metadata });
    for (const { png, ...item } of images) { await fs.writeFile(`${out}/styled-cells/${item.physicalIndex}.png`, Buffer.from(png, 'base64')); proof.push(item); }
  }
} finally { await browser.close(); }
await fs.writeFile(`${out}/style-proof.json`, JSON.stringify(proof, null, 2));
console.log({ frames: proof.length, painted: proof.filter(p => p.painted).length, unpainted: proof.filter(p => !p.painted).map(p => p.physicalIndex) });
