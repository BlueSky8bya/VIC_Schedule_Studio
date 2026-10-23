#!/usr/bin/env node
/** Reclaim only receipt-excluded, reproducible Next caches. Evidence stays in place. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {safeQaRelative,activeState,sameIdentity} from './qa-storage.mjs';

const HASH=/^[a-f0-9]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const slash=value=>value.replaceAll('\\','/');
const writeNew=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hashFile=file=>new Promise((resolve,reject)=>{const hash=createHash('sha256'),stream=fs.createReadStream(file);stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolve(hash.digest('hex')));});
const manifestPath=p=>typeof p==='string'&&!p.includes('\\')&&!p.includes(':')&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[<>:"|?*]/.test(s)&&[...s].every(c=>c.charCodeAt(0)>31)&&!/[. ]$/.test(s));
export function safeCacheRelative(relative){
  return safeQaRelative(relative)&&/^(?:\.scratch-pw|\.scratch\d{2,})\/(?:[^/]+\/)+workspace\/\.next\/cache$/.test(relative);
}
export function regularPath(root,relative,{directory=false}={}){
  if(!safeQaRelative(relative))throw Error('unsafe-reclaim-path');
  let current=path.resolve(root);
  if(fs.lstatSync(current).isSymbolicLink()||fs.realpathSync.native(current).toLowerCase()!==current.toLowerCase())throw Error('linked-reclaim-root');
  for(const segment of relative.split('/')){current=path.join(current,segment);if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-reclaim-path');}
  const stat=fs.lstatSync(current);if(directory?!stat.isDirectory():!stat.isFile())throw Error('regular-reclaim-path-required');return current;
}
export function cacheExcluded(build,freeze,result){
  return Boolean(result?.schemaVersion===1&&result?.kind==='focused-native-result'&&Array.isArray(result.evidence)&&result.integrity?.ownedProcessesClosed===true&&result.integrity?.sourceUnchanged===true&&
    typeof build?.buildId==='string'&&build.buildId===result.buildId&&build.productKey===result.productKey&&
    Array.isArray(build.files)&&build.files.length&&build.files.every(row=>manifestPath(row.path)&&HASH.test(row.sha256??'')&&row.path.toLowerCase()!=='cache'&&!row.path.toLowerCase().startsWith('cache/'))&&
    Array.isArray(freeze?.sourceFiles)&&freeze.sourceFiles.length&&sha(JSON.stringify(freeze.sourceFiles))===freeze.contentDigest&&
    freeze.sourceFiles.every(row=>manifestPath(row.path)&&HASH.test(row.sha256??'')&&row.path.toLowerCase()!=='.next'&&!row.path.toLowerCase().startsWith('.next/')));
}
export function referencedCache(relative,root,text,referenceFile=''){
  let decoded=text;try{decoded=decodeURIComponent(decoded);}catch{/* Plain paths still checked when unrelated escapes are malformed. */}
  decoded=slash(decoded.replaceAll('\\\\','\\')).toLowerCase();
  const relativeLower=relative.toLowerCase(),absolute=slash(path.resolve(root,...relative.split('/'))).toLowerCase();
  if(decoded.includes(relativeLower)||decoded.includes(absolute))return true;
  if(referenceFile){
    const cache=path.resolve(root,...relative.split('/')).toLowerCase(),links=[];
    for(const match of text.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi))links.push(match[2]);
    for(const match of text.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\s*\)/g))links.push(match[1]??match[2]);
    for(let link of links){
      link=link.split(/[?#]/)[0];if(!link||/^(?:https?|data|app|codex):/i.test(link))continue;
      try{
        const target=(/^file:/i.test(link)?fileURLToPath(link):path.resolve(path.dirname(referenceFile),decodeURIComponent(link).replaceAll('\\','/'))).toLowerCase();
        if(target===cache||target.startsWith(cache+path.sep))return true;
      }catch{/* Malformed unrelated links do not expand or authorize cleanup. */}
    }
  }
  const run=path.resolve(root,...relative.split('/').slice(0,-3));
  // A generic mention in a policy/report is not a reference to every cache.
  // Resolve run-relative cache links only from documents inside that run.
  if(!referenceFile||!path.resolve(referenceFile).toLowerCase().startsWith(run.toLowerCase()+path.sep))return false;
  for(const match of decoded.matchAll(/(?:["'(=\s]|^)((?:\.\.?\/)*(?:workspace\/)?\.next\/cache(?:\/[a-z0-9_./%+ -]*)?)/g)){
    const target=path.resolve(path.dirname(referenceFile),...match[1].split('/'));
    if(target.toLowerCase()===path.resolve(root,...relative.split('/')).toLowerCase()||target.toLowerCase().startsWith(path.resolve(root,...relative.split('/')).toLowerCase()+path.sep))return true;
  }
  return false;
}
export function discoverReferences(roots,{maxFiles=5000,maxBytes=268435456,maxFileBytes=33554432}={}){
  const files=new Set(),locations=[];let bytes=0;
  const add=file=>{
    const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('linked-auto-reference');
    if(!stat.isFile())throw Error('nonregular-auto-reference');
    if(!/\.(?:json|jsonl|html|md|txt|log)$/i.test(file))return;
    if(stat.size>maxFileBytes||files.size>=maxFiles||bytes+stat.size>maxBytes)throw Error('reference-discovery-limit-exceeded');
    if(!files.has(file)){files.add(file);bytes+=stat.size;}
  };
  function visit(directory){
    if(fs.lstatSync(directory).isSymbolicLink())throw Error('linked-auto-reference-directory');
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('linked-auto-reference');if(entry.isDirectory())visit(file);else if(entry.isFile())add(file);}
  }
  for(const root of [...new Set(roots.map(x=>path.resolve(x)))]){
    if(fs.lstatSync(root).isSymbolicLink()||fs.realpathSync.native(root).toLowerCase()!==root.toLowerCase())throw Error('linked-auto-reference-root');
    for(const relative of ['docs/agent/reports','docs/agent/plans','docs/agent/CURRENT_STATE.md','.scratch-pw/site-daily/state.json','.scratch-pw/site-daily/history.json','.scratch-pw/site-daily/focused-case-history.json','.scratch-pw/site-daily/qa-storage-schedule.json']){
      const full=path.join(root,...relative.split('/')),exists=fs.existsSync(full);locations.push({path:full,exists});if(!exists)continue;
      // Check every parent before opening a metadata/document reference.
      let current=root;for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-auto-reference-parent');}
      if(fs.lstatSync(full).isDirectory())visit(full);else add(full);
    }
  }
  return {files:[...files].sort(),locations,logicalBytes:bytes,limitPolicy:{maxFiles,maxBytes,maxFileBytes},rawEvidenceContentsScanned:false};
}
function stateSnapshot(files){return files.map(file=>{
  if(!fs.existsSync(file))return {path:file,missing:true};const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)throw Error('bounded-regular-state-required');
  const bytes=fs.readFileSync(file),state=JSON.parse(bytes);if(activeState(state))throw Error('active-work-reclaim-deferred');return {path:file,sha256:sha(bytes)};
});}
async function referenceSnapshot(files){
  const result=[];for(const file of files){
    if(!fs.existsSync(file))throw Error('missing-reclaim-reference');
    const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>33554432)throw Error('bounded-regular-reference-required');
    const bytes=fs.readFileSync(file);result.push({path:file,size:stat.size,sha256:sha(bytes)});
  }return result;
}
function native(root,out,request){
  const id=randomUUID(),input=path.join(out,id+'-request.json'),output=path.join(out,id+'-native.json');writeNew(input,{...request,root,output});
  const helper=fileURLToPath(new URL('./qa-reclaim-native.ps1',import.meta.url));
  const child=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Request',input],{windowsHide:true,encoding:'utf8',maxBuffer:1048576});
  if(child.error||child.status!==0||!fs.existsSync(output))throw Error('reclaim-native-failed: '+String(child.error?.message??child.stderr??child.status).slice(0,200));
  return {file:output,...json(output)};
}
function listCaches(root,qaRoots,{maxScan,deadline}){
  const caches=[],skips={linked:0,protected:0,errors:0};let scanned=0,truncated=false;
  function visit(relative){
    if(scanned++>=maxScan||Date.now()>=deadline){truncated=true;return;}
    if(!safeQaRelative(relative)){skips.protected++;return;}
    const file=path.join(root,...relative.split('/'));let stat;try{stat=fs.lstatSync(file);}catch{skips.errors++;return;}
    if(stat.isSymbolicLink()){skips.linked++;return;}if(!stat.isDirectory())return;
    if(path.posix.basename(relative)==='workspace'){
      const cache=relative+'/.next/cache';if(fs.existsSync(path.join(root,...cache.split('/'))))caches.push(cache);return;
    }
    if(relative.startsWith('.scratch-pw/site-daily/reclaim')||relative.startsWith('.scratch-pw/site-daily/storage'))return;
    for(const entry of fs.readdirSync(file,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))if(entry.isDirectory()||entry.isSymbolicLink()){visit(relative+'/'+entry.name);if(truncated)break;}
  }
  for(const qaRoot of qaRoots){if(fs.existsSync(path.join(root,qaRoot)))visit(qaRoot);if(truncated)break;}return {caches,scanned,truncated,skips};
}
async function controlsFor(root,cache){
  if(!safeCacheRelative(cache))throw Error('unsafe-cache-root');regularPath(root,cache,{directory:true});
  const run=cache.slice(0,-'/workspace/.next/cache'.length),controls=[];
  for(const name of ['result.json','build.json','source-freeze.json']){
    const file=regularPath(root,run+'/'+name),stat=fs.lstatSync(file);if(stat.size>33554432)throw Error('oversized-cache-control');
    controls.push({path:run+'/'+name,sha256:await hashFile(file),value:json(file)});
  }
  const [result,build,freeze]=controls.map(row=>row.value);
  if(!cacheExcluded(build,freeze,result))throw Error('cache-not-proven-excluded');
  for(const name of ['build.json','source-freeze.json'])if(!result.evidence?.some(row=>row.path===name&&row.sha256===controls.find(x=>x.path===run+'/'+name).sha256))throw Error('unbound-cache-control');
  if(result.evidence.some(row=>!manifestPath(row.path)||row.path.toLowerCase()==='workspace/.next/cache'||row.path.toLowerCase().startsWith('workspace/.next/cache/')))throw Error('cache-is-pinned-evidence');
  return {run,buildId:build.buildId,productKey:build.productKey,controls:controls.map(({path,sha256})=>({path,sha256}))};
}
function cacheFiles(root,cache,maxFiles){
  const result=[],directories=[];
  function visit(relative){
    const full=path.join(root,...relative.split('/')),stat=fs.lstatSync(full);
    if(stat.isSymbolicLink())throw Error('linked-cache-entry');
    if(stat.isDirectory()){directories.push({path:relative,ino:stat.ino,dev:stat.dev});for(const entry of fs.readdirSync(full))visit(relative+'/'+entry);}
    else if(stat.isFile()&&stat.nlink===1){if(result.length>=maxFiles)throw Error('cache-files-over-budget');result.push({relative,stat});}
    else throw Error('nonregular-or-hardlinked-cache');
  }
  visit(cache);return {files:result.sort((a,b)=>a.relative.localeCompare(b.relative)),directories:directories.sort((a,b)=>a.path.localeCompare(b.path))};
}
export function options(argv){
  const o={root:process.cwd(),qaRoots:[],references:[],states:[],excludeRuns:[],apply:false,maxBytes:107374182400,maxFiles:100000,maxCaches:100,maxScan:100000,minutes:10,minAgeHours:24};
  const names={'--root':'root','--plan':'plan','--plan-sha':'planSha','--max-bytes':'maxBytes','--max-files':'maxFiles','--max-caches':'maxCaches','--max-scan':'maxScan','--minutes':'minutes','--min-age-hours':'minAgeHours'};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];if(key==='--apply'){o.apply=true;continue;}const value=argv[++i];if(!value||value.startsWith('--'))throw Error('missing-reclaim-option-value');
    if(key==='--qa-root')o.qaRoots.push(value);else if(key==='--reference')o.references.push(value);else if(key==='--state')o.states.push(value);else if(key==='--exclude-run')o.excludeRuns.push(value);else if(names[key])o[names[key]]=value;else throw Error('unknown-reclaim-option');
  }
  o.root=path.resolve(o.root);o.qaRoots=o.qaRoots.length?o.qaRoots:['.scratch-pw'];
  if(o.qaRoots.some(p=>!safeQaRelative(p)||p.includes('/'))||new Set(o.qaRoots).size!==o.qaRoots.length)throw Error('safe-explicit-qa-roots-required');
  if(o.excludeRuns.some(p=>!safeQaRelative(p)))throw Error('safe-excluded-run-required');
  for(const key of ['maxBytes','maxFiles','maxCaches','maxScan','minutes','minAgeHours']){o[key]=Number(o[key]);if(!Number.isSafeInteger(o[key])||o[key]<(key==='minAgeHours'?0:1))throw Error('positive-reclaim-limits-required');}
  if(o.maxBytes>107374182400||o.maxFiles>1000000||o.maxCaches>1000||o.maxScan>1000000||o.minutes>60)throw Error('reclaim-limits-outside-bounds');
  if(o.apply&&(!o.plan||!HASH.test(o.planSha??''))||!o.apply&&(o.plan||o.planSha))throw Error('apply-requires-pinned-reclaim-plan');
  o.states=[...new Set([path.join(o.root,'.scratch-pw/site-daily/state.json'),...o.states.map(p=>path.resolve(p))])];
  const referenceRoots=[o.root,...o.states.filter(p=>slash(p).toLowerCase().endsWith('/.scratch-pw/site-daily/state.json')).map(p=>path.dirname(path.dirname(path.dirname(p))))];
  o.referenceDiscovery=discoverReferences(referenceRoots);
  o.references=[...new Set([...o.referenceDiscovery.files,...o.references.map(p=>path.resolve(o.root,p))])].sort();return o;
}
export function validatePlan(plan,o){
  if(plan.schemaVersion!==1||plan.kind!=='qa-reclaim-plan'||path.resolve(plan.root)!==o.root||!Array.isArray(plan.caches)||plan.caches.length>o.maxCaches||!Array.isArray(plan.states)||!Array.isArray(plan.references))throw Error('invalid-reclaim-plan');
  if(!Number.isFinite(Date.parse(plan.at))||Date.now()-Date.parse(plan.at)>86400000||Date.parse(plan.at)>Date.now()+60000)throw Error('stale-reclaim-plan');
  if(JSON.stringify(plan.states.map(x=>x.path))!==JSON.stringify(o.states)||JSON.stringify(plan.references.map(x=>x.path))!==JSON.stringify(o.references))throw Error('reclaim-protection-set-mismatch');
  const seen=new Set();let bytes=0,count=0;
  for(const cache of plan.caches){
    if(!safeCacheRelative(cache.path)||!o.qaRoots.includes(cache.path.split('/')[0])||seen.has(cache.path.toLowerCase())||!Array.isArray(cache.files)||!Array.isArray(cache.directories)||!Array.isArray(cache.controls)||cache.controls.length!==3||!cache.directories.some(d=>d.path===cache.path))throw Error('unsafe-cache-plan');
    seen.add(cache.path.toLowerCase());const paths=new Set();
    for(const file of cache.files){
      if(!safeQaRelative(file.path)||!file.path.startsWith(cache.path+'/')||paths.has(file.path.toLowerCase())||!HASH.test(file.sha256??'')||file.nlink!==1||!Number.isSafeInteger(file.size)||file.size<0||!Number.isSafeInteger(file.allocatedBytes)||file.allocatedBytes<0)throw Error('unsafe-cache-plan-file');
      paths.add(file.path.toLowerCase());bytes+=file.size;count++;
    }
    if(cache.directories.some(d=>!safeQaRelative(d.path)||d.path!==cache.path&&!d.path.startsWith(cache.path+'/')))throw Error('unsafe-cache-plan-directory');
    if(cache.controls.some(row=>!HASH.test(row.sha256??'')))throw Error('invalid-cache-control-hash');
  }
  if(bytes>o.maxBytes||count>o.maxFiles)throw Error('reclaim-plan-over-budget');return plan.caches;
}
export async function run(o){
  if(process.platform!=='win32')throw Error('reclaim-requires-windows');
  const started=Date.now(),deadline=started+o.minutes*60000,root=o.root;
  if(fs.lstatSync(root).isSymbolicLink()||!fs.statSync(root).isDirectory()||fs.realpathSync.native(root).toLowerCase()!==root.toLowerCase())throw Error('regular-reclaim-project-required');
  let output=root;for(const part of ['.scratch-pw','site-daily','reclaim']){output=path.join(output,part);if(fs.existsSync(output)){if(fs.lstatSync(output).isSymbolicLink()||!fs.statSync(output).isDirectory())throw Error('linked-reclaim-output');}else fs.mkdirSync(output);}
  const lease=path.join(output,'lease.json'),token=randomUUID();
  if(fs.existsSync(lease))throw Error('reclaim-lease-exists-review-owner');
  writeNew(lease,{pid:process.pid,token,started:new Date(started).toISOString()});
  const out=path.join(output,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));fs.mkdirSync(out);
  const result={schemaVersion:1,kind:'qa-reclaim-result',at:new Date().toISOString(),root,output:out,apply:o.apply,policy:{deleteOnly:'receipt-excluded workspace/.next/cache',rawEvidenceDeleted:false,sourceOrBuildDeleted:false,hardlinkDeduplication:false,qaPassChanged:false}};
  try{
    const states=stateSnapshot(o.states),references=await referenceSnapshot(o.references),environment=native(root,out,{mode:'environment',ignorePid:process.pid});
    if(environment.fileSystem!=='NTFS'||environment.activeProcesses.length)throw Error('active-process-or-non-ntfs-reclaim-deferred');
    if(!o.apply){
      const scan=listCaches(root,o.qaRoots,{maxScan:o.maxScan,deadline}),caches=[],skipped=[];let totalBytes=0,totalFiles=0;
      const texts=o.references.filter(p=>/\.(?:json|jsonl|html|md|txt|log)$/i.test(p)).map(p=>({file:p,text:fs.readFileSync(p,'utf8')}));
      for(const candidate of scan.caches){
        if(Date.now()>=deadline||caches.length>=o.maxCaches)break;
        try{
          if(o.excludeRuns.some(run=>candidate===run+'/workspace/.next/cache'||candidate.startsWith(run+'/')))throw Error('explicitly-excluded-active-run');
          if(texts.some(row=>referencedCache(candidate,root,row.text,row.file)))throw Error('direct-reference-to-cache');
          const binding=await controlsFor(root,candidate),listing=cacheFiles(root,candidate,o.maxFiles-totalFiles);
          const latest=Math.max(...listing.files.map(x=>Math.max(x.stat.mtimeMs,x.stat.birthtimeMs)),...listing.directories.map(x=>fs.lstatSync(path.join(root,...x.path.split('/'))).mtimeMs));
          if(started-latest<o.minAgeHours*3600000)throw Error('cache-not-cold');
          const bytes=listing.files.reduce((sum,x)=>sum+x.stat.size,0);if(totalBytes+bytes>o.maxBytes)throw Error('cache-byte-budget');
          const inspected=native(root,out,{mode:'inspect',ignorePid:process.pid,paths:listing.files.map(x=>path.join(root,...x.relative.split('/')))}),files=[];
          for(const row of listing.files){
            if(Date.now()>=deadline)throw Error('reclaim-plan-budget-ended');const full=regularPath(root,row.relative),meta=inspected.files.find(x=>x.path.toLowerCase()===full.toLowerCase());
            if(!meta||meta.error||meta.nlink!==1||meta.unsafeReparse)throw Error('cache-native-inspection-failed');
            const sha256=await hashFile(full),after=fs.lstatSync(full);if(!sameIdentity(row.stat,after))throw Error('cache-mutated-during-plan');
            files.push({path:row.relative,sha256,size:after.size,mtimeMs:after.mtimeMs,birthtimeMs:after.birthtimeMs,ino:after.ino,dev:after.dev,nlink:after.nlink,allocatedBytes:meta.allocatedBytes});
          }
          caches.push({path:candidate,...binding,files,directories:listing.directories});totalBytes+=bytes;totalFiles+=files.length;
        }catch(error){skipped.push({path:candidate,reason:String(error.message??error)});}
      }
      const plan={schemaVersion:1,kind:'qa-reclaim-plan',at:new Date().toISOString(),root,states,references,referenceDiscovery:o.referenceDiscovery,caches,scan,skipped},file=path.join(out,'plan.json');writeNew(file,plan);
      Object.assign(result,{status:'planned',plan:file,planSha256:sha(fs.readFileSync(file)),selectedCaches:caches.length,selectedFiles:totalFiles,selectedLogicalBytes:totalBytes,selectedAllocatedBytes:caches.flatMap(x=>x.files).reduce((n,x)=>n+x.allocatedBytes,0),skipped,scan});
    }else{
      const bytes=fs.readFileSync(o.plan);if(sha(bytes)!==o.planSha)throw Error('reclaim-plan-sha-mismatch');const plan=JSON.parse(bytes),caches=validatePlan(plan,o);
      if(JSON.stringify(states)!==JSON.stringify(plan.states)||JSON.stringify(references)!==JSON.stringify(plan.references))throw Error('reclaim-protection-mutated-since-plan');
      for(const cache of caches){
        const binding=await controlsFor(root,cache.path);if(JSON.stringify(binding.controls)!==JSON.stringify(cache.controls))throw Error('reclaim-controls-mutated');
        const current=cacheFiles(root,cache.path,o.maxFiles);if(JSON.stringify(current.files.map(x=>x.relative))!==JSON.stringify(cache.files.map(x=>x.path))||JSON.stringify(current.directories)!==JSON.stringify(cache.directories))throw Error('reclaim-cache-file-set-mutated');
        for(const row of cache.files){const full=regularPath(root,row.path),stat=fs.lstatSync(full);if(!sameIdentity(stat,row)||await hashFile(full)!==row.sha256)throw Error('reclaim-cache-mutated-since-plan');}
      }
      const applied=native(root,out,{mode:'remove-cache',ignorePid:process.pid,deadline,states,references,caches,journal:path.join(out,'operations.jsonl')});
      const afterRefs=await referenceSnapshot(o.references),referenceIntegrity=JSON.stringify(afterRefs)===JSON.stringify(references);
      const completed=applied.caches.filter(x=>x.status==='removed');
      for(const cache of caches)for(const control of cache.controls)if(await hashFile(regularPath(root,control.path))!==control.sha256)throw Error('post-reclaim-control-mismatch');
      Object.assign(result,{status:referenceIntegrity&&!applied.failure?'completed':'failed',plan:path.resolve(o.plan),planSha256:o.planSha,nativeReceipt:applied.file,referenceIntegrity,controlsIntegrity:true,completedCaches:completed.length,completedFiles:completed.reduce((n,x)=>n+x.files,0),savedAllocatedBytes:completed.reduce((n,x)=>n+x.allocatedBefore,0),allocationScope:'sum of measured allocated bytes of removed single-link cache files; no claim of whole-drive deduplication or free-space attribution',freeBytesBefore:applied.freeBytesBefore,freeBytesAfter:applied.freeBytesAfter,freeBytesDelta:applied.freeBytesAfter-applied.freeBytesBefore,results:applied.caches,failure:applied.failure??null});
      if(!referenceIntegrity)result.failure='post-reclaim-reference-mismatch';
    }
  }catch(error){Object.assign(result,{status:'deferred-or-failed',failure:String(error.message??error)});}
  finally{if(fs.existsSync(lease)&&!fs.lstatSync(lease).isSymbolicLink()&&json(lease).token===token)fs.unlinkSync(lease);}
  result.wallMs=Date.now()-started;writeNew(path.join(out,'result.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=await run(options(process.argv.slice(2)));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(!['planned','completed'].includes(result.status))process.exitCode=1;}catch(error){process.stderr.write(String(error.message??error)+'\n');process.exitCode=1;}
}
