/** Local scheduling policy, not a product or release certificate. */
export const AREAS = Object.freeze(['companion','calendar','public','broadcast','insights','privacy','design','platform']);
export const PERSONALITIES = Object.freeze(['performer','curious','affectionate','sleepy','tidy','mischievous','gourmet','homebody','balanced']);
export const ALWAYS_UNITS = Object.freeze(['tests/unit/public-boundary.test.ts','tests/unit/public-dto.test.ts','tests/unit/auth-next-path.test.ts','tests/unit/kst-helpers.test.ts']);
export const AREA_UNITS = Object.freeze({
  companion:['tests/unit/companion-before-bed-rest-157.test.ts','tests/unit/companion-choice-fairness-157.test.ts','tests/unit/companion-tidy-primary-157.test.ts'],
  calendar:['tests/unit/editor-model.test.ts','tests/unit/event-validation.test.ts','tests/unit/event-span.test.ts','tests/unit/calendar-zoom.test.ts'],
  public:['tests/unit/public-request-contract.test.ts','tests/unit/teaser-state-route.test.ts','tests/unit/public-cache-revalidate.test.ts'],
  broadcast:['tests/unit/broadcast-dto.test.ts','tests/unit/broadcast-work-bounds.test.ts','tests/unit/broadcast-start-time.test.ts'],
  insights:['tests/unit/insights-refresh-wiring.test.ts','tests/unit/activity-row-cap.test.ts','tests/unit/perf-sampling.test.ts'],
  privacy:['tests/unit/presence-privacy.test.ts','tests/unit/public-boundary.test.ts','tests/unit/public-dto.test.ts'],
  design:['tests/unit/calendar-zoom.test.ts','tests/unit/companion-wardrobe-selection.test.ts','tests/unit/companion-home-carrier-scroll-157.test.ts'],
  platform:['tests/unit/public-request-contract.test.ts','tests/unit/perf-sampling.test.ts'],
});
export const BASELINE = Object.freeze({
  day:'2026-10-21',lastCompanionFullDay:'2026-10-21',releaseSha:'a9a5dd6cf04476c48f4fd229d3fab554b48aa93e',
  actualNativeCases:200,actualNativeMinutes:35.26,workerMinutes:101.318,workers:3,
  sourceDigest:'54d0e85d60d02d60fd7670a815a2e3da95d6fdddc2356b7bd9d77b36d76898b6',
  statement:'One verified full run is not seven stable days. Non-companion native and live-usage coverage remain unknown.',
});
export const SEQUENCE_CONTRACTS = Object.freeze([
  'rest-prepare-controls-cozy-sleep-next','same-object-pickup-carry-return-remaining-wash-outing',
  'manual-choice-autonomy-refresh','target-approach-contact-effect-next','scroll-resident-sofa-items',
]);
export function dayOrdinal(day){const stamp=typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)?Date.parse(day+'T00:00:00Z'):NaN;if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==day)throw Error('invalid-day');return stamp/86400000;}
export function affectedAreas(files){
  if(!Array.isArray(files)||files.length>10000||files.some(f=>typeof f!=='string'||f.includes('..')||f.includes('\\')||f.startsWith('/')||f.includes(':')))throw Error('invalid-source-list');
  const areas=new Set();let broad=false,companionChanged=false;
  for(const file of files){
    if(/^(?:docs\/|art-src\/|\.scratch-pw\/)/.test(file)||/\.md$/.test(file))continue;
    if(/^(?:scripts\/site-daily\/|tests\/unit\/site-daily-)/.test(file)){areas.add('platform');continue;}
    if(/\.(?:css|scss)$|components\/shared\/|^(?:package(?:-lock)?\.json|tsconfig|next\.config|app\/layout|app\/globals|components\/poster\/public-poster)/.test(file)){AREAS.forEach(a=>areas.add(a));companionChanged=true;broad=true;continue;}
    if(/viewer-companion|companion-|scripts\/companion-qa|app\/visual-fixture\/poster/.test(file)){areas.add('companion');companionChanged=true;}
    else if(/calendar|editor|event|schedule/.test(file))areas.add('calendar');
    else if(/broadcast|vod|soop/.test(file))areas.add('broadcast');
    else if(/insight|activity|perf|visit/.test(file))areas.add('insights');
    else if(/privacy|auth|permission|session/.test(file))areas.add('privacy');
    else if(/public|teaser|premiere|heart/.test(file))areas.add('public');
    else if(/\.(?:css|scss)$|components\/shared\//.test(file)){AREAS.forEach(a=>areas.add(a));companionChanged=true;broad=true;}
    else {AREAS.forEach(a=>areas.add(a));companionChanged=true;broad=true;}
    if(/^(?:package(?:-lock)?\.json|tsconfig|next\.config|app\/layout|app\/globals|components\/poster\/public-poster)/.test(file)){AREAS.forEach(a=>areas.add(a));companionChanged=true;broad=true;}
  }
  return {areas:[...areas],companionChanged,broad,unknownDependencyCoverage:broad};
}
