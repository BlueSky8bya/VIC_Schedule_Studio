#!/usr/bin/env node
/** Bounded selected native runs. The full200 certifier remains separate. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {snapshotEligible,childEnvironment,ownedTerminationCommand} from '../companion-qa/runner.mjs';
import {AUDITED_MACHINE_METADATA,validateAuditedMachineMetadata} from '../companion-qa/machine-metadata.mjs';
import {dayOrdinal} from './catalog.mjs';
import {caseId,nativeCaseFingerprint,productDependencies,flattenReporter,actualOutcome,continuationCases} from './selection.mjs';
import {sha,hashJson,writeNew,regular,manifest,verifyFiles,verifyRun} from './receipts.mjs';
export function options(argv){
  const o={root:process.cwd(),minutes:15,listOnly:false};
  const names={'--root':'root','--plan':'plan','--continue-from':'prior','--receipt-sha':'receiptSha','--reuse-build':'reuseBuild','--build-receipt-sha':'buildReceiptSha','--minutes':'minutes','--source-manifest':'sourceManifest'};
  for(let i=0;i<argv.length;i++)if(argv[i]==='--list-only')o.listOnly=true;else if(names[argv[i]]){const value=argv[++i];if(!value||value.startsWith('--'))throw Error('missing-option-value');o[names[argv[i-1]]]=value;}else throw Error('unknown-option');
  o.root=path.resolve(o.root);o.minutes=Number(o.minutes);
  if(!o.plan||!Number.isInteger(o.minutes)||o.minutes<2||o.minutes>30||o.prior&&!o.receiptSha||o.reuseBuild&&!o.buildReceiptSha||o.prior&&o.reuseBuild)throw Error('invalid-scoped-options');return o;
}
const buildExclude=p=>p==='cache'||p.startsWith('cache/');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function validateSourceManifest(rows){
  if(!Array.isArray(rows)||rows.length>10000||rows.some(file=>typeof file!=='string'||file.includes('\\')||!snapshotEligible(file))||new Set(rows).size!==rows.length)throw Error('invalid-explicit-source-manifest');
  return rows;
}
export function validatePlan(plan){
  dayOrdinal(plan.day);const cases=plan.companion?.selection?.cases;
  if(!Array.isArray(cases)||!cases.length||cases.length>60||new Set(cases.map(c=>c.id)).size!==cases.length||cases.some(c=>c.id!==caseId(c)||!/^tests\/visual\/[a-z0-9-]+\.spec\.ts$/.test(c.file)||!c.title||c.project!==''))throw Error('invalid-exact-selection');
  if(!Array.isArray(plan.companion.dailyScenarios)||plan.companion.dailyScenarios.length!==9)throw Error('explicit-nine-registration-scenarios-required');return cases;
}
export async function run(o){
  const started=Date.now(),deadline=started+o.minutes*60000,root=o.root;
  const plan=JSON.parse(fs.readFileSync(o.plan,'utf8')),selected=validatePlan(plan);
  const prior=o.prior?verifyRun(o.prior,o.receiptSha):undefined;
  const reusable=o.reuseBuild?verifyRun(o.reuseBuild,o.buildReceiptSha):prior;
  const out=path.join(root,'.scratch-pw/site-daily/native',plan.day+'-'+Date.now()+'-'+randomUUID().slice(0,8)),workspace=path.join(out,'workspace');
  fs.mkdirSync(workspace,{recursive:true});writeNew(path.join(out,'plan.json'),plan);
  const git=args=>execFileSync('git',['--no-optional-locks','-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
  const tracked=git(['ls-files','-z']).split('\0').filter(Boolean),dirty=git(['diff','--name-only','-z','HEAD']).split('\0').filter(Boolean);
  const machine=AUDITED_MACHINE_METADATA.map(e=>validateAuditedMachineMetadata(e.path,fs.readFileSync(regular(root,e.path)),{tracked:tracked.includes(e.path),headUnchanged:!dirty.includes(e.path)}));
  const extra=['selection.mjs','policy.mjs','runner.mjs','receipts.mjs','scoped-native.mjs','native-catalog.json'].map(p=>'scripts/site-daily/'+p).filter(p=>fs.existsSync(path.join(root,p)));
  let approved=[];
  if(o.sourceManifest){if(fs.lstatSync(o.sourceManifest).isSymbolicLink()||!fs.statSync(o.sourceManifest).isFile()||fs.statSync(o.sourceManifest).size>1024*1024)throw Error('bounded-regular-source-manifest-required');approved=validateSourceManifest(JSON.parse(fs.readFileSync(o.sourceManifest,'utf8')));}
  const files=[...new Set([...tracked.filter(snapshotEligible),...extra,...approved,...machine.map(x=>x.path)])].sort();
  const sourceFiles=[];
  for(const file of files){if(!fs.existsSync(path.join(root,file)))continue;const bytes=fs.readFileSync(regular(root,file)),target=path.join(workspace,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});sourceFiles.push({path:file,sha256:sha(bytes)});}
  const freeze={head:git(['rev-parse','HEAD']).trim(),contentDigest:hashJson(sourceFiles),sourceFiles,credentialsCopied:0,privateArtCopied:0,auditedMachineJson:machine.length};writeNew(path.join(out,'source-freeze.json'),freeze);
  fs.symlinkSync(path.join(root,'node_modules'),path.join(workspace,'node_modules'),'junction');
  // Installed dependencies may be the project's approved node_modules junction.
  const runtime={node:process.version,platform:process.platform,arch:process.arch,...Object.fromEntries(['next','@playwright/test','playwright-core'].map(name=>[name,JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'))).version]))};
  const browser=await import(pathToFileURL(path.join(root,'node_modules/playwright-core/index.mjs')).href);const executable=browser.chromium.executablePath();runtime.chromiumExecutableSha=sha(fs.readFileSync(executable));
  const productKey=hashJson({files:productDependencies(sourceFiles),runtime});
  const networkLog=path.join(out,'network-denied.jsonl'),guard={NODE_OPTIONS:`--import=${pathToFileURL(path.join(workspace,'scripts/companion-qa/network-guard.mjs')).href}`,COMPANION_QA_NETWORK_LOG:networkLog,GIT_CEILING_DIRECTORIES:out};
  const children=new Set(),closed=new WeakMap(),stages=[];let interrupted=false,cleanupOk=true,buildId=null,buildFiles=null,rows=[],continuation={run:selected,reuse:[],invalidated:[],fullRestart:false},failure=null;
  function own(child){children.add(child);closed.set(child,new Promise(resolve=>child.once('close',resolve)));return child;}
  async function stop(child){
    if(!child)return;
    if(child.pid&&child.exitCode===null&&child.signalCode===null){const spec=ownedTerminationCommand(child.pid);if(spec.file)await new Promise((resolve,reject)=>{const killer=spawn(spec.file,spec.args,{windowsHide:true,stdio:'ignore',shell:false});killer.once('error',reject);killer.once('close',code=>code===0||child.exitCode!==null||child.signalCode!==null?resolve():reject(Error('owned-cleanup-failed')));});else try{process.kill(spec.group,spec.signal);}catch(e){if(e.code!=='ESRCH')throw e;}}
    // Join close (including stdio), not only exit or the taskkill command.
    if(closed.has(child))await closed.get(child);
  }
  const cancel=()=>{interrupted=true;for(const child of children)void stop(child).catch(()=>{cleanupOk=false;});};process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
  async function command(name,args,extra={}){
    if(interrupted||Date.now()>=deadline)throw Error('focused-budget-exhausted');
    const log=fs.openSync(path.join(out,name+'.log'),'wx'),at=Date.now();
    const child=own(spawn(process.execPath,args,{cwd:workspace,env:childEnvironment(process.env,{...guard,...extra}),windowsHide:true,detached:process.platform!=='win32',shell:false,stdio:['ignore',log,log]}));
    // Let Playwright's own global timeout flush partial results/teardown first.
    const timer=setTimeout(()=>void stop(child).catch(()=>{cleanupOk=false;}),Math.max(1,deadline-Date.now()+(name==='native'?30000:0)));
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);}).finally(()=>{clearTimeout(timer);fs.closeSync(log);children.delete(child);});
    stages.push({name,code,wallMs:Date.now()-at});return code;
  }
  try{
    if(!o.listOnly){
      if(reusable&&reusable.result.productKey===productKey){
        for(const item of reusable.build.files){const from=regular(path.join(reusable.dir,'workspace/.next'),item.path),target=path.join(workspace,'.next',item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(from,target,fs.constants.COPYFILE_EXCL);if(sha(fs.readFileSync(target))!==item.sha256)throw Error('build-copy-mutated');}
        stages.push({name:'verified-product-build-reuse',code:0,wallMs:0});
      }
      else{if(await command('metadata',['scripts/generate-ambient-art-metadata.mjs'])!==0||await command('build',['node_modules/next/dist/bin/next','build'])!==0)throw Error('focused-build-failed');}
      verifyFiles(workspace,sourceFiles);buildId=fs.readFileSync(regular(path.join(workspace,'.next'),'BUILD_ID'),'utf8').trim();buildFiles=manifest(path.join(workspace,'.next'),{exclude:buildExclude});writeNew(path.join(out,'build.json'),{buildId,productKey,files:buildFiles});
    }
    const fingerprint=item=>nativeCaseFingerprint({sourceFiles,item,buildId,dailyScenarios:plan.companion.dailyScenarios,runtime});
    if(prior&&prior.result.buildId===buildId)continuation=continuationCases(selected,prior.proofs,fingerprint);
    const listener=net.createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;
    const native=path.join(out,'native');fs.mkdirSync(native);
    const env={COMPANION_QA_NODE_ORIGIN:origin,COMPANION156_SOURCE_FREEZE:path.join(out,'source-freeze.json'),COMPANION_QA_OUTPUT:native,COMPANION_QA_CASES:JSON.stringify(plan.companion.dailyScenarios),VISUAL_TEST_BUILD_DIR:path.join(workspace,'.next'),VIC_ACTIVITY_BASE_URL:origin.replace('127.0.0.1','127.0.0.2'),...Object.fromEntries(['COMPANION164_OUTPUT','COMPANION162_OUTPUT','COMPANION149_OUTPUT','COMPANION149_OBJECTS_OUTPUT','COMPANION147_OUTPUT','COMPANION146_HOME_OUTPUT','COMPANION146_OUTPUT','COMPANION143_OUTPUT','COMPANION141_AGENCY_OUTPUT','COMPANION141_OUTPUT','COMPANION137_OUTPUT','COMPANION134_GALLERY_OUTPUT','COMPANION_WINDOW_UI_OUTPUT','VIC_ACTIVITY_AUDIT_PREFIX'].map(k=>[k,path.join(native,k.toLowerCase())]))};
    if(continuation.run.length){
      const config=path.join(workspace,'scoped.generated.config.ts'),settings={testDir:'./tests/visual',testMatch:[...new Set(continuation.run.map(c=>path.basename(c.file)))],workers:3,retries:0,maxFailures:3,timeout:125000,globalTimeout:Math.max(1,deadline-Date.now()),fullyParallel:true,outputDir:path.join(out,'playwright'),reporter:[['json',{outputFile:path.join(out,'playwright.json')}]],use:{baseURL:origin,viewport:{width:1920,height:1100},deviceScaleFactor:1,serviceWorkers:'block',trace:'retain-on-failure',video:'on',screenshot:'only-on-failure'}};
      fs.writeFileSync(config,`import {defineConfig} from '@playwright/test';export default defineConfig(${JSON.stringify(settings)});`,{flag:'wx'});
      const args=['node_modules/@playwright/test/cli.js','test','--config',config,'--grep','(?:'+continuation.run.map(c=>escape(c.title)).join('|')+')$'];
      if(await command('registration',[...args,'--list'],env)!==0)throw Error('registration-failed');
      const registration=flattenReporter(JSON.parse(fs.readFileSync(path.join(out,'playwright.json'))));fs.renameSync(path.join(out,'playwright.json'),path.join(out,'registration.json'));
      if(registration.length!==continuation.run.length||registration.some(c=>!continuation.run.some(x=>x.id===c.id)))throw Error('selected-registration-drift');
      if(!o.listOnly){
        const log=fs.openSync(path.join(out,'server.log'),'wx'),server=own(spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{cwd:workspace,env:childEnvironment(process.env,{...guard,...env}),windowsHide:true,detached:process.platform!=='win32',shell:false,stdio:['ignore',log,log]}));fs.closeSync(log);server.on('error',()=>{failure='owned-server-error';});
        let ready=false;for(let i=0;i<100&&Date.now()<deadline&&!interrupted;i++){try{if((await fetch(origin+'/visual-fixture/poster',{signal:AbortSignal.timeout(2000),redirect:'error'})).ok){ready=true;break;}}catch{ /* Bounded owned-server startup; never a fallback origin. */ }await new Promise(resolve=>setTimeout(resolve,200));}if(!ready)throw Error('owned-fixture-not-ready');
        const code=await command('native',args,env);if(code!==0)failure='selected-native-failed-or-budget';
        if(fs.existsSync(path.join(out,'playwright.json')))rows=flattenReporter(JSON.parse(fs.readFileSync(path.join(out,'playwright.json'))));
        if(rows.some(c=>!continuation.run.some(x=>x.id===c.id)))throw Error('unexpected-native-case');
      }
    }
    continuation.fingerprint=fingerprint;
  }catch(error){failure=error.message;}
  finally{for(const child of children)try{await stop(child);}catch{cleanupOk=false;}process.off('SIGTERM',cancel);process.off('SIGINT',cancel);}
  let sourceUnchanged=false,buildUnchanged=false;try{verifyFiles(workspace,sourceFiles);sourceUnchanged=true;if(buildFiles){verifyFiles(path.join(workspace,'.next'),buildFiles);if(JSON.stringify(manifest(path.join(workspace,'.next'),{exclude:buildExclude}))!==JSON.stringify(buildFiles))throw Error('build-file-set-mutated');buildUnchanged=true;}}catch{failure='frozen-source-or-build-mutated';}
  const guardsClear=!fs.existsSync(networkLog)||fs.statSync(networkLog).size===0;
  const cases=selected.map(c=>{const reuse=continuation.reuse.find(x=>x.id===c.id),raw=rows.find(x=>x.id===c.id);return reuse?{id:c.id,fingerprint:reuse.fingerprint,outcome:'reused',proofRef:reuse.proofRef,proofSha:reuse.proofSha}:{id:c.id,fingerprint:o.listOnly?hashJson({registrationOnly:c.id}):continuation.fingerprint?.(c)??hashJson({id:c.id,failedBeforeFingerprint:true}),outcome:raw?actualOutcome(raw):'not-run'};});
  const evidence=manifest(out,{exclude:p=>p==='workspace'||p.startsWith('workspace/')});if(fs.existsSync(path.join(workspace,'scoped.generated.config.ts')))evidence.push({path:'workspace/scoped.generated.config.ts',sha256:sha(fs.readFileSync(path.join(workspace,'scoped.generated.config.ts')))});
  const result={schemaVersion:1,kind:'focused-native-result',day:plan.day,at:new Date().toISOString(),wallMs:Date.now()-started,fullCertification:false,normal36:'UNVERIFIED',runtime,productKey,buildId,integrity:{sourceUnchanged:sourceUnchanged&&buildUnchanged,guardsClear,ownedProcessesClosed:cleanupOk&&!interrupted},executedIds:continuation.run.map(c=>c.id),cases,stages,evidence,failure,listOnly:o.listOnly,notSelected:plan.companion.selection.notSelected??[],scopeSatisfied:!o.listOnly&&!failure&&sourceUnchanged&&buildUnchanged&&guardsClear&&cleanupOk&&!interrupted&&cases.every(c=>['passed','reused'].includes(c.outcome)),independentReview:'required-for-the-changed-scope-not-per-item-full-media'};
  const file=path.join(out,'result.json');writeNew(file,result);return {file,sha256:sha(fs.readFileSync(file)),scopeSatisfied:result.scopeSatisfied,listOnly:o.listOnly,selected:cases.length,actualPassed:cases.filter(c=>c.outcome==='passed').length,reused:cases.filter(c=>c.outcome==='reused').length,failure,wallMs:result.wallMs};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)run(options(process.argv.slice(2))).then(r=>{console.log(JSON.stringify(r));if(!r.scopeSatisfied&&!r.listOnly)process.exitCode=1;}).catch(()=>{console.error('Focused QA stopped; preserve evidence. No full-suite fallback.');process.exitCode=1;});
