import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
// @ts-expect-error Local Windows-only QA maintenance, never a product dependency.
import {safeCacheRelative,regularPath,cacheExcluded,referencedCache,discoverReferences,options,validatePlan} from '../../scripts/site-daily/qa-reclaim.mjs';

const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const source=[{path:'package.json',sha256:'b'.repeat(64)}];
const freeze={sourceFiles:source,contentDigest:sha(JSON.stringify(source))};
const build={buildId:'fixed',productKey:'product',files:[{path:'BUILD_ID',sha256:'a'.repeat(64)}]};
const result={schemaVersion:1,kind:'focused-native-result',evidence:[],buildId:'fixed',productKey:'product',integrity:{ownedProcessesClosed:true,sourceUnchanged:true}};
const cache='.scratch-pw/site-daily/native/closed-run/workspace/.next/cache';

describe('QA reproducible cache reclamation',()=>{
  it('only accepts exact QA workspace Next caches, with no sources, build output, raw failure or traversal',()=>{
    for(const p of [cache,'.scratch157/closed/workspace/.next/cache'])expect(safeCacheRelative(p)).toBe(true);
    for(const p of ['.next/cache','.scratch-pw/workspace/.next/cache','.scratch-pw/run/.next/cache',cache+'/webpack',cache+'/../server','.scratch-pw/run/workspace/.next','.scratch-pw/run/workspace/.next/server','.scratch-pw/run/workspace/public/cache','.scratch-pw/../run/workspace/.next/cache','.scratch-pw/run /workspace/.next/cache','.scratch-pw/run/workspace/.next/cache:stream','.scratch-pw/art-src/workspace/.next/cache',cache.replaceAll('/','\\')])expect(safeCacheRelative(p)).toBe(false);
  });
  it('requires a closed focused build and source manifests proving the cache is excluded',()=>{
    expect(cacheExcluded(build,freeze,result)).toBe(true);
    for(const r of [{...result,kind:'unknown'},{...result,buildId:'changed'},{...result,productKey:'changed'},{...result,integrity:{ownedProcessesClosed:false,sourceUnchanged:true}},{...result,integrity:{ownedProcessesClosed:true,sourceUnchanged:false}}])expect(cacheExcluded(build,freeze,r)).toBe(false);
    for(const b of [{...build,files:[]},{...build,files:[{path:'cache/webpack/data.pack',sha256:'a'.repeat(64)}]},{...build,files:[{path:'CACHE/webpack/data.pack',sha256:'a'.repeat(64)}]},{...build,files:[{path:'CaChe',sha256:'a'.repeat(64)}]},{...build,files:[{path:'cache',sha256:'a'.repeat(64)}]},{...build,files:[{path:'BUILD_ID',sha256:'invalid'}]}])expect(cacheExcluded(b,freeze,result)).toBe(false);
    for(const p of ['../cache/file','.next/../cache/file','C:/cache/file','cache\\file','/cache/file','cache//file'])expect(cacheExcluded({...build,files:[{path:p,sha256:'a'.repeat(64)}]},freeze,result)).toBe(false);
    expect(cacheExcluded(build,freeze,{...result,schemaVersion:2})).toBe(false);
    expect(cacheExcluded(build,freeze,{...result,evidence:null})).toBe(false);
    expect(cacheExcluded(build,{...freeze,contentDigest:'a'.repeat(64)},result)).toBe(false);
    const rows=[{path:'.next/cache/file',sha256:'b'.repeat(64)}];
    expect(cacheExcluded(build,{sourceFiles:rows,contentDigest:sha(JSON.stringify(rows))},result)).toBe(false);
    const mixed=[{path:'.NeXt/cache/file',sha256:'b'.repeat(64)}];
    expect(cacheExcluded(build,{sourceFiles:mixed,contentDigest:sha(JSON.stringify(mixed))},result)).toBe(false);
  });
  it('protects explicit report links in encoded, slash, Windows and JSON escaped forms',()=>{
    const root=path.resolve('C:/Project');
    for(const text of [cache,cache.toUpperCase(),cache.replaceAll('/','\\'),JSON.stringify({evidence:cache.replaceAll('/','\\')}),encodeURIComponent(cache),'old <a href="file:///C:/Project/'+cache+'">cache</a>'])expect(referencedCache(cache,root,text)).toBe(true);
    expect(referencedCache(cache,root,'workspace/.next/cache',path.join(root,'.scratch-pw/site-daily/native/closed-run/report.html'))).toBe(true);
    expect(referencedCache(cache,root,'../.next/cache/webpack/data.pack',path.join(root,'.scratch-pw/site-daily/native/closed-run/workspace/test/report.html'))).toBe(true);
    expect(referencedCache(cache,root,'policy explains workspace/.next/cache and .next/cache/webpack',path.join(root,'docs/report.html'))).toBe(false);
    const outside=path.join(root,'.scratch-pw/foo/report.html');
    for(const text of ['<a href="../site-daily/native/closed-run/workspace/.next/cache/a.pack">original cache</a>','<img src="../site-daily/native/closed-run/workspace/.next/cache/a.pack">','[cache](../site-daily/native/closed-run/workspace/.next/cache/a.pack)','[cache](<../site-daily/native/closed-run/workspace/.next/cache/a%20pack>)'])expect(referencedCache(cache,root,text,outside)).toBe(true);
    expect(referencedCache(cache,root,'[reference](https://example.com/workspace/.next/cache/)',outside)).toBe(false);
    expect(referencedCache(cache,root,'run/workspace/.next/server/app.html, video.webm, trace.zip')).toBe(false);
  });
  it('plans by default and bounds explicit apply, with cold-by-default and immediate closed-cache opt-in',()=>{
    expect(options([])).toMatchObject({apply:false,minAgeHours:24,maxCaches:100,minutes:10});
    expect(options(['--min-age-hours','0'])).toMatchObject({minAgeHours:0});
    for(const args of [['--apply'],['--plan','a.json'],['--minutes','61'],['--max-caches','1001'],['--max-files','1000001'],['--min-age-hours','-1'],['--qa-root','../scratch'],['--qa-root','.scratch-pw/nested'],['--unknown','x']])expect(()=>options(args)).toThrow();
    expect(options(['--apply','--plan','a.json','--plan-sha','a'.repeat(64)])).toMatchObject({apply:true});
  });
  it('requires the exact protected state/reference set and rejects widened, duplicate or malformed plan content',()=>{
    const o=options([]),file={path:cache+'/webpack/a.pack',sha256:'a'.repeat(64),nlink:1,size:42,allocatedBytes:4096};
    const row={path:cache,controls:[{sha256:'a'.repeat(64)},{sha256:'b'.repeat(64)},{sha256:'c'.repeat(64)}],directories:[{path:cache}],files:[file]};
    const plan={schemaVersion:1,kind:'qa-reclaim-plan',at:new Date().toISOString(),root:o.root,states:o.states.map((p:string)=>({path:p,missing:true})),references:o.references.map((p:string)=>({path:p,sha256:'a'.repeat(64)})),caches:[row]};
    expect(validatePlan(plan,o)).toHaveLength(1);
    for(const p of [{...plan,root:path.dirname(o.root)},{...plan,states:[]},{...plan,references:[{path:'unbound'}]},{...plan,at:'2000-01-01'},{...plan,caches:[row,row]},{...plan,caches:[{...row,path:'.scratch-pw/other/workspace/.next/cache'}]},{...plan,caches:[{...row,files:[file,file]}]},{...plan,caches:[{...row,files:[{...file,nlink:2}]}]},{...plan,caches:[{...row,files:[{...file,path:cache+'/../server/a.js'}]}]},{...plan,caches:[{...row,directories:[{path:cache},{path:'.scratch-pw/elsewhere'}]}]},{...plan,caches:[{...row,files:[{...file,sha256:'invalid'}]}]}])expect(()=>validatePlan(p,o)).toThrow();
    expect(()=>validatePlan(plan,{...o,maxBytes:41})).toThrow('budget');
  });
  it('automatically protects reports, plans and primary state metadata without reading raw QA contents',()=>{
    const parent=path.resolve('.scratch-pw');fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'reclaim-references-'));
    for(const p of ['docs/agent/reports/report.html','docs/agent/plans/plan.md','docs/agent/CURRENT_STATE.md','.scratch-pw/site-daily/state.json','.scratch-pw/site-daily/history.json','.scratch-pw/raw/video.webm','.scratch-pw/raw/huge-report.json']){const full=path.join(root,...p.split('/'));fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,'{}');}
    const discovery=discoverReferences([root]);expect(discovery.files).toHaveLength(5);expect(discovery.files.some((p:string)=>p.includes('raw'))).toBe(false);expect(discovery.rawEvidenceContentsScanned).toBe(false);
    const o=options(['--state',path.join(root,'.scratch-pw/site-daily/state.json')]);expect(o.references).toContain(path.join(root,'docs/agent/reports/report.html'));
    expect(()=>discoverReferences([root],{maxFiles:1})).toThrow('limit');
    expect(()=>discoverReferences([root],{maxBytes:1})).toThrow('limit');
    fs.symlinkSync(path.join(root,'docs/agent/plans'),path.join(root,'docs/agent/reports/linked'),'junction');expect(()=>discoverReferences([root])).toThrow('linked');
  });
  it('rejects a junction in every target path segment',()=>{
    const parent=path.resolve('.scratch-pw');fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'reclaim-links-'));
    fs.mkdirSync(path.join(root,'.scratch-pw','real'),{recursive:true});fs.writeFileSync(path.join(root,'.scratch-pw','real','file.json'),'retained');
    fs.symlinkSync(path.join(root,'.scratch-pw','real'),path.join(root,'.scratch-pw','linked'),'junction');
    expect(()=>regularPath(root,'.scratch-pw/linked/file.json')).toThrow('linked');
    expect(regularPath(root,'.scratch-pw/real/file.json')).toBe(path.join(root,'.scratch-pw','real','file.json'));
  });
  it.skipIf(process.platform!=='win32')('removes only a pre-hashed synthetic UTF-8 cache and retains the build, source and raw failures',({skip})=>{
    const parent=path.resolve('.scratch-pw');fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'reclaim-native-'));
    const relative='.scratch-pw/한글 실행/workspace/.next/cache',folder=path.join(root,...relative.split('/'));fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,'캐시.pack'),content='재생성 가능한 캐시'.repeat(8192);fs.writeFileSync(file,content);
    const retained=['.scratch-pw/한글 실행/workspace/.next/BUILD_ID','.scratch-pw/한글 실행/workspace/source.ts','.scratch-pw/한글 실행/failure.webm','.scratch-pw/한글 실행/result.json'];
    for(const p of retained){fs.writeFileSync(path.join(root,...p.split('/')),'retained original');}
    const request=path.join(root,'request.json'),output=path.join(root,'native.json');
    const helper=path.resolve('scripts/site-daily/qa-reclaim-native.ps1');
    fs.writeFileSync(request,JSON.stringify({mode:'environment',root,ignorePid:process.pid,output}),'utf8');
    const environment=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Request',request],{encoding:'utf8',windowsHide:true,maxBuffer:1048576,timeout:30000});
    expect(environment.error).toBeUndefined();expect(environment.status).toBe(0);
    if(JSON.parse(fs.readFileSync(output,'utf8')).activeProcesses.length)skip();
    fs.writeFileSync(request,JSON.stringify({mode:'remove-cache',root,ignorePid:process.pid,deadline:Date.now()+60000,states:[],references:[],output,journal:path.join(root,'journal.jsonl'),caches:[{path:relative,controls:[],directories:[{path:relative}],files:[{path:relative+'/캐시.pack',sha256:sha(content),size:Buffer.byteLength(content)}]}]}),'utf8');
    const child=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/site-daily/qa-reclaim-native.ps1'),'-Request',request],{encoding:'utf8',windowsHide:true,maxBuffer:1048576,timeout:60000});
    expect(child.error).toBeUndefined();expect(child.status).toBe(0);const native=JSON.parse(fs.readFileSync(output,'utf8'));
    expect(native.failure).toBeNull();expect(native.caches[0]).toMatchObject({status:'removed',preDeletionHashesVerified:true,files:1});expect(native.caches[0].allocatedBefore).toBeGreaterThan(0);expect(fs.existsSync(folder)).toBe(false);
    for(const p of retained)expect(fs.readFileSync(path.join(root,...p.split('/')),'utf8')).toBe('retained original');
  });
});
