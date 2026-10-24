import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error Offline Node tooling, no runtime import into app.
import {caseId,caseFingerprint,nativeCaseFingerprint,productDependencies,actualOutcome,flattenReporter,weeklyBuckets,selectDailyCases,continuationCases} from '../../scripts/site-daily/selection.mjs';
// @ts-expect-error Offline Node tooling.
import {sha,writeNew,verifyFiles,verifyRun,hashJson,manifest} from '../../scripts/site-daily/receipts.mjs';
// @ts-expect-error Offline Node tooling.
import {validatePlan,options} from '../../scripts/site-daily/scoped-native.mjs';
// @ts-expect-error Offline policy excludes only explicitly retired registrations.
import {planDaily,partitionRetiredCaseObservations} from '../../scripts/site-daily/policy.mjs';
const catalog=JSON.parse(fs.readFileSync(path.resolve('scripts/site-daily/native-catalog.json'),'utf8'));
const fingerprint=(value='a')=>caseFingerprint({files:[{path:'lib/product.ts',sha256:value.repeat(64)}],scenario:{buildId:'exact-build',id:'scenario'},runtime:{node:'22',chromium:'fixed'}});
const raw=(overrides:Record<string,unknown>={})=>({expectedStatus:'passed',status:'expected',results:[{status:'passed',retry:0,duration:200,errors:[]}],...overrides});
describe('focused daily selection and immutable continuation',()=>{
  it('balances the current registrations into seven nonduplicated, bounded-cost buckets',()=>{
    const buckets=weeklyBuckets(catalog.cases);expect(buckets).toHaveLength(7);expect(buckets.flatMap((b:{cases:unknown[]})=>b.cases)).toHaveLength(catalog.cases.length);
    expect(new Set(buckets.flatMap((b:{cases:{id:string}[]})=>b.cases.map(c=>c.id))).size).toBe(catalog.cases.length);
    const costs=buckets.map((b:{estimatedWorkerSeconds:number})=>b.estimatedWorkerSeconds);expect(Math.max(...costs)-Math.min(...costs)).toBeLessThanOrEqual(125);
    expect(catalog.registrationOnly).toBe(true);expect(catalog.additionalLampCases).toBe(21);
    expect(catalog.additionalLivingIntentMotionCases).toBe(7);
    expect(catalog.additionalMeadowWalkCases).toBe(5);
    expect(catalog.additionalMeadowSessionCases).toBe(3);expect(catalog.additionalToyMechanicsCases).toBe(2);
    expect(catalog.additionalShowcaseResetCases).toBe(8);
    expect(catalog.additionalCurtainReachCases).toBe(9);expect(catalog.additionalMeadowManualInputCases).toBe(1);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/meadow-walk.spec.ts')).toHaveLength(5);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/meadow-session.spec.ts')).toHaveLength(4);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/companion-curtain-reach.spec.ts')).toHaveLength(9);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/companion-toy-axis.spec.ts')).toHaveLength(2);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/showcase-reset.spec.ts')).toHaveLength(8);
    expect(catalog.cases.some((c:{title:string})=>c.title==='meadow requires an exposed resident and reduced motion and OFF stay effective')).toBe(true);
    expect(catalog.cases.some((c:{title:string})=>c.title.startsWith('meadow cold sprite failure recovers'))).toBe(false);
    expect(catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/companion-intent-motion.spec.ts')).toHaveLength(6);
  });
  it('rotates the current catalog within daily budgets and catches up deferred or missed cases',()=>{
    const observations:Record<string,unknown>[]=[];const seen=new Set();
    for(let day=23;day<=29;day++){
      const plan=selectDailyCases({catalog:catalog.cases,day:`2026-10-${day}`,observations});expect(plan.cases.length).toBeLessThanOrEqual(42);expect(plan.fullCertification).toBe(false);
      for(const c of plan.cases){seen.add(c.id);observations.push({id:c.id,day:`2026-10-${day}`,outcome:'passed',receiptVerified:true,actualExecuted:true});}
    }
    expect(seen.size).toBeGreaterThan(0);expect(seen.size).toBeLessThanOrEqual(catalog.cases.length);
    // The caller carries known missed IDs explicitly. An absent observation
    // alone cannot distinguish that day from never-observed registrations,
    // which can still remain after seven bounded runs as the catalog grows.
    const missedIds=observations.filter(x=>x.day==='2026-10-25').map(x=>x.id);
    const missed=selectDailyCases({catalog:catalog.cases,day:'2026-10-30',observations:observations.filter(x=>x.day!=='2026-10-25'),priorityIds:missedIds});
    expect(missedIds.length).toBeGreaterThan(0);
    expect(missedIds.every(id=>missed.cases.some((c:{id:string;reason:string})=>c.id===id&&c.reason==='changed-or-failed-risk'))).toBe(true);
    expect(missed.pendingPriorityIds).toEqual([]);expect(missed.cases.length).toBeLessThanOrEqual(42);
    expect(missed.estimatedWorkerSeconds).toBeLessThanOrEqual(1500);
    // Catalog growth can exceed seven days' budget. Unobserved registrations
    // remain in the oldest-first rotation; seven buckets are no full QA claim.
    for(let offset=0;offset<7&&seen.size<catalog.cases.length;offset++){
      const day=new Date(Date.UTC(2026,9,30+offset)).toISOString().slice(0,10);
      const next=selectDailyCases({catalog:catalog.cases,day,observations});expect(next.cases.length).toBeLessThanOrEqual(42);
      for(const c of next.cases){seen.add(c.id);observations.push({id:c.id,day,outcome:'passed',receiptVerified:true,actualExecuted:true});}
    }
    expect(seen.size).toBe(catalog.cases.length);
  });
  it('does not let old input overwrite a newer observation or reused evidence advance the day',()=>{
    const c=catalog.cases[0],o={id:c.id,receiptVerified:true,actualExecuted:true,outcome:'passed'};
    const selected=selectDailyCases({catalog:catalog.cases,day:'2026-10-23',observations:[{...o,day:'2026-10-23'},{...o,day:'2026-10-21'}]});expect(selected.cases.some((x:{id:string})=>x.id===c.id)).toBe(false);
    const failed=selectDailyCases({catalog:catalog.cases,day:'2026-10-23',observations:[{...o,day:'2026-10-23'},{...o,day:'2026-10-23',outcome:'failed'}]});expect(failed.cases[0].id).toBe(c.id);
    const reused=selectDailyCases({catalog:catalog.cases,day:'2026-10-23',observations:[{...o,day:'2026-10-23',outcome:'reused',actualExecuted:false}],priorityIds:[c.id]});expect(reused.cases[0].id).toBe(c.id);
  });
  it('keeps a verified retired receipt historical while its replacement remains unobserved',()=>{
    const retired=catalog.retiredRegistrations.find((r:{title:string})=>r.title==='meadow cold sprite failure recovers and reduced motion and OFF stay effective');
    expect(retired.id).toBe('18c75d96b0a0a4b84710b11703d1b8681227dba35b8ac97325ae925e582c6196');
    const observations=catalog.cases.filter((c:{id:string})=>c.id!==retired.replacementId).map((c:{id:string})=>({id:c.id,day:'2026-10-23',outcome:'passed',receiptVerified:true,actualExecuted:true}));
    observations.push({id:retired.id,day:'2026-10-23',outcome:'passed',receiptVerified:true,actualExecuted:true});
    const original=JSON.stringify(observations),plan=planDaily({day:'2026-10-23',caseObservations:observations});
    expect(plan.companion.selection.cases.map((c:{id:string})=>c.id)).toEqual([retired.replacementId]);
    expect(plan.companion.selection.retiredObservations).toEqual([{...retired,observedDay:'2026-10-23',outcome:'passed',actualExecuted:true,oldEvidencePreserved:true,passTransferred:false}]);
    expect(JSON.stringify(observations)).toBe(original);
  });
  it('does not silently discard unknown, unverified or future retired observations',()=>{
    const retired=catalog.retiredRegistrations[0],row={id:retired.id,day:'2026-10-23',outcome:'passed',receiptVerified:true,actualExecuted:true};
    const shared=catalog.cases.filter((c:{file:string})=>c.file==='tests/visual/showcase-reset.spec.ts').map((c:{id:string})=>({...row,id:c.id}));
    expect(shared).toHaveLength(8);
    const known=planDaily({day:'2026-10-23',caseObservations:shared});
    expect(known.companion.selection.retiredObservations).toEqual([]);
    expect(known.companion.selection.cases.every((c:{id:string})=>!shared.some((observation:{id:string})=>observation.id===c.id))).toBe(true);
    expect(()=>planDaily({day:'2026-10-23',caseObservations:[...shared,{...row,id:caseId({file:'tests/visual/unknown.spec.ts',title:'unknown',project:''})}]})).toThrow('invalid-observation');
    expect(()=>planDaily({day:'2026-10-23',caseObservations:[{...row,receiptVerified:false}]})).toThrow('invalid-retired-observation');
    expect(()=>planDaily({day:'2026-10-23',caseObservations:[{...row,day:'2026-10-24'}]})).toThrow('future-observation');
    expect(()=>partitionRetiredCaseObservations({day:'2026-10-23',observations:[row],catalog:{...catalog,retiredRegistrations:[{...retired,id:'0'.repeat(64)}]}})).toThrow('invalid-retired-registration');
  });
  it('prioritizes exact changed curtain and showcase input contracts without treating registration as a current observation',()=>{
    for(const [file,families,expected]of [
      ['lib/ui/viewer-companion/curtain-contact-anchors.json',['tests/visual/companion-curtain-reach.spec.ts'],9],
      ['lib/ui/viewer-companion/showcase-input.ts',['tests/visual/meadow-session.spec.ts','tests/visual/meadow-walk.spec.ts','tests/visual/companion-toy-axis.spec.ts'],11],
    ] as const){
      const plan=planDaily({day:'2026-10-23',changedFiles:[file]});
      const selected=plan.companion.selection.cases.filter((c:{file:string})=>(families as readonly string[]).includes(c.file));
      expect(selected).toHaveLength(expected);expect(selected.every((c:{reason:string})=>c.reason==='changed-or-failed-risk')).toBe(true);
      expect(plan.companion.selection.actualCoverageClaim).toBe(false);expect(plan.companion.selection.fullCertification).toBe(false);
    }
  });
  it('keeps pending risk explicitly when the hard case cap is reached',()=>{
    const ids=catalog.cases.slice(0,45).map((x:{id:string})=>x.id);const p=selectDailyCases({catalog:catalog.cases,day:'2026-10-23',priorityIds:ids});expect(p.pendingPriorityIds).toHaveLength(3);
  });
  it('reuses only verified exact fingerprints and reruns failed, missing or changed cases',()=>{
    const planned=catalog.cases.slice(0,4),old=planned.slice(0,3).map((x:{id:string},i:number)=>({id:x.id,receiptVerified:true,outcome:i===1?'failed':'passed',fingerprint:i===2?fingerprint('b'):fingerprint()}));
    const p=continuationCases(planned,old,()=>fingerprint());expect(p.reuse.map((x:{id:string})=>x.id)).toEqual([planned[0].id]);expect(p.run).toHaveLength(3);expect(p.invalidated).toEqual([planned[2].id]);expect(p.fullRestart).toBe(false);
    expect(()=>continuationCases([planned[0]],[{id:planned[0].id,receiptVerified:true,outcome:'passed'}],()=>undefined)).toThrow('fingerprint');
  });
  it('hashes dependency, scenario and runtime changes, with stable object-key ordering',()=>{
    const files=[{path:'lib/p.ts',sha256:'a'.repeat(64)}];const a=caseFingerprint({files,scenario:{a:1,b:2},runtime:{node:'22'}});
    expect(caseFingerprint({files,scenario:{b:2,a:1},runtime:{node:'22'}})).toBe(a);
    expect(caseFingerprint({files,scenario:{a:1,b:2},runtime:{node:'24'}})).not.toBe(a);expect(fingerprint('a')).not.toBe(fingerprint('b'));
    expect(()=>caseFingerprint({files,scenario:[],runtime:{}})).toThrow();
  });
  it('never classifies retry, skip, expected failure, missing duration or missing errors as PASS',()=>{
    expect(actualOutcome(raw())).toBe('passed');expect(actualOutcome(raw({results:[{status:'passed',retry:1,duration:200,errors:[]}]}))).not.toBe('passed');
    for(const r of [raw({results:[]}),raw({expectedStatus:'failed'}),raw({results:[{status:'passed',retry:0}]}),raw({results:[{status:'skipped',retry:0,duration:10,errors:[]}]})])expect(actualOutcome(r)).not.toBe('passed');
  });
  it('rejects malformed, duplicate or arbitrary-command selection rather than widening to all200',()=>{
    expect(()=>validatePlan({day:'2026-10-23',companion:{selection:{cases:[]}}})).toThrow();
    expect(()=>options(['--plan','x','--continue-from','old'])).toThrow();expect(()=>options(['--command','anything'])).toThrow();
    const c=catalog.cases[0];expect(c.id).toBe(caseId(c));
    expect(()=>flattenReporter({suites:[{file:c.file,specs:[{title:c.title,tests:[{projectName:''},{projectName:''}]}]}]})).toThrow('duplicate');
  });
});
describe('focused receipts reject altered evidence and preserve partial outcomes',()=>{
  function fixture(){
    fs.mkdirSync(path.resolve('.scratch-pw'),{recursive:true});const dir=fs.mkdtempSync(path.resolve('.scratch-pw/focused-receipt-'));
    fs.mkdirSync(path.join(dir,'workspace/.next'),{recursive:true});fs.writeFileSync(path.join(dir,'workspace/product.ts'),'original');fs.writeFileSync(path.join(dir,'workspace/.next/BUILD_ID'),'fixed-build');
    const files=[{path:'product.ts',sha256:sha(Buffer.from('original'))}],runtime={node:'v22',chromiumExecutableSha:'b'.repeat(64)},productKey=hashJson({files:productDependencies(files),runtime});writeNew(path.join(dir,'source-freeze.json'),{sourceFiles:files,contentDigest:hashJson(files)});
    writeNew(path.join(dir,'build.json'),{productKey,files:[{path:'BUILD_ID',sha256:sha(Buffer.from('fixed-build'))}]});
    const c=catalog.cases[0],plan={companion:{selection:{cases:[c]},dailyScenarios:catalog.dailyScenarios}};writeNew(path.join(dir,'plan.json'),plan);writeNew(path.join(dir,'playwright.json'),{errors:[],suites:[{file:c.file,specs:[{title:c.title,tests:[{projectName:'',...raw()}]}]}]});
    fs.copyFileSync(path.join(dir,'playwright.json'),path.join(dir,'registration.json'));fs.writeFileSync(path.join(dir,'workspace/scoped.generated.config.ts'),'fixed-config');
    const fp=(item:unknown)=>nativeCaseFingerprint({sourceFiles:files,item,buildId:'fixed-build',dailyScenarios:catalog.dailyScenarios,runtime});
    const evidence=manifest(dir,{exclude:(p:string)=>p==='workspace'||p.startsWith('workspace/')});evidence.push({path:'workspace/scoped.generated.config.ts',sha256:sha(Buffer.from('fixed-config'))});
    const result={schemaVersion:1,kind:'focused-native-result',day:'2026-10-23',fullCertification:false,buildId:'fixed-build',productKey,runtime,integrity:{sourceUnchanged:true,guardsClear:true,ownedProcessesClosed:true},executedIds:[c.id],cases:[{id:c.id,outcome:'passed',fingerprint:fp(c)}],evidence};
    const file=path.join(dir,'result.json');writeNew(file,result);return {dir,file,digest:sha(fs.readFileSync(file)),result,c,fp,plan};
  }
  it('requires externally pinned result and all source/build/reporter hashes',()=>{
    const f=fixture();expect(verifyRun(f.file,f.digest).proofs[0]).toMatchObject({outcome:'passed',actualExecuted:true});expect(()=>verifyRun(f.file)).toThrow('pinned');
    fs.appendFileSync(path.join(f.dir,'workspace/product.ts'),'modified');expect(()=>verifyRun(f.file,f.digest)).toThrow('hash');
  });
  it('rejects changed original report, missing artifacts and path traversal',()=>{
    const f=fixture();fs.appendFileSync(path.join(f.dir,'playwright.json'),' ');expect(()=>verifyRun(f.file,f.digest)).toThrow('hash');
    expect(()=>verifyFiles(f.dir,[{path:'../private',sha256:'a'.repeat(64)}])).toThrow('unsafe');
  });
  it('can retain an actual passed case while another case was not run, without claiming scope complete',()=>{
    const f=fixture();const second=catalog.cases[1];f.plan.companion.selection.cases.push(second);fs.writeFileSync(path.join(f.dir,'plan.json'),JSON.stringify(f.plan));f.result.cases.push({id:second.id,outcome:'not-run',fingerprint:f.fp(second)});f.result.evidence=f.result.evidence.map((e:{path:string,sha256:string})=>e.path==='plan.json'?{...e,sha256:sha(fs.readFileSync(path.join(f.dir,e.path)))}:e);
    const file=path.join(f.dir,'partial.json');writeNew(file,f.result);const v=verifyRun(file,sha(fs.readFileSync(file)));expect(v.proofs.map((x:{outcome:string})=>x.outcome)).toEqual(['passed','not-run']);
  });
  it('rejects newly injected build files and fingerprints that do not bind the source/scenario',()=>{
    const f=fixture();fs.writeFileSync(path.join(f.dir,'workspace/.next/injected.js'),'new');expect(()=>verifyRun(f.file,f.digest)).toThrow('file-set');
    const g=fixture();g.result.cases[0].fingerprint='f'.repeat(64);const file=path.join(g.dir,'bad-fingerprint.json');writeNew(file,g.result);expect(()=>verifyRun(file,sha(fs.readFileSync(file)))).toThrow('fingerprint');
  });
  it('unwraps the original actual pass through two continuations rather than rerunning it',()=>{
    const f=fixture(),next=fs.mkdtempSync(path.resolve('.scratch-pw/focused-continue-'));
    fs.cpSync(f.dir,next,{recursive:true,filter:(p:string)=>!['result.json','playwright.json'].includes(path.basename(p))});
    const reused={...f.result,executedIds:[],cases:[{id:f.c.id,outcome:'reused',fingerprint:f.fp(f.c),proofRef:f.file,proofSha:f.digest}],evidence:manifest(next,{exclude:(p:string)=>p==='workspace'||p.startsWith('workspace/')})};
    const file=path.join(next,'continued.json');writeNew(file,reused);const digest=sha(fs.readFileSync(file)),v=verifyRun(file,digest);
    expect(v.proofs[0]).toMatchObject({outcome:'passed',actualExecuted:false,proofRef:f.file});
    expect(continuationCases([f.c],v.proofs,()=>f.fp(f.c)).run).toHaveLength(0);
  });
  it('refuses control JSON missing from the hash-bound manifest even if the result itself is pinned',()=>{
    const f=fixture();f.result.evidence=f.result.evidence.filter((e:{path:string})=>e.path!=='plan.json');const file=path.join(f.dir,'unbound.json');writeNew(file,f.result);expect(()=>verifyRun(file,sha(fs.readFileSync(file)))).toThrow('unbound-control');
  });
});
