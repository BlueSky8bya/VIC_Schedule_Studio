import{AREAS,PERSONALITIES,BASELINE,ALWAYS_UNITS,AREA_UNITS,SEQUENCE_CONTRACTS,dayOrdinal,affectedAreas}from'./catalog.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k));
const natural=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e9;
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=86400000;
/** Only explicitly projected, coarse aggregates. Never an anonymity or consent claim. */
export function projectSignals(input){
  if(input===undefined)return {available:false,areas:AREAS.map(area=>({area,available:false,reason:'not-provided'}))};
  if(!keys(input,['schemaVersion','source','periodDays','observedDay','areas'])||input.schemaVersion!==1||!['developer-aggregate','performance-aggregate','synthetic-test'].includes(input.source)||![7,14,28].includes(input.periodDays))throw Error('invalid-aggregate-envelope');
  dayOrdinal(input.observedDay);
  if(!Array.isArray(input.areas)||input.areas.length>AREAS.length||new Set(input.areas.map(r=>r.area)).size!==input.areas.length)throw Error('invalid-aggregate-areas');
  const rows=input.areas.map(row=>{
    if(!keys(row,['area','sampleCount','attempts','failures','repeatedActions','p95Ms'])||!AREAS.includes(row.area)||!natural(row.sampleCount))throw Error('invalid-aggregate-row');
    for(const k of ['attempts','failures','repeatedActions'])if(row[k]!==undefined&&!natural(row[k]))throw Error('invalid-aggregate-count');
    if(row.p95Ms!==undefined&&!finite(row.p95Ms)||row.failures!==undefined&&(row.attempts===undefined||row.failures>row.attempts)||row.attempts!==undefined&&row.attempts>row.sampleCount||row.repeatedActions!==undefined&&row.repeatedActions>row.sampleCount)throw Error('incoherent-aggregate');
    if(row.sampleCount<5)return {area:row.area,available:true,suppressed:true,reason:'small-event-sample-not-anonymity-guarantee'};
    return {area:row.area,available:true,suppressed:false,sampleCount:row.sampleCount,...Object.fromEntries(['attempts','failures','repeatedActions','p95Ms'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]]))};
  });
  return {available:true,source:input.source,periodDays:input.periodDays,observedDay:input.observedDay,areas:AREAS.map(area=>rows.find(r=>r.area===area)??{area,available:false,reason:'not-provided'})};
}
export function normalizeHistory(input=[]){
  if(!Array.isArray(input)||input.length>5000)throw Error('invalid-history');
  return input.map(row=>{if(!keys(row,['area','day','kind','status','sourceDigest','evidenceRef','verified','regression','severity'])||!AREAS.includes(row.area)||!['unit','native','full'].includes(row.kind)||!['passed','failed','not-run'].includes(row.status)||typeof row.verified!=='boolean'||row.sourceDigest!==undefined&&!/^[a-f0-9]{64}$/.test(row.sourceDigest)||row.regression!==undefined&&typeof row.regression!=='boolean'||row.severity!==undefined&&!['P0','P1','P2','P3'].includes(row.severity)||row.verified&&(!row.sourceDigest||typeof row.evidenceRef!=='string'||!/^\.scratch-pw\/[a-zA-Z0-9_./-]+\.json$/.test(row.evidenceRef)||row.evidenceRef.includes('..')))throw Error('invalid-history-row');dayOrdinal(row.day);return {...row};});
}
export function rankAreas({day,history=[],signals,changedFiles=[]}){
  const now=dayOrdinal(day),rows=normalizeHistory(history);if(rows.some(r=>dayOrdinal(r.day)>now))throw Error('future-history');
  const aggregate=projectSignals(signals);if(aggregate.observedDay&&dayOrdinal(aggregate.observedDay)>now)throw Error('future-signals');
  const affected=affectedAreas(changedFiles);
  const ranked=AREAS.map(area=>{
    const observed=rows.filter(r=>r.area===area&&r.verified&&r.status!=='not-run'),anchor=observed.some(r=>r.day===day&&['native','full'].includes(r.kind))?now:now-1;
    const recent=observed.filter(r=>now-dayOrdinal(r.day)<=7),failures=observed.filter(r=>r.status==='failed'&&(recent.includes(r)||r.regression&&!observed.some(pass=>pass.kind==='full'&&pass.status==='passed'&&pass.day>r.day))),days=new Set(observed.filter(r=>r.status==='passed'&&['native','full'].includes(r.kind)&&dayOrdinal(r.day)>=anchor-6&&dayOrdinal(r.day)<=anchor).map(r=>r.day));
    const lastFull=rows.filter(r=>r.area===area&&r.kind==='full'&&r.status==='passed'&&r.verified).map(r=>r.day).sort().at(-1)??(area==='companion'?BASELINE.lastCompanionFullDay:undefined);
    const lastObserved=rows.filter(r=>r.area===area&&r.verified&&['native','full'].includes(r.kind)&&r.status!=='not-run').map(r=>r.day).sort().at(-1);
    const stable=days.size>=7&&!failures.length&&lastFull!==undefined&&now-dayOrdinal(lastFull)<=7;
    const metric=aggregate.areas.find(r=>r.area===area),stale=metric.available&&aggregate.observedDay&&now-dayOrdinal(aggregate.observedDay)>7;
    const severity=Math.max(0,...failures.map(r=>({P0:100,P1:70,P2:40,P3:10})[r.severity??'P2']));
    const realSignal=aggregate.source!=='synthetic-test'&&metric.available&&!metric.suppressed&&!stale;
    const reasons=[],scoreParts={severity,recentFailures:Math.min(25,failures.length*5),changed:affected.areas.includes(area)?24:0,aging:Math.min(14,lastObserved?now-dayOrdinal(lastObserved):7),uncertainty:!realSignal?4:0,observedFriction:realSignal&&metric.attempts>0?Math.min(20,20*(metric.failures??0)/metric.attempts):0,currentInstability:area==='companion'&&!stable?16:0};
    for(const[k,v]of Object.entries(scoreParts))if(v)reasons.push(k);
    return {area,score:Object.values(scoreParts).reduce((a,b)=>a+b,0),scoreParts,reasons,stable,verifiedGreenDays:days.size,lastObservedDay:lastObserved??null,lastFullDay:lastFull??null,signalsAvailable:realSignal,signalInputAvailable:metric.available,signalCausality:'Observed counts are candidate signals, not proof of user satisfaction or product defects.'};
  }).sort((a,b)=>b.score-a.score||AREAS.indexOf(a.area)-AREAS.indexOf(b.area));
  return {ranked,affected,aggregate};
}
export function planDaily({day,history=[],signals,changedFiles=[],budgetMinutes=45}){
  if(!Number.isInteger(budgetMinutes)||budgetMinutes<20||budgetMinutes>90)throw Error('invalid-budget');
  const now=dayOrdinal(day),rank=rankAreas({day,history,signals,changedFiles}),focus=rank.ranked[0].area;
  const explorer=AREAS.filter(a=>a!==focus)[now%(AREAS.length-1)],companionStable=rank.ranked.find(r=>r.area==='companion').stable,personalityStart=(now%3)*3,personalities=companionStable&&focus!=='companion'?[PERSONALITIES[now%9]]:PERSONALITIES.slice(personalityStart,personalityStart+3);
  const known=normalizeHistory(history),lastFull=known.filter(r=>r.area==='companion'&&r.kind==='full'&&r.status==='passed'&&r.verified).map(r=>r.day).sort().at(-1)??BASELINE.lastCompanionFullDay;
  const sweepDue=now-dayOrdinal(lastFull)>=7,confirmedRegression=known.some(r=>r.area==='companion'&&r.verified&&r.status==='failed'&&r.regression&&!known.some(pass=>pass.area==='companion'&&pass.verified&&pass.kind==='full'&&pass.status==='passed'&&pass.day>r.day)),fullRequired=rank.affected.companionChanged||confirmedRegression||sweepDue;
  const units=[...new Set([...ALWAYS_UNITS,...AREA_UNITS[focus],...AREA_UNITS[explorer]])];
  const surface=['viewer','studio','preview'][now%3],band=now%2?'night':'day';
  const nativePattern=`142 daily (?:${personalities.join('|')}):|143 studio sofa stays aligned beside the editor and independent controls$|142 floating home tidy ${now%2?'returns from a real calendar perch to all four toys':'preserves all four returns with learned care on'}$|157 ${surface} ${band} same-ID return prepares controls before cozy then rests and continues$`;
  const requiredTitlePatterns=[...personalities.map(p=>`^142 daily ${p}: ninety actual full-motion seconds in `),'^143 studio sofa stays aligned beside the editor and independent controls$',`^142 floating home tidy ${now%2?'returns from a real calendar perch to all four toys':'preserves all four returns with learned care on'}$`,`^157 ${surface} ${band} same-ID return prepares controls before cozy then rests and continues$`];
  return {schemaVersion:1,kind:'site-daily-triage-plan',day,budgetMinutes,fullSweepBudgetMinutes:45,repairAndReleaseBudgetSeparate:true,focusArea:focus,explorationArea:explorer,areaRanking:rank.ranked,changedImpact:rank.affected,signals:rank.aggregate,offlineUnitFiles:units,
    companion:{mode:fullRequired?'full-required':'diagnostic-only',fullRequired,reasons:[...(rank.affected.companionChanged?['source-or-oracle-changed']:[]),...(confirmedRegression?['unresolved-confirmed-regression']:[]),...(sweepDue?['seven-day-full-sweep-due']:[])],lastFullDay:lastFull,rotatingPersonalities:personalities,allNineIdeaAudit:true,nativePattern:fullRequired?null:nativePattern,requiredTitlePatterns:fullRequired?[]:requiredTitlePatterns,expectedSelectedCases:fullRequired?200:personalities.length+3,releaseEligible:false,
      command:['node','scripts/companion-qa/runner.mjs','--budget-minutes',fullRequired?'45':'20','--workers','3',...(fullRequired?[]:['--native-grep',nativePattern])]},
    sequenceContracts:SEQUENCE_CONTRACTS,ideaPolicy:{maxDailyProposals:3,maxActiveImplementations:2,allNinePersonalityIdeasRequired:false,allNinePersonalityReviewRequired:true,duplicateKey:'area+problemKey',score:'user benefit × evidence confidence / implementation+token+maintenance cost; project heuristic, not a research-proved optimum',approvalBeforeNewFeature:true,bugsNeedNoNewApproval:true},
    evidencePolicy:{reuseBuildOrNativePass:false,onlyActuallyObservedSettingsCount:true,plannedMotionIsNotActualCoverage:true,retryPassDoesNotEraseFailure:true,allOriginalFailuresRetained:true,triageNeverAuthorizesRelease:true},
    historyTrust:'Caller-reviewed evidence ledger with source digest and raw evidence ref; this planner does not reverify ledger proof.',nonCompanionCoverage:'Offline selected units are not native UI, actual-login, operating-DB or hardware validation. Observe guarded fixtures and approved aggregates separately; unavailable stays unavailable.'};
}
/** Proposals stay proposals until explicit human approval; deduplicate before ranking. */
export function shortlistIdeas(items,max=3){
  if(!Array.isArray(items)||items.length>200||!Number.isInteger(max)||max<1||max>3)throw Error('invalid-ideas');
  const grouped=new Map();
  for(const x of items){if(!keys(x,['area','problemKey','status','benefit','confidence','implementationCost','tokenCost','maintenanceCost'])||!AREAS.includes(x.area)||typeof x.problemKey!=='string'||!/^[a-z0-9-]{1,80}$/.test(x.problemKey)||!['proposed','approved','implemented','verified','released','rejected'].includes(x.status)||!['benefit','confidence','implementationCost','tokenCost','maintenanceCost'].every(k=>finite(x[k]))||x.confidence>1||x.benefit>10||x.implementationCost+x.tokenCost+x.maintenanceCost<=0)throw Error('invalid-idea-row');
    const key=x.area+':'+x.problemKey;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(x);
  }
  const active=[],candidates=[];for(const[key,rows]of grouped){if(!rows.some(x=>['released','rejected'].includes(x.status))&&rows.some(x=>['approved','implemented','verified'].includes(x.status)))active.push(key);if(rows.some(x=>x.status!=='proposed'))continue;const x=rows[0];candidates.push({...x,key,duplicates:rows.length-1,priority:x.benefit*x.confidence/(x.implementationCost+x.tokenCost+x.maintenanceCost)});}
  candidates.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));return {proposals:candidates.slice(0,max),deferredCount:Math.max(0,candidates.length-max),approvedBacklog:active,implementationSlots:Math.max(0,2-active.length),newProposalsAutomaticallyApproved:false};
}
