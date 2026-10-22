/** Hash-bound local evidence, never a signature, full-suite or release approval. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {safeRelative} from '../companion-qa/runner.mjs';
import {flattenReporter,actualOutcome,nativeCaseFingerprint,productDependencies} from './selection.mjs';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const hashJson=value=>sha(JSON.stringify(value));
export const writeNew=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
export function regular(root,relative){
  if(!safeRelative(relative)||relative.includes('\\'))throw Error('unsafe-evidence-path');
  let current=path.resolve(root);
  for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-evidence');}
  if(!fs.statSync(current).isFile())throw Error('regular-evidence-required');return current;
}
export function manifest(root,{exclude=()=>false}={}){
  const rows=[];
  function visit(relative=''){
    for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
      const file=relative?relative+'/'+entry.name:entry.name;if(exclude(file))continue;
      if(entry.isSymbolicLink())throw Error('linked-manifest-entry');
      if(entry.isDirectory())visit(file);else if(entry.isFile())rows.push({path:file,sha256:sha(fs.readFileSync(regular(root,file)))});else throw Error('special-evidence-entry');
    }
  }
  visit();return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
export function verifyFiles(root,rows){
  if(!Array.isArray(rows)||!rows.length||new Set(rows.map(x=>x.path)).size!==rows.length)throw Error('invalid-file-receipt');
  for(const row of rows)if(!/^[a-f0-9]{64}$/.test(row.sha256)||sha(fs.readFileSync(regular(root,row.path)))!==row.sha256)throw Error('evidence-hash-mismatch');
}
export function verifyRun(resultFile,expectedSha,seen=new Set(),cache=new Map()){
  if(!/^[a-f0-9]{64}$/.test(expectedSha??''))throw Error('pinned-result-sha-required');
  const file=regular(path.dirname(path.resolve(resultFile)),path.basename(resultFile)),bytes=fs.readFileSync(file),digest=sha(bytes),dir=path.dirname(file);
  if(digest!==expectedSha||seen.has(file)||seen.size>10)throw Error('invalid-result-receipt');
  const cacheKey=file+'|'+digest;if(cache.has(cacheKey))return cache.get(cacheKey);
  const visited=new Set([...seen,file]),r=JSON.parse(bytes);
  if(r.schemaVersion!==1||r.kind!=='focused-native-result'||!r.integrity?.sourceUnchanged||!r.integrity?.guardsClear||!r.integrity?.ownedProcessesClosed||!r.buildId||r.fullCertification!==false)throw Error('incomplete-focused-receipt');
  const controls=['source-freeze.json','build.json','plan.json'];
  if(fs.existsSync(path.join(dir,'playwright.json')))controls.push('playwright.json');
  if(r.cases.some(c=>c.outcome==='passed'))controls.push('playwright.json','registration.json','workspace/scoped.generated.config.ts');
  if(controls.some(p=>!r.evidence?.some(e=>e.path===p&&/^[a-f0-9]{64}$/.test(e.sha256))))throw Error('unbound-control-evidence');
  verifyFiles(dir,r.evidence);
  const freeze=JSON.parse(fs.readFileSync(regular(dir,'source-freeze.json')));
  if(hashJson(freeze.sourceFiles)!==freeze.contentDigest)throw Error('source-digest-mismatch');
  verifyFiles(path.join(dir,'workspace'),freeze.sourceFiles);
  const build=JSON.parse(fs.readFileSync(regular(dir,'build.json')));
  verifyFiles(path.join(dir,'workspace/.next'),build.files);
  if(JSON.stringify(manifest(path.join(dir,'workspace/.next'),{exclude:p=>p==='cache'||p.startsWith('cache/')}))!==JSON.stringify(build.files))throw Error('build-file-set-mismatch');
  if(fs.readFileSync(regular(path.join(dir,'workspace/.next'),'BUILD_ID'),'utf8').trim()!==r.buildId||build.productKey!==r.productKey)throw Error('build-binding-mismatch');
  if(hashJson({files:productDependencies(freeze.sourceFiles),runtime:r.runtime})!==r.productKey)throw Error('product-key-mismatch');
  const plan=JSON.parse(fs.readFileSync(regular(dir,'plan.json'))),planned=plan.companion.selection.cases;
  if(planned.length!==r.cases.length||new Set(planned.map(c=>c.id)).size!==planned.length)throw Error('plan-binding-mismatch');
  const reporter=fs.existsSync(path.join(dir,'playwright.json'))?JSON.parse(fs.readFileSync(regular(dir,'playwright.json'))):undefined;
  const budgetOnly=reporter?.errors?.length===1&&/^Timed out waiting \d+(?:\.\d+)?s for the test suite to run$/.test(String(reporter.errors[0].message).split(String.fromCharCode(27)).join('').replace(/\[[0-9;]*m/g,''))&&r.failure==='selected-native-failed-or-budget';
  if(reporter&&(!Array.isArray(reporter.errors)||reporter.errors.length&&!budgetOnly))throw Error('global-reporter-error');
  const actual=reporter?flattenReporter(reporter):[];
  for(const row of actual)for(const result of row.results)for(const attachment of result.attachments??[])if(attachment.path){const relative=path.relative(dir,path.resolve(attachment.path)).replaceAll('\\','/');if(!safeRelative(relative)||!r.evidence.some(e=>e.path===relative))throw Error('unbound-reporter-attachment');}
  const allowed=new Set(r.executedIds);if(actual.some(x=>!allowed.has(x.id))||new Set(r.cases.map(x=>x.id)).size!==r.cases.length)throw Error('unexpected-case');
  const proofs=r.cases.map(c=>{
    const item=planned.find(x=>x.id===c.id);
    if(!item||nativeCaseFingerprint({sourceFiles:freeze.sourceFiles,item,buildId:r.buildId,dailyScenarios:plan.companion.dailyScenarios,runtime:r.runtime})!==c.fingerprint)throw Error('case-fingerprint-mismatch');
    if(c.outcome==='reused'){
      const origin=verifyRun(c.proofRef,c.proofSha,visited,cache),found=origin.proofs.find(x=>x.id===c.id);
      if(!found||found.outcome!=='passed'||found.fingerprint!==c.fingerprint||origin.result.buildId!==r.buildId)throw Error('invalid-origin-pass');
      return {...found,actualExecuted:false};
    }
    const raw=actual.find(x=>x.id===c.id),outcome=raw?actualOutcome(raw):'not-run';
    if(c.outcome!==outcome)throw Error('outcome-reporter-mismatch');
    return {...c,outcome,receiptVerified:true,actualExecuted:!!raw&&raw.results.some(x=>x.status!=='skipped'),proofRef:file,proofSha:digest};
  });
  const verified={result:r,proofs,dir,freeze,build};cache.set(cacheKey,verified);return verified;
}
export function observationsFromReceipts(refs){
  if(!Array.isArray(refs)||refs.length>500)throw Error('invalid-case-history');
  // Rotation needs the latest actual record per case, not every historical
  // video/build rehashed every morning. Headers remain pinned; chosen proofs
  // are fully verified. Cache lasts only this call, never a persisted PASS.
  const headers=refs.map(ref=>{const file=regular(path.dirname(path.resolve(ref.receipt)),path.basename(ref.receipt)),bytes=fs.readFileSync(file);if(sha(bytes)!==ref.sha256)throw Error('history-header-hash-mismatch');const r=JSON.parse(bytes);if(r.kind!=='focused-native-result'||!Array.isArray(r.cases))throw Error('invalid-history-header');return {ref,result:r};}).sort((a,b)=>String(a.result.at??'').localeCompare(String(b.result.at??'')));
  const latest=new Map();for(const h of headers)for(const c of h.result.cases)if(c.outcome!=='reused')latest.set(c.id,h);
  const needed=new Set([...latest.values()]),cache=new Map();
  return headers.filter(h=>needed.has(h)).map(h=>verifyRun(h.ref.receipt,h.ref.sha256,new Set(),cache)).flatMap(verified=>{
    return verified.proofs.filter(c=>c.actualExecuted||c.outcome==='not-run').map(c=>({id:c.id,day:verified.result.day,outcome:c.outcome==='passed'?'passed':c.outcome==='not-run'?'not-run':'failed',receiptVerified:true,actualExecuted:c.actualExecuted}));
  });
}
