#!/usr/bin/env node
// Local QA scratch retention for every worktree's `.scratch-pw`.
// Default is a dry run; `--apply` changes disk. Nothing outside a `.scratch-pw`
// root is touched, links are unlinked and never followed, registered git
// worktrees and in-progress runs are never removed, and any run referenced by
// a live site-daily `state.json` (plus its receipt chain) is kept.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GIB = 2 ** 30, HOUR = 3600000, DAY = 24 * HOUR;
export const DEFAULT_POLICY = Object.freeze({
  activeHours: 3, // anything written this recently may still be in progress
  keepLatestPerFactory: 2, // newest runs of each factory, plus the newest success
  successDays: 3, failureDays: 7, // factory runs (companion-daily, site-daily, site-daily/native)
  featureDays: 14, // other top-level evidence folders (companion-NNN, side-*, qa ...)
  leftoverDays: 1, // unit-test leftovers such as focused-receipt-*
  toolEnvDays: 3, // Python/native tool environments created inside scratch
  budgetBytes: 40 * GIB, // total across every `.scratch-pw`
  minFreeBytes: 60 * GIB, // keep at least this much free on the volume
  startFloorBytes: 30 * GIB, // a factory refuses to start below this after pruning
});
const RUN_ID = /^\d{14}-\d+-[0-9a-f]{8}$/;
const TEXT = new Set(['.json', '.jsonl', '.log', '.txt', '.md', '.html', '.ndjson']);

const isLink = entry => entry.isSymbolicLink();
function unlinkLink(file) { try { fs.unlinkSync(file); } catch { fs.rmdirSync(file); } }

/** Every file under `dir` once per file id (hardlinks counted once), never following links. */
export function walk(dir, visit) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (isLink(entry)) continue;
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}

export function measure(dir, seen = new Set()) {
  let bytes = 0n, newest = 0, files = 0;
  walk(dir, file => {
    const st = fs.statSync(file, { bigint: true, throwIfNoEntry: false });
    if (!st) return;
    newest = Math.max(newest, Number(st.mtimeMs));
    const id = `${st.dev}:${st.ino}`;
    if (seen.has(id)) return;
    seen.add(id); bytes += st.size; files++;
  });
  return { bytes: Number(bytes), newest, files };
}

/** `.scratch-pw` roots of the repository and all of its registered worktrees. */
export function scratchRoots(repoRoot) {
  const worktrees = [path.resolve(repoRoot)];
  try {
    const out = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', windowsHide: true });
    for (const line of out.split(/\r?\n/)) if (line.startsWith('worktree ')) worktrees.push(path.resolve(line.slice(9)));
  } catch { /* Not a git checkout: only the given root. */ }
  const roots = [...new Set(worktrees)].map(w => path.join(w, '.scratch-pw')).filter(r => fs.existsSync(r));
  return { roots: roots.filter(r => !roots.some(o => o !== r && inside(r, o))), worktrees: [...new Set(worktrees)] };
}
const norm = p => path.resolve(p).toLowerCase();
const inside = (child, parent) => norm(child).startsWith(norm(parent) + path.sep);

function status(dir) {
  for (const name of ['report.json', 'result.json']) {
    try { const value = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).status; if (typeof value === 'string') return value; } catch { /* absent */ }
  }
  return undefined;
}
const succeeded = value => typeof value === 'string' && /^(?:completed|passed|pass|success)/i.test(value);

/** Classify the deletable units of one scratch root. */
export function units(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || isLink(entry)) continue;
    const dir = path.join(root, entry.name);
    if (entry.name === 'companion-daily' || entry.name === 'site-daily') {
      for (const run of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!run.isDirectory() || isLink(run)) continue;
        if (entry.name === 'site-daily' && run.name === 'native') {
          for (const nat of fs.readdirSync(path.join(dir, 'native'), { withFileTypes: true })) if (nat.isDirectory() && !isLink(nat)) out.push({ dir: path.join(dir, 'native', nat.name), kind: 'factory', factory: 'site-daily/native' });
        } else out.push({ dir: path.join(dir, run.name), kind: 'factory', factory: entry.name, runId: RUN_ID.test(run.name) ? run.name : undefined });
      }
    } else if (entry.name.startsWith('.retention')) continue;
    else if (/^focused-(?:receipt|continue)-/.test(entry.name)) out.push({ dir, kind: 'leftover' });
    else out.push({ dir, kind: 'feature' });
  }
  for (const unit of out) unit.status = status(unit.dir);
  return out;
}

/** Python/native tool environments nested in feature folders (re-creatable, large). */
export function toolEnvs(featureDir, depth = 3) {
  const found = [];
  const visit = (dir, d) => {
    if (fs.existsSync(path.join(dir, 'pyvenv.cfg')) || fs.existsSync(path.join(dir, 'Lib', 'site-packages'))) { found.push(dir); return; }
    if (d === 0) return;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !isLink(e)) visit(path.join(dir, e.name), d - 1);
  };
  visit(featureDir, depth);
  return found;
}

const PATH_STRING = /(?:[A-Za-z]:[\\/]|\.scratch-pw[\\/])[^"'\s<>|*?]+/g;
/**
 * Paths referenced by live state files (and by `seeds`, e.g. kept runs) and, recursively,
 * by the receipts of every referenced run, so a kept run's proof chain is kept too.
 */
export function referencedPaths(roots, maxDepth = 10, seeds = []) {
  const refs = new Set(), queue = seeds.map(dir => ({ path: dir, depth: 0 }));
  const repoOf = root => path.dirname(root);
  const collect = (file, root, depth) => {
    let text; try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
    for (const m of text.match(PATH_STRING) ?? []) {
      const abs = /^[A-Za-z]:/.test(m) ? path.resolve(m) : path.resolve(repoOf(root), m);
      if (!refs.has(norm(abs))) { refs.add(norm(abs)); queue.push({ path: abs, depth: depth + 1 }); }
    }
  };
  for (const root of roots) {
    const state = path.join(root, 'site-daily', 'state.json');
    if (fs.existsSync(state)) collect(state, root, 0);
  }
  while (queue.length) {
    const { path: p, depth } = queue.shift();
    if (depth > maxDepth) continue;
    const root = roots.find(r => inside(p, r));
    if (!root) continue;
    let dir = fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : path.dirname(p);
    for (const name of ['result.json', 'build.json', 'plan.json', 'report.json']) {
      const f = path.join(dir, name); if (fs.existsSync(f)) collect(f, root, depth);
    }
  }
  return refs;
}

function worktreeInside(unitDir, worktrees) { return worktrees.some(w => norm(w) === norm(unitDir) || inside(w, unitDir)); }

/**
 * Decide, without changing anything, what to slim and what to delete.
 * `free` is the current free byte count of the volume.
 */
export function plan({ roots, worktrees, now = Date.now(), free = Infinity, policy = DEFAULT_POLICY, refs = referencedPaths(roots) }) {
  const all = roots.flatMap(units), seen = new Set();
  for (const u of all) Object.assign(u, measure(u.dir, seen));
  const protect = (u, why) => { u.protected ??= why; };
  for (const u of all) {
    if (worktreeInside(u.dir, worktrees)) protect(u, 'contains a registered git worktree');
    else if (now - u.newest < policy.activeHours * HOUR) protect(u, `written within ${policy.activeHours}h`);
    else if ([...refs].some(r => r === norm(u.dir) || r.startsWith(norm(u.dir) + path.sep))) protect(u, 'referenced by live state/receipt chain');
  }
  const byFactory = new Map();
  for (const u of all.filter(u => u.kind === 'factory')) {
    const key = `${path.dirname(path.dirname(u.dir))}|${u.factory}`;
    if (!byFactory.has(key)) byFactory.set(key, []);
    byFactory.get(key).push(u);
  }
  for (const list of byFactory.values()) {
    list.sort((a, b) => b.newest - a.newest);
    list.slice(0, policy.keepLatestPerFactory).forEach(u => protect(u, `newest ${policy.keepLatestPerFactory} of ${u.factory}`));
    const ok = list.find(u => succeeded(u.status)); if (ok) protect(ok, `newest successful ${ok.factory}`);
  }
  // Whatever a kept run cites (continue-from, reuse-build, case history, proofRef) stays verifiable.
  const chain = referencedPaths(roots, 10, all.filter(u => u.protected).map(u => u.dir));
  for (const u of all) if ([...chain].some(r => r === norm(u.dir) || r.startsWith(norm(u.dir) + path.sep))) protect(u, 'cited by a kept run');
  const age = u => (now - u.newest) / DAY;
  const expiry = u => u.kind === 'leftover' ? policy.leftoverDays : u.kind === 'feature' ? policy.featureDays : succeeded(u.status) ? policy.successDays : policy.failureDays;
  const remove = [];
  for (const u of all) if (!u.protected && age(u) >= expiry(u)) remove.push({ ...u, reason: `${u.kind} older than ${expiry(u)}d` });
  // Tool environments inside kept feature folders expire on their own clock.
  const envs = [];
  for (const u of all.filter(u => u.kind === 'feature' && !remove.some(r => r.dir === u.dir) && !worktreeInside(u.dir, worktrees))) {
    for (const dir of toolEnvs(u.dir)) {
      const m = measure(dir, new Set());
      if (now - m.newest >= policy.toolEnvDays * DAY) envs.push({ dir, kind: 'tool-env', ...m, reason: `tool environment older than ${policy.toolEnvDays}d` });
    }
  }
  remove.push(...envs);
  // Budget and free-space floor: oldest unprotected first.
  let total = all.reduce((s, u) => s + u.bytes, 0) - remove.reduce((s, u) => s + u.bytes, 0);
  let projectedFree = free + remove.reduce((s, u) => s + u.bytes, 0);
  const candidates = all.filter(u => !u.protected && !remove.some(r => r.dir === u.dir)).sort((a, b) => a.newest - b.newest);
  for (const u of candidates) {
    if (total <= policy.budgetBytes && projectedFree >= policy.minFreeBytes) break;
    remove.push({ ...u, reason: total > policy.budgetBytes ? 'over scratch budget (oldest first)' : 'below free-space floor (oldest first)' });
    total -= u.bytes; projectedFree += u.bytes;
  }
  const slim = all.filter(u => u.kind === 'factory' && !remove.some(r => r.dir === u.dir) && !(u.protected ?? '').startsWith('written within')).map(u => u.dir);
  return { units: all, remove, slim, totalBefore: all.reduce((s, u) => s + u.bytes, 0), totalAfter: total, freeBefore: free, projectedFree };
}

/** Delete one unit: unlink every link inside first, then remove. Never follows a link. */
export function removeUnit(dir, scratchRoots) {
  if (!scratchRoots.some(r => inside(dir, r))) throw Error(`Refusing to delete outside .scratch-pw: ${dir}`);
  const unlinkAll = d => {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) { const f = path.join(d, e.name); if (isLink(e)) unlinkLink(f); else if (e.isDirectory()) unlinkAll(f); }
  };
  unlinkAll(dir);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  return !fs.existsSync(dir);
}

/** Shrink a finished run without touching evidence bytes: drop the webpack cache and NTFS-compress text. */
export function slimRun(dir, { compress = process.platform === 'win32' } = {}) {
  let freed = 0;
  for (const cache of [path.join(dir, 'workspace', '.next', 'cache')]) {
    if (fs.existsSync(cache) && !fs.lstatSync(cache).isSymbolicLink()) { freed += measure(cache).bytes; fs.rmSync(cache, { recursive: true, force: true }); }
  }
  if (compress) {
    const byDir = new Map();
    walk(dir, file => { if (TEXT.has(path.extname(file).toLowerCase()) && fs.statSync(file).size >= 4096) { const d = path.dirname(file); if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(path.basename(file)); } });
    for (const [d, names] of byDir) for (let i = 0; i < names.length; i += 50) spawnSync('compact', ['/c', '/exe:lzx', '/q', '/i', ...names.slice(i, i + 50)], { cwd: d, windowsHide: true });
  }
  return freed;
}

/** Replace byte-identical files (>= 64 KiB) inside `dirs` with hardlinks to one copy. Bytes and hashes are unchanged. */
export function dedupe(dirs, minBytes = 64 * 1024) {
  const bySize = new Map();
  for (const dir of dirs) walk(dir, file => {
    const st = fs.statSync(file, { bigint: true, throwIfNoEntry: false });
    if (!st || st.size < BigInt(minBytes)) return;
    const key = String(st.size); if (!bySize.has(key)) bySize.set(key, new Map());
    bySize.get(key).set(`${st.dev}:${st.ino}`, file);
  });
  let saved = 0, linked = 0;
  for (const [size, ids] of bySize) {
    if (ids.size < 2) continue;
    const byHash = new Map();
    for (const file of ids.values()) {
      const h = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h).push(file);
    }
    for (const files of byHash.values()) {
      files.sort();
      const keep = files[0];
      for (const file of files.slice(1)) {
        if (fs.statSync(keep).nlink >= 1000) break; // NTFS allows 1023 links per file
        const tmp = `${file}.retention-link`;
        try { fs.linkSync(keep, tmp); fs.renameSync(tmp, file); saved += Number(size); linked++; } catch { try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ } }
      }
    }
  }
  return { saved, linked };
}

export function freeBytes(dir) { const s = fs.statfsSync(dir); return s.bavail * s.bsize; }

function slimLedger(root) {
  const file = path.join(root, '.retention', 'slimmed.json');
  let done = []; try { done = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first run */ }
  return { done: new Set(done.map(norm)), save: set => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify([...set], null, 1)); } };
}

/** Plan and (with apply) enforce. Returns the plan plus what actually happened. */
export function enforce({ repoRoot, apply = false, policy = DEFAULT_POLICY, now = Date.now(), log = () => {}, dedupeFiles = true }) {
  const { roots, worktrees } = scratchRoots(repoRoot);
  const result = plan({ roots, worktrees, now, free: freeBytes(repoRoot), policy });
  result.applied = apply; result.deleted = []; result.slimmedBytes = 0; result.dedupe = { saved: 0, linked: 0 };
  if (!apply) return result;
  for (const u of result.remove) {
    const ok = removeUnit(u.dir, roots); result.deleted.push({ dir: u.dir, bytes: u.bytes, reason: u.reason, ok });
    log(`${ok ? 'deleted' : 'partial'} ${(u.bytes / GIB).toFixed(2)} GiB ${u.reason}: ${u.dir}`);
  }
  for (const root of roots) {
    const ledger = slimLedger(root);
    for (const dir of result.slim.filter(d => inside(d, root) && fs.existsSync(d) && !ledger.done.has(norm(d)))) { result.slimmedBytes += slimRun(dir); ledger.done.add(norm(dir)); }
    ledger.save(new Set([...ledger.done].filter(d => fs.existsSync(d))));
  }
  if (dedupeFiles) result.dedupe = dedupe(result.units.filter(u => fs.existsSync(u.dir) && !(u.protected ?? '').startsWith('written within')).map(u => u.dir));
  result.freeAfter = freeBytes(repoRoot);
  for (const root of roots) {
    const logDir = path.join(root, '.retention'); fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ policy, deleted: result.deleted, slimmedBytes: result.slimmedBytes, dedupe: result.dedupe, freeBefore: result.freeBefore, freeAfter: result.freeAfter }, null, 2));
  }
  return result;
}

/**
 * Called by factories before they create a run: enforce the policy (expiry, budget, floor; no slow
 * dedupe pass), then refuse to start below the disk floor. `SCRATCH_RETENTION=off` skips pruning
 * but never the floor check.
 */
export function guardBeforeRun(repoRoot, { policy = DEFAULT_POLICY, log = () => {} } = {}) {
  if (process.env.SCRATCH_RETENTION !== 'off') enforce({ repoRoot, apply: true, policy, log, dedupeFiles: false });
  const free = freeBytes(repoRoot);
  if (free < policy.startFloorBytes) throw Error(`Disk floor: only ${(free / GIB).toFixed(1)} GiB free after scratch retention (< ${(policy.startFloorBytes / GIB).toFixed(0)} GiB). Free space before starting another QA run.`);
  return free;
}

/** Called by factories after their evidence manifest is written. Never changes evidence bytes. */
export function afterRun(runDir) {
  const freed = slimRun(runDir);
  const marker = `${path.sep}.scratch-pw${path.sep}`, at = norm(runDir).lastIndexOf(marker);
  if (at < 0) throw Error(`Not a .scratch-pw run: ${runDir}`);
  const root = path.resolve(runDir).slice(0, at + marker.length - 1);
  const ledger = slimLedger(root); ledger.done.add(norm(runDir)); ledger.save(ledger.done);
  return freed;
}

export function parseArgs(argv) {
  const options = { apply: false, repoRoot: process.cwd(), policy: { ...DEFAULT_POLICY }, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') options.apply = true;
    else if (a === '--json') options.json = true;
    else if (a === '--root') options.repoRoot = path.resolve(argv[++i]);
    else if (a.startsWith('--') && a.slice(2) in DEFAULT_POLICY) {
      const v = Number(argv[++i]); if (!Number.isFinite(v) || v < 0) throw Error(`Invalid ${a}`);
      options.policy[a.slice(2)] = /Bytes$/.test(a) ? v * GIB : v;
    } else throw Error(`Unknown argument ${a}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const r = enforce({ ...o, log: line => process.stdout.write(line + '\n') });
    if (o.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else {
      const g = b => (b / GIB).toFixed(1) + ' GiB';
      process.stdout.write(`${o.apply ? 'APPLIED' : 'DRY RUN'}: scratch ${g(r.totalBefore)} -> ${g(r.totalAfter)}, free ${g(r.freeBefore)} -> ${g(r.freeAfter ?? r.projectedFree)}\n`);
      for (const u of r.remove) process.stdout.write(`  remove ${g(u.bytes).padStart(9)}  ${u.reason}: ${u.dir}\n`);
      for (const u of r.units.filter(u => u.protected)) process.stdout.write(`  keep   ${g(u.bytes).padStart(9)}  ${u.protected}: ${u.dir}\n`);
    }
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
