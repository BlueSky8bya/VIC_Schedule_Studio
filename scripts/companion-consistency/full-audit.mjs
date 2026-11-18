import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { browserProduct, installBrowserProduct } from './browser-product.mjs';
const out = '.scratch-pw/companion-consistency/full/runs/20261118-running-eyes'; await fs.mkdir(out, { recursive: true });
const baselineCommit=execFileSync('git',['rev-parse','origin/main']).toString().trim();
const provenance={before:{},after:{}};
const edition = JSON.parse(await fs.readFile('lib/ui/viewer-companion/appearance-edition.json'));
const representatives = [...new Map(edition.frames.map(frame => [frame.nativeCell, frame.physicalIndex])).values()];
const browser = await chromium.launch(), results = {};
try {
  for (const version of ['before', 'after']) {
    const revision = version === 'before' ? 'origin/main' : undefined;
    const modules = await browserProduct(['lib/ui/viewer-companion/accessory.ts', 'lib/ui/viewer-companion/expression-painter.ts'], revision);
    const css = revision ? execFileSync('git', ['show', `${revision}:components/poster/viewer-companion/viewer-companion.css`]).toString() : await fs.readFile('components/poster/viewer-companion/viewer-companion.css', 'utf8');
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }), errors = [], rejected = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://companion.test') { rejected.push(url.href); return route.abort(); }
      if (url.pathname === '/qa') return route.fulfill({ contentType: 'text/html', body: `<style>${css}\nbody{margin:16px;background:#f5eedf;color:#514133;font:14px sans-serif}.gallery{display:grid;grid-template-columns:repeat(5,184px);gap:6px}.case{width:184px;height:198px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fffaf0;border:1px solid #ded0b9;border-radius:12px;box-sizing:border-box}.stage{position:relative;width:92px;height:92px;margin:28px 0 12px}.caption{height:24px}h1{font-size:20px;margin:8px 0 16px}</style><h1 id="title"></h1><div class="gallery"></div><div id="probe"></div>` });
      if (!url.pathname.startsWith('/companion/')) { rejected.push(url.href); return route.abort(); }
      const file = 'public' + decodeURIComponent(url.pathname);
      const bytes = revision ? execFileSync('git', ['show', `${revision}:${file}`], { maxBuffer: 30e6 }) : await fs.readFile(file);
      provenance[version][file]=createHash('sha256').update(bytes).digest('hex');
      return route.fulfill({ body: bytes, contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/webp' });
    });
    await page.goto('http://companion.test/qa'); await page.evaluate(installBrowserProduct, modules);
    const setup = await page.evaluate(async () => {
      const load = window.product, sprite = load('lib/ui/viewer-companion/sprite-quality.ts'), accessory = load('lib/ui/viewer-companion/accessory.ts');
      const catalogue = load('lib/ui/viewer-companion/accessory-catalog.ts').COMPANION_ACCESSORIES;
      const art = load('lib/ui/viewer-companion/accessory-art.ts'), hats = Object.keys(catalogue).filter(id => catalogue[id].family === 'head' && !catalogue[id].retired);
      const images = new Map(), sources = new Set();
      for (const id of hats) for (const view of ['front','quarter','side','back']) sources.add(art.getCompanionAccessoryArtFrame(id, view).src);
      for (const src of sources) { const image = new Image(); image.src = src; await image.decode(); images.set(src, image); }
      const textures = { use() {}, ready: src => images.has(src), image: src => images.get(src), clear() {} };
      const make = parent => {
        const figure = document.createElement('div'); figure.className = 'case';
        const stage = document.createElement('div'); stage.className = 'stage'; const pose = document.createElement('span'); pose.className = 'vc-pose'; stage.append(pose);
        const back = document.createElement('span'), front = document.createElement('span'), gift = document.createElement('span'), composite = document.createElement('span'), plane = document.createElement('span'), canvas = document.createElement('canvas'), caption = document.createElement('div');
        back.className='vc-wearable vc-wearable-back'; front.className='vc-wearable vc-wearable-front'; gift.className='vc-wearable vc-gift-prop'; composite.className='vc-ear-layers'; composite.hidden=true; plane.className='vc-sprite'; canvas.width=canvas.height=192; canvas.style.width=canvas.style.height='100%'; plane.append(canvas); pose.append(back, composite, plane, front, gift); caption.className='caption'; figure.append(stage,caption); parent.append(figure);
        return { stage, plane, canvas, caption, composite, painter: accessory.createCompanionAccessoryPainter({back,front,gift,composite},textures) };
      };
      const paint = async (target, physicalIndex, id, mirror = 1) => {
        const selected = sprite.selectCompanionSprite(physicalIndex); await sprite.decodeCompanionSprite(selected.src); const image=sprite.peekDecodedCompanionSprite(selected.src); if(!image)throw Error('Decode failed');
        const cell=image.naturalWidth/selected.grid, ctx=target.canvas.getContext('2d'); ctx.clearRect(0,0,192,192); ctx.drawImage(image,selected.index%selected.grid*cell,Math.floor(selected.index/selected.grid)*cell,cell,cell,0,0,192,192);
        target.plane.style.transform=`translate(${selected.frame.x/80*100}%,${selected.frame.y/80*100}%)`; target.plane.style.clipPath=`inset(${selected.frame.clip.map(n=>n/80*100+'%').join(' ')})`;
        target.stage.style.transform=`scaleX(${mirror})`; target.caption.textContent=`${physicalIndex} · ${catalogue[id].name}`; target.painter.paint(selected,id,false);
        return { selected, layered: target.painter.layered?.()??false, canvas: target.composite.querySelector('canvas') };
      };
      window.fullQA = { sprite, hats, make, paint, probe: make(document.querySelector('#probe')) };
      document.querySelector('#probe').style.position='fixed'; document.querySelector('#probe').style.left='-1000px';
      return { hats, count:sprite.companionSpriteMetadata.frames.length };
    });
    const checks = [];
    for (let first = 0; first < setup.count; first += 16) {
      const batch = await page.evaluate(async ({ first, total, version }) => {
        const { hats, paint, probe }=window.fullQA, checks=[];
        for(let i=first;i<Math.min(first+16,total);i++)for(const id of hats)for(const mirror of [-1,1]){
          const result=await paint(probe,i,id,mirror);
          if(version==='after'&&!result.layered)throw Error(`Missing4-ear composite ${i}:${id}`);
          checks.push([i,id,mirror,result.layered]);
        }return checks;
      }, { first, total:setup.count, version }); checks.push(...batch);
    }
    for (const id of setup.hats) for (let part = 0; part < Math.ceil(representatives.length / 20); part++) {
      const poses = representatives.slice(part*20,part*20+20);
      await page.evaluate(async ({ id, poses, part }) => {
        const q=window.fullQA, gallery=document.querySelector('.gallery'); gallery.replaceChildren(); document.querySelector('#title').textContent=`${id} · 고유원화 ${part+1}`;
        for(const physicalIndex of poses)await q.paint(q.make(gallery),physicalIndex,id);
      }, { id, poses, part });
      await page.screenshot({ path:path.join(out,`${version}-${id}-${part}.png`), fullPage:true });
    }
    await page.evaluate(async () => {
      const q=window.fullQA, gallery=document.querySelector('.gallery'),load=window.product;
      gallery.replaceChildren();gallery.style.gridTemplateColumns='repeat(3, 316px)';document.querySelector('#title').textContent='정지 · 달리기 · 쓰담 · 접힌 귀 · 새 왕관';
      const cases=[{index:0,id:null,label:'정지 기준'},{index:304,id:null,label:'달리기 기준'},{index:144,id:'beret',face:true,label:'쓰담 · 베레모'},{index:447,id:'beret',label:'접힌 귀 · 시무룩'},{index:144,id:'tiny-crown',face:true,label:'쓰담 · 왕관'},{index:0,id:'tiny-crown',label:'왕관 · 정지'}];
      const faces=load('lib/ui/viewer-companion/expression-painter.ts');
      for(const item of cases){const target=q.make(gallery);target.stage.style.width=target.stage.style.height='216px';target.stage.parentElement.style.width='316px';target.stage.parentElement.style.height='342px';
        const selected=q.sprite.selectCompanionSprite(item.index);await q.sprite.decodeCompanionSprite(faces.COMPANION_EXPRESSION_REFERENCE_SRC);await q.sprite.decodeCompanionSprite(selected.src);
        const image=q.sprite.peekDecodedCompanionSprite(selected.src),ctx=target.canvas.getContext('2d');ctx.drawImage(image,selected.index%8*192,Math.floor(selected.index/8)*192,192,192,0,0,192,192);
        let face;
        if(item.face){face=document.createElement('canvas');const painter=faces.createCompanionExpressionPainter(face,q.sprite.peekDecodedCompanionSprite);if(painter.paint(selected,{id:'melt',progress:.5})){ctx.clearRect(0,0,192,192);ctx.drawImage(face,0,0);}else face=undefined;}
        target.plane.style.transform=`translate(${selected.frame.x/80*100}%,${selected.frame.y/80*100}%)`;target.plane.style.clipPath=`inset(${selected.frame.clip.map(n=>n/80*100+'%').join(' ')})`;
        target.painter.paint(selected,item.id,false,undefined,face);target.caption.textContent=item.label;
      }
    });
    await page.screenshot({path:path.join(out,`${version}-DETAIL.png`),fullPage:true});
    results[version]={checks,errors,rejected,hats:setup.hats,representatives}; await page.close();
    if(errors.length||rejected.length)throw Error('Unexpected browser errors/requests');
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(out,'proof.json'),JSON.stringify({baselineCommit,provenance,results,scope:'Actual shared painter/CSS/assets,520poses×12headwear×2facings=12480 per edition. Controlled predecoded headwear textures for geometry; production readiness/performance verified separately.'},null,2));
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>전 동작 귀·모자 비교</title><style>body{margin:20px;background:#f5eedf;color:#514133;font:16px sans-serif}.pair{display:flex;gap:12px}figure{margin:0;flex:1;min-width:0}img{width:100%;height:auto}h2{margin-bottom:6px}</style><h1>520프레임 · 귀4파트 · 모자12종 · 양방향</h1><p>전 origin/main / 후 현재 작업.60고유원화 전체를12종 착용으로 표시. 실제생활/성능 범위는 별도 검사 기록.</p><h2>가까이 비교</h2><div class="pair"><figure><figcaption>전</figcaption><img src="before-DETAIL.png"></figure><figure><figcaption>후</figcaption><img src="after-DETAIL.png"></figure></div>${results.after.hats.map(id=>`<h2>${id}</h2>${[0,1,2].map(p=>`<div class="pair"><figure><figcaption>전</figcaption><img src="before-${id}-${p}.png"></figure><figure><figcaption>후</figcaption><img src="after-${id}-${p}.png"></figure></div>`).join('')}`).join('')}</html>`);
console.log({out,before:results.before.checks.length,after:results.after.checks.length});
