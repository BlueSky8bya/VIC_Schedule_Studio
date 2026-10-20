import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { evaluateReviewContracts, finalizeDailyReview, registeredRecipes, parseReviewOptions, REVIEW_PERSPECTIVES, ITEMS_SCROLL_147_TITLES } from "../../scripts/companion-qa/review.mjs";
import { PERSONALITIES, NATIVE_ENTRY_TITLES, NATIVE_FLOATING_TIDY_TITLES, PLANNED_NATIVE_CASE_COUNT } from "../../scripts/companion-qa/catalog.mjs";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const HASH = digest("fixture"), CATALOG="lib/ui/viewer-companion/personality-scene-catalog.ts";
const BINDING={runId:"20261020-local-fixture",sourceDigest:HASH,buildId:"local-build-fixture",dayKst:"2026-10-20"};
const sourceCode=`export const COMPANION_PERSONALITY_SCENES = Object.freeze([${PERSONALITIES.map((p,i)=>`{id:"D143-${i}",personality:"${p}",major:false,triggers:["free"],steps:[]}`).join(",")}]);`;
const pngRef={path:"native/screenshot.png",sha256:HASH};
const nativeTitles=[...NATIVE_ENTRY_TITLES,...NATIVE_FLOATING_TIDY_TITLES,...ITEMS_SCROLL_147_TITLES,...Array.from({length:PLANNED_NATIVE_CASE_COUNT-NATIVE_ENTRY_TITLES.length-NATIVE_FLOATING_TIDY_TITLES.length-ITEMS_SCROLL_147_TITLES.length},(_,i)=>`actual fixture ${i}`)];
type PaintRef={kind:string;path:string;sha256:string;pixelScale:number;sampleCount:number};
type RenderAssessment={rawAttachment:{path:string;sha256:string};caseTitle:string;buildId:string;state:string;candidateCount:number;maxRelativeErrorCssPx:number;missing:number;reason:string;paintEvidence:PaintRef[]};
function make() {
  const items=PERSONALITIES.map((personality,i)=>({id:`idea-${i}`,personality,hypothesis:"A bounded new journey with a physical effect",decision:"rejected",reason:"Actual implementation not adopted in this fixture",registeredRecipeId:`D143-${i}`,implementation:{path:CATALOG,sha256:HASH},pureModelEvidence:[{kind:"pure-model",path:"pure/vitest.json",sha256:HASH,testFullName:`D143-${i} model`}],actualCaseEvidence:[{kind:"native",path:`native/goal-${i}.json`,sha256:HASH,caseTitle:nativeTitles[i]}]}));
  const stages=["isolated-snapshot","pure-models","pure-count-proof","metadata","build","typecheck","lint","native-production-fixture","native-personality-entry-proof","owned-process-cleanup","original-tree-preserved"].map(name=>({name,status:"passed",exitCode:0}));
  const report={schemaVersion:1,...BINDING,createdAtKst:"2026-10-20 12:00:00 KST",status:"completed-scoped-checks",stages,universe:{plannedNativeCaseCount:PLANNED_NATIVE_CASE_COUNT,plannedNativeEntryCases:27,plannedNativeFloatingTidyCases:2},nativeEntries:{gatePassed:true,selectedPassedCases:PLANNED_NATIVE_CASE_COUNT},dailyCases:{required:9,observed:9,passed:9}};
  const proof={build:BINDING.buildId,errors:[],rejected:[],mutations:[],liveReads:[],chunks:[{served:HASH,local:HASH}]};
  const daily=PERSONALITIES.map(personality=>({status:"passed",scenario:{id:`daily-${personality}`,personality,seconds:90},sufficiency:{passed:true},frames:Array.from({length:451},(_,i)=>({at:i*200,visible:true,decoded:true,activity:{source:false,manual:false,epoch:0,jumpAllowed:true,width:60,height:60,anchor:{x:0,y:0,width:1200,height:900},action:"",context:""},lifePurpose:"ordinary",humanEpoch:0,layoutEpoch:0,walkSource:false,personality,hunger:.2,energy:.8,outsideVisible:true,jumpSource:false,play:"",playPaint:"other",command:""})),proof:structuredClone(proof)}));
  const reporter={errors:[],suites:[{specs:nativeTitles.map(title=>({title,tests:[{expectedStatus:"passed",status:"expected",results:[{status:"passed",retry:0}]}]}))}]};
  const authors=["/root-builder","/behavior-builder","/art-builder"];
  const ideas={schemaVersion:1,kind:"companion-daily-ideas",...BINDING,authors,items};
  const reviews=REVIEW_PERSPECTIVES.map((perspective,i)=>({document:{schemaVersion:1,kind:"companion-independent-review",...BINDING,agentId:`/grader-${i}`,perspective,fresh:true,readOnly:true,decision:"accept",assessments:items.map(x=>({ideaId:x.id,decision:"reject",reason:"Reject the unimplemented candidate"})),renderedAssessments:[] as RenderAssessment[],findings:[] as {severity:string;status:string;reason:string;evidence:typeof pngRef[]}[],evidence:[pngRef]},invocation:{schemaVersion:1,kind:"companion-parent-grader-receipt",...BINDING,agentId:`/grader-${i}`,parentAgentId:authors[0],perspective,fresh:true,readOnly:true,dispatchReceiptSha256:HASH,completionReceiptSha256:HASH}}));
  const source={contentDigest:HASH,recomputedDigest:HASH,buildId:BINDING.buildId,snapshotMatches:true,privateSourceArtCopied:false,sourceIllustrationsCopied:0,sourceContractsCopied:0};
  const registrations=registeredRecipes(sourceCode), pureReport={success:true,numTotalTests:9,numFailedTests:0,numPendingTests:0,testResults:[{assertionResults:items.map((_,i)=>({status:"passed",fullName:`D143-${i} model`}))}]};
  const modelCoverage={recipeCount:registrations.length,entries:9,routineTemplates:54,booleanPatterns:262144};
  const nativeEvidence=items.map((item,i)=>({path:`native/goal-${i}.json`,sha256:HASH,caseTitle:nativeTitles[i],attachmentBound:true,document:{status:"passed",errors:[],rejected:[],notes:[{reachedFinalBeatAndSubsequentSequence:[{id:item.registeredRecipeId,major:false}]}],frames:[{at:10,scene:item.registeredRecipeId,visible:true,decoded:true},{at:1000,scene:item.registeredRecipeId,visible:true,decoded:true}]}}));
  const renderedNativeEvidence=ITEMS_SCROLL_147_TITLES.map((caseTitle,i)=>({path:`native/items147-${i}.json`,sha256:HASH,caseTitle,attachmentBound:true,paintAttachments:[{kind:"trace",path:`native/items147-${i}-trace.zip`,sha256:HASH,attachmentBound:true},{kind:"video",path:`native/items147-${i}-video.webm`,sha256:HASH,attachmentBound:true}],document:{schemaVersion:1,kind:"companion-items-scroll-147",caseTitle,build:BINDING.buildId,buildId:BINDING.buildId,status:"passed",admissionStatus:"passed",errors:[],unexpected:[],renderThresholdCssPx:2,renderedStatus:"no_candidate_observed",renderCandidates:[] as {phase:string;at:number;type:string;id:string;shown:boolean;dx:number;dy:number}[],frames:i===0?[]:["scroll","frame","post-render"].map((phase,at)=>({phase,at,items:["food","toy"].map(type=>({type,id:type,eligible:true,shown:true,dx:0,dy:0}))}))}}));
  return {report,source,ideas,reviews,daily,reporter,registrations,pureReport,modelCoverage,nativeEvidence,renderedNativeEvidence,authors};
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
  const put=(name:string,value:unknown)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==="string"?value:JSON.stringify(value));return file;};
  const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));
  const ref=(base:string,name:string)=>({path:name,sha256:digest(fs.readFileSync(path.join(root,base,name)))});
  put(`run/workspace/${CATALOG}`,sourceCode);put("run/workspace/lib/fixture.ts","export const safe = true;");put("run/workspace/.next/BUILD_ID",BINDING.buildId);
  const sourceFiles=[{path:CATALOG,sha256:digest(sourceCode)},{path:"lib/fixture.ts",sha256:digest("export const safe = true;")},{path:"art-src/private-contract.json",sha256:HASH}];
  const sourceDigest=digest(JSON.stringify(sourceFiles));input.report.sourceDigest=sourceDigest;input.ideas.sourceDigest=sourceDigest;for(const r of input.reviews){r.document.sourceDigest=sourceDigest;r.invocation.sourceDigest=sourceDigest;}
  input.ideas.items.forEach(x=>{x.implementation.sha256=digest(sourceCode);});
  for(let i=0;i<input.nativeEvidence.length;i++){const spec=input.reporter.suites[0].specs[i];Object.assign(spec.tests[0].results[0],{attachments:[{contentType:"application/json",path:path.join(run,"attempt-01",input.nativeEvidence[i].path)}]});}
  for(const e of input.renderedNativeEvidence){const spec=input.reporter.suites[0].specs.find(s=>s.title===e.caseTitle)!;Object.assign(spec.tests[0].results[0],{attachments:[{name:"actual-items-scroll-147",contentType:"application/json",path:path.join(run,"attempt-01",e.path)},...e.paintAttachments.map(p=>({name:p.kind,contentType:p.kind==="trace"?"application/zip":"video/webm",path:path.join(run,"attempt-01",p.path)}))]});}
  put("run/attempt-01/playwright.json",input.reporter);for(const row of input.daily)put(`run/attempt-01/native/daily/${row.scenario.id}.json`,row);
  put("run/attempt-01/native/screenshot.png","fixture-only-png-bytes");put("run/attempt-01/pure/vitest.json",input.pureReport);put("run/attempt-01/pure/model-coverage.json",input.modelCoverage);
  for(const e of input.nativeEvidence)put("run/attempt-01/"+e.path,e.document);
  for(const e of input.renderedNativeEvidence){put("run/attempt-01/"+e.path,e.document);for(const p of e.paintAttachments)put("run/attempt-01/"+p.path,`fixture-only-${p.kind}-${e.caseTitle}`);}
  const evidencePaths=["playwright.json","native/screenshot.png","pure/vitest.json","pure/model-coverage.json",...input.daily.map(r=>`native/daily/${r.scenario.id}.json`),...input.nativeEvidence.map(e=>e.path),...input.renderedNativeEvidence.flatMap(e=>[e.path,...e.paintAttachments.map(p=>p.path)])];
  const evidenceFiles=evidencePaths.map(p=>({...ref("run/attempt-01",p),bytes:fs.statSync(path.join(run,"attempt-01",p)).size}));
  const nativeRef=(p:string)=>{const f=evidenceFiles.find(f=>f.path===p);if(!f)throw Error("fixture-ref");return {path:f.path,sha256:f.sha256};};
  input.ideas.items.forEach(x=>{x.actualCaseEvidence=x.actualCaseEvidence.map(r=>({...r,...nativeRef(r.path)}));x.pureModelEvidence=x.pureModelEvidence.map(r=>({...r,...nativeRef(r.path)}));});
  const reviewIndex=[];
  for(let i=0;i<input.reviews.length;i++){
    const r=input.reviews[i];r.document.evidence=[nativeRef("native/screenshot.png")];
    for(const a of r.document.renderedAssessments){a.rawAttachment={...a.rawAttachment,...nativeRef(a.rawAttachment.path)};a.paintEvidence=a.paintEvidence.map(p=>({...p,...nativeRef(p.path)}));}
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
