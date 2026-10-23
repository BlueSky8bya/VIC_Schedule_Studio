import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error Offline evidence tooling does not enter the app runtime.
import {sha,hashJson,manifest,verifyRun,verifyBuildReceipt,selectBuildReceipt,readBuildHistory,rememberBuildReceipt} from '../../scripts/site-daily/receipts.mjs';
// @ts-expect-error Offline QA selection.
import {nativeCaseFingerprint,productDependencies,continuationCases} from '../../scripts/site-daily/selection.mjs';
// @ts-expect-error Offline QA runner.
import {options,buildHistoryCandidateFile} from '../../scripts/site-daily/scoped-native.mjs';

const catalog=JSON.parse(fs.readFileSync(path.resolve('scripts/site-daily/native-catalog.json'),'utf8'));
function fixture({globalError=true,passed=false,at='2026-10-23T04:00:00Z'}={}){
  fs.mkdirSync(path.resolve('.scratch-pw'),{recursive:true});
  const dir=fs.mkdtempSync(path.resolve('.scratch-pw/build-receipt-')),workspace=path.join(dir,'workspace');
  function put(relative:string,bytes:string){const file=path.join(workspace,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  put('app/product.ts','export const product = 1;');put('package-lock.json','{"lockfileVersion":3}');put('tests/visual/example.spec.ts','original test');put('scripts/companion-qa/network-guard.mjs','fixed guard');
  put('.next/BUILD_ID','exact-build');put('.next/server/product.js','compiled product');put('scoped.generated.config.ts','fixed-config');
  const sourceFiles=manifest(workspace,{exclude:(p:string)=>p==='.next'||p.startsWith('.next/')||p==='scoped.generated.config.ts'});
  const runtime={node:'v22.14.0',platform:process.platform,arch:process.arch,next:'15.5.28','@playwright/test':'1.60.0','playwright-core':'1.60.0',chromiumExecutableSha:'b'.repeat(64)};
  const productKey=hashJson({files:productDependencies(sourceFiles),runtime}),c=catalog.cases[0];
  const freeze={head:'a'.repeat(40),sourceFiles,contentDigest:hashJson(sourceFiles),credentialsCopied:0,privateArtCopied:0};
  const build={buildId:'exact-build',productKey,files:manifest(path.join(workspace,'.next'))};
  const plan={companion:{selection:{cases:[c]},dailyScenarios:catalog.dailyScenarios}};
  const reporter={errors:globalError?[{message:'\u001b[31mTesting stopped early after 3 maximum allowed failures.\u001b[39m'}]:[],suites:[{file:c.file,specs:[{title:c.title,tests:[{projectName:'',expectedStatus:'passed',status:passed?'expected':'unexpected',results:[{status:passed?'passed':'failed',retry:0,duration:200,errors:passed?[]:[{message:'test assertion failed'}]}]}]}]}]};
  const result={schemaVersion:1,kind:'focused-native-result',at,day:'2026-10-23',fullCertification:false,listOnly:false,buildId:'exact-build',productKey,runtime,integrity:{sourceUnchanged:true,guardsClear:true,ownedProcessesClosed:true},executedIds:[c.id],cases:[{id:c.id,outcome:passed?'passed':'failed',fingerprint:nativeCaseFingerprint({sourceFiles,item:c,buildId:'exact-build',dailyScenarios:catalog.dailyScenarios,runtime})}],stages:[{name:'metadata',code:0},{name:'build',code:0},{name:'registration',code:0},{name:'native',code:passed?0:1}],failure:passed?null:'selected-native-failed-or-budget',buildReuse:null as null|{version:number,verification:string,receipt:string,sha256:string},evidence:[] as {path:string,sha256:string}[]};
  function seal(){
    for(const [file,value] of Object.entries({'source-freeze.json':freeze,'build.json':build,'plan.json':plan,'playwright.json':reporter,'registration.json':reporter}))fs.writeFileSync(path.join(dir,file),JSON.stringify(value));
    result.evidence=manifest(dir,{exclude:(p:string)=>p==='workspace'||p.startsWith('workspace/')||p==='result.json'});
    result.evidence.push({path:'workspace/scoped.generated.config.ts',sha256:sha(Buffer.from('fixed-config'))});
    const file=path.join(dir,'result.json');fs.writeFileSync(file,JSON.stringify(result));return {file,sha256:sha(fs.readFileSync(file))};
  }
  return {dir,workspace,result,freeze,build,reporter,c,seal};
}
describe('build-only reuse is independent of case PASS certification',()=>{
  it('reuses the exact completed build after maxFailures but still rejects the original case receipt',()=>{
    const f=fixture(),ref=f.seal(),verified=verifyBuildReceipt(ref.file,ref.sha256);
    expect(verified).toMatchObject({buildVerified:true,casePassReusable:false,proofs:[]});
    expect(verified.result.cases[0].outcome).toBe('failed');
    expect(continuationCases([f.c],verified.proofs,()=>f.result.cases[0].fingerprint).reuse).toHaveLength(0);
    expect(()=>verifyRun(ref.file,ref.sha256)).toThrow('global-reporter-error');
  });
  it('keeps a normal assertion failure failed while allowing only its immutable build',()=>{
    const f=fixture({globalError:false}),ref=f.seal();expect(verifyBuildReceipt(ref.file,ref.sha256).buildVerified).toBe(true);
    expect(verifyRun(ref.file,ref.sha256).proofs[0].outcome).toBe('failed');
  });
  it('requires a pinned digest and all original control/report hashes',()=>{
    const f=fixture(),ref=f.seal();expect(()=>verifyBuildReceipt(ref.file)).toThrow('pinned');
    expect(()=>verifyBuildReceipt(ref.file,'f'.repeat(64))).toThrow('invalid-result');
    fs.appendFileSync(path.join(f.dir,'playwright.json'),' ');expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('hash');
  });
  for(const field of ['sourceUnchanged','guardsClear','ownedProcessesClosed'] as const)it(`rejects an unfinished or unsafe ${field} receipt`,()=>{
    const f=fixture();f.result.integrity[field]=false;const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('incomplete-build');
  });
  it('rejects environment/unknown global errors even when result booleans say clear',()=>{
    const f=fixture();f.reporter.errors=[{message:'Worker process crashed unexpectedly'}];const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('environment');
    const g=fixture();g.result.failure='owned-fixture-not-ready';const other=g.seal();expect(()=>verifyBuildReceipt(other.file,other.sha256)).toThrow('incomplete-build');
  });
  it('rejects an actual network denial even if a forged summary claims guardsClear',()=>{
    const f=fixture();fs.writeFileSync(path.join(f.dir,'network-denied.jsonl'),'denied\n');const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('network-guard-denial');
  });
  it('rejects modified source and new eligible source files not in the frozen manifest',()=>{
    const f=fixture(),ref=f.seal();fs.appendFileSync(path.join(f.workspace,'app/product.ts'),'changed');expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('hash');
    const g=fixture(),other=g.seal();fs.writeFileSync(path.join(g.workspace,'app/injected.ts'),'new source');expect(()=>verifyBuildReceipt(other.file,other.sha256)).toThrow('source-file-set');
  });
  it('rejects injected build output and a mismatched BUILD_ID binding',()=>{
    const f=fixture(),ref=f.seal();fs.writeFileSync(path.join(f.workspace,'.next/injected.js'),'new build');expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('build-file-set');
    const g=fixture();g.build.buildId='other-build';const other=g.seal();expect(()=>verifyBuildReceipt(other.file,other.sha256)).toThrow('build-binding');
  });
  it('ignores only the deliberately unbound disposable .next/cache subtree',()=>{
    const f=fixture();fs.mkdirSync(path.join(f.workspace,'.next/cache'),{recursive:true});fs.writeFileSync(path.join(f.workspace,'.next/cache/webpack.pack'),'disposable bytes');const ref=f.seal();
    const v=verifyBuildReceipt(ref.file,ref.sha256);expect(v.build.files.some((x:{path:string})=>x.path.startsWith('cache/'))).toBe(false);
  });
  it('fails closed on unknown/missing runtime keys and changed product dependency identity',()=>{
    const f=fixture();delete (f.result.runtime as Partial<typeof f.result.runtime>).next;const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('runtime');
    const g=fixture();g.result.runtime.next='99.0.0';const other=g.seal();expect(()=>verifyBuildReceipt(other.file,other.sha256)).toThrow('binding');
  });
  it('does not accept an unsuccessful metadata/build stage or leaked source credentials',()=>{
    const f=fixture();f.result.stages[1].code=1;const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('build-stage');
    const g=fixture();g.freeze.credentialsCopied=1;const other=g.seal();expect(()=>verifyBuildReceipt(other.file,other.sha256)).toThrow('source-digest');
  });
  it('can reuse build inputs after a test-only change without treating that as a reusable case PASS',()=>{
    const a=fixture(),first=a.seal(),b=fixture();
    fs.appendFileSync(path.join(b.workspace,'tests/visual/example.spec.ts'),' updated oracle');
    b.freeze.sourceFiles=b.freeze.sourceFiles.map((f:{path:string,sha256:string})=>({...f,sha256:sha(fs.readFileSync(path.join(b.workspace,f.path)))}));b.freeze.contentDigest=hashJson(b.freeze.sourceFiles);
    b.result.stages=[{name:'verified-product-build-reuse',code:0},{name:'registration',code:0},{name:'native',code:1}];
    b.result.buildReuse={version:1,verification:'build',receipt:first.file,sha256:first.sha256};
    const second=b.seal(),v=verifyBuildReceipt(second.file,second.sha256);expect(v.result.productKey).toBe(a.result.productKey);expect(v.proofs).toEqual([]);
    expect(()=>verifyRun(second.file,second.sha256)).toThrow('global-reporter');
  });
  it('rejects unbound legacy reuse provenance and recursive or altered origins',()=>{
    const f=fixture();f.result.stages=[{name:'verified-product-build-reuse',code:0},{name:'registration',code:0},{name:'native',code:1}];const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('unbound-build-origin');
    const a=fixture(),first=a.seal(),b=fixture();b.result.stages=f.result.stages;b.result.buildReuse={version:1,verification:'build',receipt:first.file,sha256:'f'.repeat(64)};const second=b.seal();expect(()=>verifyBuildReceipt(second.file,second.sha256)).toThrow('invalid-result');
  });
  it('selects only pinned matching product candidates and records invalid ones instead of trusting them',()=>{
    const a=fixture(),first=a.seal(),b=fixture({at:'2026-10-23T05:00:00Z'}),second=b.seal();
    const refs=[{receipt:first.file,sha256:first.sha256},{receipt:second.file,sha256:'f'.repeat(64)}];
    const choice=selectBuildReceipt(refs,a.result.productKey);expect(choice.selected.receipt).toBe(first.file);expect(choice.rejected).toHaveLength(1);
    expect(selectBuildReceipt(refs,'f'.repeat(64)).selected).toBeUndefined();expect(()=>selectBuildReceipt({},a.result.productKey)).toThrow('history');
  });
  it('falls back from an unbound legacy reuse candidate to its valid original build',()=>{
    const a=fixture(),original=a.seal(),b=fixture({at:'2026-10-23T05:00:00Z'});b.result.stages=[{name:'verified-product-build-reuse',code:0},{name:'registration',code:0},{name:'native',code:1}];const legacy=b.seal();
    const choice=selectBuildReceipt([{receipt:original.file,sha256:original.sha256},{receipt:legacy.file,sha256:legacy.sha256}],a.result.productKey);
    expect(choice.selected.receipt).toBe(original.file);expect(choice.rejected).toEqual([{receipt:legacy.file,reason:'unbound-build-origin'}]);
    const none=selectBuildReceipt([{receipt:legacy.file,sha256:legacy.sha256}],a.result.productKey);expect(none.selected).toBeUndefined();expect(none.rejected[0].reason).toBe('unbound-build-origin');
  });
  it('keeps list-only/full certification and ambiguous candidate sources ineligible',()=>{
    const f=fixture();f.result.listOnly=true;const ref=f.seal();expect(()=>verifyBuildReceipt(ref.file,ref.sha256)).toThrow('incomplete-build');
    expect(()=>options(['--plan','x','--reuse-build','r','--build-receipt-sha','s','--continue-from','p','--receipt-sha','q'])).toThrow('invalid-scoped');
    expect(buildHistoryCandidateFile(options(['--plan','x','--reuse-build','r','--build-receipt-sha','s','--build-history','h']))).toBeUndefined();
    expect(options(['--plan','x','--build-history','h']).buildHistory).toBe('h');
  });
});
describe('automatic bounded build history prevents tomorrow from rebuilding failed-test builds',()=>{
  it('records a failed-test build as a pinned build hint and leaves the original failure immutable',()=>{
    const f=fixture(),ref=f.seal(),index=path.join(f.dir,'build-history.json'),before=sha(fs.readFileSync(ref.file));
    const receipt=rememberBuildReceipt(ref.file,ref.sha256,index),rows=readBuildHistory(index);
    expect(receipt).toMatchObject({entries:1,casePassReuse:false});expect(rows[0]).toMatchObject({receipt:ref.file,sha256:ref.sha256,productKey:f.result.productKey,buildId:f.result.buildId});
    expect(sha(fs.readFileSync(ref.file))).toBe(before);expect(()=>verifyRun(ref.file,ref.sha256)).toThrow('global-reporter');
    expect(selectBuildReceipt(rows,f.result.productKey).selected.buildVerified).toBe(true);
  });
  it('automatically chooses the owned index unless a pinned command or explicit override takes priority',()=>{
    const f=fixture(),index=path.join(f.dir,'.scratch-pw/site-daily/build-history.json');fs.mkdirSync(path.dirname(index),{recursive:true});fs.writeFileSync(index,'[]');
    expect(buildHistoryCandidateFile({root:f.dir})).toBe(index);
    expect(buildHistoryCandidateFile({root:f.dir,buildHistory:'explicit.json'})).toBe('explicit.json');
    expect(buildHistoryCandidateFile({root:f.dir,prior:'case-run'})).toBeUndefined();expect(buildHistoryCandidateFile({root:f.dir,reuseBuild:'pinned-build'})).toBeUndefined();
    expect(buildHistoryCandidateFile({root:path.join(f.dir,'missing')})).toBeUndefined();
  });
  it('folds copied build receipts to one verified compile origin rather than growing a daily chain',()=>{
    const a=fixture(),first=a.seal(),b=fixture({at:'2026-10-23T05:00:00Z'}),index=path.join(b.dir,'build-history.json');
    b.result.stages=[{name:'verified-product-build-reuse',code:0},{name:'registration',code:0},{name:'native',code:1}];b.result.buildReuse={version:1,verification:'build',receipt:first.file,sha256:first.sha256};const second=b.seal();
    rememberBuildReceipt(first.file,first.sha256,index);const saved=rememberBuildReceipt(second.file,second.sha256,index);
    expect(saved.entries).toBe(1);expect(saved.remembered).toMatchObject({receipt:first.file,sha256:first.sha256});expect(readBuildHistory(index)[0].receipt).toBe(first.file);
  });
  it('caps unique product/build identities and removes duplicates without deleting any raw evidence',()=>{
    const a=fixture(),index=path.join(a.dir,'build-history.json'),refs=[];
    for(let i=1;i<=3;i++){
      const f=fixture({at:`2026-10-23T0${i}:00:00Z`});f.result.buildId=`build-${i}`;f.build.buildId=f.result.buildId;fs.writeFileSync(path.join(f.workspace,'.next/BUILD_ID'),f.result.buildId);f.build.files=manifest(path.join(f.workspace,'.next'));const ref=f.seal();refs.push(ref);
      rememberBuildReceipt(ref.file,ref.sha256,index,{maxEntries:2});
    }
    const kept=readBuildHistory(index);expect(kept).toHaveLength(2);expect(kept.map((x:{buildId:string})=>x.buildId)).toEqual(['build-3','build-2']);
    for(const ref of refs)expect(sha(fs.readFileSync(ref.file))).toBe(ref.sha256);
    rememberBuildReceipt(refs[2].file,refs[2].sha256,index,{maxEntries:2});expect(readBuildHistory(index)).toHaveLength(2);
  });
  it('refuses unsafe/unfinished builds without creating an index and preserves malformed existing indexes',()=>{
    const f=fixture();f.result.integrity.ownedProcessesClosed=false;const ref=f.seal(),index=path.join(f.dir,'build-history.json');expect(()=>rememberBuildReceipt(ref.file,ref.sha256,index)).toThrow('incomplete-build');expect(fs.existsSync(index)).toBe(false);
    const g=fixture(),good=g.seal(),badIndex=path.join(g.dir,'build-history.json');fs.writeFileSync(badIndex,'{"not":"a receipt array"}');const digest=sha(fs.readFileSync(badIndex));expect(()=>rememberBuildReceipt(good.file,good.sha256,badIndex)).toThrow('invalid-build-history');expect(sha(fs.readFileSync(badIndex))).toBe(digest);expect(fs.existsSync(badIndex+'.lock')).toBe(false);
  });
  it('does not overwrite an index when another owned writer holds its lock',()=>{
    const f=fixture(),ref=f.seal(),index=path.join(f.dir,'build-history.json');fs.writeFileSync(index,'[]');fs.writeFileSync(index+'.lock','another writer');
    expect(()=>rememberBuildReceipt(ref.file,ref.sha256,index)).toThrow();expect(fs.readFileSync(index,'utf8')).toBe('[]');expect(fs.readFileSync(index+'.lock','utf8')).toBe('another writer');
  });
  it('drops tampered header hints during atomic refresh and never uses them for a build or PASS',()=>{
    const f=fixture(),ref=f.seal(),index=path.join(f.dir,'build-history.json');fs.writeFileSync(index,JSON.stringify([{receipt:ref.file,sha256:'f'.repeat(64)}]));
    const refreshed=rememberBuildReceipt(ref.file,ref.sha256,index);expect(refreshed.rejected).toEqual([{receipt:ref.file,reason:'invalid-build-history-header'}]);expect(readBuildHistory(index)).toHaveLength(1);expect(readBuildHistory(index)[0].sha256).toBe(ref.sha256);
  });
  it('refuses a parent junction before creating any outside index, lock or temporary file',()=>{
    const f=fixture(),ref=f.seal(),outside=path.join(f.dir,'outside'),linked=path.join(f.dir,'linked-parent');fs.mkdirSync(outside);fs.symlinkSync(outside,linked,process.platform==='win32'?'junction':'dir');
    const index=path.join(linked,'build-history.json');expect(()=>rememberBuildReceipt(ref.file,ref.sha256,index)).toThrow('linked-build-history');expect(fs.readdirSync(outside)).toEqual([]);
    fs.writeFileSync(path.join(outside,'build-history.json'),'[]');expect(()=>readBuildHistory(index)).toThrow('linked-build-history');expect(fs.readFileSync(path.join(outside,'build-history.json'),'utf8')).toBe('[]');
  });
  it('checks the index byte cap before hashing or replacing an oversized file',()=>{
    const f=fixture(),ref=f.seal(),index=path.join(f.dir,'build-history.json');fs.writeFileSync(index,Buffer.alloc(1024*1024+1,32));
    expect(()=>readBuildHistory(index)).toThrow('bounded-regular');expect(()=>rememberBuildReceipt(ref.file,ref.sha256,index)).toThrow('bounded-regular');expect(fs.statSync(index).size).toBe(1024*1024+1);expect(fs.existsSync(index+'.lock')).toBe(false);
  });
});
