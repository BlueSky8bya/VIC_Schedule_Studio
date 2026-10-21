/** Read-only sofa observation contracts. DOM phases produce candidates only;
 * original same-case native pixels and three non-author reviews judge paint. */
export const SOFA_SCROLL_143_TITLE = '143 studio sofa stays aligned beside the editor and independent controls';
export const SOFA_SCROLL_156_SOURCES = Object.freeze([
  'tests/visual/companion-living-143.spec.ts',
  'scripts/companion-qa/sofa-render-156.mjs',
  'components/poster/viewer-companion/viewer-companion.tsx',
  'components/poster/viewer-companion/viewer-companion.css',
]);
export const SOFA_SCROLL_156_PAINTS = Object.freeze(['sofa143-paint-before','sofa143-paint-down','sofa143-paint-up']);
const phases = Object.freeze(['scroll', 'frame', 'post-render']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const array = value => Array.isArray(value) ? value : [];
const clean = value => Array.isArray(value) && value.length === 0;
const positive = rect => Boolean(rect && ['x','y','width','height'].every(key => Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0);
const span = values => values.length ? Math.max(...values) - Math.min(...values) : 0;
const contains = (rect, x, y) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
const localPath = value => typeof value === 'string' && value.length > 0 && value.length < 600 && !/[\\:\0]/.test(value)
  && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');
const bound = ref => Boolean(ref && localPath(ref.path) && hash(ref.sha256));
const sameRef = (a, b) => bound(a) && bound(b) && a.path === b.path && a.sha256 === b.sha256;
const surface = frame => positive(frame.room) && positive(frame.home) && positive(frame.bed) && positive(frame.cushion)
  && Number.isFinite(frame.homeScroll) && frame.homeScroll >= 0 && Array.isArray(frame.viewport) && frame.viewport.length === 2
  && frame.viewport.every(value => Number.isFinite(value) && value > 0);

/** Full unfiltered probe history is required. Sequence gaps, truncated capture,
 * invalid surfaces, disappearing carriers and changed support fail admission.
 * Every >=1px coordinate candidate remains in the output, including a single
 * aggregate body-relative span with both exact extremal source samples. */
export function analyzeSofaScroll143(raw) {
  const issues = [], add = code => { if (!issues.includes(code)) issues.push(code); };
  const frames = array(raw?.frames), window = raw?.observationWindow;
  if (!Array.isArray(raw?.frames) || frames.length < 1 || frames.length > 24000 || raw?.probeOverflow !== false
    || raw?.probeStopped !== true || raw?.totalCapturedFrames !== frames.length) add('capture-history');
  if (frames.some((frame, index) => frame?.sequence !== index || !phases.includes(frame?.phase) || !Number.isFinite(frame?.at)
    || index > 0 && frame.at < frames[index - 1]?.at)) add('capture-sequence');
  if (!window || !Number.isFinite(window.began) || !Number.isFinite(window.ended) || window.ended <= window.began
    || window.ended - window.began > 100000) add('observation-window');
  const observed = window && Number.isFinite(window.began) && Number.isFinite(window.ended)
    ? frames.filter(frame => frame && frame.at >= window.began && frame.at <= window.ended) : [];
  const dimensions = raw?.dimensions;
  if (!dimensions || !Number.isFinite(dimensions.client) || dimensions.client <= 0 || !Number.isFinite(dimensions.full)
    || dimensions.full - dimensions.client <= 5 || !['auto','scroll'].includes(dimensions.overflow)) add('actual-overflow');
  const missingSurface = observed.filter(frame => !surface(frame)).length;
  if (missingSurface || !observed.length) add('missing-surface');
  const eligible = observed.filter(frame => {
    if (!surface(frame)) return false;
    const x = frame.cushion.x + frame.cushion.width / 2, y = frame.cushion.y + frame.cushion.height / 2;
    return x >= 0 && x <= frame.viewport[0] && y >= 0 && y <= frame.viewport[1]
      && contains(frame.room, x, y) && contains(frame.home, x, y);
  });
  const phaseCounts = Object.fromEntries(phases.map(phase => [phase, eligible.filter(frame => frame.phase === phase).length]));
  if (eligible.length <= 10 || phaseCounts.frame <= 10 || phaseCounts['post-render'] <= 10 || phaseCounts.scroll < 2) add('phase-denominator');
  if(eligible.length!==observed.length)add('resident-denominator');
  if (observed.some(frame => !Array.isArray(frame.viewport) || frame.viewport[0] !== 1920 || frame.viewport[1] !== 420)) add('actual-viewport');
  const missingActor = eligible.filter(frame => !positive(frame.pet)).length;
  const hiddenActor = eligible.filter(frame => frame.petHidden !== false || frame.petPainted !== true || frame.decoded !== true).length;
  const missingFront = eligible.filter(frame => !positive(frame.front)).length;
  const hiddenFront = eligible.filter(frame => frame.frontHidden !== false || frame.frontPainted !== true).length;
  const doubleFront = eligible.filter(frame => frame.localFrontVisibility !== 'hidden').length;
  const wrongDepth = eligible.filter(frame => !['seat','back'].includes(frame.depth)).length;
  const wrongSupport = eligible.filter(frame => frame.platform !== 'companion-home').length;
  const wrongStack = eligible.filter(frame => !Number.isFinite(frame.petZ) || !Number.isFinite(frame.frontZ) || frame.frontZ <= frame.petZ).length;
  const nonresident = eligible.filter(frame => frame.nativeActor !== true || frame.nativeFront !== true || !text(frame.state) || ['jump','held'].includes(frame.state)).length;
  if (missingActor || hiddenActor || missingFront || hiddenFront || doubleFront || wrongDepth || wrongSupport || wrongStack || nonresident) add('resident-visibility-owner');
  const visible = eligible.filter(frame => positive(frame.pet) && positive(frame.front) && frame.petHidden === false
    && frame.frontHidden === false && frame.petPainted === true && frame.frontPainted === true && frame.decoded === true);
  if (visible.length <= 10) add('visible-denominator');
  const scrollSpan = span(eligible.map(frame => frame.homeScroll)), bedSpan = span(eligible.map(frame => frame.bed.y));
  const directions = eligible.slice(1).flatMap((frame, index) => Math.abs(frame.homeScroll - eligible[index].homeScroll) > .01
    ? [Math.sign(frame.homeScroll - eligible[index].homeScroll)] : []);
  if (scrollSpan <= 5 || bedSpan <= 5 || !directions.includes(1) || !directions.includes(-1)) add('actual-wheel-reversal');
  const candidates = [];
  for (const frame of visible) {
    const dx = frame.front.x - frame.bed.x, dy = frame.front.y - frame.bed.y;
    const sizeError = Math.max(Math.abs(frame.front.width - frame.bed.width), Math.abs(frame.front.height - frame.bed.height));
    if (Math.hypot(dx, dy) >= 1 || sizeError >= 1) candidates.push({ kind: 'front-geometry', phase: frame.phase,
      at: frame.at, sequence: frame.sequence, dx, dy, sizeError });
  }
  const feet = visible.map(frame => ({ at: frame.at, phase: frame.phase, sequence: frame.sequence,
    value: frame.pet.y + frame.pet.height - frame.bed.y }));
  const minimum = feet.reduce((best, item) => !best || item.value < best.value ? item : best, undefined);
  const maximum = feet.reduce((best, item) => !best || item.value > best.value ? item : best, undefined);
  const footRelativeSpan = minimum && maximum ? maximum.value - minimum.value : 0;
  if (footRelativeSpan >= 1) candidates.push({ kind: 'body-relative-span', phase: 'all-phases', span: footRelativeSpan, minimum, maximum });
  return { admissionPassed: issues.length === 0, issues, candidates,
    summary: { began: window?.began, ended: window?.ended, totalFrames: observed.length, eligible: eligible.length, missingSurface,
      missingActor, hiddenActor, missingFront, hiddenFront, samples: visible.length, phaseCounts, scrollSpan, bedSpan, footRelativeSpan,
      maxOffset: Math.max(0, ...visible.map(frame => Math.hypot(frame.front.x-frame.bed.x, frame.front.y-frame.bed.y))),
      maxSize: Math.max(0, ...visible.map(frame => Math.max(Math.abs(frame.front.width-frame.bed.width),Math.abs(frame.front.height-frame.bed.height)))),
      doubleFront, wrongDepth, wrongSupport, wrongStack, nonresident } };
}

/** Always require three painted assessments for this exact resident case,
 * including a no-DOM-candidate run. Labels, timers, model traces, a different
 * case's screenshot or resized media do not certify a <1CSSpx painted result. */
export function evaluateSofaRendered143({ report, source, evidence, reviews, casePresent }) {
  const issues = [], add = code => { if (!issues.includes(code)) issues.push(code); };
  if (casePresent !== true || !evidence || evidence.caseTitle !== SOFA_SCROLL_143_TITLE || evidence.attachmentBound !== true || !bound(evidence)) {
    add('sofa143-exact-case-or-attachment'); return { passed: false, issues };
  }
  const raw = evidence.document, analysis = analyzeSofaScroll143(raw);
  const sourceEntries = array(raw?.sourceFiles), expected = array(source?.sourceFiles);
  const sourceBound = sourceEntries.length === SOFA_SCROLL_156_SOURCES.length && new Set(sourceEntries.map(entry => entry?.path)).size === sourceEntries.length
    && SOFA_SCROLL_156_SOURCES.every(path => {
      const entry = sourceEntries.find(item => item?.path === path);
      return entry && hash(entry.sha256) && expected.some(item => item?.path === path && item.sha256 === entry.sha256);
    });
  if (!raw || raw.schemaVersion !== 1 || raw.kind !== 'companion-sofa-scroll-156' || raw.caseTitle !== evidence.caseTitle
    || raw.build !== report?.buildId || raw.buildId !== report?.buildId || raw.sourceDigest !== report?.sourceDigest || !sourceBound
    || raw.status !== 'passed' || raw.admissionStatus !== 'passed' || !clean(raw.errors) || !clean(raw.rejected)
    || raw.renderThresholdCssPx !== 1 || raw.deviceScaleFactor !== 1 || raw.videoSize?.width !== 1920 || raw.videoSize?.height !== 850
    || !Array.isArray(raw.chunks) || raw.chunks.length < 1 || !raw.chunks.every(chunk => hash(chunk?.served) && chunk.served === chunk.local)
    || !analysis.admissionPassed || JSON.stringify(raw.renderCandidates) !== JSON.stringify(analysis.candidates)
    || JSON.stringify(raw.measurement) !== JSON.stringify(analysis.summary)
    || raw.renderedStatus !== (analysis.candidates.length ? 'needs_render_review' : 'no_candidate_observed')) add('sofa143-raw-unproved');
  const samples=array(raw?.paintSamples),pngs=array(evidence.paintAttachments).filter(attachment=>attachment?.kind==='png');
  if(!raw?.observationWindow||samples.length!==SOFA_SCROLL_156_PAINTS.length||new Set(samples.map(sample=>sample?.name)).size!==samples.length
    ||pngs.length!==SOFA_SCROLL_156_PAINTS.length||!SOFA_SCROLL_156_PAINTS.every(name=>{
      const sample=samples.find(value=>value?.name===name),png=pngs.find(value=>value?.name===name);
      return sample&&png&&png.attachmentBound===true&&hash(sample.sha256)&&sample.sha256===png.sha256
        &&png.pixelWidth===1920&&png.pixelHeight===420&&sample.pixelWidth===1920&&sample.pixelHeight===420
        &&Number.isFinite(sample.beforeAt)&&Number.isFinite(sample.afterAt)&&sample.afterAt>=sample.beforeAt
        &&sample.beforeAt>=raw.observationWindow.began&&sample.afterAt<=raw.observationWindow.ended;
    }))add('sofa143-original-paints-unproved');
  if (!Array.isArray(reviews) || reviews.length !== 3) add('sofa143-three-rendered-assessments');
  for (const review of array(reviews)) {
    const assessments = array(review?.document?.sofaRenderedAssessments);
    const assessment = assessments[0];
    if (assessments.length !== 1 || assessment?.caseTitle !== evidence.caseTitle || assessment.buildId !== report?.buildId
      || !sameRef(assessment.rawAttachment, evidence)) { add('sofa143-three-rendered-assessments'); continue; }
    const paints = array(assessment.paintEvidence), expectedState = analysis.candidates.length ? 'prepaint_observation' : 'no_failure_observed';
    const trace=paints.find(paint=>paint?.kind==='trace'),video=paints.find(paint=>paint?.kind==='video');
    const tracePngs=array(trace?.embeddedPngs);
    const downInspected=paints.some(paint=>paint?.kind==='png'&&pngs.some(png=>png.name==='sofa143-paint-down'&&sameRef(png,paint)));
    if (assessment.state !== expectedState || assessment.candidateCount !== analysis.candidates.length || assessment.missing !== 0
      || !text(assessment.reason) || !['maxRelativeErrorCssPx','maxFrontErrorCssPx','maxSizeErrorCssPx','bodyRelativeSpanCssPx'].every(key =>
        Number.isFinite(assessment[key]) && assessment[key] >= 0 && assessment[key] < 1)
      || !['trace','video'].every(kind => paints.some(paint => paint?.kind === kind)) || paints.length > 12
      || paints.filter(paint=>paint?.kind==='png').length<2||!downInspected
      ||tracePngs.length<2||tracePngs.length>3||new Set(tracePngs.map(png=>png?.name)).size!==tracePngs.length
      ||!tracePngs.some(png=>png?.name==='sofa143-paint-down')
      ||tracePngs.some(png=>!samples.some(sample=>sample?.name===png?.name&&sample?.sha256===png?.sha256))
      ||video?.pixelWidth!==1920||video?.pixelHeight!==850
      || new Set(paints.map(paint => paint?.path)).size !== paints.length
      || paints.some(paint => !['trace','video','png'].includes(paint?.kind) || paint.pixelScale !== 1
        || !Number.isSafeInteger(paint.sampleCount) || paint.sampleCount < (paint.kind==='png'?1:2)
        || !array(evidence.paintAttachments).some(original => original.attachmentBound === true && original.kind === paint.kind && sameRef(original, paint))))
      add('sofa143-rendered-unproved');
  }
  return { passed: issues.length === 0, issues };
}
