import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { evaluateReviewContracts, finalizeDailyReview, registeredRecipes, parseReviewOptions, REVIEW_PERSPECTIVES, ITEMS_SCROLL_147_TITLES } from "../../scripts/companion-qa/review.mjs";
import { PERSONALITIES, NATIVE_ENTRY_TITLES, NATIVE_FLOATING_TIDY_TITLES, PLANNED_NATIVE_CASE_COUNT } from "../../scripts/companion-qa/catalog.mjs";
import { analyzeSofaScroll143, evaluateSofaRendered143, SOFA_SCROLL_143_TITLE, SOFA_SCROLL_156_SOURCES, SOFA_SCROLL_156_PAINTS } from "../../scripts/companion-qa/sofa-render-156.mjs";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const HASH = digest("fixture"), CATALOG="lib/ui/viewer-companion/personality-scene-catalog.ts";
const BINDING={runId:"20261020-local-fixture",sourceDigest:HASH,buildId:"local-build-fixture",dayKst:"2026-10-20"};
const sourceCode=`export const COMPANION_PERSONALITY_SCENES = Object.freeze([${PERSONALITIES.map((p,i)=>`{id:"D143-${i}",personality:"${p}",major:false,triggers:["free"],steps:[]}`).join(",")}]);`;
const pngRef={path:"native/screenshot.png",sha256:HASH};
const nativeTitles=[...NATIVE_ENTRY_TITLES,...NATIVE_FLOATING_TIDY_TITLES,...ITEMS_SCROLL_147_TITLES,SOFA_SCROLL_143_TITLE,...Array.from({length:PLANNED_NATIVE_CASE_COUNT-NATIVE_ENTRY_TITLES.length-NATIVE_FLOATING_TIDY_TITLES.length-ITEMS_SCROLL_147_TITLES.length-1},(_,i)=>`actual fixture ${i}`)];
type PaintRef={kind:string;path:string;sha256:string;pixelScale:number;sampleCount:number;pixelWidth?:number;pixelHeight?:number;embeddedPngs?:{name:string;sha256:string}[]};
type RenderAssessment={rawAttachment:{path:string;sha256:string};caseTitle:string;buildId:string;state:string;candidateCount:number;maxRelativeErrorCssPx:number;missing:number;reason:string;paintEvidence:PaintRef[]};
type SofaRenderAssessment=RenderAssessment&{maxFrontErrorCssPx:number;maxSizeErrorCssPx:number;bodyRelativeSpanCssPx:number};
type SofaPaint={kind:string;name?:string;path:string;sha256:string;attachmentBound:boolean;pixelWidth?:number;pixelHeight?:number};
function sofaFrameFixture(){
  const rows=[];
  for(let i=0;i<30;i++){
    const scroll=i<15?i*2:(29-i)*2;
    for(const [phase,offset] of [["frame",0],["post-render",1],...(i?[["scroll",2]]:[])] as [string,number][]){
      rows.push({phase,sequence:rows.length,at:1000+i*20+offset,homeScroll:scroll,viewport:[1920,420],
        room:{x:0,y:0,width:400,height:420},home:{x:0,y:0,width:400,height:394},bed:{x:20,y:300-scroll,width:160,height:70},
        cushion:{x:50,y:300-scroll,width:100,height:20},pet:{x:70,y:258-scroll,width:60,height:60},front:{x:20,y:300-scroll,width:160,height:70},
        petHidden:false,frontHidden:false,petPainted:true,frontPainted:true,decoded:true,petZ:75,frontZ:76,nativeActor:true,nativeFront:true,
        localFrontVisibility:"hidden",depth:"seat",platform:"companion-home",state:"idle"});
    }
  }
  return rows;
}
function sofaEvidenceFixture(){
  const frames=sofaFrameFixture(),sourceFiles=SOFA_SCROLL_156_SOURCES.map((path:string)=>({path,sha256:HASH}));
  const raw={schemaVersion:1,kind:"companion-sofa-scroll-156",caseTitle:SOFA_SCROLL_143_TITLE,build:BINDING.buildId,buildId:BINDING.buildId,
    sourceDigest:BINDING.sourceDigest,sourceFiles,status:"passed",admissionStatus:"passed",errors:[],rejected:[],renderThresholdCssPx:1,
    videoSize:{width:1920,height:850},deviceScaleFactor:1,chunks:[{served:HASH,local:HASH}],frames,probeStopped:true,probeOverflow:false,totalCapturedFrames:frames.length,
    observationWindow:{began:1000,ended:1600},dimensions:{client:394,full:447,overflow:"auto"},
    paintSamples:SOFA_SCROLL_156_PAINTS.map((name:string,index:number)=>({name,sha256:HASH,beforeAt:1000+index*250,afterAt:1001+index*250,pixelWidth:1920,pixelHeight:420})),
    renderCandidates:[] as unknown[],measurement:{} as ReturnType<typeof analyzeSofaScroll143>["summary"],renderedStatus:"no_candidate_observed"};
  const measured=analyzeSofaScroll143(raw);raw.renderCandidates=measured.candidates;raw.measurement=measured.summary;
  const paintAttachments:SofaPaint[]=[{kind:"trace",path:"native/sofa143-trace.zip",sha256:HASH,attachmentBound:true},{kind:"video",path:"native/sofa143-video.webm",sha256:HASH,attachmentBound:true},
    ...SOFA_SCROLL_156_PAINTS.map((name:string,index:number)=>({kind:"png",name,path:"native/sofa143-"+index+".png",sha256:HASH,attachmentBound:true,pixelWidth:1920,pixelHeight:420}))];
  return {path:"native/sofa143.json",sha256:HASH,caseTitle:SOFA_SCROLL_143_TITLE,attachmentBound:true,paintAttachments,document:raw};
}
function make() {
  const items=PERSONALITIES.map((personality,i)=>({id:`idea-${i}`,personality,hypothesis:"A bounded new journey with a physical effect",decision:"rejected",reason:"Actual implementation not adopted in this fixture",registeredRecipeId:`D143-${i}`,implementation:{path:CATALOG,sha256:HASH},pureModelEvidence:[{kind:"pure-model",path:"pure/vitest.json",sha256:HASH,testFullName:`D143-${i} model`}],actualCaseEvidence:[{kind:"native",path:`native/goal-${i}.json`,sha256:HASH,caseTitle:nativeTitles[i]}]}));
  const stages=["isolated-snapshot","pure-models","pure-count-proof","metadata","build","typecheck","lint","native-production-fixture","native-personality-entry-proof","owned-process-cleanup","original-tree-preserved"].map(name=>({name,status:"passed",exitCode:0}));
  const report={schemaVersion:1,...BINDING,createdAtKst:"2026-10-20 12:00:00 KST",status:"completed-scoped-checks",stages,universe:{plannedNativeCaseCount:PLANNED_NATIVE_CASE_COUNT,plannedNativeEntryCases:27,plannedNativeFloatingTidyCases:2},nativeEntries:{gatePassed:true,selectedPassedCases:PLANNED_NATIVE_CASE_COUNT},dailyCases:{required:9,observed:9,passed:9}};
  const proof={build:BINDING.buildId,errors:[],rejected:[],mutations:[],liveReads:[],chunks:[{served:HASH,local:HASH}]};
  const daily=PERSONALITIES.map(personality=>({status:"passed",scenario:{id:`daily-${personality}`,personality,seconds:90},sufficiency:{passed:true},frames:Array.from({length:451},(_,i)=>({at:i*200,visible:true,decoded:true,activity:{source:false,manual:false,epoch:0,jumpAllowed:true,width:60,height:60,anchor:{x:0,y:0,width:1200,height:900},action:"",context:""},lifePurpose:"ordinary",humanEpoch:0,layoutEpoch:0,walkSource:false,personality,hunger:.2,energy:.8,outsideVisible:true,jumpSource:false,play:"",playPaint:"other",command:""})),proof:structuredClone(proof)}));
  const reporter={errors:[],suites:[{specs:nativeTitles.map(title=>({title,tests:[{expectedStatus:"passed",status:"expected",results:[{status:"passed",retry:0}]}]}))}]};
  const authors=["/root-builder","/behavior-builder","/art-builder"];
  const ideas={schemaVersion:1,kind:"companion-daily-ideas",...BINDING,authors,items};
  const reviews=REVIEW_PERSPECTIVES.map((perspective,i)=>({document:{schemaVersion:1,kind:"companion-independent-review",...BINDING,agentId:`/grader-${i}`,perspective,fresh:true,readOnly:true,decision:"accept",assessments:items.map(x=>({ideaId:x.id,decision:"reject",reason:"Reject the unimplemented candidate"})),renderedAssessments:[] as RenderAssessment[],sofaRenderedAssessments:[] as SofaRenderAssessment[],findings:[] as {severity:string;status:string;reason:string;evidence:typeof pngRef[]}[],evidence:[pngRef]},invocation:{schemaVersion:1,kind:"companion-parent-grader-receipt",...BINDING,agentId:`/grader-${i}`,parentAgentId:authors[0],perspective,fresh:true,readOnly:true,dispatchReceiptSha256:HASH,completionReceiptSha256:HASH}}));
  const source={contentDigest:HASH,recomputedDigest:HASH,buildId:BINDING.buildId,snapshotMatches:true,privateSourceArtCopied:false,sourceIllustrationsCopied:0,sourceContractsCopied:0,sourceFiles:SOFA_SCROLL_156_SOURCES.map((path:string)=>({path,sha256:HASH}))};
  const registrations=registeredRecipes(sourceCode), pureReport={success:true,numTotalTests:9,numFailedTests:0,numPendingTests:0,testResults:[{assertionResults:items.map((_,i)=>({status:"passed",fullName:`D143-${i} model`}))}]};
  const modelCoverage={recipeCount:registrations.length,entries:9,routineTemplates:54,booleanPatterns:262144};
  const nativeEvidence=items.map((item,i)=>({path:`native/goal-${i}.json`,sha256:HASH,caseTitle:nativeTitles[i],attachmentBound:true,document:{status:"passed",errors:[],rejected:[],notes:[{reachedFinalBeatAndSubsequentSequence:[{id:item.registeredRecipeId,major:false}]}],frames:[{at:10,scene:item.registeredRecipeId,visible:true,decoded:true},{at:1000,scene:item.registeredRecipeId,visible:true,decoded:true}]}}));
  const renderedNativeEvidence=ITEMS_SCROLL_147_TITLES.map((caseTitle,i)=>({path:`native/items147-${i}.json`,sha256:HASH,caseTitle,attachmentBound:true,paintAttachments:[{kind:"trace",path:`native/items147-${i}-trace.zip`,sha256:HASH,attachmentBound:true},{kind:"video",path:`native/items147-${i}-video.webm`,sha256:HASH,attachmentBound:true}],document:{schemaVersion:1,kind:"companion-items-scroll-147",caseTitle,build:BINDING.buildId,buildId:BINDING.buildId,status:"passed",admissionStatus:"passed",errors:[],unexpected:[],renderThresholdCssPx:2,renderedStatus:"no_candidate_observed",renderCandidates:[] as {phase:string;at:number;type:string;id:string;shown:boolean;dx:number;dy:number}[],frames:i===0?[]:["scroll","frame","post-render"].map((phase,at)=>({phase,at,items:["food","toy"].map(type=>({type,id:type,eligible:true,shown:true,dx:0,dy:0}))}))}}));
  const sofaRenderedNativeEvidence=sofaEvidenceFixture();
  for(const review of reviews)review.document.sofaRenderedAssessments=[{rawAttachment:{path:sofaRenderedNativeEvidence.path,sha256:HASH},caseTitle:SOFA_SCROLL_143_TITLE,buildId:BINDING.buildId,
    state:"no_failure_observed",candidateCount:0,maxRelativeErrorCssPx:0,maxFrontErrorCssPx:0,maxSizeErrorCssPx:0,bodyRelativeSpanCssPx:0,missing:0,
    reason:"Synthetic unit contract only. In a real run all three reviewers must inspect actual original1x PNGs embedded in this same case trace plus its1x video; DOM phases do not certify paint.",
    paintEvidence:sofaRenderedNativeEvidence.paintAttachments.map(p=>({kind:p.kind,path:p.path,sha256:p.sha256,pixelScale:1,sampleCount:p.kind==="png"?1:3,
      ...(p.kind==="trace"?{embeddedPngs:sofaRenderedNativeEvidence.document.paintSamples.map(sample=>({name:sample.name,sha256:sample.sha256}))}:{}),
      ...(p.kind==="video"?{pixelWidth:1920,pixelHeight:850}:{})}))}];
  return {report,source,ideas,reviews,daily,reporter,registrations,pureReport,modelCoverage,nativeEvidence,renderedNativeEvidence,sofaRenderedNativeEvidence,authors};
}
function renderedCandidate(input=make(),index=1,phase="post-render") {
  const e=input.renderedNativeEvidence[index],frame=e.document.frames.find(f=>f.phase===phase)!;frame.items[0].dy=18.25;
  e.document.renderedStatus="needs_render_review";e.document.renderCandidates=[{phase,at:frame.at,type:"food",id:"food",shown:true,dx:0,dy:18.25}];
  for(const r of input.reviews)r.document.renderedAssessments.push({rawAttachment:{path:e.path,sha256:e.sha256},caseTitle:e.caseTitle,buildId:BINDING.buildId,state:"prepaint_observation",candidateCount:1,maxRelativeErrorCssPx:1,missing:0,reason:"Original 1:1 native trace and video show both objects move with their floor in the same painted frame",paintEvidence:e.paintAttachments.map(p=>({kind:p.kind,path:p.path,sha256:p.sha256,pixelScale:1,sampleCount:3}))});
  return input;
}
function adopt(input:ReturnType<typeof make>,n=0) { input.ideas.items[n].decision="adopted";input.ideas.items[n].reason="Model plus actual case inspected";for(const r of input.reviews)r.document.assessments[n].decision="accept";return input; }
const temporary:string[]=[];
afterEach(()=>{ for(const root of temporary.splice(0)){expect(path.dirname(root)).toBe(os.tmpdir());expect(path.basename(root)).toMatch(/^companion-review-unit-/);fs.rmSync(root,{recursive:true,force:true});} });
function fixture(input=make()) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"companion-review-unit-"));temporary.push(root);const run=path.join(root,"run"),reviewRoot=path.join(root,"reviews");
  const put=(name:string,value:unknown)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==="string"||Buffer.isBuffer(value)?value:JSON.stringify(value));return file;};
  const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));
  const ref=(base:string,name:string)=>({path:name,sha256:digest(fs.readFileSync(path.join(root,base,name)))});
  put(`run/workspace/${CATALOG}`,sourceCode);put("run/workspace/lib/fixture.ts","export const safe = true;");put("run/workspace/.next/BUILD_ID",BINDING.buildId);
  const sofaSources=SOFA_SCROLL_156_SOURCES.map((name:string)=>{const code="fixture-only-code:"+name;put("run/workspace/"+name,code);return {path:name,sha256:digest(code)};});
  const sourceFiles=[{path:CATALOG,sha256:digest(sourceCode)},{path:"lib/fixture.ts",sha256:digest("export const safe = true;")},...sofaSources,{path:"art-src/private-contract.json",sha256:HASH}];
  const sourceDigest=digest(JSON.stringify(sourceFiles));input.report.sourceDigest=sourceDigest;input.ideas.sourceDigest=sourceDigest;for(const r of input.reviews){r.document.sourceDigest=sourceDigest;r.invocation.sourceDigest=sourceDigest;}
  input.ideas.items.forEach(x=>{x.implementation.sha256=digest(sourceCode);});
  input.sofaRenderedNativeEvidence.document.sourceDigest=sourceDigest;input.sofaRenderedNativeEvidence.document.sourceFiles=sofaSources;
  for(let i=0;i<input.nativeEvidence.length;i++){const spec=input.reporter.suites[0].specs[i];Object.assign(spec.tests[0].results[0],{attachments:[{contentType:"application/json",path:path.join(run,"attempt-01",input.nativeEvidence[i].path)}]});}
  for(const e of input.renderedNativeEvidence){const spec=input.reporter.suites[0].specs.find(s=>s.title===e.caseTitle)!;Object.assign(spec.tests[0].results[0],{attachments:[{name:"actual-items-scroll-147",contentType:"application/json",path:path.join(run,"attempt-01",e.path)},...e.paintAttachments.map(p=>({name:p.kind,contentType:p.kind==="trace"?"application/zip":"video/webm",path:path.join(run,"attempt-01",p.path)}))]});}
  const sofa=input.sofaRenderedNativeEvidence,sofaSpec=input.reporter.suites[0].specs.find(spec=>spec.title===SOFA_SCROLL_143_TITLE)!;
  Object.assign(sofaSpec.tests[0].results[0],{attachments:[{name:"actual-sofa-scroll-156",contentType:"application/json",path:path.join(run,"attempt-01",sofa.path)},
    ...sofa.paintAttachments.map(p=>({name:p.name??p.kind,contentType:p.kind==="png"?"image/png":p.kind==="trace"?"application/zip":"video/webm",path:path.join(run,"attempt-01",p.path)}))]});
  put("run/attempt-01/playwright.json",input.reporter);for(const row of input.daily)put(`run/attempt-01/native/daily/${row.scenario.id}.json`,row);
  put("run/attempt-01/native/screenshot.png","fixture-only-png-bytes");put("run/attempt-01/pure/vitest.json",input.pureReport);put("run/attempt-01/pure/model-coverage.json",input.modelCoverage);
  for(const e of input.nativeEvidence)put("run/attempt-01/"+e.path,e.document);
  for(const e of input.renderedNativeEvidence){put("run/attempt-01/"+e.path,e.document);for(const p of e.paintAttachments)put("run/attempt-01/"+p.path,`fixture-only-${p.kind}-${e.caseTitle}`);}
  for(const paint of sofa.paintAttachments){
    if(paint.kind==="png"){
      const bytes=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(1920,16);bytes.writeUInt32BE(420,20);
      put("run/attempt-01/"+paint.path,bytes);paint.sha256=digest(bytes);sofa.document.paintSamples.find(sample=>sample.name===paint.name)!.sha256=paint.sha256;
    }else put("run/attempt-01/"+paint.path,"fixture-only-"+paint.kind+"-sofa143");
  }
  put("run/attempt-01/"+sofa.path,sofa.document);
  const evidencePaths=[sofa.path,...sofa.paintAttachments.map(p=>p.path),"playwright.json","native/screenshot.png","pure/vitest.json","pure/model-coverage.json",...input.daily.map(r=>`native/daily/${r.scenario.id}.json`),...input.nativeEvidence.map(e=>e.path),...input.renderedNativeEvidence.flatMap(e=>[e.path,...e.paintAttachments.map(p=>p.path)])];
  const evidenceFiles=evidencePaths.map(p=>({...ref("run/attempt-01",p),bytes:fs.statSync(path.join(run,"attempt-01",p)).size}));
  const nativeRef=(p:string)=>{const f=evidenceFiles.find(f=>f.path===p);if(!f)throw Error("fixture-ref");return {path:f.path,sha256:f.sha256};};
  input.ideas.items.forEach(x=>{x.actualCaseEvidence=x.actualCaseEvidence.map(r=>({...r,...nativeRef(r.path)}));x.pureModelEvidence=x.pureModelEvidence.map(r=>({...r,...nativeRef(r.path)}));});
  const reviewIndex=[];
  for(let i=0;i<input.reviews.length;i++){
    const r=input.reviews[i];r.document.evidence=[nativeRef("native/screenshot.png")];
    for(const a of [...r.document.renderedAssessments,...r.document.sofaRenderedAssessments]){
      a.rawAttachment={...a.rawAttachment,...nativeRef(a.rawAttachment.path)};
      a.paintEvidence=a.paintEvidence.map(p=>({...p,...nativeRef(p.path),...(p.embeddedPngs?{embeddedPngs:sofa.document.paintSamples.map(sample=>({name:sample.name,sha256:sample.sha256}))}:{})}));
    }
    put(`reviews/dispatch-${i}.json`,{kind:"actual-parent-tool-receipt-fixture",agentId:r.document.agentId});put(`reviews/completion-${i}.json`,{kind:"actual-parent-completion-fixture",agentId:r.document.agentId});
    const dispatchReceipt=ref("reviews",`dispatch-${i}.json`),completionReceipt=ref("reviews",`completion-${i}.json`);
    const call={...r.invocation,dispatchReceipt,completionReceipt,dispatchReceiptSha256:dispatchReceipt.sha256,completionReceiptSha256:completionReceipt.sha256};
    put(`reviews/review-${i}.json`,r.document);put(`reviews/invocation-${i}.json`,call);
    reviewIndex.push({review:ref("reviews",`review-${i}.json`),invocation:ref("reviews",`invocation-${i}.json`)});
  }
  put("reviews/index.json",{schemaVersion:1,kind:"companion-review-index",authors:input.authors,reviews:reviewIndex});put("ideas.json",input.ideas);
  put("run/report.json",input.report);put("run/source-freeze.json",{sourceFiles,contentDigest:sourceDigest,privateSourceArtCopied:false,sourceIllustrationsCopied:0,sourceContractsCopied:0});put("run/universe.json",input.report.universe);
  put("run/evidence-manifest.json",{files:evidenceFiles,report:["report.json","source-freeze.json","universe.json"].map(p=>ref("run",p))});
  return {root,run,reviews:path.join(reviewRoot,"index.json"),ideas:path.join(root,"ideas.json"),output:path.join(root,"final.json"),put,read,ref};
}

describe("143 bounded independent daily review contracts",()=>{
  it("accepts nine explicit rejections after all factory gates and three separate reviewers",()=>{expect(evaluateReviewContracts(make())).toEqual({passed:true,issues:[]});});
  it("accepts an adopted literal registration only with model/native completion and all three assessments",()=>{expect(evaluateReviewContracts(adopt(make()))).toEqual({passed:true,issues:[]});});
  const negatives:[string,(x:ReturnType<typeof make>)=>void,string][]=[
    ["unfinished factory",x=>{x.report.status="running";},"factory-not-closed"],
    ["wrong build",x=>{x.source.buildId="older-build";},"source-build-mismatch"],
    ["changed snapshot",x=>{x.source.snapshotMatches=false;},"source-build-mismatch"],
    ["missing cleanup",x=>{x.report.stages=x.report.stages.filter(s=>s.name!=="owned-process-cleanup");},"factory-stage-owned-process-cleanup"],
    ["failed preservation",x=>{x.report.stages.find(s=>s.name==="original-tree-preserved")!.status="failed";},"factory-stage-original-tree-preserved"],
    ["95-only native scope",x=>{x.reporter.suites[0].specs.pop();x.reporter.suites[0].specs.pop();},"native-exact-counts"],
    ["retry",x=>{x.reporter.suites[0].specs[0].tests[0].results.push({status:"passed",retry:1});},"native-exact-counts"],
    ["skipped actual case",x=>{x.reporter.suites[0].specs[0].tests[0].results[0].status="skipped";},"native-exact-counts"],
    ["duplicate title",x=>{x.reporter.suites[0].specs[1].title=x.reporter.suites[0].specs[0].title;},"native-exact-counts"],
    ["daily short",x=>{x.daily[0].scenario.seconds=89;},"daily-nine-insufficient"],
    ["daily insufficient",x=>{x.daily[0].sufficiency.passed=false;},"daily-nine-insufficient"],
    ["daily absent",x=>{x.daily.pop();},"daily-nine-insufficient"],
    ["raw daily empty despite a claimed pass",x=>{x.daily[0].frames=[];},"daily-raw-insufficient"],
    ["raw daily hidden",x=>{x.daily[0].frames.forEach(f=>{f.visible=false;});},"daily-raw-insufficient"],
    ["raw daily short",x=>{x.daily[0].frames=x.daily[0].frames.slice(0,150);},"daily-raw-insufficient"],
    ["raw daily absent observation context",x=>{x.daily[0].frames.forEach(f=>{f.lifePurpose="";});},"daily-raw-insufficient"],
    ...["personality","hunger","energy","outsideVisible","jumpSource","play","playPaint","command"].map(key=>[`raw daily missing143 ${key}`,(x:ReturnType<typeof make>)=>{x.daily[0].frames.forEach(f=>Reflect.deleteProperty(f,key));},"daily-raw-insufficient"] as [string,(x:ReturnType<typeof make>)=>void,string]),
    ["raw daily invalid painted-play source enum",x=>{x.daily[0].frames.forEach(f=>{f.playPaint="label-only";});},"daily-raw-insufficient"],
    ["raw daily personality differs from its case",x=>{x.daily[0].frames.forEach(f=>{f.personality="tidy";});},"daily-raw-insufficient"],
    ["actual code mismatch",x=>{x.daily[0].proof.chunks[0].local=digest("other");},"daily-source-or-boundary"],
    ["two reviewers",x=>{x.reviews.pop();},"three-unique-reviewers"],
    ["same reviewer",x=>{x.reviews[1].document.agentId=x.reviews[0].document.agentId;},"three-unique-reviewers"],
    ["same perspective",x=>{x.reviews[1].document.perspective=x.reviews[0].document.perspective;},"three-unique-reviewers"],
    ["author reviewing self",x=>{x.reviews[0].document.agentId=x.authors[0];},"review-not-independent-accepted"],
    ["review source changed",x=>{x.reviews[0].document.sourceDigest=digest("later");},"review-not-independent-accepted"],
    ["review not fresh",x=>{x.reviews[0].document.fresh=false;},"review-not-independent-accepted"],
    ["review not read only",x=>{x.reviews[0].document.readOnly=false;},"review-not-independent-accepted"],
    ["parent receipt missing",x=>{x.reviews[0].invocation.dispatchReceiptSha256="";},"review-parent-receipt"],
    ["parent not author",x=>{x.reviews[0].invocation.parentAgentId="/unknown";},"review-parent-receipt"],
    ["unresolved P2",x=>{x.reviews[0].document.findings.push({severity:"P2",status:"open",reason:"Unsafe ownership",evidence:[]});},"review-unresolved-findings"],
    ["resolved finding no evidence",x=>{x.reviews[0].document.findings.push({severity:"P1",status:"resolved",reason:"Claim only",evidence:[]});},"review-unresolved-findings"],
    ["missing ninth assessment",x=>{x.reviews[0].document.assessments.pop();},"review-all-nine"],
    ["missing personality",x=>{x.ideas.items.pop();},"ideas-nine-binding"],
    ["duplicate personality",x=>{x.ideas.items[0].personality=x.ideas.items[1].personality;},"ideas-nine-binding"],
    ["wrong KST day",x=>{x.ideas.dayKst="2026-10-19";},"ideas-nine-binding"],
    ["authors changed",x=>{x.ideas.authors=["/different-builder"];},"idea-author-or-ids"],
    ["unregistered recipe",x=>{adopt(x).ideas.items[0].registeredRecipeId="not-real";},"idea-unregistered-implementation"],
    ["native omitted",x=>{adopt(x).ideas.items[0].actualCaseEvidence=[];},"idea-missing-native-evidence"],
    ["pure only presented as native",x=>{adopt(x).ideas.items[0].actualCaseEvidence[0].kind="pure-model";},"idea-native-completion-unproved"],
    ["whole completion not observed",x=>{adopt(x).nativeEvidence[0].document.notes=[];},"idea-native-completion-unproved"],
    ["unrelated passing case attachment",x=>{adopt(x).nativeEvidence[0].attachmentBound=false;},"idea-native-completion-unproved"],
    ["decoded paint missing",x=>{adopt(x).nativeEvidence[0].document.frames.forEach(f=>{f.decoded=false;});},"idea-native-completion-unproved"],
    ["case did not actually pass",x=>{adopt(x).ideas.items[0].actualCaseEvidence[0].caseTitle="not-run-case";},"idea-native-completion-unproved"],
    ["one grader rejects adopted idea",x=>{adopt(x).reviews[0].document.assessments[0].decision="reject";},"idea-not-three-accepted"],
    ["unknown pure test",x=>{adopt(x).ideas.items[0].pureModelEvidence[0].testFullName="D143-0 not-run-model";},"idea-pure-model-unproved"],
    ["wrong modeled catalog size",x=>{x.modelCoverage.recipeCount=144;},"pure-coverage-mismatch"],
  ];
  it.each(negatives)("fails closed: %s",(_,mutate,code)=>{const input=make();mutate(input);expect(evaluateReviewContracts(input).issues).toContain(code);});
  it("does not offset a safety failure with positive idea assessments",()=>{const x=adopt(make());x.reviews[0].document.findings=[{severity:"P0",status:"open",reason:"Privacy violation",evidence:[pngRef]}];expect(evaluateReviewContracts(x).passed).toBe(false);});
  it("retains an evidenced resolved finding and nonblocking P3",()=>{const x=make();x.reviews[0].document.findings=[{severity:"P1",status:"resolved",reason:"Fixed and checked",evidence:[pngRef]},{severity:"P3",status:"open",reason:"Future refinement",evidence:[]}];expect(evaluateReviewContracts(x).passed).toBe(true);});
});

describe("143 immutable local file finalization",()=>{
  it("verifies actual bytes/source/build/receipts, writes wx outside the run and never claims an automatic release",()=>{const f=fixture();const result=finalizeDailyReview(f);expect(result.issues).toEqual([]);expect(result.eligibleForAuthorizedRelease).toBe(true);expect(result.scope).toMatchObject({nativeExhaustive:false,scheduledExecutionProved:false,automaticRelease:false,reviewerIdentity:"parent-attested-not-authenticated"});expect(fs.existsSync(f.output)).toBe(true);const prior=fs.readFileSync(f.output);expect(finalizeDailyReview(f).eligibleForAuthorizedRelease).toBe(false);expect(fs.readFileSync(f.output)).toEqual(prior);});
  it("links an adopted real registered ID to both exact frozen model and actual-case files",()=>{const f=fixture(adopt(make()));expect(finalizeDailyReview(f).eligibleForAuthorizedRelease).toBe(true);});
  it("rejects a native raw file not attached to its claimed passing case",()=>{const f=fixture(adopt(make()));const reporter=f.read("run/attempt-01/playwright.json");reporter.suites[0].specs[0].tests[0].results[0].attachments=[];f.put("run/attempt-01/playwright.json",reporter);const manifest=f.read("run/evidence-manifest.json");manifest.files=manifest.files.map((r:{path:string})=>r.path==="playwright.json"?{...f.ref("run/attempt-01",r.path),bytes:fs.statSync(path.join(f.run,"attempt-01",r.path)).size}:r);f.put("run/evidence-manifest.json",manifest);expect(finalizeDailyReview(f).issues).toContain("idea-native-completion-unproved");});
  it("rejects post-freeze source modification",()=>{const f=fixture();f.put("run/workspace/lib/fixture.ts","changed");expect(finalizeDailyReview(f).issues).toEqual(["snapshot-source-changed"]);});
  it("rejects mismatched actual BUILD_ID",()=>{const f=fixture();f.put("run/workspace/.next/BUILD_ID","another-build");expect(finalizeDailyReview(f).issues).toContain("source-build-mismatch");});
  it("rejects amended evidence bytes without manifest replacement",()=>{const f=fixture();f.put("run/attempt-01/native/screenshot.png","other");expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);});
  it("rejects altered review bytes with the same review index",()=>{const f=fixture();const r=f.read("reviews/review-0.json");r.decision="reject";f.put("reviews/review-0.json",r);expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);});
  it("rejects a claimed parent receipt with changed body",()=>{const f=fixture();f.put("reviews/dispatch-0.json","changed");expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);});
  it("rejects review path traversal",()=>{const f=fixture();const index=f.read("reviews/index.json");index.reviews[0].review.path="../ideas.json";f.put("reviews/index.json",index);expect(finalizeDailyReview(f).issues).toEqual(["unsafe-relative-path"]);});
  it("rejects NTFS alternate-stream path syntax",()=>{const f=fixture();const index=f.read("reviews/index.json");index.reviews[0].review.path="review-0.json:stream";f.put("reviews/index.json",index);expect(finalizeDailyReview(f).issues).toEqual(["unsafe-relative-path"]);});
  it("does not read environment credentials even through an explicit input argument",()=>{const f=fixture();const secret=f.put(".env","SYNTHETIC-SECRET-CANARY");const r=finalizeDailyReview({...f,ideas:secret});expect(r.issues).toEqual(["sensitive-path-excluded"]);expect(JSON.stringify(r)).not.toContain("SYNTHETIC-SECRET-CANARY");});
  it("rejects a linked review directory",()=>{const f=fixture();const linked=path.join(f.root,"linked-reviews");fs.symlinkSync(path.dirname(f.reviews),linked,"junction");expect(finalizeDailyReview({...f,reviews:path.join(linked,"index.json")}).issues).toEqual(["linked-path"]);});
  it("never writes new output inside the frozen run",()=>{const f=fixture();expect(finalizeDailyReview({...f,output:path.join(f.run,"new.json")}).issues).toEqual(["output-inside-frozen-run"]);expect(fs.existsSync(path.join(f.run,"new.json"))).toBe(false);});
  it("does not follow private source art or JSON references",()=>{const f=fixture();expect(fs.existsSync(path.join(f.run,"workspace/art-src/private-contract.json"))).toBe(false);expect(finalizeDailyReview(f).eligibleForAuthorizedRelease).toBe(true);});
  it("requires the catalog itself in the frozen source list",()=>{const f=fixture();const freeze=f.read("run/source-freeze.json");freeze.sourceFiles=freeze.sourceFiles.filter((r:{path:string})=>r.path!==CATALOG);f.put("run/source-freeze.json",freeze);const manifest=f.read("run/evidence-manifest.json");manifest.report=manifest.report.map((r:{path:string})=>r.path==="source-freeze.json"?f.ref("run",r.path):r);f.put("run/evidence-manifest.json",manifest);expect(finalizeDailyReview(f).issues).toEqual(["catalog-not-frozen"]);});
  it("holds unreadable JSON without leaking raw text or local paths",()=>{const f=fixture();f.put("ideas.json","PRIVATE-SYNTHETIC-CANARY");const r=finalizeDailyReview(f);expect(r.eligibleForAuthorizedRelease).toBe(false);expect(JSON.stringify(r)).not.toContain("PRIVATE-SYNTHETIC-CANARY");expect(JSON.stringify(r)).not.toContain(f.root);});
  it("rejects missing argument/unknown flag/duplicate run and keeps exact three required inputs",()=>{expect(()=>parseReviewOptions(["--run","x"])).toThrow();expect(()=>parseReviewOptions(["--run","a","--run","b","--reviews","x","--ideas","y"])).toThrow();expect(()=>parseReviewOptions(["--run","a","--reviews","x","--ideas","y","--deploy"])).toThrow();expect(parseReviewOptions(["--run","a","--reviews","x","--ideas","y"]).run).toBe(path.resolve("a"));});
});

describe("157 diagnostic runs cannot authorize release",()=>{
  it.each(["diagnosticScope","nativeGrep"])("rejects %s even with every native count and independent review passing",key=>{
    const input=make();
    expect(evaluateReviewContracts(input)).toEqual({passed:true,issues:[]});
    Object.assign(input.report,{[key]:key==="nativeGrep"?".*":{nativeGrep:".*",eligibleForRelease:false}});
    expect(evaluateReviewContracts(input).issues).toContain("diagnostic-not-release");
  });
});

describe("157 original native media has a separate bounded streaming budget",()=>{
  function resize(f:ReturnType<typeof fixture>,name:string,bytes:number,zipHeader=true){
    const file=path.join(f.run,"attempt-01",name);fs.truncateSync(file,bytes);
    if(zipHeader&&name.endsWith(".zip")){const fd=fs.openSync(file,"r+");try{fs.writeSync(fd,Buffer.from([80,75,3,4]),0,4,0);}finally{fs.closeSync(fd);}}
    const hash=createHash("sha256"),fd=fs.openSync(file,"r"),buffer=Buffer.alloc(1024*1024);
    try{let length;while((length=fs.readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,length));}finally{fs.closeSync(fd);}
    const sha256=hash.digest("hex"),manifest=f.read("run/evidence-manifest.json");
    Object.assign(manifest.files.find((ref:{path:string})=>ref.path===name),{sha256,bytes});f.put("run/evidence-manifest.json",manifest);
    const patch=(value:unknown):void=>{if(!value||typeof value!=="object")return;const item=value as Record<string,unknown>;if(item.path===name)item.sha256=sha256;Object.values(item).forEach(patch);};
    const index=f.read("reviews/index.json");
    for(let i=0;i<3;i++){const doc=f.read(`reviews/review-${i}.json`);patch(doc);f.put(`reviews/review-${i}.json`,doc);index.reviews[i].review=f.ref("reviews",`review-${i}.json`);}
    f.put("reviews/index.json",index);return {name,sha256,bytes};
  }
  it("accepts an original65MiB trace only when exact passing case, MIME and frozen hash bind it",()=>{
    const f=fixture();resize(f,"native/sofa143-trace.zip",65*1024*1024);
    expect(finalizeDailyReview(f).eligibleForAuthorizedRelease).toBe(true);
  });
  it("does not grant the same allowance to arbitrary evidence or PNGs",()=>{
    const f=fixture();resize(f,"native/screenshot.png",65*1024*1024);
    expect(finalizeDailyReview(f).issues).toEqual(["file-budget"]);
  });
  it("rejects an oversized text file merely labelled as a native ZIP",()=>{
    const f=fixture();resize(f,"native/sofa143-trace.zip",65*1024*1024,false);
    expect(finalizeDailyReview(f).issues).toEqual(["native-media-header"]);
  });
  it("does not trust a reviewer kind when the native trace MIME is forged",()=>{
    const f=fixture();resize(f,"native/sofa143-trace.zip",65*1024*1024);
    const reporter=f.read("run/attempt-01/playwright.json"),spec=reporter.suites[0].specs.find((s:{title:string})=>s.title===SOFA_SCROLL_143_TITLE);
    spec.tests[0].results[0].attachments.find((a:{name:string})=>a.name==="trace").contentType="application/octet-stream";
    f.put("run/attempt-01/playwright.json",reporter);const manifest=f.read("run/evidence-manifest.json");Object.assign(manifest.files.find((r:{path:string})=>r.path==="playwright.json"),{...f.ref("run/attempt-01","playwright.json"),bytes:fs.statSync(path.join(f.run,"attempt-01/playwright.json")).size});f.put("run/evidence-manifest.json",manifest);
    expect(finalizeDailyReview(f).issues).toEqual(["file-budget"]);
  });
  it("retains the192MiB ceiling even for a bound original trace",()=>{
    const f=fixture();resize(f,"native/sofa143-trace.zip",193*1024*1024);
    expect(finalizeDailyReview(f).issues).toEqual(["file-budget"]);
  });
  it("keeps JSON strict after the very same trace has been cached as binary media",()=>{
    const f=fixture();const large=resize(f,"native/sofa143-trace.zip",65*1024*1024);
    const ideas=f.read("ideas.json");ideas.items[0].decision="adopted";ideas.items[0].actualCaseEvidence=[{kind:"native",path:large.name,sha256:large.sha256,caseTitle:SOFA_SCROLL_143_TITLE}];f.put("ideas.json",ideas);
    // The physical attachment is deliberately still a ZIP, so it cannot be
    // parsed as adopted native JSON merely because hashing it was permitted.
    expect(finalizeDailyReview(f).issues).toEqual(["file-budget"]);
  });
});

describe("147 raw DOM admission and independent rendered review stay separate",()=>{
  it("requires all thirteen exact cases even when every daily idea is rejected",()=>{const x=make();for(const s of x.reporter.suites[0].specs)if(s.title.startsWith("147 "))s.title="unrelated "+s.title;expect(evaluateReviewContracts(x).issues).toContain("items147-exact-cases-or-attachments");});
  it("requires all thirteen raw attachments, independent of adopted idea references",()=>{const x=make();x.renderedNativeEvidence=[];expect(evaluateReviewContracts(x).issues).toContain("items147-exact-cases-or-attachments");});
  it("rejects a duplicate raw attachment",()=>{const x=make();x.renderedNativeEvidence.push(x.renderedNativeEvidence[0]);expect(evaluateReviewContracts(x).issues).toContain("items147-exact-cases-or-attachments");});
  it.each(["scroll","frame","post-render"])("requires three original painted assessments for a %s candidate",phase=>{const x=renderedCandidate(make(),1,phase);expect(evaluateReviewContracts(x)).toEqual({passed:true,issues:[]});x.reviews[2].document.renderedAssessments=[];expect(evaluateReviewContracts(x).issues).toContain("items147-three-rendered-assessments");});
  const negatives:[string,(x:ReturnType<typeof make>)=>void,string][]=[
    ["missing assessment",x=>{x.reviews[0].document.renderedAssessments=[];},"items147-three-rendered-assessments"],
    ["raw SHA differs",x=>{x.reviews[0].document.renderedAssessments[0].rawAttachment.sha256=digest("different");},"items147-three-rendered-assessments"],
    ["case differs",x=>{x.reviews[0].document.renderedAssessments[0].caseTitle=ITEMS_SCROLL_147_TITLES[2];},"items147-three-rendered-assessments"],
    ["BUILD_ID differs",x=>{x.reviews[0].document.renderedAssessments[0].buildId="old-build";},"items147-three-rendered-assessments"],
    ["duplicate assessment",x=>{x.reviews[0].document.renderedAssessments.push(x.reviews[0].document.renderedAssessments[0]);},"items147-three-rendered-assessments"],
    ...["confirmed_failure","insufficient_evidence","needs_render_review"].map(state=>[state,(x:ReturnType<typeof make>)=>{x.reviews[0].document.renderedAssessments[0].state=state;},"items147-rendered-unproved"] as [string,(x:ReturnType<typeof make>)=>void,string]),
    ...[2,2.01,-1,NaN,Infinity].map(value=>[`paint error ${value}`,(x:ReturnType<typeof make>)=>{x.reviews[0].document.renderedAssessments[0].maxRelativeErrorCssPx=value;},"items147-rendered-unproved"] as [string,(x:ReturnType<typeof make>)=>void,string]),
    ["missing painted object",x=>{x.reviews[0].document.renderedAssessments[0].missing=1;},"items147-rendered-unproved"],
    ["not all candidates inspected",x=>{x.reviews[0].document.renderedAssessments[0].candidateCount=0;},"items147-rendered-unproved"],
    ["no original paints",x=>{x.reviews[0].document.renderedAssessments[0].paintEvidence=[];},"items147-rendered-unproved"],
    ...["trace","video"].map(kind=>[`${kind} only`,(x:ReturnType<typeof make>)=>{x.reviews[0].document.renderedAssessments[0].paintEvidence=x.reviews[0].document.renderedAssessments[0].paintEvidence.filter(p=>p.kind===kind);},"items147-rendered-unproved"] as [string,(x:ReturnType<typeof make>)=>void,string]),
    ["duplicate original ref",x=>{const p=x.reviews[0].document.renderedAssessments[0].paintEvidence;p.push(p[0]);},"items147-rendered-unproved"],
    ["resized paint",x=>{x.reviews[0].document.renderedAssessments[0].paintEvidence[0].pixelScale=.5;},"items147-rendered-unproved"],
    ["one paint only",x=>{x.reviews[0].document.renderedAssessments[0].paintEvidence[0].sampleCount=1;},"items147-rendered-unproved"],
    ["fractional paint count",x=>{x.reviews[0].document.renderedAssessments[0].paintEvidence[0].sampleCount=2.5;},"items147-rendered-unproved"],
    ["another case trace",x=>{const a=x.reviews[0].document.renderedAssessments[0];a.paintEvidence[0]={...a.paintEvidence[0],...x.renderedNativeEvidence[2].paintAttachments[0]};},"items147-rendered-unproved"],
    ["unbound paint bytes",x=>{x.renderedNativeEvidence[1].paintAttachments[0].attachmentBound=false;},"items147-rendered-unproved"],
    ["raw BUILD_ID differs",x=>{x.renderedNativeEvidence[1].document.buildId="older";},"items147-raw-unproved"],
    ["raw admission failed",x=>{x.renderedNativeEvidence[1].document.admissionStatus="failed";},"items147-raw-unproved"],
    ["changed threshold",x=>{x.renderedNativeEvidence[1].document.renderThresholdCssPx=20;},"items147-raw-unproved"],
    ["candidate label emptied",x=>{x.renderedNativeEvidence[1].document.renderCandidates=[];x.renderedNativeEvidence[1].document.renderedStatus="no_candidate_observed";for(const r of x.reviews)r.document.renderedAssessments=[];},"items147-raw-unproved"],
  ];
  it.each(negatives)("holds %s",(_,change,code)=>{const x=renderedCandidate();change(x);expect(evaluateReviewContracts(x).issues).toContain(code);});
  it("does not accept two otherwise valid reviewers",()=>{const x=renderedCandidate();x.reviews.pop();expect(evaluateReviewContracts(x).issues).toContain("three-unique-reviewers");});
  it("hash-verifies all thirteen raw files and original trace/video with three valid fresh receipts",()=>{expect(finalizeDailyReview(fixture(renderedCandidate())).eligibleForAuthorizedRelease).toBe(true);});
  it("rejects altered original paint bytes even when generic screenshot and all idea evidence are intact",()=>{const f=fixture(renderedCandidate());f.put("run/attempt-01/native/items147-1-trace.zip","amended");expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);});
  it("rejects amended raw bytes independently of idea evidence",()=>{const f=fixture(make());f.put("run/attempt-01/native/items147-1.json","{}");expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);});
  it.each(["missing","duplicate"])("rejects %s dedicated reporter attachment despite a frozen raw JSON",mode=>{const f=fixture();const reporter=f.read("run/attempt-01/playwright.json"),spec=reporter.suites[0].specs.find((s:{title:string})=>s.title===ITEMS_SCROLL_147_TITLES[1]),attachments=spec.tests[0].results[0].attachments;if(mode==="missing")spec.tests[0].results[0].attachments=attachments.filter((a:{name:string})=>a.name!=="actual-items-scroll-147");else attachments.push(attachments[0]);f.put("run/attempt-01/playwright.json",reporter);const manifest=f.read("run/evidence-manifest.json");manifest.files=manifest.files.map((r:{path:string})=>r.path==="playwright.json"?{...f.ref("run/attempt-01",r.path),bytes:fs.statSync(path.join(f.run,"attempt-01",r.path)).size}:r);f.put("run/evidence-manifest.json",manifest);expect(finalizeDailyReview(f).issues).toEqual(["items147-exact-cases-or-attachments"]);});
});

describe("143 literal recipe registration",()=>{
  it("does not register an ID in a comment, unrelated string or nonexported variable",()=>{expect(registeredRecipes(`// {id:"fake",personality:"tidy"}\nconst unrelated="fake";\n${sourceCode}`)).toHaveLength(9);expect(()=>registeredRecipes(sourceCode.replace("export const","const"))).toThrow();});
  it.each([
    '...dynamicOverride',
    'get id(){return "overridden";}',
    'set id(value){}',
    'method(){}',
    '["id"]:"overridden"',
    'id:"overridden"',
  ])("never certifies unfamiliar or overriding object properties: %s",extra=>{
    const altered=sourceCode.replace('personality:"performer",major:false',`personality:"performer",${extra},major:false`);
    expect(()=>registeredRecipes(altered)).toThrow("catalog-record");
  });
  it("rejects dynamic registration or duplicate IDs rather than evaluating code",()=>{expect(()=>registeredRecipes("export const COMPANION_PERSONALITY_SCENES = runNetwork();")).toThrow();expect(()=>registeredRecipes(sourceCode.replace('id:"D143-1"','id:"D143-0"'))).toThrow();});
});


function refreshSofa156(input:ReturnType<typeof make>){
  const raw=input.sofaRenderedNativeEvidence.document,analysis=analyzeSofaScroll143(raw);
  raw.renderCandidates=analysis.candidates;raw.measurement=analysis.summary;
  raw.renderedStatus=analysis.candidates.length?"needs_render_review":"no_candidate_observed";
  for(const review of input.reviews)for(const assessment of review.document.sofaRenderedAssessments){
    assessment.state=analysis.candidates.length?"prepaint_observation":"no_failure_observed";
    assessment.candidateCount=analysis.candidates.length;
  }
  return input;
}
function sofaCandidate156(input=make(),phase="frame"){
  const row=input.sofaRenderedNativeEvidence.document.frames.find(frame=>frame.phase===phase)!;
  row.front.y+=53;row.pet.y+=53;
  return refreshSofa156(input);
}
function sofaGate156(input=make()){
  return evaluateSofaRendered143({report:input.report,source:input.source,evidence:input.sofaRenderedNativeEvidence,reviews:input.reviews,casePresent:true});
}
function rebindSofaFixture156(f:ReturnType<typeof fixture>){
  // Deliberately rewritten synthetic fixtures are still inspected by the gate.
  // This helper is never used on a real run, original media or its manifest.
  const raw=f.read("run/attempt-01/native/sofa143.json");
  raw.paintSamples.forEach((sample:{sha256:string},index:number)=>{sample.sha256=f.ref("run/attempt-01","native/sofa143-"+index+".png").sha256;});
  f.put("run/attempt-01/native/sofa143.json",raw);
  const manifest=f.read("run/evidence-manifest.json");
  manifest.files=manifest.files.map((entry:{path:string})=>({...f.ref("run/attempt-01",entry.path),bytes:fs.statSync(path.join(f.run,"attempt-01",entry.path)).size}));
  f.put("run/evidence-manifest.json",manifest);
  const index=f.read("reviews/index.json");
  for(let i=0;i<3;i++){
    const review=f.read("reviews/review-"+i+".json"),assessment=review.sofaRenderedAssessments[0];
    assessment.rawAttachment=f.ref("run/attempt-01","native/sofa143.json");
    assessment.paintEvidence=assessment.paintEvidence.map((paint:PaintRef)=>({...paint,...f.ref("run/attempt-01",paint.path),
      ...(paint.kind==="trace"?{embeddedPngs:raw.paintSamples.map((sample:{name:string;sha256:string})=>({name:sample.name,sha256:sample.sha256}))}:{})}));
    f.put("reviews/review-"+i+".json",review);index.reviews[i].review=f.ref("reviews","review-"+i+".json");
  }
  f.put("reviews/index.json",index);
}

describe("156 exact resident-sofa painted contract, separate from the thirteen147 cases",()=>{
  it("requires three original same-case painted reviews even with no DOM candidate",()=>{
    const input=make();expect(sofaGate156(input)).toEqual({passed:true,issues:[]});
    input.reviews[0].document.sofaRenderedAssessments=[];
    expect(sofaGate156(input).issues).toContain("sofa143-three-rendered-assessments");
  });
  it.each(["scroll","frame","post-render"])("keeps every %s >=1px observation pending three real painted reviews",phase=>{
    const input=sofaCandidate156(make(),phase),raw=input.sofaRenderedNativeEvidence.document;
    expect(analyzeSofaScroll143(raw).admissionPassed).toBe(true);
    expect(raw.renderCandidates).toHaveLength(2);
    expect(raw.renderCandidates[0]).toMatchObject({kind:"front-geometry",phase,dy:53});
    expect(raw.renderCandidates[1]).toMatchObject({kind:"body-relative-span",span:53});
    expect(raw.frames).toHaveLength(sofaFrameFixture().length);
    expect(sofaGate156(input)).toEqual({passed:true,issues:[]});
    input.reviews[2].document.sofaRenderedAssessments[0].state="confirmed_failure";
    expect(sofaGate156(input).issues).toContain("sofa143-rendered-unproved");
  });
  it("nominates exactly one CSS pixel and preserves actor-relative span extrema across all phases",()=>{
    const input=make(),raw=input.sofaRenderedNativeEvidence.document;
    raw.frames[0].front.y+=1;raw.frames[1].pet.y-=.6;raw.frames[2].pet.y+=.6;
    refreshSofa156(input);
    expect(raw.renderCandidates[0]).toMatchObject({kind:"front-geometry",dy:1});
    const candidate=raw.renderCandidates[1];
    expect(candidate).toMatchObject({kind:"body-relative-span",minimum:{sequence:1,phase:"post-render"},maximum:{sequence:2,phase:"frame"}});
    expect(analyzeSofaScroll143(raw).summary.footRelativeSpan).toBeCloseTo(1.2);
    expect(sofaGate156(input).passed).toBe(true);
  });
  it("does not certify the same raw coordinate error from a post-rAF timer label",()=>{
    const input=sofaCandidate156(make(),"post-render");
    input.reviews.forEach(review=>{review.document.sofaRenderedAssessments=[];});
    expect(sofaGate156(input).passed).toBe(false);
    expect(input.sofaRenderedNativeEvidence.document.renderedStatus).toBe("needs_render_review");
  });
  const rawNegatives:[string,(input:ReturnType<typeof make>)=>void,string][]=[
    ["missing exact case",input=>{input.reporter.suites[0].specs.find(spec=>spec.title===SOFA_SCROLL_143_TITLE)!.title="unrelated case";},"sofa143-exact-case-or-attachment"],
    ["unbound raw",input=>{input.sofaRenderedNativeEvidence.attachmentBound=false;},"sofa143-exact-case-or-attachment"],
    ["different raw case",input=>{input.sofaRenderedNativeEvidence.caseTitle="another case";},"sofa143-exact-case-or-attachment"],
    ["malformed raw hash",input=>{input.sofaRenderedNativeEvidence.sha256="bad";},"sofa143-exact-case-or-attachment"],
    ["raw JSON from another case",input=>{input.sofaRenderedNativeEvidence.document.caseTitle="another case";},"sofa143-raw-unproved"],
    ["old build",input=>{input.sofaRenderedNativeEvidence.document.buildId="old-build";},"sofa143-raw-unproved"],
    ["old source digest",input=>{input.sofaRenderedNativeEvidence.document.sourceDigest=digest("other-source");},"sofa143-raw-unproved"],
    ["missing frozen source",input=>{input.sofaRenderedNativeEvidence.document.sourceFiles.pop();},"sofa143-raw-unproved"],
    ["source bytes differ",input=>{input.sofaRenderedNativeEvidence.document.sourceFiles[0].sha256=digest("other-source");},"sofa143-raw-unproved"],
    ["duplicate source",input=>{input.sofaRenderedNativeEvidence.document.sourceFiles[0]=input.sofaRenderedNativeEvidence.document.sourceFiles[1];},"sofa143-raw-unproved"],
    ["served chunk differs",input=>{input.sofaRenderedNativeEvidence.document.chunks[0].local=digest("different-chunk");},"sofa143-raw-unproved"],
    ["no served chunks",input=>{input.sofaRenderedNativeEvidence.document.chunks=[];},"sofa143-raw-unproved"],
    ["old failure relabeled",input=>{input.sofaRenderedNativeEvidence.document.status="failed";},"sofa143-raw-unproved"],
    ["admission failure",input=>{input.sofaRenderedNativeEvidence.document.admissionStatus="failed";},"sofa143-raw-unproved"],
    ["candidate erased",input=>{input.sofaRenderedNativeEvidence.document.renderCandidates=[];},"sofa143-raw-unproved"],
    ["aggregate erased",input=>{input.sofaRenderedNativeEvidence.document.measurement.maxOffset=0;},"sofa143-raw-unproved"],
    ["candidate relabeled as absent",input=>{input.sofaRenderedNativeEvidence.document.renderedStatus="no_candidate_observed";},"sofa143-raw-unproved"],
    ["criterion relaxed",input=>{input.sofaRenderedNativeEvidence.document.renderThresholdCssPx=2;},"sofa143-raw-unproved"],
    ["counterfeit DPR",input=>{input.sofaRenderedNativeEvidence.document.deviceScaleFactor=2;},"sofa143-raw-unproved"],
    ["scaled video declaration",input=>{input.sofaRenderedNativeEvidence.document.videoSize.width=800;},"sofa143-raw-unproved"],
  ];
  it.each(rawNegatives)("holds %s",(_,mutate,code)=>{const input=sofaCandidate156();mutate(input);expect(evaluateReviewContracts(input).issues).toContain(code);});
  const admissionNegatives:[string,(input:ReturnType<typeof make>)=>void,string][]=[
    ["one row removed",input=>{input.sofaRenderedNativeEvidence.document.frames.splice(5,1);},"capture-history"],
    ["sequence renumbered",input=>{input.sofaRenderedNativeEvidence.document.frames[5].sequence++;},"capture-sequence"],
    ["all frame observations discarded",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach(row=>{if(row.phase==="frame")row.phase="post-render";});},"phase-denominator"],
    ["all scroll observations discarded",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach(row=>{if(row.phase==="scroll")row.phase="post-render";});},"phase-denominator"],
    ["all post-rAF observations discarded",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach(row=>{if(row.phase==="post-render")row.phase="frame";});},"phase-denominator"],
    ["unknown phase",input=>{input.sofaRenderedNativeEvidence.document.frames[0].phase="painted";},"capture-sequence"],
    ["capture silently capped",input=>{input.sofaRenderedNativeEvidence.document.probeOverflow=true;},"capture-history"],
    ["probe still live",input=>{input.sofaRenderedNativeEvidence.document.probeStopped=false;},"capture-history"],
    ["actual compact viewport omitted",input=>{input.sofaRenderedNativeEvidence.document.frames[0].viewport=[800,420];},"actual-viewport"],
    ["missing owner surface",input=>{Reflect.deleteProperty(input.sofaRenderedNativeEvidence.document.frames[0],"room");},"missing-surface"],
    ["seat moved outside denominator",input=>{input.sofaRenderedNativeEvidence.document.frames[0].cushion.x=-1000;},"resident-denominator"],
    ["not actually overflowed",input=>{input.sofaRenderedNativeEvidence.document.dimensions.full=394;},"actual-overflow"],
    ["no actual scroll",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach(row=>{row.homeScroll=0;});},"actual-wheel-reversal"],
    ["no upward reversal",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach((row,index)=>{row.homeScroll=index;});},"actual-wheel-reversal"],
    ["bed never moved",input=>{input.sofaRenderedNativeEvidence.document.frames.forEach(row=>{row.bed.y=300;});},"actual-wheel-reversal"],
    ...["pet","front"].map(key=>["missing "+key,(input:ReturnType<typeof make>)=>{Reflect.deleteProperty(input.sofaRenderedNativeEvidence.document.frames[0],key);},"resident-visibility-owner"] as [string,(input:ReturnType<typeof make>)=>void,string]),
    ...["petHidden","frontHidden"].map(key=>["hidden "+key,(input:ReturnType<typeof make>)=>{Reflect.set(input.sofaRenderedNativeEvidence.document.frames[0],key,true);},"resident-visibility-owner"] as [string,(input:ReturnType<typeof make>)=>void,string]),
    ...["petPainted","frontPainted","decoded","nativeActor","nativeFront"].map(key=>["unproved "+key,(input:ReturnType<typeof make>)=>{Reflect.set(input.sofaRenderedNativeEvidence.document.frames[0],key,false);},"resident-visibility-owner"] as [string,(input:ReturnType<typeof make>)=>void,string]),
    ["double front",input=>{input.sofaRenderedNativeEvidence.document.frames[0].localFrontVisibility="visible";},"resident-visibility-owner"],
    ["wrong depth",input=>{input.sofaRenderedNativeEvidence.document.frames[0].depth="floor";},"resident-visibility-owner"],
    ["wrong support",input=>{input.sofaRenderedNativeEvidence.document.frames[0].platform="calendar";},"resident-visibility-owner"],
    ["wrong stack",input=>{input.sofaRenderedNativeEvidence.document.frames[0].frontZ=1;},"resident-visibility-owner"],
    ["in flight",input=>{input.sofaRenderedNativeEvidence.document.frames[0].state="jump";},"resident-visibility-owner"],
    ["held",input=>{input.sofaRenderedNativeEvidence.document.frames[0].state="held";},"resident-visibility-owner"],
  ];
  it.each(admissionNegatives)("preserves the native hard gate: %s",(_,mutate,code)=>{
    const input=make();mutate(input);const analysis=analyzeSofaScroll143(input.sofaRenderedNativeEvidence.document);
    expect(analysis.issues).toContain(code);refreshSofa156(input);
    expect(sofaGate156(input).issues).toContain("sofa143-raw-unproved");
  });
  const reviewNegatives:[string,(input:ReturnType<typeof make>)=>void,string][]=[
    ["missing assessment",input=>{input.reviews[0].document.sofaRenderedAssessments=[];},"sofa143-three-rendered-assessments"],
    ["two reviewers",input=>{input.reviews.pop();},"sofa143-three-rendered-assessments"],
    ["duplicate assessment",input=>{input.reviews[0].document.sofaRenderedAssessments.push(input.reviews[0].document.sofaRenderedAssessments[0]);},"sofa143-three-rendered-assessments"],
    ["wrong raw hash",input=>{input.reviews[0].document.sofaRenderedAssessments[0].rawAttachment.sha256=digest("other-raw");},"sofa143-three-rendered-assessments"],
    ["other case assessment",input=>{input.reviews[0].document.sofaRenderedAssessments[0].caseTitle="other case";},"sofa143-three-rendered-assessments"],
    ["other build assessment",input=>{input.reviews[0].document.sofaRenderedAssessments[0].buildId="old";},"sofa143-three-rendered-assessments"],
    ...["confirmed_failure","insufficient_evidence","needs_render_review","no_failure_observed"].map(state=>[state,(input:ReturnType<typeof make>)=>{input.reviews[0].document.sofaRenderedAssessments[0].state=state;},"sofa143-rendered-unproved"] as [string,(input:ReturnType<typeof make>)=>void,string]),
    ...["maxRelativeErrorCssPx","maxFrontErrorCssPx","maxSizeErrorCssPx","bodyRelativeSpanCssPx"].flatMap(key=>[1,1.01,-1,NaN,Infinity].map(value=>[key+" "+value,(input:ReturnType<typeof make>)=>{Reflect.set(input.reviews[0].document.sofaRenderedAssessments[0],key,value);},"sofa143-rendered-unproved"] as [string,(input:ReturnType<typeof make>)=>void,string])),
    ["missing visible object",input=>{input.reviews[0].document.sofaRenderedAssessments[0].missing=1;},"sofa143-rendered-unproved"],
    ["candidate count dropped",input=>{input.reviews[0].document.sofaRenderedAssessments[0].candidateCount=0;},"sofa143-rendered-unproved"],
    ["no reason",input=>{input.reviews[0].document.sofaRenderedAssessments[0].reason="";},"sofa143-rendered-unproved"],
    ["no actual paints",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence=[];},"sofa143-rendered-unproved"],
    ...["trace","video","png"].map(kind=>["missing "+kind,(input:ReturnType<typeof make>)=>{const assessment=input.reviews[0].document.sofaRenderedAssessments[0];assessment.paintEvidence=assessment.paintEvidence.filter(paint=>paint.kind!==kind);},"sofa143-rendered-unproved"] as [string,(input:ReturnType<typeof make>)=>void,string]),
    ["duplicate paint",input=>{const paints=input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence;paints.push(paints[0]);},"sofa143-rendered-unproved"],
    ["resized trace",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence[0].pixelScale=5/12;},"sofa143-rendered-unproved"],
    ["only one video sample",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence.find(paint=>paint.kind==="video")!.sampleCount=1;},"sofa143-rendered-unproved"],
    ["800px video pixels",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence.find(paint=>paint.kind==="video")!.pixelWidth=800;},"sofa143-rendered-unproved"],
    ["no 1x trace PNGs inspected",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence[0].embeddedPngs=[];},"sofa143-rendered-unproved"],
    ["800px trace cast called 1x PNG",input=>{input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence[0].embeddedPngs![0].sha256=digest("800px-cast");},"sofa143-rendered-unproved"],
    ["down sample not inspected",input=>{const a=input.reviews[0].document.sofaRenderedAssessments[0];a.paintEvidence=a.paintEvidence.filter(paint=>paint.path!=="native/sofa143-1.png");a.paintEvidence[0].embeddedPngs=a.paintEvidence[0].embeddedPngs!.filter(png=>png.name!=="sofa143-paint-down");},"sofa143-rendered-unproved"],
    ["another case video",input=>{const paint=input.reviews[0].document.sofaRenderedAssessments[0].paintEvidence.find(p=>p.kind==="video")!;paint.path="native/unrelated-video.webm";},"sofa143-rendered-unproved"],
    ["unbound trace",input=>{input.sofaRenderedNativeEvidence.paintAttachments[0].attachmentBound=false;},"sofa143-rendered-unproved"],
    ["missing native PNG",input=>{input.sofaRenderedNativeEvidence.paintAttachments.pop();},"sofa143-original-paints-unproved"],
    ["800px native PNG header",input=>{input.sofaRenderedNativeEvidence.paintAttachments[2].pixelWidth=800;},"sofa143-original-paints-unproved"],
    ["PNG missing raw hash",input=>{input.sofaRenderedNativeEvidence.document.paintSamples[0].sha256="";},"sofa143-original-paints-unproved"],
    ["PNG clock outside window",input=>{input.sofaRenderedNativeEvidence.document.paintSamples[0].beforeAt=0;},"sofa143-original-paints-unproved"],
    ["PNG negative clock bracket",input=>{input.sofaRenderedNativeEvidence.document.paintSamples[0].afterAt=999;},"sofa143-original-paints-unproved"],
  ];
  it.each(reviewNegatives)("cannot counterfeit painted review: %s",(_,mutate,code)=>{const input=sofaCandidate156();mutate(input);expect(sofaGate156(input).issues).toContain(code);});
  it("fails closed on malformed records without executing any native or product hooks",()=>{
    const input=make();Reflect.set(input.sofaRenderedNativeEvidence.document.frames,0,null);
    expect(()=>sofaGate156(input)).not.toThrow();expect(sofaGate156(input).passed).toBe(false);
    Reflect.set(input.sofaRenderedNativeEvidence,"document",null);
    expect(()=>sofaGate156(input)).not.toThrow();expect(sofaGate156(input).passed).toBe(false);
  });
  it("leaves the thirteen147 arrays and original idea-completion gate intact",()=>{
    const input=sofaCandidate156();expect(input.renderedNativeEvidence).toHaveLength(13);
    expect(input.reviews.every(review=>review.document.renderedAssessments.length===0)).toBe(true);
    expect(evaluateReviewContracts(input)).toEqual({passed:true,issues:[]});
    adopt(input).nativeEvidence[0].document.notes=[];
    expect(evaluateReviewContracts(input).issues).toContain("idea-native-completion-unproved");
  });
});

describe("156 sofa source/raw/original-media file binding",()=>{
  it("hash-binds exact143 JSON, original trace, original video and three native PNGs",()=>{expect(finalizeDailyReview(fixture(sofaCandidate156())).eligibleForAuthorizedRelease).toBe(true);});
  it.each(["native/sofa143.json","native/sofa143-trace.zip","native/sofa143-video.webm","native/sofa143-1.png"])("rejects original bytes modified after freeze: %s",file=>{
    const f=fixture();f.put("run/attempt-01/"+file,"amended-original");expect(finalizeDailyReview(f).issues).toEqual(["reference-sha-mismatch"]);
  });
  it.each(["missing","duplicate"])("rejects %s exact143 attachment while its raw file remains frozen",mode=>{
    const f=fixture(),reporter=f.read("run/attempt-01/playwright.json"),test=reporter.suites[0].specs.find((spec:{title:string})=>spec.title===SOFA_SCROLL_143_TITLE).tests[0].results[0];
    if(mode==="missing")test.attachments=test.attachments.filter((attachment:{name:string})=>attachment.name!=="actual-sofa-scroll-156");else test.attachments.push(test.attachments[0]);
    f.put("run/attempt-01/playwright.json",reporter);rebindSofaFixture156(f);
    expect(finalizeDailyReview(f).issues).toEqual(["sofa143-exact-case-or-attachment"]);
  });
  it("rejects missing original same-case PNG attachment despite a PNG file and fresh reviewers",()=>{
    const f=fixture(),reporter=f.read("run/attempt-01/playwright.json"),test=reporter.suites[0].specs.find((spec:{title:string})=>spec.title===SOFA_SCROLL_143_TITLE).tests[0].results[0];
    test.attachments=test.attachments.filter((attachment:{name:string})=>attachment.name!=="sofa143-paint-down");
    f.put("run/attempt-01/playwright.json",reporter);rebindSofaFixture156(f);
    expect(finalizeDailyReview(f).issues).toContain("sofa143-original-paints-unproved");
  });
  it("reads actual PNG pixel dimensions even when raw and every review declare 1x",()=>{
    const f=fixture(),bytes=fs.readFileSync(path.join(f.run,"attempt-01/native/sofa143-1.png"));bytes.writeUInt32BE(800,16);
    f.put("run/attempt-01/native/sofa143-1.png",bytes);rebindSofaFixture156(f);
    expect(finalizeDailyReview(f).issues).toContain("sofa143-original-paints-unproved");
  });
  it("does not accept unrecognized PNG bytes with a claimed1920px raw declaration",()=>{
    const f=fixture();f.put("run/attempt-01/native/sofa143-1.png","counterfeit-pixels");rebindSofaFixture156(f);
    expect(finalizeDailyReview(f).issues).toEqual(["sofa143-original-paints-unproved"]);
  });
  it("requires the actual observer source, not only the unchanged product or a matching label",()=>{
    const f=fixture();f.put("run/workspace/tests/visual/companion-living-143.spec.ts","different-observer");
    expect(finalizeDailyReview(f).issues).toEqual(["snapshot-source-changed"]);
  });
});
