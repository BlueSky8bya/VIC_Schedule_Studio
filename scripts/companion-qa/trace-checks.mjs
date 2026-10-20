import { inspectLivingContext } from './living-criteria.mjs';
import { activityProgressTimes, stationaryActivityRepetitions } from './activity-criteria.mjs';
/** Physical wash evidence is measured from the current DOM, never an engine ACK.
 * Keep at most750ms and require500ms of uninterrupted visible, decoded contact.
 * Labels and row9 are corroboration only: a real brush must move relative to the
 * same body, so scrolling the whole room and changing a face cannot qualify. */
function measuredWashProgressTimes(frames) {
  const credited = new Set();
  let window = [], lastMotionAt = -Infinity;
  const rect = value => value && [value.x, value.y, value.width, value.height].every(Number.isFinite) && value.width > 0 && value.height > 0;
  const angleDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  for (const frame of frames) {
    const wash = frame.wash, body = wash?.body, pad = wash?.pad, brush = wash?.brush;
    const valid = frame.visible && frame.decoded && frame.enabled !== false && frame.eligible === true && !frame.blocked && !frame.owned && frame.state === 'play' && frame.platform === 'companion-home-floor-400' && wash?.signaled === true && wash.command === 'wash' && wash.row9 === true && Number.isInteger(frame.pose) && rect(body) && rect(pad) && rect(brush) && pad.visible === true && pad.decoded === true && brush.visible === true && Number.isFinite(brush.angle) && [frame.at, frame.x, frame.y].every(Number.isFinite) && Math.abs(frame.x - body.x - body.width / 2) <= .5 && Math.abs(frame.y - body.y - body.height) <= .5 && Math.abs(frame.x - pad.x - pad.width / 2) <= 2.5 && Math.abs(frame.y - pad.y - pad.height * .72) <= 2.5 && brush.x < body.x + body.width && brush.x + brush.width > body.x && brush.y < body.y + body.height && brush.y + brush.height > body.y;
    if (!valid) { window = []; lastMotionAt = -Infinity; continue; }
    const sample = { at: frame.at, pose: frame.pose, x: brush.x + brush.width / 2 - frame.x, y: brush.y + brush.height / 2 - frame.y, angle: brush.angle };
    const previous = window.at(-1);
    if (previous && (sample.at <= previous.at || sample.at - previous.at > 250)) { window = []; lastMotionAt = -Infinity; }
    else if (previous && (Math.hypot(sample.x - previous.x, sample.y - previous.y) >= .5 || angleDelta(sample.angle, previous.angle) >= 2)) lastMotionAt = sample.at;
    window.push(sample); window = window.filter(item => sample.at - item.at <= 750);
    const relativeTravel = Math.max(...window.map(item => Math.hypot(sample.x - item.x, sample.y - item.y)));
    const rotation = Math.max(...window.map(item => angleDelta(sample.angle, item.angle)));
    if (window.length >= 4 && sample.at - window[0].at >= 500 && sample.at - lastMotionAt <= 150 && new Set(window.map(item => item.pose)).size >= 2 && (relativeTravel >= 2 || rotation >= 4)) credited.add(sample.at);
  }
  return credited;
}

/** Candidate only: four measured transfers revisit exactly two settled points
 * in thirty seconds without a real object/control/care or human context change.
 * Old traces lack input/layout epochs; report that limitation, never invent it. */
export function ordinaryRouteOscillations(frames, { legacyAudit = false } = {}) {
  let path = [], travel = [], resting = [], context, anchor;
  const findings = [], washing = measuredWashProgressTimes(frames);
  const moving = frame => ['walk', 'jump'].includes(frame.state);
  const same = (a, b, tolerance = 4) => a.platform === b.platform && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
  const reset = () => { path = []; travel = []; resting = []; context = undefined; anchor = undefined; };
  let previous;
  for (const frame of frames) {
    const body = frame.wash?.body, pad = frame.wash?.pad;
    const rawAnchor = body && pad ? [body.width, body.height, pad.x, pad.y, pad.width, pad.height] : null;
    const contextObserved = ['ordinary','explore'].includes(frame.lifePurpose) && [frame.humanEpoch, frame.layoutEpoch].every(value => Number.isSafeInteger(value) && value >= 0);
    const valid = (contextObserved || legacyAudit && frame.lifePurpose === undefined) && frame.visible === true && frame.decoded === true && frame.enabled !== false && frame.roam !== false
      && frame.eligible === true && !frame.blocked && !frame.owned && !frame.scene && !frame.goal && !frame.carried
      && !(moving(frame) && frame.lifePurpose === 'explore') && !['sleep', 'eat', 'held', 'placing'].includes(frame.state) && !washing.has(frame.at)
      && [frame.at, frame.x, frame.y, frame.pose].every(Number.isFinite) && Boolean(frame.platform)
      && typeof frame.items === 'string' && typeof frame.controls === 'string';
    if (!valid || previous && (frame.at <= previous.at || frame.at - previous.at > 250)) {
      reset(); previous = frame; continue;
    }
    const key = JSON.stringify([frame.items, frame.controls, frame.goal ?? '', frame.humanEpoch ?? null, frame.layoutEpoch ?? null]);
    if (context !== undefined && context !== key || anchor && rawAnchor && rawAnchor.some((value, index) => Math.abs(value - anchor[index]) > 1)) reset();
    context = key; anchor ??= rawAnchor;
    if (moving(frame)) {
      resting = [];
      if (path.length) travel.push(frame);
    } else {
      if (resting.length && !same(resting[0], frame, 2)) resting = [];
      resting.push(frame);
      if (resting.length >= 3 && frame.at - resting[0].at >= 150) {
        const settled = { at: resting[0].at, confirmedAt: frame.at, x: frame.x, y: frame.y, platform: frame.platform };
        const from = path.at(-1);
        if (!from) path.push(settled);
        else if (!same(from, settled)) {
          const traversed = travel.length >= 3 && travel.at(-1).at - travel[0].at >= 100 && new Set(travel.map(item => item.pose)).size >= 2
            && Math.hypot(settled.x - from.x, settled.y - from.y) >= 8;
          path = traversed ? [...path, settled] : [settled];
          path = path.filter(point => settled.at - point.at <= 30000).slice(-5);
          if (path.length === 5 && same(path[0], path[2]) && same(path[0], path[4]) && same(path[1], path[3]) && !same(path[0], path[1])) {
            findings.push({ rule: 'ordinary-two-point-route-oscillation', at: frame.at, severity: 'candidate',
              detail: 'Four decoded physical transfers repeatedly visit the same two measured settled points within30s without object/control/care progress. ' +
                (contextObserved ? 'Actual ordinary purpose and trusted-input/layout epochs remained observed.' : 'Legacy trace: life-purpose/human-input/layout epochs were not recorded; absence of those events is unproved.'),
              evidence: { from: path[0].at, to: settled.at, transitions: 4, reversals: 3, inputContextObserved: contextObserved, points: path } });
            return findings;
          }
        }
        travel = [];
      }
    }
    previous = frame;
  }
  return findings;
}

/** Short native stops do not erase a physically completed ordinary walk.
 * Four proven alternating legs between two fixed points are a local QA
 * candidate, never permission to cancel or override an actual engine goal. */
export function ordinaryWalkPacing(frames, { legacyWalkPoses } = {}) {
  const findings = [], washing = measuredWashProgressTimes(frames), registered = new Set(legacyWalkPoses ?? []);
  let previous, context, anchor, leg, history = [];
  const point = frame => ({ at: frame.at, x: frame.x, y: frame.y, platform: frame.platform });
  const same = (a, b) => a.platform === b.platform && Math.hypot(a.x - b.x, a.y - b.y) <= 4;
  const clear = () => { previous = undefined; context = undefined; anchor = undefined; leg = undefined; history = []; };
  const finish = frame => {
    if (!leg) return;
    const end = point(frame), distance = Math.abs(end.x - leg.from.x);
    const firstSource = leg.samples[0], lastSource = leg.samples.at(-1);
    const registeredDistance = firstSource && lastSource ? (lastSource.x - firstSource.x) * leg.direction : 0;
    if (leg.samples.length >= 3 && leg.samples.at(-1).at - leg.samples[0].at >= 100 && leg.poses.size >= 2
      && distance >= 24 && registeredDistance >= 24 && Math.abs(end.y - leg.from.y) <= 2 && Math.sign(end.x - leg.from.x) === leg.direction) {
      const completed = { from: leg.from, to: end, direction: leg.direction, distance, registeredDistance, frames: leg.samples.length,
        poses: leg.poses.size, firstMotion: leg.samples[0].at, lastMotion: leg.samples.at(-1).at };
      if (history.length && (!same(history.at(-1).to, completed.from) || history.at(-1).direction === completed.direction)) history = [];
      history.push(completed); history = history.filter(value => completed.to.at - value.from.at <= 30000).slice(-4);
      if (history.length === 4 && same(history[0].from, history[1].to) && same(history[0].from, history[2].from)
        && same(history[0].from, history[3].to) && same(history[0].to, history[1].from)
        && same(history[0].to, history[2].to) && same(history[0].to, history[3].from)) {
        findings.push({ rule: 'ordinary-walk-pacing', at: frame.at, severity: 'candidate',
          detail: 'Four actual ordinary horizontal walks and three reversals revisit the same two points within30s without measured object/control/care/input/layout progress; no engine goal is changed.',
          evidence: { legs: history, ordinaryMotionOnly: true, shortStopsAllowed: true, legacySourceAudit: Boolean(legacyWalkPoses) } });
      }
    } else history = [];
    leg = undefined;
  };
  for (const frame of frames) {
    const valid = frame.visible === true && frame.decoded === true && frame.enabled !== false && frame.roam !== false && frame.eligible === true
      && !frame.blocked && !frame.owned && !frame.scene && !frame.goal && !frame.carried && ['ordinary','explore'].includes(frame.lifePurpose)
      && !['sleep','eat','held','placing','jump'].includes(frame.state) && !washing.has(frame.at)
      && [frame.at,frame.x,frame.y,frame.pose].every(Number.isFinite) && Boolean(frame.platform)
      && [frame.humanEpoch,frame.layoutEpoch].every(value => Number.isSafeInteger(value) && value >= 0)
      && typeof frame.items === 'string' && typeof frame.controls === 'string';
    if (!valid) { clear(); continue; }
    const key = JSON.stringify([frame.platform,frame.items,frame.controls,frame.goal ?? '',frame.humanEpoch,frame.layoutEpoch]);
    const body = frame.wash?.body, pad = frame.wash?.pad;
    const physical = body && pad ? [body.width,body.height,pad.x,pad.y,pad.width,pad.height] : undefined;
    if (context !== undefined && context !== key || anchor && physical && physical.some((value,index)=>Math.abs(value-anchor[index])>1)
      || previous && (frame.at <= previous.at || frame.at-previous.at>250 || Math.abs(frame.y-previous.y)>2
        || Math.hypot(frame.x-previous.x,frame.y-previous.y)>(frame.at-previous.at)*.5+1)
      || leg && Math.abs(frame.y-leg.from.y)>2) clear();
    context=key;anchor??=physical;
    if (frame.state === 'walk') {
      // An actual retained explore move is outside the ordinary-motion scope.
      // Its preceding idle/look label alone must not erase a completed leg.
      if (frame.lifePurpose !== 'ordinary') { clear(); continue; }
      if (previous) {
        const dx=frame.x-previous.x, direction=Math.abs(dx)>=.25 ? Math.sign(dx) : leg?.direction;
        if (direction) {
          if (leg && direction!==leg.direction) finish(previous);
          leg??={from:point(previous),direction,samples:[],poses:new Set()};
          const source=frame.walkSource === true || legacyWalkPoses && frame.sourceClipMeasured === true && registered.has(frame.pose);
          if (source) {leg.samples.push(frame);leg.poses.add(frame.pose);}
        }
      }
    } else if (leg) finish(frame);
    if (findings.length) return findings;
    previous=frame;
  }
  return findings;
}

/** Missing observation context cannot silently make a daily run pass. */
export function traceContextComplete(frames) {
  const observed = frames.filter(frame => frame.visible && frame.decoded);
  return observed.length > 0 && observed.every(frame => ['ordinary', 'explore', 'food', 'toy', 'care', 'social', 'authored'].includes(frame.lifePurpose)
    && [frame.humanEpoch, frame.layoutEpoch].every(value => Number.isSafeInteger(value) && value >= 0) && typeof frame.walkSource === 'boolean' && frame.activity && typeof frame.activity.source === 'boolean'
    && typeof frame.activity.manual === 'boolean' && Number.isSafeInteger(frame.activity.epoch) && frame.activity.epoch >= 0
    && typeof frame.activity.jumpAllowed === 'boolean' && typeof frame.activity.action === 'string' && typeof frame.activity.context === 'string'
    && [frame.activity.width,frame.activity.height].every(value=>Number.isFinite(value)&&value>0)
    && frame.activity.anchor && [frame.activity.anchor.x,frame.activity.anchor.y,frame.activity.anchor.width,frame.activity.anchor.height].every(Number.isFinite));
}

/** Read-only evidence classifier. A candidate is never an automatic art verdict. */
export function inspectTrace(frames) {
  const washProgress = measuredWashProgressTimes(frames);
  const activity = activityProgressTimes(frames);
  const living = inspectLivingContext(frames);
  const findings = [...stationaryActivityRepetitions(frames,{progressTimes:washProgress}), ...ordinaryRouteOscillations(frames), ...ordinaryWalkPacing(frames), ...living.findings], active = frames.filter(f => f.visible && f.decoded && f.enabled !== false && !f.blocked && !f.owned && !['sleep', 'held', 'placing'].includes(f.state));
  let checkpoint, prior, targetHistory = [], repeated = 0;
  const flag = (rule, frame, detail) => { if (!findings.some(f => f.rule === rule)) findings.push({ rule, at: frame.at, severity: 'candidate', detail }); };
  for (const frame of active) {
    if (![frame.at, frame.x, frame.y].every(Number.isFinite)) { flag('nonfinite-body', frame, 'Nonfinite measured body'); continue; }
    if (prior && (frame.at - prior.at > 500 || frame.at <= prior.at)) { checkpoint = undefined; targetHistory = []; repeated = 0; }
    checkpoint ??= frame;
    // A changed face/pose/scene label is not an accomplished action. Keep the
    // checkpoint until real travel, object ownership/count, or a painted home
    // control changes; otherwise a looping authored beat would evade this rule.
    const meaningful = activity.has(frame.at) || washProgress.has(frame.at) || frame.controls !== checkpoint.controls || frame.carried !== checkpoint.carried || frame.items !== checkpoint.items;
    if (meaningful) checkpoint = frame;
    else if (frame.at - checkpoint.at >= 10000 && frame.roam !== false && frame.eligible) flag('no-visible-progress-10s', frame, 'Ten eligible active seconds without authenticated in-progress movement, a finite authenticated body action, object ownership/count, painted control or independently measured brush/contact progress. Exact landing is separate; labels and endless same-action loops do not qualify');
    if (frame.goal && frame.goal !== prior?.goal) {
      targetHistory = [...targetHistory.filter(item => frame.at - item.at <= 10000), { id: frame.goal, at: frame.at }].slice(-3);
      if (frame.stableFood && targetHistory.length === 3 && targetHistory[0].id === targetHistory[2].id && targetHistory[0].id !== targetHistory[1].id) flag('food-target-thrash', frame, 'A-B-A while the same real foods and support remain stable');
    }
    if (prior && frame.scene && frame.scene === prior.scene && frame.beat === prior.beat && frame.state === 'look') repeated += frame.at - prior.at;
    else repeated = 0;
    if (repeated >= 10000 && frame.eligible) flag('owned-beat-no-progress', frame, 'One owned observation beat did not advance for ten eligible seconds');
    if (frame.nearbyCleanupCandidate && frame.cleanupWaitingMs >= 10000) flag('nearby-cleanup-no-progress-candidate', frame, 'Nearby settled objects and an available box without a pickup or approach; this does not establish a route to the box');
    if (frame.clipError > 2 && !frame.intendedOcclusion) flag('body-clip', frame, 'Measured registered opaque body crosses its explicit clip by more than two pixels');
    if (frame.sleepAllowed === false && frame.state === 'sleep') flag('sleep-off', frame, 'Actual sleep while explicit sleep is OFF');
    prior = frame;
  }
  // OFF/sleep is checked outside the active-progress filter as well.
  for (const frame of frames) if (frame.visible && frame.decoded && frame.sleepAllowed === false && frame.state === 'sleep') flag('sleep-off', frame, 'Actual sleep while explicit sleep is OFF');
  return { frames: frames.length, washProgressFrames: washProgress.size, eligibleFrames: active.filter(frame => frame.eligible === true).length, living, findings, verdict: findings.length ? 'needs-review' : 'no-detector-findings', limitations: ['No detector findings is not human visual approval.', 'Two-point oscillation is a sampled ordinary-life candidate, not an engine route verdict; legacy traces do not prove unrecorded mouse/input/layout inactivity.', 'Nearby cleanup is only a candidate: route availability and four-object return completion require dedicated native proof.', 'Clip checks require explicit current source proof; absent proof is not assumed.', 'A sampled trace is not every compositor frame or every possible sequence.', 'Wash progress requires raw visible pad/body/brush geometry, decoded current row9, continuous500ms contact and fresh body-relative brush motion; labels alone do not qualify. Older traces without these fields remain unchanged and cannot be promoted retroactively.'] };
}

/** Empty, hidden, undecoded or prematurely stopped samples never prove 90s. */
export function traceSufficiency(frames, expectedSeconds = 90) {
  const finite = frames.filter(frame => Number.isFinite(frame.at)), visible = finite.filter(frame => frame.visible), decoded = visible.filter(frame => frame.decoded);
  const elapsed = finite.length > 1 ? finite.at(-1).at - finite[0].at : 0;
  const requiredFrames = Math.ceil(expectedSeconds * 5), requiredVisible = Math.ceil(requiredFrames * .8);
  return { passed: finite.length >= requiredFrames && visible.length >= requiredVisible && decoded.length >= requiredVisible && elapsed >= expectedSeconds * 1000 - 1000,
    frames: finite.length, visibleFrames: visible.length, decodedVisibleFrames: decoded.length, elapsedMs: elapsed, requiredFrames, requiredVisibleFrames: requiredVisible, expectedSeconds };
}
