/** Focused QA accounting. Previous outcomes never become fresh executions. */
import {createHash} from 'node:crypto';
import {dayOrdinal} from './catalog.mjs';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const sha=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const requireThat=(value,message)=>{if(!value)throw Error(message);};
export const caseId=row=>sha([row.file,row.title,row.project??'']);
export function caseFingerprint({files,scenario,runtime}){
  requireThat(Array.isArray(files)&&files.length>0&&new Set(files.map(f=>f.path)).size===files.length,'unique-dependencies-required');
  requireThat(files.every(f=>typeof f.path==='string'&&!f.path.includes('..')&&!f.path.includes('\\')&&!f.path.startsWith('/')&&f.sha256!==undefined&&(f.sha256===null||/^[a-f0-9]{64}$/.test(f.sha256))),'invalid-dependency');
  requireThat(scenario&&runtime&&typeof scenario==='object'&&typeof runtime==='object'&&!Array.isArray(scenario)&&!Array.isArray(runtime)&&Object.keys(scenario).length>0&&Object.keys(runtime).length>0,'scenario-and-runtime-required');
  return sha({files:files.map(f=>({path:f.path,sha256:f.sha256})).sort((a,b)=>a.path.localeCompare(b.path)),scenario,runtime});
}
export function flattenReporter(reporter){
  const result=[];
  function visit(suite){
    for(const spec of suite.specs??[])for(const test of spec.tests??[]){
      const file=spec.file??suite.file;
      const normalized=String(file).replaceAll('\\','/');
      const relative=normalized.includes('/tests/visual/')?'tests/visual/'+normalized.split('/tests/visual/').at(-1):normalized.startsWith('tests/visual/')?normalized:'tests/visual/'+normalized;
      const row={file:relative,title:spec.title,project:test.projectName??'',expectedStatus:test.expectedStatus,status:test.status,annotations:test.annotations??[],results:test.results??[]};
      result.push({...row,id:caseId(row)});
    }
    for(const nested of suite.suites??[])visit(nested);
  }
  for(const suite of reporter.suites??[])visit(suite);
  requireThat(new Set(result.map(r=>r.id)).size===result.length,'duplicate-reporter-case');
  return result;
}
export function actualOutcome(row){
  if(row.results.length!==1)return 'not-once';
  const result=row.results[0];
  if(result.retry!==0)return 'retried';
  if(!Number.isFinite(result.duration)||result.duration<=0||!Array.isArray(result.errors))return 'incomplete';
  if(row.annotations?.some(a=>['skip','fixme','fail'].includes(a.type)))return 'unexpected-contract';
  if(row.expectedStatus!=='passed')return 'unexpected-contract';
  if(row.status==='expected'&&result.status==='passed'&&!result.error&&!result.errors?.length)return 'passed';
  return result.status==='skipped'?'not-run':'failed';
}
export function weeklyBuckets(catalog){
  requireThat(Array.isArray(catalog)&&catalog.length>0&&new Set(catalog.map(c=>c.id)).size===catalog.length,'invalid-case-catalog');
  requireThat(catalog.every(c=>c.id===caseId(c)&&/^tests\/visual\/[a-z0-9-]+\.spec\.ts$/.test(c.file)&&typeof c.title==='string'&&c.title.length>0&&c.project===''),'invalid-case-registration');
  const buckets=Array.from({length:7},(_,index)=>({index,estimatedWorkerSeconds:0,cases:[]}));
  for(const item of [...catalog].sort((a,b)=>b.estimatedSeconds-a.estimatedSeconds||a.id.localeCompare(b.id))){
    requireThat(Number.isFinite(item.estimatedSeconds)&&item.estimatedSeconds>0&&item.estimatedSeconds<=600,'invalid-case-duration');
    const target=[...buckets].sort((a,b)=>a.estimatedWorkerSeconds-b.estimatedWorkerSeconds||a.index-b.index)[0];
    target.cases.push(item);target.estimatedWorkerSeconds+=item.estimatedSeconds;
  }
  return buckets;
}
export function selectDailyCases({catalog,day,observations=[],priorityIds=[],workerBudgetSeconds=1500,maxCases=42}){
  dayOrdinal(day);
  requireThat(Number.isFinite(workerBudgetSeconds)&&workerBudgetSeconds>0&&Number.isSafeInteger(maxCases)&&maxCases>0&&maxCases<=60,'invalid-selection-budget');
  const byId=new Map(catalog.map(c=>[c.id,c]));
  requireThat(priorityIds.every(id=>byId.has(id)),'unknown-priority-case');
  const last=new Map(),latest=new Map();
  for(const item of observations){
    // Input is a verified-receipt projection supplied by the caller. Reused
    // proofs do not advance the actual-observation date or erase a failure.
    requireThat(byId.has(item.id)&&['passed','failed','not-run','reused'].includes(item.outcome)&&typeof item.receiptVerified==='boolean','invalid-observation');
    dayOrdinal(item.day);requireThat(item.day<=day,'future-observation');
    if(item.receiptVerified&&(item.actualExecuted===true||item.outcome==='not-run')){
      if(item.actualExecuted===true&&item.outcome==='passed'&&(!last.has(item.id)||last.get(item.id)<item.day))last.set(item.id,item.day);
      if(!latest.has(item.id)||latest.get(item.id).day<=item.day)latest.set(item.id,item);
    }
  }
  priorityIds=[...new Set([...priorityIds,...[...latest.values()].filter(x=>x.outcome==='failed'||x.outcome==='not-run').map(x=>x.id)])];
  const buckets=weeklyBuckets(catalog),age=b=>Math.min(...b.cases.map(c=>last.has(c.id)?dayOrdinal(last.get(c.id)):-Infinity));
  const rotated=[...buckets].sort((a,b)=>age(a)-age(b)||((a.index-dayOrdinal(day)%7+7)%7)-((b.index-dayOrdinal(day)%7+7)%7));
  const queue=[...new Set([...priorityIds,...rotated.flatMap(b=>[...b.cases].sort((a,b)=>(last.get(a.id)??'').localeCompare(last.get(b.id)??'')||a.id.localeCompare(b.id)).map(c=>c.id))])];
  const selected=[];let cost=0;
  for(const id of queue){
    const item=byId.get(id),priority=priorityIds.includes(id);
    if(selected.length>=maxCases)break;
    if(!priority&&last.get(id)===day)continue;
    if(cost+item.estimatedSeconds>workerBudgetSeconds&&!priority)continue;
    if(priority&&selected.length>=maxCases)break;
    selected.push({...item,reason:priority?'changed-or-failed-risk':'oldest-actual-weekly-rotation'});cost+=item.estimatedSeconds;
    if(!priority&&cost>=workerBudgetSeconds)break;
  }
  const ids=new Set(selected.map(c=>c.id));
  return {day,cases:selected,estimatedWorkerSeconds:cost,estimatedWallSecondsAt3Workers:Math.ceil(cost/3),notSelected:catalog.filter(c=>!ids.has(c.id)).map(c=>c.id),pendingPriorityIds:priorityIds.filter(id=>!ids.has(id)),weeklyBucketCount:7,actualCoverageClaim:false,fullCertification:false,overBudgetPriority:cost>workerBudgetSeconds};
}
export function continuationCases(planned,verifiedPrevious,currentFingerprint){
  const previous=new Map(verifiedPrevious.map(c=>[c.id,c]));
  const reuse=[],run=[],invalidated=[];
  for(const item of planned){const prior=previous.get(item.id),fingerprint=currentFingerprint(item);
    requireThat(/^[a-f0-9]{64}$/.test(fingerprint??''),'complete-current-fingerprint-required');
    if(prior?.receiptVerified===true&&prior.outcome==='passed'&&prior.fingerprint===fingerprint){reuse.push({...prior,outcome:'reused',actualExecuted:false});}
    else{run.push(item);if(prior?.fingerprint!==undefined&&prior.fingerprint!==fingerprint)invalidated.push(item.id);}
  }
  return {run,reuse,invalidated,fullRestart:false};
}
export const productDependencies=rows=>rows.filter(x=>!x.path.startsWith('tests/')&&!x.path.startsWith('docs/')&&!x.path.endsWith('.md')&&!x.path.startsWith('scripts/site-daily/'));
export function nativeCaseFingerprint({sourceFiles,item,buildId,dailyScenarios,runtime}){
  requireThat(typeof buildId==='string'&&buildId.length>0&&item.id===caseId(item)&&/^[a-f0-9]{64}$/.test(runtime?.chromiumExecutableSha??''),'incomplete-native-environment');
  return caseFingerprint({files:sourceFiles.filter(f=>productDependencies([f]).length||f.path===item.file||f.path.startsWith('tests/visual/helpers/')||f.path.startsWith('scripts/companion-qa/')||f.path.startsWith('scripts/site-daily/')),scenario:{id:item.id,buildId,dailyScenarios,viewport:[1920,1100],dpr:1,workers:3,retries:0,fixtureOnly:true,trace:'retain-on-failure',video:'on'},runtime});
}
