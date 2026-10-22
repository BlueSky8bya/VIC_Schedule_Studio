/** Opt-in, memory-only lamp diagnostics. No network, storage enumeration or
 * identity/schedule/collection/learned-memory reads. Never owns actor state. */
const numbers = new Set(['at','serial','progress','duration','x','y','displayY','handX','handY','handDOMX','handDOMY','actorWidth','actorHeight','knobX','knobY','knobWidth','knobHeight','paintHeight','paintWidth','paintCssWidth','buttonHeight','pull','feedbackOpacity','baselineAt','baselineHeight','baselineWidth','baselineCssWidth','neutralAt','receiptAt','contactAge','viewportWidth','viewportHeight','dpr','viewportScale','textPx','weight','roomWidth','roomHeight','homeCount','visibleHomeCount']);
const booleans = new Set(['lit','wantedLit','prepared','paintedCurrent','reachTouch','touching','witness','canLight','active','visible','sourceMatches','samePlane','feedbackVisible','baseline','effectApplied','effectSucceeded','authoredApplied','enabled','roam','jump','sleep','petting','learnFromYou','appReduced','reduced','comfort','premiere','ambient','hidden','focused','paused','pressed','keyboardHeld','placing','overlay','workspaceBusy','presenceActive','sameOwner','supported','contactPresent','receiptReady','owned','allowed']);
const strings: Record<string,ReadonlySet<string>> = {
  stage:new Set(['paint','launch','clear','effect','missing-contact','render']),owner:new Set(['home-life','authored','other']),
  kind:new Set(['play','jump','walk','sleep','look','stretch','idle','other']),
  gfx:new Set(['full','lite','soft','off']),support:new Set(['home-floor','home-other','outside']),
  personality:new Set(['balanced','performer','curious','affectionate','sleepy','tidy','mischievous','gourmet','homebody']),
  speed:new Set(['relaxed','normal','lively']),font:new Set(['base','noto','nanumgothic','plex','gowun','suit','scdream','gmarket','nsround','tmoney','binggrae','cookierun','maple','cafe24air','cafe24','sunflower','myeongjo','gowunbatang','omyu','gangwon','nanumpen']),
};
export function safeLampFacts(input:Readonly<Record<string,unknown>>) {
  const output:Record<string,string|number|boolean>={};
  for(const [key,value]of Object.entries(input)) {
    if(numbers.has(key)&&typeof value==='number'&&Number.isFinite(value))output[key]=Math.round(value*10000)/10000;
    else if(booleans.has(key)&&typeof value==='boolean')output[key]=value;
    else if(typeof value==='string'&&Object.hasOwn(strings,key)&&strings[key].has(value))output[key]=value;
  }
  return output;
}
export function createLampDiagnosticBuffer(context:()=>Readonly<Record<string,unknown>>,revision:string) {
  const frames:ReturnType<typeof safeLampFacts>[]=[];
  return {
    record(facts:Readonly<Record<string,unknown>>) { try { frames.push(safeLampFacts(facts));if(frames.length>720)frames.shift(); } catch { /* Observation must never interrupt the actor. */ } },
    snapshot() { let current={};try { current=safeLampFacts(context()); } catch { /* A failed optional preference read must not affect movement. */ } return { schemaVersion:1,kind:'local-lamp-diagnostic',revision:/^[a-f\d]{40}$/i.test(revision)?revision:'dev',scope:'Lamp-only actual local runtime; preferences unchanged; no upload or account/schedule/learned-memory/collection data',context:current,frames:frames.map(frame=>({...frame})) }; },
  };
}
/** Independent actual CSS-chain projection, after the actor's final write.
 * Diagnostic only; it never supplies coordinates to movement or contact. */
export function measureLampDiagnosticPoint(actor:HTMLElement,sprite:HTMLElement,point:Readonly<{x:number;y:number}>) {
  try {
  if(typeof DOMPoint==='undefined')return;
  const width=parseFloat(getComputedStyle(sprite).width);if(!Number.isFinite(width))return;
  let p=new DOMPoint(point.x/80*width,point.y/80*width);
  for(let node:HTMLElement|null=sprite;node&&node!==actor;node=node.parentElement) {
    const css=getComputedStyle(node),origin=css.transformOrigin.split(' ').map(Number.parseFloat),matrix=new DOMMatrixReadOnly(css.transform);
    p=matrix.transformPoint(new DOMPoint(p.x-origin[0],p.y-origin[1]));p=new DOMPoint(p.x+origin[0]+node.offsetLeft,p.y+origin[1]+node.offsetTop);
  }
  const matrix=new DOMMatrixReadOnly(getComputedStyle(actor).transform),box=actor.getBoundingClientRect();
  const corners=[[0,0],[actor.offsetWidth,0],[0,actor.offsetHeight],[actor.offsetWidth,actor.offsetHeight]].map(([x,y])=>matrix.transformPoint(new DOMPoint(x,y)));
  p=matrix.transformPoint(p);return{x:box.left+p.x-Math.min(...corners.map(p=>p.x)),y:box.top+p.y-Math.min(...corners.map(p=>p.y))};
  } catch { return; }
}
export function installLampDiagnostics(context:()=>Readonly<Record<string,unknown>>) {
  try {
  if(typeof window==='undefined'||new URLSearchParams(location.search).get('lampTrace')!=='1')return;
  const buffer=createLampDiagnosticBuffer(context,process.env.APP_COMMIT??'dev');
  const button=document.createElement('button');button.type='button';button.textContent='전등 진단 저장';button.dataset.lampTrace='';button.dataset.activityManual='';button.setAttribute('aria-label','전등 진단 저장');
  Object.assign(button.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483000',padding:'12px 16px',border:'1px solid #75644b',borderRadius:'12px',background:'#fff9e8',color:'#302b23',font:'600 14px system-ui',cursor:'pointer'});
  let exported=false,timer:number|undefined;
  const download=()=>{
    try {
    const file=JSON.stringify(buffer.snapshot(),null,2),link=document.createElement('a'),url=URL.createObjectURL(new Blob([file],{type:'application/json'}));
    link.href=url;link.download=`VIC-lamp-diagnostic-${Date.now()}.json`;link.dataset.activityManual='';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);exported=true;button.textContent='전등 진단 다시 저장';
    } catch { button.textContent='전등 진단 저장 재시도'; }
  };
  const click=(event:MouseEvent)=>{event.stopPropagation();download();};button.addEventListener('click',click);document.body.append(button);
  // One local download after observing a light attempt; manual save remains
  // available if the failure starts later. No repeat background capture job.
  return {...buffer,record(facts:Readonly<Record<string,unknown>>) { buffer.record(facts);if(timer===undefined&&facts.stage==='paint')timer=window.setTimeout(()=>{if(!exported)download();},12000); },dispose(){clearTimeout(timer);button.removeEventListener('click',click);button.remove();}};
  } catch { return; }
}
