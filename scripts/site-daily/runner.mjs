#!/usr/bin/env node
/** Produces a local triage plan and optionally runs allowlisted offline units.
 * Does not start a server, read production data, approve ideas or deploy. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {finished} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
import {planDaily,shortlistIdeas} from './policy.mjs';
import {AREAS,ALWAYS_UNITS,AREA_UNITS,dayOrdinal} from './catalog.mjs';
import {childEnvironment,ownedTerminationCommand} from '../companion-qa/runner.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
export function options(argv){
  const out={day:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),root:process.cwd(),runOffline:false,base:'HEAD'};
  const names={'--day':'day','--root':'root','--base':'base','--history':'history','--signals':'signals','--ideas':'ideas','--changed':'changed'};
  for(let i=0;i<argv.length;i++){if(argv[i]==='--run-offline')out.runOffline=true;else if(names[argv[i]]){const value=argv[++i];if(!value||value.startsWith('--'))throw Error('missing-option-value');out[names[argv[i-1]]]=value;}else throw Error('unknown-option');}
  dayOrdinal(out.day);out.root=path.resolve(out.root);if(!/^[a-zA-Z0-9_./-]{1,160}$/.test(out.base)||out.base.startsWith('-'))throw Error('invalid-base');return out;
}
function readInput(file){if(!file)return undefined;const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('input-must-be-small-regular-json');return JSON.parse(fs.readFileSync(file,'utf8'));}
function fingerprint(root,files){return files.map(file=>{let current=root;for(const part of file.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('linked-source-excluded');}return {path:file,sha256:sha(fs.readFileSync(current))};});}
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
/** Exact owned PID only. Catchable interruption preserves logs and joins cleanup. */
export async function watchOwnedChild(child,timeoutMs=600000){
  let error,timedOut=false,cancelled=false,stopping;
  const stop=()=>{if(stopping)return stopping;stopping=(async()=>{
    if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;
    const spec=ownedTerminationCommand(child.pid);
    if(spec.file)await new Promise(resolve=>{const killer=spawn(spec.file,spec.args,{windowsHide:true,shell:false,stdio:'ignore'});killer.once('error',e=>{error=e.message;resolve();});killer.once('close',code=>{if(code!==0&&child.exitCode===null&&child.signalCode===null)error='owned-cleanup-failed';resolve();});});
    else try{process.kill(spec.group,spec.signal);}catch(e){if(e.code!=='ESRCH')error=e.message;}
  })();return stopping;};
  const cancel=()=>{cancelled=true;void stop();};
  process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
  const timer=setTimeout(()=>{timedOut=true;void stop();},timeoutMs);
  try{const code=await new Promise(resolve=>{child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stopping;return {code,error:error??null,timedOut,cancelled};}
  finally{clearTimeout(timer);process.off('SIGINT',cancel);process.off('SIGTERM',cancel);if(child.exitCode===null&&child.signalCode===null)await stop();}
}
async function offline(root,plan,out){
  const allowed=new Set([...ALWAYS_UNITS,...AREAS.flatMap(a=>AREA_UNITS[a])]);if(plan.offlineUnitFiles.some(f=>!allowed.has(f)))throw Error('unit-outside-fixed-allowlist');
  const log=fs.createWriteStream(path.join(out,'offline.log'),{flags:'wx'}),json=path.join(out,'vitest.json');
  const args=['node_modules/vitest/vitest.mjs','run','--config','scripts/site-daily/vitest.config.mjs',...plan.offlineUnitFiles,'--maxWorkers=3','--reporter=json','--outputFile='+json];
  const env=childEnvironment(process.env,{NODE_OPTIONS:'--import '+pathToFileURL(path.join(root,'scripts/site-daily/offline-guard.mjs')).href,SITE_DAILY_NETWORK_LOG:path.join(out,'network.jsonl')});
  const start=Date.now(),child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,detached:process.platform!=='win32',shell:false,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const {code,error,timedOut,cancelled}=await watchOwnedChild(child);log.end();await finished(log);
  const reporter=fs.existsSync(json)?JSON.parse(fs.readFileSync(json,'utf8')):undefined;
  const blockedNetworkAttempts=fs.existsSync(env.SITE_DAILY_NETWORK_LOG)?fs.readFileSync(env.SITE_DAILY_NETWORK_LOG,'utf8').split('\n').filter(Boolean).length:0;
  const passed=code===0&&!error&&!timedOut&&!cancelled&&!blockedNetworkAttempts&&reporter?.success===true&&reporter.numTotalTests>0&&reporter.numPassedTests===reporter.numTotalTests&&reporter.numFailedTests===0&&reporter.numPendingTests===0&&reporter.numTodoTests===0;
  return {status:passed?'passed':'failed',exitCode:code,error,timedOut,cancelled,blockedNetworkAttempts,wallMs:Date.now()-start,actualTests:reporter?.numTotalTests??0,passedTests:reporter?.numPassedTests??0,scope:'selected-offline-unit-only',nativeUiExecuted:false,productionRequests:0,releaseEligible:false};
}
export async function runDaily(o){
  const changed=o.changed?readInput(o.changed):[...new Set((git(o.root,['diff','--name-only','-z',o.base,'--'])+'\0'+git(o.root,['ls-files','--others','--exclude-standard','-z','--','app','components','lib','scripts','tests'])).split('\0').filter(Boolean))];
  const plan=planDaily({day:o.day,history:readInput(o.history),signals:readInput(o.signals),changedFiles:changed});
  const ideas=shortlistIdeas(readInput(o.ideas)??[]);
  const out=path.join(o.root,'.scratch-pw','site-daily',o.day+'-'+Date.now()+'-'+randomUUID().slice(0,8));fs.mkdirSync(out,{recursive:true});
  const files=[...new Set([...plan.offlineUnitFiles,'scripts/site-daily/catalog.mjs','scripts/site-daily/policy.mjs','scripts/site-daily/runner.mjs','scripts/site-daily/offline-guard.mjs','scripts/site-daily/vitest.config.mjs','scripts/companion-qa/runner.mjs','package.json','package-lock.json','vitest.config.ts'])];
  const source=fingerprint(o.root,files),sourceDigest=sha(JSON.stringify(source));
  write(path.join(out,'source.json'),{scope:'explicit-subset-not-all-imports',sourceDigest,head:git(o.root,['rev-parse','HEAD']).trim(),files:source});write(path.join(out,'plan.json'),plan);write(path.join(out,'ideas.json'),ideas);
  const result=o.runOffline?await offline(o.root,plan,out):{status:'not-run',scope:'plan-only',releaseEligible:false};
  const sourceUnchanged=JSON.stringify(source)===JSON.stringify(fingerprint(o.root,files));
  const report={schemaVersion:1,day:o.day,output:out,sourceDigest,sourceUnchanged,offline:result,companionNative:'not-run-by-this-command-use-plan-command',liveDataCollected:false,aggregateInputProvided:!!o.signals,overallReleaseEligible:false};
  write(path.join(out,'report.json'),report);return report;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){runDaily(options(process.argv.slice(2))).then(r=>{process.stdout.write(JSON.stringify(r,null,2)+'\n');if(!r.sourceUnchanged||r.offline.status==='failed')process.exitCode=1;}).catch(()=>{process.stderr.write('Site daily triage failed; preserve local evidence. No input content logged.\n');process.exitCode=1;});}
