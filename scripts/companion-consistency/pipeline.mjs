// Single entry point for the CURRENT appearance edition. Historical numbered
// generators are immutable evidence and are never invoked to restore old art.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const folder='scripts/companion-consistency', output='.scratch-pw/companion-consistency/pipeline';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';
export function appearanceImpact(scope, nativeKeys, frames) {
  if(!['eyes','body','ears','headwear','all'].includes(scope))throw Error('Scope must be eyes, body, ears, headwear or all');
  const global=['eyes','body','all'].includes(scope), selected=new Set(nativeKeys);
  const affected=scope==='headwear'?[]:frames.filter(frame=>global||!selected.size||selected.has(frame.nativeCell));
  return {scope,nativeKeys:[...new Set(affected.map(frame=>frame.nativeCell))],frames:affected.map(frame=>frame.physicalIndex),
    packets:[...new Set(affected.map(frame=>frame.atlas))],
    stages:scope==='headwear'?['headwear geometry/readiness/live verification']:['material/ownership','native face bake','lossless packing'],
    note:scope==='ears'&&selected.size?'Key list narrows review impact. Publishing still rebuilds the coherent edition; unchanged complete builds use the content cache.':'Global eye/material policy changes intentionally invalidate every dependent pose.'};
}
async function fingerprints(files) {
  const result={};for(const file of [...new Set(files)].sort())result[file]=hash(await fs.readFile(file));return result;
}
async function inputs() {
  const scriptFiles=(await fs.readdir(folder)).filter(name=>name.endsWith('.mjs')).map(name=>`${folder}/${name}`);
  const runtimeFiles=(await fs.readdir('lib/ui/viewer-companion')).filter(name=>name.endsWith('.ts')).map(name=>`lib/ui/viewer-companion/${name}`);
  const metadata=await readJson(`${folder}/input-metadata.json`), receipt=await readJson('art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json');
  const files=[...scriptFiles,...runtimeFiles,`${folder}/input-metadata.json`,`${folder}/native-parts.json`,'scripts/prepare-companion-motion-115.mjs','scripts/prepare-companion-eye-style.mjs',
    'lib/ui/viewer-companion/appearance-policy.json','lib/ui/viewer-companion/hd-motion-sprite.json','lib/ui/viewer-companion/play-motion-sprite.json','lib/ui/viewer-companion/living-motion-sprite.json','lib/ui/viewer-companion/expression-anchors-161.json','lib/ui/viewer-companion/expression-pose-overrides.json',receipt.slots[0].source,...metadata.atlases.map(source=>'public'+source.src)];
  return fingerprints(files);
}
async function outputs() {
  const edition=await readJson('lib/ui/viewer-companion/appearance-edition.json');
  return fingerprints(['lib/ui/viewer-companion/appearance-edition.json',...edition.packets.map(packet=>'public'+packet.src)]);
}
async function doctor() {
  const policy=await readJson('lib/ui/viewer-companion/appearance-policy.json'), anchors=await readJson('lib/ui/viewer-companion/expression-anchors-161.json');
  const reference=anchors.frames.find(frame=>frame.physicalIndex===policy.eye.referencePhysicalIndex), source=reference&&anchors.sources[reference.source];
  assert(source&&source.src===policy.eye.referenceSrc&&source.sha256===policy.eye.referenceSha256,'Reference must bind an observed original source, not a new recursive bake');
  assert.equal(hash(await fs.readFile('public'+source.src)),source.sha256);
  assert(policy.eye.pettingStrokeGain>1&&policy.eye.pettingStrokeGain<=1.3,'Petting line gain is deliberately small');
  assert(policy.eye.pettingArchControl>.36&&policy.eye.pettingArchControl<=1,'Petting arch must be rounded and fit inside the admitted eye corridor');
  assert.equal(policy.material.referenceScope,'same-native-only');
  const painter=await fs.readFile('lib/ui/viewer-companion/expression-painter.ts','utf8');
  assert(painter.includes('policy.eye.referencePhysicalIndex')&&painter.includes('policy.eye.pettingStrokeGain'),'Runtime must use the current policy');
  assert(!/orientation\s*===\s*["']quarter["']\s*\?\s*\.83/.test(painter),'Old double-shrink quarter eye rule returned');
  return {policyVersion:policy.version,referencePhysicalIndex:reference.physicalIndex,referenceSha256:source.sha256,
    superseded:['idle-reference eye sizing','quarter eye .83 multiplier','independent baked body/fit area','unmapped historical attachment coordinates'],
    preserved:['source/native bytes and rejection evidence','intended wink/sad/spiral states','viewer/studio permissions and KST','3 retained/2 inflight body decoder']};
}
const run=(file,args=[])=>{const result=spawnSync(process.execPath,[file,...args],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error(`Failed: ${file} (${result.status})`);};
const vitest=(files)=>run('node_modules/vitest/vitest.mjs',['run',...files,'--testTimeout=15000','--maxWorkers=2']);
export async function main(args=process.argv.slice(2)) {
  const [action='plan',...options]=args, scope=options.find(arg=>arg.startsWith('--scope='))?.slice(8)??'all';
  const keys=(options.find(arg=>arg.startsWith('--native='))?.slice(9)??'').split(',').filter(Boolean).map(Number);
  if(options.some(arg=>arg!=='--force'&&!arg.startsWith('--scope=')&&!arg.startsWith('--native=')))throw Error('Unknown option');
  if(keys.some(key=>!Number.isInteger(key)||key<0||key>=80))throw Error('Native keys must be integers 0..79');
  const edition=await readJson('lib/ui/viewer-companion/appearance-edition.json'), impact=appearanceImpact(scope,keys,edition.frames);
  await fs.mkdir(output,{recursive:true});
  if(action==='plan'){console.log(json(impact));return impact;}
  const health=await doctor();
  if(action==='doctor'){console.log(json(health));return health;}
  if(action==='build'){
    if(scope==='headwear'){console.log('Headwear-only: body/eye packets left unchanged. Run verify --scope=headwear.');return;}
    const before=await inputs(), fingerprint=hash(json(before));let cached;
    try{cached=await readJson(`${output}/build-cache.json`);}catch{ /* Cold cache: derive the current edition. */ }
    if(!options.includes('--force')&&cached?.fingerprint===fingerprint&&JSON.stringify(cached.outputs)===JSON.stringify(await outputs())){
      console.log('CACHE_HIT: verified all input/output hashes; 0 renderer/packer calls. QA is not silently reused.');return;
    }
    const start=performance.now();
    run(`${folder}/prepare-appearance.mjs`);run(`${folder}/bake-style.mjs`);run(`${folder}/prepare-appearance.mjs`,['--styled']);
    assert.deepEqual(await inputs(),before,'Build inputs changed during derivation; do not cache a mixed edition');
    const result={fingerprint,inputs:before,outputs:await outputs(),durationMs:Math.round(performance.now()-start),impact,health};
    await fs.writeFile(`${output}/build-cache.json`,json(result));console.log(json({built:true,durationMs:result.durationMs,packets:33}));return result;
  }
  if(action==='verify'){
    const eye=['tests/unit/companion-expressions-161.test.ts','tests/unit/companion-painted-source-157.test.ts'];
    const body=['tests/unit/companion-material-scale.test.ts','tests/unit/viewer-companion-mouth.test.ts','tests/unit/viewer-companion-sofa-pose.test.ts'];
    const hats=['tests/unit/companion-accessory.test.ts','tests/unit/companion-accessory-art.test.ts','tests/unit/companion-accessory-sleep-mask-115.test.ts'];
    vitest(scope==='all'?['companion']:['tests/unit/companion-appearance.test.ts',...(['eyes'].includes(scope)?eye:scope==='body'?body:['ears','headwear'].includes(scope)?hats:[])]);
    if(['all','eyes'].includes(scope))run(`${folder}/eye-audit.mjs`);
    if(['all','ears','headwear'].includes(scope)){run(`${folder}/readiness-audit.mjs`);run(`${folder}/full-audit.mjs`);}
    const proof={scope,health,outputs:await outputs(),note:'Offline/unit/source-browser checks only. Production React interaction and actual device evidence are separate gates.'};
    await fs.writeFile(`${output}/verify-${scope}.json`,json(proof));return proof;
  }
  if(action==='report'){run(`${folder}/full-audit.mjs`);return;}
  throw Error('Use plan, doctor, build, verify or report');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
