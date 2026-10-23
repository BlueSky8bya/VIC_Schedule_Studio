#!/usr/bin/env node
/** Cold QA storage maintenance: transparent NTFS compression, never relocation or deletion. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HASH=/^[a-f0-9]{64}$/;
const TEXT=new Set(['.json','.jsonl','.ndjson','.log','.txt','.csv','.html','.xml','.js','.mjs','.cjs','.ts','.tsx','.css','.map','.pack','.md','.yaml','.yml']);
const PROTECTED=/(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|node_modules|art-src|public|assets|originals?|references?|backups?|recovery|secrets?|credentials?|sessions?|cookies?|private|analytics|telemetry|api-cache|login)(?:\/|$)/i;
const ACTIVE_KEYS=['activeRun','activeWork','activeFactory','sourceFreeze','sourceFrozen'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=file=>new Promise((resolve,reject)=>{const h=createHash('sha256'),s=fs.createReadStream(file);s.on('data',chunk=>h.update(chunk));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')));});
const writeNew=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const slash=p=>p.replaceAll('\\','/');
export function safeQaRelative(relative){
  if(typeof relative!=='string'||relative.includes('\\')||relative.includes(':')||relative.includes('\0')||path.posix.isAbsolute(relative))return false;
  const parts=relative.split('/');
  return /^(?:\.scratch-pw|\.scratch\d{2,})$/.test(parts[0])&&parts.every(p=>p&&p!=='.'&&p!=='..'&&!/[<>:"|?*]/.test(p)&&[...p].every(c=>c.charCodeAt(0)>31)&&!/[. ]$/.test(p)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))&&!PROTECTED.test(relative)&&!relative.startsWith('.scratch-pw/site-daily/storage/');
}
export function activeState(state){return Boolean(state&&ACTIVE_KEYS.some(key=>state[key]!==null&&state[key]!==undefined&&state[key]!==false));}
export function eligible(relative,stat,{now=Date.now(),minAgeHours=24,minBytes=65536,maxFileBytes=268435456}={}){
  return safeQaRelative(relative)&&stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&TEXT.has(path.posix.extname(relative).toLowerCase())&&stat.size>=minBytes&&stat.size<=maxFileBytes&&now-Math.max(stat.mtimeMs,stat.birthtimeMs)>=minAgeHours*3600000;
}
export function sameIdentity(a,b){return a.dev===b.dev&&a.ino===b.ino&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.birthtimeMs===b.birthtimeMs;}
export function pendingCandidates(candidates,pendingPaths,completed){
  const pending=new Set(pendingPaths),done=new Map(completed.map(x=>[x.path,x]));
  return candidates.filter(x=>{const d=done.get(x.relative);return !d||d.size!==x.stat.size||d.mtimeMs!==x.stat.mtimeMs||d.ino!==x.stat.ino;}).sort((a,b)=>Number(pending.has(b.relative))-Number(pending.has(a.relative))||b.stat.size-a.stat.size||a.relative.localeCompare(b.relative));
}
export function regularQa(root,relative){
  if(!safeQaRelative(relative))throw Error('unsafe-qa-path');
  const base=path.resolve(root),file=path.resolve(base,...relative.split('/'));
  if(!file.startsWith(base+path.sep))throw Error('outside-qa-root');
  let current=base;
  if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-project-root');
  for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-qa-path');}
  if(!fs.lstatSync(file).isFile())throw Error('regular-qa-file-required');
  return file;
}
export function options(argv){
  const o={root:process.cwd(),qaRoots:[],references:[],states:[],apply:false,maxBytes:2147483648,maxFiles:1000,maxScan:100000,minutes:3,minAgeHours:24,minBytes:65536,maxFileBytes:268435456};
  const names={'--root':'root','--plan':'plan','--plan-sha':'planSha','--max-bytes':'maxBytes','--max-files':'maxFiles','--max-scan':'maxScan','--minutes':'minutes','--min-age-hours':'minAgeHours','--min-bytes':'minBytes','--max-file-bytes':'maxFileBytes'};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];if(key==='--apply'){o.apply=true;continue;}
    const value=argv[++i];if(!value||value.startsWith('--'))throw Error('missing-storage-option-value');
    if(key==='--qa-root')o.qaRoots.push(value);else if(key==='--reference')o.references.push(value);else if(key==='--state')o.states.push(value);else if(names[key])o[names[key]]=value;else throw Error('unknown-storage-option');
  }
  o.root=path.resolve(o.root);o.qaRoots=o.qaRoots.length?o.qaRoots:['.scratch-pw'];
  if(o.qaRoots.some(p=>!safeQaRelative(p)||p.includes('/'))||new Set(o.qaRoots).size!==o.qaRoots.length)throw Error('explicit-safe-qa-roots-required');
  for(const key of ['maxBytes','maxFiles','maxScan','minutes','minAgeHours','minBytes','maxFileBytes']){o[key]=Number(o[key]);if(!Number.isSafeInteger(o[key])||o[key]<1)throw Error('positive-storage-limits-required');}
  if(o.minAgeHours<24||o.maxFiles>10000||o.maxScan>1000000||o.minutes>60||o.maxBytes>107374182400||o.maxFileBytes>1073741824)throw Error('storage-limit-outside-safe-bounds');
  if(o.apply&&(!o.plan||!HASH.test(o.planSha??''))||!o.apply&&(o.plan||o.planSha))throw Error('apply-requires-pinned-plan');
  o.states=[...new Set([path.join(o.root,'.scratch-pw/site-daily/state.json'),...o.states.map(p=>path.resolve(p))])];
  o.references=[...new Set(o.references.map(p=>path.resolve(o.root,p)))];return o;
}
function stateSnapshot(files){return files.map(file=>{if(!fs.existsSync(file))return {path:file,missing:true};const s=fs.lstatSync(file);if(s.isSymbolicLink()||!s.isFile()||s.size>1048576)throw Error('bounded-regular-state-required');const bytes=fs.readFileSync(file),state=JSON.parse(bytes);return {path:file,sha256:digest(bytes),active:activeState(state)};});}
function assertIdle(states){const rows=stateSnapshot(states);if(rows.some(x=>x.active))throw Error('active-qa-work-storage-deferred');return rows;}
function native(root,out,request){
  const id=randomUUID(),input=path.join(out,id+'-request.json'),output=path.join(out,id+'-native.json');
  writeNew(input,{...request,root,output});
  const helper=fileURLToPath(new URL('./qa-storage-native.ps1',import.meta.url));
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Request',input],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
  if(p.error||p.status!==0||!fs.existsSync(output))throw Error('native-storage-helper-failed: '+String(p.error?.message??p.stderr??p.status).slice(0,300));
  return {file:output,...JSON.parse(fs.readFileSync(output,'utf8').replace(/^\uFEFF/,''))};
}
function inventory(root,qaRoots,{maxScan,deadline,after=''}){
  const files=[];let scanned=0,last='',truncated=false;const skips={linked:0,protected:0,errors:0};
  function visit(relative){
    if(truncated)return;
    if(!safeQaRelative(relative)){skips.protected++;return;}
    const file=path.join(root,...relative.split('/'));let stat;try{stat=fs.lstatSync(file);}catch{skips.errors++;return;}
    if(stat.isSymbolicLink()){skips.linked++;return;}
    if(stat.isFile()){
      if(relative<=after)return;
      if(scanned>=maxScan||Date.now()>=deadline){truncated=true;return;}
      scanned++;last=relative;files.push({relative,stat});return;
    }
    if(!stat.isDirectory())return;
    if(after&&relative+'/'<after&&!after.startsWith(relative+'/'))return;
    let names;try{names=fs.readdirSync(file,{withFileTypes:true}).sort((a,b)=>{const x=a.name+(a.isDirectory()?'/':''),y=b.name+(b.isDirectory()?'/':'');return x<y?-1:x>y?1:0;});}catch{skips.errors++;return;}
    for(const entry of names){visit(relative+'/'+entry.name);if(truncated)break;}
  }
  for(const relative of [...qaRoots].sort()){visit(relative);if(truncated)break;}
  return {files,scanned,last:truncated?last:'',truncated,skips};
}
async function references(files){
  const rows=[];for(const file of files){
    if(!fs.existsSync(file)){rows.push({path:file,exists:false});continue;}
    const s=fs.lstatSync(file);if(s.isSymbolicLink()||!s.isFile())throw Error('regular-reference-required');
    rows.push({path:file,exists:true,size:s.size,sha256:await hashFile(file)});
  }return rows;
}
export function validatePlan(plan,o){
  if(plan.schemaVersion!==1||plan.kind!=='qa-storage-plan'||path.resolve(plan.root)!==o.root||!Array.isArray(plan.files)||plan.files.length>o.maxFiles||!Array.isArray(plan.states)||!Array.isArray(plan.references))throw Error('invalid-storage-plan');
  if(!Number.isFinite(Date.parse(plan.at))||Date.now()-Date.parse(plan.at)>86400000||Date.parse(plan.at)>Date.now()+60000)throw Error('stale-storage-plan');
  let bytes=0;const seen=new Set();
  for(const row of plan.files){
    if(!safeQaRelative(row.path)||!o.qaRoots.includes(row.path.split('/')[0])||!TEXT.has(path.posix.extname(row.path).toLowerCase())||!HASH.test(row.sha256??'')||row.nlink!==1||!Number.isSafeInteger(row.size)||row.size<o.minBytes||row.size>o.maxFileBytes||seen.has(row.path.toLowerCase()))throw Error('unsafe-storage-plan-file');
    bytes+=row.size;seen.add(row.path.toLowerCase());
  }
  if(bytes>o.maxBytes)throw Error('storage-plan-over-budget');
  if(plan.states.some(s=>s.active)||plan.states.some(s=>!o.states.includes(s.path)))throw Error('storage-plan-state-mismatch');
  return plan.files;
}
export async function run(o){
  if(process.platform!=='win32')throw Error('ntfs-storage-requires-windows');
  const started=Date.now(),deadline=started+o.minutes*60000,root=o.root;
  if(!fs.statSync(root).isDirectory()||fs.lstatSync(root).isSymbolicLink()||fs.realpathSync.native(root).toLowerCase()!==root.toLowerCase())throw Error('regular-project-root-required');
  let current=root;for(const part of ['.scratch-pw','site-daily','storage']){current=path.join(current,part);if(fs.existsSync(current)){if(fs.lstatSync(current).isSymbolicLink()||!fs.statSync(current).isDirectory())throw Error('linked-storage-output');}else fs.mkdirSync(current);}
  const base=current,lease=path.join(base,'lease.json'),token=randomUUID();
  if(fs.existsSync(lease)){
    if(fs.lstatSync(lease).isSymbolicLink()||fs.statSync(lease).size>4096)throw Error('unsafe-storage-lease');
    const prior=JSON.parse(fs.readFileSync(lease));let alive=true;
    if(!Number.isInteger(prior.pid)||prior.pid<1)throw Error('unverifiable-storage-lease');
    try{process.kill(prior.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
    if(alive)throw Error('storage-maintenance-already-active');
    fs.renameSync(lease,path.join(base,'lease-stale-'+Date.now()+'-'+randomUUID()+'.json'));
  }
  writeNew(lease,{pid:process.pid,token,started:new Date(started).toISOString()});
  const out=path.join(base,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));fs.mkdirSync(out);
  const cursor=path.join(base,'cursor.json');let progress={qaRoots:o.qaRoots,after:'',pendingPaths:[],completed:[]};
  if(fs.existsSync(cursor)){if(fs.lstatSync(cursor).isSymbolicLink()||fs.statSync(cursor).size>8388608)throw Error('bounded-regular-storage-cursor-required');const c=JSON.parse(fs.readFileSync(cursor));if(JSON.stringify(c.qaRoots)===JSON.stringify(o.qaRoots))progress={...progress,...c};}
  const updateProgress=extra=>{progress={...progress,...extra,at:new Date().toISOString()};const tmp=cursor+'.'+randomUUID()+'.tmp';writeNew(tmp,progress);fs.renameSync(tmp,cursor);};
  const summary={schemaVersion:1,kind:'qa-storage-result',at:new Date().toISOString(),root,apply:o.apply,policy:{relocation:false,deletion:false,lossyEncoding:false,rawEvidenceRewritten:false},contentVerification:'not-performed',output:out};
  try{
    const states=assertIdle(o.states),environment=native(root,out,{mode:'environment',ignorePid:process.pid});
    if(environment.fileSystem!=='NTFS'||environment.activeProcesses?.length)throw Error(environment.fileSystem!=='NTFS'?'ntfs-required':'active-native-process-storage-deferred');
    if(!o.apply){
      const scan=inventory(root,o.qaRoots,{maxScan:o.maxScan,deadline,after:progress.after});
      const pending=new Set(progress.pendingPaths.filter(safeQaRelative));
      const candidates=scan.files.filter(x=>eligible(x.relative,x.stat,{...o,now:started}));
      for(const relative of pending){if(candidates.some(x=>x.relative===relative))continue;try{const stat=fs.lstatSync(regularQa(root,relative));if(eligible(relative,stat,{...o,now:started}))candidates.push({relative,stat});}catch{ /* Missing or now-protected work is never followed. */ }}
      const remaining=pendingCandidates(candidates,[...pending],progress.completed);
      const selected=[];let logicalBytes=0;
      for(const candidate of remaining){if(selected.length>=o.maxFiles||Date.now()>=deadline)break;if(logicalBytes+candidate.stat.size>o.maxBytes)continue;selected.push(candidate);logicalBytes+=candidate.stat.size;}
      const metadata=selected.length?native(root,out,{mode:'inspect',paths:selected.map(x=>path.join(root,...x.relative.split('/'))),ignorePid:process.pid}):{files:[]};
      const files=[],alreadyCompressed=[];
      for(const candidate of selected){
        if(Date.now()>=deadline)break;
        const full=regularQa(root,candidate.relative),m=metadata.files.find(x=>x.path.toLowerCase()===full.toLowerCase());
        if(!m||m.error||m.unsafeReparse||m.encrypted||m.nlink!==1)continue;
        if(m.wof||m.allocatedBytes+4096<m.size){
          const s=fs.lstatSync(full);if(sameIdentity(candidate.stat,s))alreadyCompressed.push({path:candidate.relative,size:s.size,mtimeMs:s.mtimeMs,ino:s.ino,compressionState:'already-compressed-inspected',qaOutcome:null});continue;
        }
        const before=fs.lstatSync(full),sha256=await hashFile(full),afterStat=fs.lstatSync(full);
        if(!sameIdentity(before,afterStat)||!eligible(candidate.relative,afterStat,{...o,now:started}))continue;
        files.push({path:candidate.relative,sha256,size:afterStat.size,mtimeMs:afterStat.mtimeMs,birthtimeMs:afterStat.birthtimeMs,ino:afterStat.ino,dev:afterStat.dev,nlink:afterStat.nlink,allocatedBytes:m.allocatedBytes});
      }
      const refs=await references(o.references),plan={schemaVersion:1,kind:'qa-storage-plan',at:new Date().toISOString(),root,states,references:refs,limits:{maxBytes:o.maxBytes,maxFiles:o.maxFiles,minutes:o.minutes,minAgeHours:o.minAgeHours},scan:{scanned:scan.scanned,truncated:scan.truncated,nextAfter:scan.last,skips:scan.skips},files};
      const planFile=path.join(out,'plan.json');writeNew(planFile,plan);
      // Cursor is advisory inventory progress; immutable plans/receipts remain untouched.
      const inspectedPaths=new Set(alreadyCompressed.map(x=>x.path));
      const pendingPaths=remaining.filter(x=>!inspectedPaths.has(x.relative)).map(x=>x.relative);
      updateProgress({after:pendingPaths.length>10000?'':scan.last,plan:planFile,pendingPaths:pendingPaths.slice(0,10000),completed:[...progress.completed.filter(x=>!inspectedPaths.has(x.path)),...alreadyCompressed].slice(-10000)});
      Object.assign(summary,{status:'planned',plan:planFile,planSha256:digest(fs.readFileSync(planFile)),selectedFiles:files.length,inspectionErrors:metadata.files.filter(x=>x.error).length,inspectionReceipt:metadata.file??null,alreadyCompressedInspected:alreadyCompressed.length,alreadyCompressedIsQaPass:false,pendingOverflow:Math.max(0,pendingPaths.length-10000),selectedLogicalBytes:files.reduce((n,x)=>n+x.size,0),selectedAllocatedBytes:files.reduce((n,x)=>n+x.allocatedBytes,0),scan:plan.scan});
    }else{
      const planBytes=fs.readFileSync(o.plan);if(digest(planBytes)!==o.planSha)throw Error('storage-plan-sha-mismatch');
      const plan=JSON.parse(planBytes),files=validatePlan(plan,o);
      const refsBefore=await references(plan.references.map(x=>x.path));
      if(JSON.stringify(refsBefore)!==JSON.stringify(plan.references))throw Error('reference-mutated-since-plan');
      for(const row of files){const full=regularQa(root,row.path),s=fs.lstatSync(full);if(!sameIdentity(s,row)||!eligible(row.path,s,{...o,now:Date.now()})||await hashFile(full)!==row.sha256)throw Error('candidate-mutated-since-plan');}
      const nativeResult=native(root,out,{mode:'compress',ignorePid:process.pid,deadline,states:assertIdle(o.states),files:files.map(row=>({...row,path:path.join(root,...row.path.split('/'))})),journal:path.join(out,'operations.jsonl')});
      const refsAfter=await references(plan.references.map(x=>x.path));
      const referenceIntegrity=JSON.stringify(refsBefore)===JSON.stringify(refsAfter);
      const changed=nativeResult.files.filter(x=>x.status==='compressed');
      for(const row of changed){const expected=files.find(x=>path.join(root,...x.path.split('/')).toLowerCase()===row.path.toLowerCase());if(!expected||await hashFile(row.path)!==expected.sha256)throw Error('post-compression-content-mismatch');}
      const completedPaths=new Set(nativeResult.files.filter(x=>['compressed','already-compressed'].includes(x.status)).map(x=>slash(path.relative(root,x.path))));
      const pendingPaths=[...new Set([...files.filter(x=>!completedPaths.has(x.path)).map(x=>x.path),...progress.pendingPaths.filter(x=>!completedPaths.has(x))])];
      const newlyDone=files.filter(x=>completedPaths.has(x.path)).map(x=>({path:x.path,size:x.size,mtimeMs:x.mtimeMs,ino:x.ino,sha256:x.sha256}));
      updateProgress({pendingPaths,completed:[...progress.completed.filter(x=>!completedPaths.has(x.path)),...newlyDone].slice(-10000),lastApply:path.join(out,'result.json')});
      Object.assign(summary,{status:referenceIntegrity&&!nativeResult.failure?'completed':'failed',plan:path.resolve(o.plan),planSha256:o.planSha,nativeReceipt:nativeResult.file,referenceIntegrity,references:refsAfter,completedFiles:changed.length,skippedFiles:nativeResult.files.filter(x=>x.status!=='compressed').length,pendingFiles:pendingPaths.length,logicalBytes:changed.reduce((n,x)=>n+x.size,0),allocatedBytesBefore:changed.reduce((n,x)=>n+x.allocatedBefore,0),allocatedBytesAfter:changed.reduce((n,x)=>n+x.allocatedAfter,0),savedAllocatedBytes:changed.reduce((n,x)=>n+x.allocatedBefore-x.allocatedAfter,0),allocationScope:'actual per-file allocation deltas for single-link processed files; not a sum of unique whole-drive usage',failure:nativeResult.failure??null,rollback:'For exact files in operations.jsonl: compact.exe /U /EXE <absolute-file>. No automatic decompression, relocation or deletion.'});
      summary.contentVerification=changed.length?'all-processed-files-sha256-and-size-mtime-verified':'no-newly-compressed-files';
      if(!referenceIntegrity)summary.failure='reference-integrity-failed';
    }
  }catch(e){Object.assign(summary,{status:'deferred-or-failed',failure:String(e.message??e)});}
  finally{if(fs.existsSync(lease)&&!fs.lstatSync(lease).isSymbolicLink()&&JSON.parse(fs.readFileSync(lease)).token===token)fs.unlinkSync(lease);}
  summary.wallMs=Date.now()-started;writeNew(path.join(out,'result.json'),summary);return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=await run(options(process.argv.slice(2)));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(!['planned','completed'].includes(result.status))process.exitCode=1;}catch(e){process.stderr.write(String(e.message??e)+'\n');process.exitCode=1;}
}
