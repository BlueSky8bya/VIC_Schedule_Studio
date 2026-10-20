/** Sampled daily candidates and positive witnesses, never runtime policy. */
export const LIVING_NEGATIVES = Object.freeze(['awake-confined-home','voluntary-audience-inside-home','repeated-sofa-reset','no-visible-progress-10s','stationary-action-repetition','ordinary-walk-pacing','ordinary-two-point-route-oscillation','food-target-thrash','nearby-cleanup-no-progress-candidate','body-clip','sleep-off']);
export const LIVING_POSITIVES = Object.freeze(['decoded-outside-walk','decoded-outside-jump','actual-object-care-progress','private-rest','outside-audience','direct-pet-response','private-toy-play']);
const home = id => /^companion-home(?:$|-)/.test(id ?? '');
export function traceLivingContextComplete(frames) {
  const observed=frames.filter(frame=>frame.visible&&frame.decoded);
  const personalities=new Set(['performer','curious','affectionate','sleepy','tidy','mischievous','gourmet','homebody','balanced']);
  return observed.length>0&&observed.every(frame=>personalities.has(frame.personality)&&[frame.hunger,frame.energy].every(n=>Number.isFinite(n)&&n>=0&&n<=1)
    && typeof frame.outsideVisible==='boolean'&&typeof frame.jumpSource==='boolean'&&typeof frame.play==='string'&&typeof frame.command==='string'
    && ['matching','other','unmeasured'].includes(frame.playPaint));
}
/** Private toy play requires physical same-ID ownership, not a purpose label.
 * Missing old measurements never earn this exception or retrospective credit.
 * After an observed same-object release its visible nearby tail is at most600ms. */
export function measuredPersonalToyPlay(frames) {
  const witnesses=[];
  let owner, previous;
  const rect = value=>value && [value.x,value.y,value.width,value.height].every(Number.isFinite) && value.width>0 && value.height>0;
  const nearby = (body,toy)=>Math.hypot(Math.max(body.x-toy.x-toy.width,toy.x-body.x-body.width,0),Math.max(body.y-toy.y-toy.height,toy.y-body.y-body.height,0))<=Math.min(12,Math.min(body.width,body.height)*.15);
  const actual = (frame,toy,body)=>rect(body)&&rect(toy.rect)&&rect(toy.imageRect)&&toy.visible===true&&toy.decoded===true&&!toy.held
    && Math.abs(frame.x-body.x-body.width/2)<=.5 && Math.abs(frame.y-body.y-body.height)<=.5 && nearby(body,toy.rect)&&nearby(body,toy.imageRect);
  for(const frame of frames) {
    const context=frame.toyPlay, ids=new Set((frame.carried??'').split(',').filter(Boolean));
    const valid=frame.visible&&frame.decoded&&frame.eligible===true&&!frame.blocked&&!frame.owned&&frame.enabled!==false&&frame.roam!==false
      && [frame.at,frame.x,frame.y].every(Number.isFinite) && [frame.humanEpoch,frame.layoutEpoch].every(value=>Number.isSafeInteger(value)&&value>=0)
      && context&&Array.isArray(context.toys)&&rect(context.body);
    if(!valid || previous && (frame.at<=previous.at||frame.at-previous.at>250||frame.humanEpoch!==previous.humanEpoch||frame.layoutEpoch!==previous.layoutEpoch||frame.platform!==previous.platform))owner=undefined;
    if(!valid){previous=frame;continue;}
    const carried=ids.size===1 && context.toys.slice(0,4).find(toy=>toy.id&&toy.carried===true&&ids.has(toy.id)&&actual(frame,toy,context.body));
    if(carried) {
      if(!owner||owner.id!==carried.id||owner.releasedAt!==undefined)owner={id:carried.id,firstAt:frame.at,samples:0};
      owner.samples++;owner.lastCarriedAt=frame.at;
    } else if(owner) {
      const released=context.toys.slice(0,4).find(toy=>toy.id===owner.id&&toy.carried===false&&!ids.has(toy.id)&&actual(frame,toy,context.body));
      if(!released||ids.size||owner.samples<2||owner.lastCarriedAt-owner.firstAt<40)owner=undefined;
      else {owner.releasedAt??=frame.at;if(frame.at-owner.releasedAt>600)owner=undefined;}
    }
    if(owner && owner.samples>=2 && owner.lastCarriedAt-owner.firstAt>=40 && frame.state==='play'&&frame.play==='lean-nuzzle'&&frame.command!=='cheer'&&context.source===true)
      witnesses.push({at:frame.at,toyId:owner.id,phase:owner.releasedAt===undefined?'carried':'released-tail'});
    previous=frame;
  }
  return witnesses;
}
export function inspectLivingContext(frames) {
  const findings = [], positives = new Map(), personalToy = new Set(measuredPersonalToyPlay(frames).map(witness=>witness.at));
  let confined, prior, lastPet = -Infinity, sofaVisits = [], enteredSofa = false;
  const flag = (rule, frame, detail) => { if (!findings.some(row => row.rule === rule)) findings.push({rule,at:frame.at,severity:'candidate',detail}); };
  const witness = (name, frame) => { if (!positives.has(name)) positives.set(name,{rule:name,firstAt:frame.at,samples:0});positives.get(name).samples++; };
  for (const frame of frames) {
    const measured = frame.visible && frame.decoded && frame.enabled !== false && [frame.at,frame.x,frame.y].every(Number.isFinite);
    if (!measured || prior && (frame.at<=prior.at || frame.at-prior.at>250)) { confined=undefined;prior=undefined;sofaVisits=[];enteredSofa=false;continue; }
    if (frame.state==='petted') lastPet=frame.at;
    const privateHome=home(frame.platform),direct=frame.at-lastPet<=10000;
    const eligible=frame.eligible===true && !frame.blocked && !frame.owned && frame.roam!==false;
    const careMeasured=Number.isFinite(frame.hunger)&&Number.isFinite(frame.energy);
    const urgent=!careMeasured || frame.hunger>=.78 || frame.energy<=.18;
    const ordinaryAwake=eligible && careMeasured && !urgent && !['sleep','eat','held','placing'].includes(frame.state) && frame.command!=='wash';
    if (ordinaryAwake && privateHome && frame.outsideVisible===true && !['homebody','sleepy'].includes(frame.personality) && !direct) {
      confined??=frame.at;
      if(frame.at-confined>=(frame.personality==='curious'?35000:60000))flag('awake-confined-home',frame,'An awake non-homebody remained inside through visible calendar opportunities. This candidate alone does not prove a safe route.');
    } else confined=undefined;
    // Explicit invitations/cheers retain their original strict criterion.
    // Only a lean label with a proved different painted row is distinguished
    // from an actually painted lean. Missing/unmeasured remains fail closed.
    const explicitAudience=['cheer-rehearsal','ask-petting'].includes(frame.play)||frame.command==='cheer';
    const audience=explicitAudience||frame.play==='lean-nuzzle'&&frame.playPaint!=='other';
    if(eligible && privateHome && audience && !direct && !personalToy.has(frame.at))flag('voluntary-audience-inside-home',frame,'User-directed cheering/invitation is painted inside the private room without a recent actual touch; approach outside first.');
    if(personalToy.has(frame.at))witness('private-toy-play',frame);
    if(eligible && !privateHome && audience && frame.playPaint==='matching')witness('outside-audience',frame);
    if(direct && frame.play)witness('direct-pet-response',frame);
    if(privateHome && ['sleep','eat'].includes(frame.state))witness('private-rest',frame);
    if(eligible && !privateHome && prior && prior.platform===frame.platform && Math.hypot(frame.x-prior.x,frame.y-prior.y)>=.5){
      if(frame.state==='walk' && frame.walkSource===true)witness('decoded-outside-walk',frame);
      if(frame.state==='jump' && frame.jumpSource===true)witness('decoded-outside-jump',frame);
    }
    if(prior && (frame.items!==prior.items||frame.carried!==prior.carried||frame.controls!==prior.controls))witness('actual-object-care-progress',frame);
    const onSofa=frame.platform==='companion-home';
    if(ordinaryAwake && !['homebody','sleepy'].includes(frame.personality) && onSofa && !enteredSofa && !direct && !['watch','nap','sleep'].includes(frame.command)){
      sofaVisits.push(frame.at);sofaVisits=sofaVisits.filter(at=>frame.at-at<=45000);
      if(sofaVisits.length>=3)flag('repeated-sofa-reset',frame,'Three returns to the sofa in45s between awake activities without a declared TV/rest command. Review the full journey rather than crediting each reset as progress.');
    }
    enteredSofa=onSofa;prior=frame;
  }
  return {findings,positiveWitnesses:[...positives.values()],negativeCriteria:LIVING_NEGATIVES,positiveCriteria:LIVING_POSITIVES,limitation:'Sampled candidates only; no safe route, human enjoyment, exhaustive motion or art approval is inferred.'};
}
