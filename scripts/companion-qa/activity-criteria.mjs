/** Actual activity and repetition are distinct observations. Exact landing,
 * scene labels, past pixel visits and repeated action names cannot erase a
 * current authenticated physical movement. Adapters retain raw paint evidence. */
const finiteRect = r => r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
const sameRect = (a, b) => ['x', 'y', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) <= 1);
function observed(f) { const a = f.activity; return f.visible === true && f.decoded === true && f.enabled !== false && !f.blocked && !f.owned && a?.source === true && a.manual === false && finiteRect(a.anchor) && [a.width, a.height].every(v => Number.isFinite(v) && v > 0) && Number.isSafeInteger(a.epoch) && a.epoch >= 0 && typeof a.context === 'string' && [f.at, f.x, f.y, f.pose].every(Number.isFinite) && !['sleep', 'held', 'placing'].includes(f.state); }
function coherent(f, p) { const a = f.activity, b = p.activity; return a.epoch === b.epoch && a.context === b.context && sameRect(a.anchor, b.anchor) && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1 && f.at > p.at && f.at - p.at <= 250 && Math.hypot(f.x - p.x, f.y - p.y) <= Math.max(a.width, a.height) * 4 * (f.at - p.at) / 100 + 2; }
export function activityProgressTimes(frames) {
    const credited = new Set();
    let run = [], prior, kindBefore = '', actionStarted = 0;
    for (const f of frames) {
        const a = f.activity, moving = ['walk', 'jump'].includes(f.state), kind = moving ? f.state : a?.action;
        const valid = observed(f) && kind && (!moving || f.roam !== false && a.action === f.state) && (f.state !== 'jump' || a.jumpAllowed === true);
        if (!valid) {
            run = [];
            prior = undefined;
            kindBefore = '';
            continue;
        }
        if (!prior || kind !== kindBefore || !coherent(f, prior))
            run = [];
        if (!run.length)
            actionStarted = f.at;
        run.push(f);
        run = run.filter(v => f.at - v.at <= 1500);
        if (run.length >= 3 && f.at - run[0].at >= 100 && new Set(run.map(v => v.pose)).size >= 2) {
            if (moving) {
                const displaced = Math.max(...run.map(v => Math.hypot(v.x - run[0].x, v.y - run[0].y))) >= 8;
                const vertical = f.state !== 'jump' || Math.max(...run.map(v => v.y)) - Math.min(...run.map(v => v.y)) >= 4;
                const locations = new Set(run.map(v => v.x.toFixed(1) + ':' + v.y.toFixed(1)));
                if (displaced && vertical && locations.size >= 3 && prior && Math.hypot(f.x - prior.x, f.y - prior.y) >= .1)
                    credited.add(f.at);
            }
            else if (f.at - actionStarted <= 1500)
                credited.add(f.at);
        }
        prior = f;
        kindBefore = kind;
    }
    return credited;
}
/** Candidate only. Repeated source actions confined to a small area for10s
 * are reported separately from real movement. Meaningful physical effects,
 * human/layout context, rest and an actual departure reset this observation. */
export function stationaryActivityRepetitions(frames, { progressTimes = new Set() } = {}) {
    let window = [], prior, lastKind = '', bouts = [];
    const findings = [];
    for (const f of frames) {
        const kind = f.activity?.action ?? '';
        if (!observed(f) || f.eligible === false || f.roam === false || progressTimes.has(f.at)) {
            window = [];
            prior = undefined;
            bouts = [];
            lastKind = '';
            continue;
        }
        if (prior && !coherent(f, prior)) {
            window = [];
            bouts = [];
            lastKind = '';
        }
        window.push(f);
        window = window.filter(v => f.at - v.at <= 30000);
        const spanX = Math.max(...window.map(v => v.x)) - Math.min(...window.map(v => v.x)), spanY = Math.max(...window.map(v => v.y)) - Math.min(...window.map(v => v.y));
        if (spanX > 24 || spanY > 24) {
            window = [f];
            bouts = [];
            lastKind = '';
        }
        if (kind && kind !== lastKind)
            bouts.push({ kind, at: f.at });
        bouts = bouts.filter(v => v.at >= window[0].at);
        lastKind = kind;
        const kinds = new Set(bouts.map(v => v.kind));
        const repeatedCycle = [1, 2, 3].some(period => { const tail = bouts.slice(-period * 3); return tail.length === period * 3 && tail.every((v, i) => v.kind === tail[i % period].kind); });
        const changed = prior && (f.pose !== prior.pose || Math.hypot(f.x - prior.x, f.y - prior.y) >= .1);
        if (kind && changed && f.at - window[0].at >= 10000 && new Set(window.map(v => v.pose)).size >= 2
            && (repeatedCycle || kinds.size === 1 && bouts.length === 1 && window.every(v => v.activity.action === kind))) {
            findings.push({ rule: 'stationary-action-repetition', at: f.at, severity: 'candidate', detail: 'At least ten observed seconds confined to a24px area with one continuous action or three repeats of an authenticated action cycle, without measured effect/input/layout progress. Real movement remains recorded; this is a separate repetition candidate.' });
            break;
        }
        prior = f;
    }
    return findings;
}
