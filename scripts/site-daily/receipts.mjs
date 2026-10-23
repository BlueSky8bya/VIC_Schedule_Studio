/** Hash-bound local evidence, never a signature, full-suite or release approval. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {safeRelative,snapshotEligible} from '../companion-qa/runner.mjs';
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
const buildExclude=p=>p==='cache'||p.startsWith('cache/');
const plainMessage=value=>String(value??'').split(String.fromCharCode(27)).join('').replace(/\[[0-9;]*m/g,'');
/** A verified build is not a verified test result. Never feed this into continuationCases. */
export function verifyBuildReceipt(resultFile,expectedSha,seen=new Set()){
  if(!/^[a-f0-9]{64}$/.test(expectedSha??''))throw Error('pinned-result-sha-required');
  const file=regular(path.dirname(path.resolve(resultFile)),path.basename(resultFile)),bytes=fs.readFileSync(file),digest=sha(bytes),dir=path.dirname(file);
  if(digest!==expectedSha||seen.has(file)||seen.size>10)throw Error('invalid-result-receipt');
  const r=JSON.parse(bytes),visited=new Set([...seen,file]);
  if(r.schemaVersion!==1||r.kind!=='focused-native-result'||r.listOnly!==false||r.fullCertification!==false||r.integrity?.sourceUnchanged!==true||r.integrity?.guardsClear!==true||r.integrity?.ownedProcessesClosed!==true||!/^[A-Za-z0-9_-]{1,128}$/.test(r.buildId??'')||!/^[a-f0-9]{64}$/.test(r.productKey??'')||![null,'selected-native-failed-or-budget'].includes(r.failure))throw Error('incomplete-build-receipt');
  const runtimeKeys=['node','platform','arch','next','@playwright/test','playwright-core','chromiumExecutableSha'].sort();
  if(!r.runtime||JSON.stringify(Object.keys(r.runtime).sort())!==JSON.stringify(runtimeKeys)||runtimeKeys.some(k=>typeof r.runtime[k]!=='string'||!r.runtime[k])||!/^v\d+\.\d+\.\d+$/.test(r.runtime.node)||!['win32','linux','darwin'].includes(r.runtime.platform)||!/^[a-f0-9]{64}$/.test(r.runtime.chromiumExecutableSha))throw Error('incomplete-build-runtime');
  if(!['source-freeze.json','build.json','plan.json','playwright.json'].every(p=>r.evidence?.some(e=>e.path===p&&/^[a-f0-9]{64}$/.test(e.sha256))))throw Error('unbound-build-control-evidence');
  verifyFiles(dir,r.evidence);
  if(fs.existsSync(path.join(dir,'network-denied.jsonl'))&&fs.statSync(regular(dir,'network-denied.jsonl')).size!==0)throw Error('build-network-guard-denial');
  const freeze=JSON.parse(fs.readFileSync(regular(dir,'source-freeze.json'))),workspace=path.join(dir,'workspace');
  if(freeze.credentialsCopied!==0||freeze.privateArtCopied!==0||hashJson(freeze.sourceFiles)!==freeze.contentDigest)throw Error('build-source-digest-mismatch');
  verifyFiles(workspace,freeze.sourceFiles);
  // Match all eligible snapshot files, including additions, without walking private art,
  // generated output or the approved dependency junction. Known audited metadata stays bound.
  const sourcePaths=new Set(freeze.sourceFiles.map(f=>f.path));
  const sourceManifest=manifest(workspace,{exclude:p=>!snapshotEligible(p)&&!sourcePaths.has(p)&&![...sourcePaths].some(q=>q.startsWith(p+'/'))});
  if(JSON.stringify(sourceManifest)!==JSON.stringify([...freeze.sourceFiles].sort((a,b)=>a.path.localeCompare(b.path))))throw Error('source-file-set-mismatch');
  const build=JSON.parse(fs.readFileSync(regular(dir,'build.json'))),buildRoot=path.join(workspace,'.next');
  verifyFiles(buildRoot,build.files);
  if(build.files.some(f=>buildExclude(f.path))||JSON.stringify(manifest(buildRoot,{exclude:buildExclude}))!==JSON.stringify(build.files))throw Error('build-file-set-mismatch');
  if(fs.readFileSync(regular(buildRoot,'BUILD_ID'),'utf8').trim()!==r.buildId||build.buildId!==r.buildId||build.productKey!==r.productKey||hashJson({files:productDependencies(freeze.sourceFiles),runtime:r.runtime})!==r.productKey)throw Error('build-binding-mismatch');
  const reporter=JSON.parse(fs.readFileSync(regular(dir,'playwright.json')));
  // Assertion failures and the deliberate suite stop do not invalidate identical build bytes.
  // Unknown global/environment errors remain ineligible; no test outcome is interpreted here.
  if(!Array.isArray(reporter.errors)||reporter.errors.some(e=>!/^Testing stopped early after \d+ maximum allowed failures\.$/.test(plainMessage(e.message))&&!/^Timed out waiting \d+(?:\.\d+)?s for the test suite to run$/.test(plainMessage(e.message))))throw Error('build-environment-reporter-error');
  const stages=r.stages;let buildOrigin={receipt:file,sha256:digest};
  if(!Array.isArray(stages)||!stages.some(s=>s.name==='registration'&&s.code===0)||!stages.some(s=>s.name==='native'&&[0,1].includes(s.code)))throw Error('incomplete-build-stages');
  if(stages.some(s=>s.name==='verified-product-build-reuse')){
    if(stages.some(s=>['build','metadata'].includes(s.name))||!r.buildReuse||r.buildReuse.version!==1)throw Error('unbound-build-origin');
    if(!['build','case-run'].includes(r.buildReuse.verification))throw Error('invalid-build-origin-kind');
    const origin=r.buildReuse.verification==='case-run'?verifyRun(r.buildReuse.receipt,r.buildReuse.sha256,visited):verifyBuildReceipt(r.buildReuse.receipt,r.buildReuse.sha256,visited);
    if(origin.result.productKey!==r.productKey||origin.result.buildId!==r.buildId||JSON.stringify(origin.build.files)!==JSON.stringify(build.files))throw Error('build-origin-mismatch');
    if(origin.buildOrigin)buildOrigin=origin.buildOrigin;
  }else if(!stages.some(s=>s.name==='metadata'&&s.code===0)||!stages.some(s=>s.name==='build'&&s.code===0)||stages.some(s=>['metadata','build'].includes(s.name)&&s.code!==0))throw Error('unsuccessful-build-stage');
  return {result:r,dir,freeze,build,buildVerified:true,casePassReusable:false,proofs:[],receipt:file,receiptSha:digest,buildOrigin};
}
/** Explicit pinned candidates only; an invalid candidate never supplies PASS or build bytes. */
export function selectBuildReceipt(refs,productKey){
  if(!Array.isArray(refs)||refs.length>500||!/^[a-f0-9]{64}$/.test(productKey??''))throw Error('invalid-build-history');
  const rejected=[],candidates=[];
  for(const ref of refs){
    try{
      if(typeof ref?.receipt!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256??''))throw Error('invalid-build-history-ref');
      const file=regular(path.dirname(path.resolve(ref.receipt)),path.basename(ref.receipt)),bytes=fs.readFileSync(file);
      if(sha(bytes)!==ref.sha256)throw Error('history-header-hash-mismatch');
      const result=JSON.parse(bytes);if(result.productKey===productKey)candidates.push({ref,at:String(result.at??'')});
    }catch(error){rejected.push({receipt:ref?.receipt??null,reason:error.message});}
  }
  for(const candidate of candidates.sort((a,b)=>b.at.localeCompare(a.at))){
    try{return {selected:verifyBuildReceipt(candidate.ref.receipt,candidate.ref.sha256),rejected};}
    catch(error){rejected.push({receipt:candidate.ref.receipt,reason:error.message});}
  }
  return {selected:undefined,rejected};
}
function unlinkedBuildHistoryPath(file){
  const target=path.resolve(file),parsed=path.parse(target);let current=parsed.root;
  const parts=target.slice(parsed.root.length).split(path.sep);
  for(let i=0;i<parts.length;i++){
    current=path.join(current,parts[i]);const stat=fs.lstatSync(current,{throwIfNoEntry:false});if(!stat)break;
    const actual=path.resolve(fs.realpathSync.native(current)),expected=path.resolve(current),same=process.platform==='win32'?actual.toLowerCase()===expected.toLowerCase():actual===expected;
    if(stat.isSymbolicLink()||!same)throw Error('linked-build-history-parent');
    if(i<parts.length-1&&!stat.isDirectory())throw Error('invalid-build-history-parent');
  }
  return target;
}
function buildHistoryBytes(file){
  const target=unlinkedBuildHistoryPath(file),actual=regular(path.dirname(target),path.basename(target));
  if(fs.statSync(actual).size>1024*1024)throw Error('bounded-regular-build-history-required');return fs.readFileSync(actual);
}
export function readBuildHistory(file){
  const refs=JSON.parse(buildHistoryBytes(file));
  if(!Array.isArray(refs)||refs.length>500)throw Error('invalid-build-history');return refs;
}
/** Owned bounded hint index. It carries build refs only, never native PASS/observation dates. */
export function rememberBuildReceipt(resultFile,expectedSha,indexFile,{maxEntries=200}={}){
  if(!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>200)throw Error('invalid-build-index-budget');
  const target=unlinkedBuildHistoryPath(indexFile),verified=verifyBuildReceipt(resultFile,expectedSha),dir=path.dirname(target);
  fs.mkdirSync(dir,{recursive:true});unlinkedBuildHistoryPath(target);const lock=target+'.lock',lockFd=fs.openSync(lock,'wx');let temporary;
  try{
    const before=fs.existsSync(target)?sha(buildHistoryBytes(target)):null;
    const old=before?readBuildHistory(target):[],rejected=[],rows=[];
    // Revalidate pinned headers as cache hints. Only selection rechecks full immutable evidence.
    for(const ref of old)try{
      if(typeof ref?.receipt!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256??''))throw Error('invalid-build-history-ref');
      const file=regular(path.dirname(path.resolve(ref.receipt)),path.basename(ref.receipt)),bytes=fs.readFileSync(file),r=JSON.parse(bytes);
      if(sha(bytes)!==ref.sha256||r.kind!=='focused-native-result'||!/^[a-f0-9]{64}$/.test(r.productKey??'')||!/^[A-Za-z0-9_-]{1,128}$/.test(r.buildId??''))throw Error('invalid-build-history-header');
      rows.push({receipt:file,sha256:ref.sha256,productKey:r.productKey,buildId:r.buildId,at:String(r.at??'')});
    }catch(error){rejected.push({receipt:ref?.receipt??null,reason:error.message});}
    // Fold a reuse chain to the verified compile origin. Tomorrow need not follow ever more copies.
    const ref={...verified.buildOrigin,productKey:verified.result.productKey,buildId:verified.result.buildId,at:String(verified.result.at??'')};
    const key=r=>r.productKey+'|'+r.buildId,unique=new Map();
    for(const row of [...rows,ref].sort((a,b)=>a.at.localeCompare(b.at)))unique.set(key(row),row);
    const kept=[...unique.values()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,maxEntries);
    if((fs.existsSync(target)?sha(buildHistoryBytes(target)):null)!==before)throw Error('build-index-concurrently-changed');
    unlinkedBuildHistoryPath(target);
    temporary=target+'.'+randomUUID()+'.tmp';writeNew(temporary,kept);fs.renameSync(temporary,target);temporary=undefined;
    return {file:target,sha256:sha(fs.readFileSync(target)),entries:kept.length,remembered:ref,rejected,casePassReuse:false};
  }finally{if(temporary&&fs.existsSync(temporary))fs.unlinkSync(temporary);fs.closeSync(lockFd);fs.unlinkSync(lock);}
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
