import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
// @ts-expect-error Offline Windows maintenance tooling, never an app import.
import {safeQaRelative,activeState,eligible,sameIdentity,pendingCandidates,regularQa,options,validatePlan} from '../../scripts/site-daily/qa-storage.mjs';
const now=Date.now();
const stat=(extra:Record<string,unknown>={})=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:100000,mtimeMs:now-48*3600000,birthtimeMs:now-48*3600000,dev:1,ino:2,...extra});
describe('cold QA in-place storage safety',()=>{
  it('allows only explicit scratch roots and rejects traversal, secrets, originals and its own ledger',()=>{
    for(const file of ['.scratch-pw/native/workspace/.next/chunk.js','.scratch157/failure/report.json'])expect(safeQaRelative(file)).toBe(true);
    for(const file of ['../.scratch-pw/a.json','.scratch-pw/../a.json','.scratch-pw//a.json','.scratch-pw/a:stream','.scratch-pw\\a.json','.scratch-pw/.. /a.json','.scratch-pw/a./b.json','.scratch-pw/*.json','.scratch-pw/nul.json','public/a.json','.scratch-pw/art-src/a.json','.scratch-pw/.env.local','.scratch-pw/node_modules/a.js','.scratch-pw/recovery/a.json','.scratch-pw/site-daily/storage/x/plan.json'])expect(safeQaRelative(file)).toBe(false);
  });
  it('skips recent, copied-today, media, hard-linked, huge and non-regular content',()=>{
    expect(eligible('.scratch-pw/old/report.json',stat(),{now})).toBe(true);
    for(const s of [stat({mtimeMs:now}),stat({birthtimeMs:now}),stat({nlink:2}),stat({size:300000000}),stat({isSymbolicLink:()=>true}),stat({isFile:()=>false})])expect(eligible('.scratch-pw/old/report.json',s,{now})).toBe(false);
    expect(eligible('.scratch-pw/old/video.webm',stat(),{now})).toBe(false);
    expect(eligible('.scratch-pw/old/trace.zip',stat(),{now})).toBe(false);
  });
  it('blocks every known active or frozen work field without treating absent fields as active',()=>{
    expect(activeState({activeWork:null,sourceFrozen:false})).toBe(false);
    for(const key of ['activeRun','activeWork','activeFactory','sourceFreeze','sourceFrozen'])expect(activeState({[key]:true})).toBe(true);
  });
  it('requires explicit pinned apply and bounded daily options',()=>{
    expect(options([])).toMatchObject({apply:false,minutes:3,maxBytes:2147483648,maxFiles:1000,minAgeHours:24});
    for(const args of [['--apply'],['--plan','a.json'],['--min-age-hours','1'],['--qa-root','../oops'],['--max-files','10001'],['--minutes','61']])expect(()=>options(args)).toThrow();
    expect(options(['--apply','--plan','a.json','--plan-sha','a'.repeat(64)])).toMatchObject({apply:true});
  });
  it('rejects candidate replacement, new hard links, size or timestamp changes',()=>{
    const a=stat();expect(sameIdentity(a,{...a})).toBe(true);
    for(const change of [{ino:3},{nlink:2},{size:100001},{mtimeMs:now},{birthtimeMs:now},{dev:2}])expect(sameIdentity(a,{...a,...change})).toBe(false);
  });
  it('does not let an unchanged already-compressed large file starve smaller pending files',()=>{
    const big={relative:'.scratch-pw/old/large.json',stat:stat({size:1000000})},small={relative:'.scratch-pw/old/small.json',stat:stat()};
    const inspected={path:big.relative,size:big.stat.size,mtimeMs:big.stat.mtimeMs,ino:big.stat.ino,compressionState:'already-compressed-inspected',qaOutcome:null};
    expect(pendingCandidates([big,small],[big.relative,small.relative],[inspected]).map((x:{relative:string})=>x.relative)).toEqual([small.relative]);
    expect(pendingCandidates([{...big,stat:stat({size:1000000,mtimeMs:now})},small],[],[inspected])).toHaveLength(2);
  });
  it('rejects plan reuse outside the project, duplicate files, widened limits or active state',()=>{
    const o=options([]),row={path:'.scratch-pw/old/report.json',sha256:'a'.repeat(64),size:100000,nlink:1},p={schemaVersion:1,kind:'qa-storage-plan',root:o.root,at:new Date().toISOString(),states:[],references:[],files:[row]};
    expect(validatePlan(p,o)).toHaveLength(1);
    for(const bad of [{...p,root:path.dirname(o.root)},{...p,at:'2020-01-01T00:00:00Z'},{...p,at:'malformed'},{...p,files:[row,row]},{...p,files:[row,{...row,path:'.scratch-pw/old/REPORT.json'}]},{...p,files:[{...row,path:'public/a.json'}]},{...p,states:[{path:o.states[0],active:true}]}])expect(()=>validatePlan(bad,o)).toThrow();
    expect(()=>validatePlan(p,{...o,maxBytes:99999})).toThrow('budget');
  });
  it('checks each filesystem segment so a QA junction cannot escape the approved root',()=>{
    const parent=path.resolve('.scratch-pw');fs.mkdirSync(parent,{recursive:true});
    const root=fs.mkdtempSync(path.join(parent,'storage-test-'));fs.mkdirSync(path.join(root,'.scratch-pw'));
    fs.writeFileSync(path.join(root,'.scratch-pw','real.json'),'fixed');
    expect(regularQa(root,'.scratch-pw/real.json')).toBe(path.join(root,'.scratch-pw','real.json'));
    fs.symlinkSync(path.resolve('scripts'),path.join(root,'.scratch-pw','linked'),'junction');
    expect(()=>regularQa(root,'.scratch-pw/linked/site-daily/qa-storage.mjs')).toThrow('linked');
    expect(()=>regularQa(root,'.scratch-pw/../real.json')).toThrow('unsafe');
  });
  it.skipIf(process.platform!=='win32')('reads UTF-8 without BOM requests with Korean names and spaces in actual Windows PowerShell',()=>{
    const parent=path.resolve('.scratch-pw');fs.mkdirSync(parent,{recursive:true});
    const root=fs.mkdtempSync(path.join(parent,'storage-utf8-test-')),folder=path.join(root,'.scratch-pw','한글 폴더');fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,'한글 파일.html');fs.writeFileSync(file,'<!doctype html><p>한글 경로를 그대로 유지합니다.</p>'.repeat(2000),'utf8');
    const request=path.join(root,'request.json'),output=path.join(root,'native.json');
    fs.writeFileSync(request,JSON.stringify({mode:'inspect',root,paths:[file],ignorePid:process.pid,output}),'utf8');
    expect(fs.readFileSync(request).subarray(0,3)).not.toEqual(Buffer.from([0xef,0xbb,0xbf]));
    const child=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/site-daily/qa-storage-native.ps1'),'-Request',request],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024,timeout:20000});
    expect(child.error).toBeUndefined();expect(child.status).toBe(0);
    const native=JSON.parse(fs.readFileSync(output,'utf8'));
    expect(native.files).toHaveLength(1);expect(native.files[0].path).toBe(file);expect(native.files[0].error).toBeUndefined();
    expect(native.files[0].size).toBe(fs.statSync(file).size);
  });
});
