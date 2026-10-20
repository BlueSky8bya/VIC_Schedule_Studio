#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { universe, dailyCases, coverageFor, PURE_SUITES, NATIVE_SUITES, NATIVE_GREP, NATIVE_ENTRY_TITLES, NATIVE_FLOATING_TIDY_TITLES, PLANNED_NATIVE_CASE_COUNT } from './catalog.mjs';
import { sha, writeNewJson, evidenceFiles, writeReport } from './report.mjs';
import { AUDITED_MACHINE_METADATA, AUDITED_MACHINE_METADATA_BYTES, validateAuditedMachineMetadata } from './machine-metadata.mjs';

export function loopbackOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '127.0.0.2', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Only an exact HTTP loopback origin is permitted');
  return url.origin;
}
export function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !/^[A-Za-z]:/.test(value) && !value.split(/[\\/]/).some(part => !part || part === '.' || part === '..') && !value.includes('\0');
}
export function snapshotEligible(relative) {
  if (!safeRelative(relative)) return false;
  const parts = relative.split(/[\\/]/);
  if (parts.some(part => /^(?:\.env(?:\..*)?|\.git|\.vercel|\.scratch.*|node_modules|제작기록|feedback_sources|user_turns|contracts?|capture_state)$/i.test(part))) return false;
  if (parts[0] === 'art-src') return false; // Never copy private source art or generation contracts.
  return ['app', 'components', 'lib', 'public', 'tests', 'scripts', 'docs'].includes(parts[0])
    || /^(?:package(?:-lock)?\.json|tsconfig\.json|next-env\.d\.ts|next\.config\.[a-z]+|postcss\.config\.[a-z]+|eslint\.config\.[a-z]+|vitest\.config\.ts|playwright\.visual\.config\.ts|AGENTS\.md|\.gitignore|\.vercelignore|\.gitattributes)$/.test(relative);
}
export function childEnvironment(source, extra = {}) {
  const allowed = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'NUMBER_OF_PROCESSORS'];
  return { ...Object.fromEntries(allowed.filter(key => source[key] !== undefined).map(key => [key, source[key]])), CI: 'true', NEXT_TELEMETRY_DISABLED: '1', VISUAL_TEST_FIXTURE: '1', ...extra };
}
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const list = value => value.split('\0').filter(Boolean).map(value => value.replaceAll('\\', '/'));
function unlinkedFile(root, relative) {
  if (!safeRelative(relative)) throw Error('Unsafe source path');
  let current = root;
  for (const part of relative.split('/')) { current = path.join(current, part); if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw Error(`Linked source excluded: ${relative}`); }
  return fs.statSync(current, { throwIfNoEntry: false })?.isFile() ? current : undefined;
}
function fingerprints(root, paths) {
  return paths.map(relative => { const file = unlinkedFile(root, relative); return { path: relative, sha256: file ? sha(fs.readFileSync(file)) : null }; });
}
export function parseOptions(argv) {
  const options = { budgetMinutes: 45, workers: 3, plan: false, root: process.cwd(), sourceManifest: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--plan') options.plan = true;
    else if (['--root', '--budget-minutes', '--workers', '--source-manifest'].includes(argv[i])) {
      const key = argv[i], value = argv[++i]; if (!value) throw Error(`Missing ${key}`);
      if (key === '--root') options.root = path.resolve(value);
      if (key === '--budget-minutes') options.budgetMinutes = Number(value);
      if (key === '--workers') options.workers = Number(value);
      if (key === '--source-manifest') options.sourceManifest = path.resolve(value);
    } else throw Error(`Unknown argument ${argv[i]}`);
  }
  if (!Number.isInteger(options.budgetMinutes) || options.budgetMinutes < 5 || options.budgetMinutes > 180 || !Number.isInteger(options.workers) || options.workers < 1 || options.workers > 3) throw Error('Budget must be 5..180 minutes; workers 1..3');
  return options;
}
const kst = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(date) + ' KST';
async function port() { const server = net.createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); const selected = server.address().port; await new Promise(resolve => server.close(resolve)); return selected; }
export function ownedTerminationCommand(pid, platform = process.platform, systemRoot = process.env.SystemRoot) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('An exact positive owned child PID is required');
  if (platform === 'win32') {
    if (!systemRoot || !path.isAbsolute(systemRoot)) throw Error('Windows SystemRoot is required for exact child-tree cleanup');
    return { file: path.join(systemRoot, 'System32', 'taskkill.exe'), args: ['/PID', String(pid), '/T', '/F'] };
  }
  return { signal: 'SIGKILL', group: -pid };
}
async function stopOwned(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const spec = ownedTerminationCommand(child.pid);
  if (spec.file) await new Promise((resolve, reject) => {
    const killer = spawn(spec.file, spec.args, { windowsHide: true, shell: false, stdio: 'ignore' });
    killer.once('error', reject); killer.once('close', code => code === 0 || child.exitCode !== null || child.signalCode !== null ? resolve() : reject(Error('Owned child-tree cleanup failed')));
  });
  else try { process.kill(spec.group, spec.signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
function trackChild(child, control) {
  control.children.add(child); child.once('close', () => control.children.delete(child)); return child;
}
async function command(cwd, args, env, log, deadline, control) {
  const remaining = deadline - Date.now(); if (remaining <= 0 || control.cancelled) return { status: 'not-run', detail: 'Wall budget exhausted or run interrupted' };
  const output = fs.createWriteStream(log, { flags: 'wx' });
  return new Promise(resolve => {
    const child = trackChild(spawn(process.execPath, args, { cwd, env, windowsHide: true, detached: process.platform !== 'win32', shell: false, stdio: ['ignore', 'pipe', 'pipe'] }), control);
    child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
    let failure, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void stopOwned(child).catch(error => { failure = error.message; }); }, remaining);
    child.once('error', error => { failure = error.message; });
    child.once('close', async (code, signal) => {
      clearTimeout(timer); output.end();
      try { await finished(output); } catch (error) { failure = error.message; }
      resolve({ status: code === 0 && !failure && !timedOut && !control.cancelled ? 'passed' : 'failed', exitCode: code,
        detail: failure ?? (timedOut ? 'Wall budget exhausted; exact owned child process tree terminated' : signal ? `Process ended with ${signal}; no retry was hidden` : undefined) });
    });
  });
}
export function dailyEvidenceGate(cases, observed) {
  const expected = new Set(cases.map(row => row.id)), ids = observed.map(row => row.scenario?.id);
  return expected.size === cases.length && observed.length === cases.length && new Set(ids).size === cases.length && observed.every(row => expected.has(row.scenario?.id) && row.status === 'passed' && row.sufficiency?.passed === true && row.scenario?.personality === cases.find(item => item.id === row.scenario.id)?.personality && row.scenario?.seconds === 90);
}
/** Read reporter outcomes, never infer native entry success from the pure9
 * ACKs or a grep match. Missing, skipped, retried and duplicate cases fail closed. */
export function nativeEntryEvidence(report) {
  const specs = [];
  const visit = suites => { for (const suite of Array.isArray(suites) ? suites : []) {
    specs.push(...(Array.isArray(suite?.specs) ? suite.specs : [])); visit(suite?.suites);
  } };
  visit(report?.suites);
  const classify = matches => {
    if (!matches.length) return 'not-run';
    if (matches.length !== 1) return 'failed';
    const tests = matches[0]?.tests;
    if (!Array.isArray(tests) || !tests.length) return 'not-run';
    if (tests.length !== 1) return 'failed';
    const test = tests[0], results = test?.results;
    if (!Array.isArray(results) || !results.length) return 'not-run';
    if (results.every(result => result?.status === 'skipped')) return 'skipped';
    if (results.length !== 1 || test.expectedStatus !== 'passed' || test.status !== 'expected' || results[0]?.status !== 'passed' || results[0]?.retry !== 0) return 'failed';
    return 'passed';
  };
  const cases = NATIVE_ENTRY_TITLES.map(title => ({ title, status: classify(specs.filter(spec => spec?.title === title)) }));
  const count = status => cases.filter(item => item.status === status).length;
  // Actual floating-house cleanup is separate from pure goal/route contracts.
  // Exact titles prevent two unrelated passes from replacing either new case.
  const floatingCases = NATIVE_FLOATING_TIDY_TITLES.map(title => ({ title, status: classify(specs.filter(spec => spec?.title === title)) }));
  const floatingTidy = { required: NATIVE_FLOATING_TIDY_TITLES.length,
    registered: floatingCases.filter(item => specs.some(spec => spec?.title === item.title)).length,
    passed: floatingCases.filter(item => item.status === 'passed').length,
    failed: floatingCases.filter(item => item.status === 'failed').length,
    skipped: floatingCases.filter(item => item.status === 'skipped').length,
    notRun: floatingCases.filter(item => item.status === 'not-run').length, cases: floatingCases };
  const selectedPassedCases = specs.filter(spec => classify([spec]) === 'passed').length;
  const selectedUniqueTitles = new Set(specs.map(spec => spec?.title).filter(title => typeof title === 'string')).size;
  const passedEntries = count('passed'), notRunEntries = count('not-run');
  const gatePassed = passedEntries === NATIVE_ENTRY_TITLES.length && floatingTidy.passed === NATIVE_FLOATING_TIDY_TITLES.length && specs.length === PLANNED_NATIVE_CASE_COUNT && selectedUniqueTitles === PLANNED_NATIVE_CASE_COUNT && selectedPassedCases === PLANNED_NATIVE_CASE_COUNT && Array.isArray(report?.errors) && report.errors.length === 0;
  return { status: notRunEntries === NATIVE_ENTRY_TITLES.length ? 'not-run' : gatePassed ? 'passed' : 'failed', gatePassed,
    requiredEntries: NATIVE_ENTRY_TITLES.length, registeredEntries: cases.filter(item => specs.some(spec => spec?.title === item.title)).length,
    passedEntries, failedEntries: count('failed'), skippedEntries: count('skipped'), notRunEntries,
    plannedSelectedCases: PLANNED_NATIVE_CASE_COUNT, selectedCaseCount: specs.length, selectedPassedCases, selectedUniqueTitles, cases, floatingTidy };
}
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function passedTests(report) { return report.testResults.flatMap(file => file.assertionResults).filter(result => result.status === 'passed'); }
export const REQUIRED_AGENT_REGRESSIONS = Object.freeze([
  'tests/unit/companion-agent-experience-142.test.ts',
  'tests/unit/companion-agent-experience-store-142.test.ts',
  'tests/unit/companion-goal-continuity-142.test.ts',
  'tests/unit/companion-actual-progress-142.test.ts',
]);
export function registeredAgentRegressions(available, learnerExists) {
  const selected = REQUIRED_AGENT_REGRESSIONS.filter(file => available.includes(file));
  if (learnerExists && selected.length !== REQUIRED_AGENT_REGRESSIONS.length) throw Error('Agent learner exists without all four registered learner/goal/progress regression suites');
  return selected;
}
export async function run(options) {
  const model = universe(), ordinal = Math.floor((Date.now() + 9 * 3600000) / 86400000), cases = dailyCases(ordinal);
  if (options.plan) { process.stdout.write(JSON.stringify({ universe: model, selectedNativeCases: cases, nativeCoverage: coverageFor([]), executes: false }, null, 2) + '\n'); return 0; }
  const root = path.resolve(options.root), started = new Date(), deadline = started.valueOf() + options.budgetMinutes * 60000;
  const runId = kst(started).replace(/[^0-9]/g, '') + '-' + process.pid + '-' + randomUUID().slice(0, 8);
  const directory = path.join(root, '.scratch-pw', 'companion-daily', runId), workspace = path.join(directory, 'workspace'), attempt = path.join(directory, 'attempt-01');
  fs.mkdirSync(attempt, { recursive: true });
  const stages = [], result = { schemaVersion: 1, createdAtKst: kst(started), runId, status: 'failed', universe: model, nativeCoverage: coverageFor([]), stages, platform: { os: os.platform(), node: process.version }, automaticCodeEdits: 0, automaticAssetEdits: 0 };
  let baseline, sourcePaths, server, serverLog, serverClosed, originalGitState;
  const control = { children: new Set(), cancelled: false };
  const cancel = () => { control.cancelled = true; for (const child of control.children) void stopOwned(child).catch(() => { /* Final cleanup records any failure. */ }); };
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  try {
    const tracked = list(git(root, ['ls-files', '-z'])), untracked = list(git(root, ['ls-files', '--others', '--exclude-standard', '-z']));
    const dirty = list(git(root, ['diff', '--name-only', '-z', 'HEAD']));
    originalGitState = sha(git(root, ['status', '--porcelain=v1', '-z']));
    const factoryNew = untracked.filter(file => /^(?:scripts\/companion-qa\/|tests\/unit\/companion-(?:qa|readonly-font)-142\.test\.ts$|tests\/visual\/companion-daily-142\.spec\.ts$|tests\/visual\/helpers\/(?:companion-qa|readonly-font)\.ts$)/.test(file));
    const approved = options.sourceManifest ? readJson(options.sourceManifest) : [];
    if (!Array.isArray(approved) || approved.some(file => !snapshotEligible(file))) throw Error('Explicit source manifest must contain only eligible relative source paths');
    const machine = AUDITED_MACHINE_METADATA.map(entry => validateAuditedMachineMetadata(entry.path, fs.readFileSync(unlinkedFile(root, entry.path)), { tracked: tracked.includes(entry.path), headUnchanged: !dirty.includes(entry.path) }));
    sourcePaths = [...new Set([...tracked.filter(snapshotEligible), ...factoryNew, ...approved, ...dirty, ...untracked.filter(file => file.startsWith('art-src/')), ...machine.map(entry => entry.path)])].filter(safeRelative).sort();
    baseline = fingerprints(root, sourcePaths);
    result.sourceDigest = sha(JSON.stringify(baseline));
    const source = { head: git(root, ['rev-parse', 'HEAD']).trim(), dirtyDigest: sha(JSON.stringify(fingerprints(root, dirty))), contentDigest: result.sourceDigest,
      snapshotIsCommitIdentical: false, copiedSourcesMatchCleanTrackedSubset: dirty.length === 0 && factoryNew.length === 0 && !approved.some(file => !tracked.includes(file)), privateSourceArtCopied: false, sourceIllustrationsCopied: 0, sourceContractsCopied: 0, sourceFiles: baseline,
      auditedMachineGeometryJson: { copied: 0, maximumFiles: 18, maximumBytes: AUDITED_MACHINE_METADATA_BYTES, referencesFollowed: 0, files: machine },
      statement: 'HEAD alone does not identify a dirty snapshot. The content digest is authoritative. No .git, credentials, source illustrations or source-art contracts are copied. Exactly eighteen audited immutable machine JSON prerequisites are separately hash-gated; their historical reference strings are never followed.' };
    writeNewJson(path.join(directory, 'universe.json'), { ...model, selectedNativeCases: cases });
    for (const item of baseline.filter(item => (snapshotEligible(item.path) || machine.some(entry => entry.path === item.path)) && item.sha256)) {
      if (Date.now() >= deadline || control.cancelled) throw Error('Snapshot budget exhausted or run interrupted; later stages not run');
      const destination = path.join(workspace, item.path); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(root, item.path), destination, fs.constants.COPYFILE_EXCL);
      if (sha(fs.readFileSync(destination)) !== item.sha256) throw Error(`Source changed during snapshot: ${item.path}`);
      if (machine.some(entry => entry.path === item.path)) source.auditedMachineGeometryJson.copied++;
    }
    if (source.auditedMachineGeometryJson.copied !== 18) throw Error('An audited machine JSON prerequisite was not copied');
    writeNewJson(path.join(directory, 'source-freeze.json'), source);
    if (!fs.existsSync(path.join(root, 'node_modules/next/dist/bin/next'))) throw Error('Installed locked dependencies are required; no install is attempted');
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    if (baseline.some((item, i) => fingerprints(root, [item.path])[0].sha256 !== baseline[i].sha256)) throw Error('Original tree changed during snapshot');
    stages.push({ name: 'isolated-snapshot', status: 'passed', detail: 'Credential-free copied source plus exactly eighteen audited machine JSON prerequisites; source illustrations/contracts copied0; original worktree is never built or edited' });
    const pure = path.join(attempt, 'pure'); fs.mkdirSync(pure);
    const learnerRequired = REQUIRED_AGENT_REGRESSIONS;
    const learner = registeredAgentRegressions(learnerRequired.filter(file => fs.existsSync(path.join(workspace, file))), fs.existsSync(path.join(workspace, 'lib/ui/viewer-companion/agent-experience.ts')));
    // A new learner must have a registered regression. Missing is explicit,
    // rather than silently passing the older engine's selected contracts.
    const suites = [...PURE_SUITES, ...learner]; for (const file of suites) if (!fs.existsSync(path.join(workspace, file))) throw Error(`Required pure suite missing: ${file}`);
    const nodeGuard = { NODE_OPTIONS: `--import=${pathToFileURL(path.join(workspace, 'scripts/companion-qa/network-guard.mjs')).href}`, COMPANION_QA_NETWORK_LOG: path.join(attempt, 'node-network-denied.jsonl'), GIT_CEILING_DIRECTORIES: directory };
    const pureFile = path.join(pure, 'vitest.json'), env = childEnvironment(process.env, { ...nodeGuard, COMPANION_QA_PURE_OUTPUT: pure });
    stages.push({ name: 'pure-models', ...await command(workspace, ['node_modules/vitest/vitest.mjs', 'run', ...suites, '--maxWorkers=1', '--reporter=json', `--outputFile=${pureFile}`], env, path.join(attempt, 'pure.log'), deadline, control) });
    if (stages.at(-1).status !== 'passed') throw Error('Pure-model gate failed; native stages not run');
    const pureReport = readJson(pureFile), evidence = readJson(path.join(pure, 'model-coverage.json')), passed = passedTests(pureReport);
    if (!pureReport.success || pureReport.numPendingTests || evidence.booleanPatterns !== 262144 || evidence.routineTemplates !== 54 || evidence.entries !== 9 || passed.filter(test => /executes .+ with actual source context/.test(test.fullName)).length !== evidence.recipeCount || evidence.recipeCount !== 144) throw Error('Pure evidence counts do not prove the declared finite model');
    for (const suite of learner) if (!pureReport.testResults.some(file => file.name.replaceAll('\\', '/').endsWith(suite) && file.assertionResults.length && file.assertionResults.every(test => test.status === 'passed'))) throw Error('A required learner suite did not execute and pass');
    stages.push({ name: 'pure-count-proof', status: 'passed', detail: `${evidence.booleanPatterns} normalization patterns; ${evidence.recipeCount} recipe contracts; ${evidence.routineTemplates} routine admissions; ${evidence.entries} entries. Not a native Cartesian proof.` });
    for (const [name, args] of [
      ['metadata', ['scripts/generate-ambient-art-metadata.mjs']],
      ['build', ['node_modules/next/dist/bin/next', 'build']],
      ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
      ['lint', ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings=0']],
    ]) { stages.push({ name, ...await command(workspace, args, childEnvironment(process.env, nodeGuard), path.join(attempt, `${name}.log`), deadline, control) }); if (stages.at(-1).status !== 'passed') throw Error(`${name} gate failed; later stages not run`); }
    const build = fs.readFileSync(path.join(workspace, '.next/BUILD_ID'), 'utf8').trim(); result.buildId = build;
    const selectedPort = await port(), baseURL = loopbackOrigin(`http://127.0.0.1:${selectedPort}`);
    serverLog = fs.createWriteStream(path.join(attempt, 'server.log'), { flags: 'wx' });
    server = trackChild(spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(selectedPort)], { cwd: workspace, env: childEnvironment(process.env, { ...nodeGuard, COMPANION_QA_NODE_ORIGIN: baseURL }), windowsHide: true, detached: process.platform !== 'win32', shell: false, stdio: ['ignore', 'pipe', 'pipe'] }), control);
    serverClosed = new Promise(resolve => server.once('close', resolve));
    server.on('error', error => { stages.push({ name: 'owned-server', status: 'failed', detail: error.message }); });
    server.stdout.pipe(serverLog, { end: false }); server.stderr.pipe(serverLog, { end: false });
    let ready = false;
    for (let n = 0; n < 150 && Date.now() < deadline && !control.cancelled; n++) { if (server.exitCode !== null) break; try { const response = await fetch(`${baseURL}/visual-fixture/poster`, { signal: AbortSignal.timeout(3000), redirect: 'error' }); if (response.ok) { ready = true; break; } } catch { /* Bounded startup only; never another server/origin. */ } await new Promise(resolve => setTimeout(resolve, 200)); }
    if (!ready) throw Error('Owned fixture server did not become ready within the budget');
    const config = path.join(workspace, 'companion-qa.generated.config.ts'), nativeOutput = path.join(attempt, 'native'), reportFile = path.join(attempt, 'playwright.json');
    fs.mkdirSync(nativeOutput, { recursive: true }); // Shared parent exists before any parallel case writes a prefix-based artifact.
    const nativeEnv = Object.fromEntries(['COMPANION141_AGENCY_OUTPUT', 'COMPANION141_OUTPUT', 'COMPANION137_OUTPUT', 'COMPANION134_GALLERY_OUTPUT', 'COMPANION_WINDOW_UI_OUTPUT', 'VIC_ACTIVITY_AUDIT_PREFIX'].map(key => [key, path.join(nativeOutput, key.toLowerCase())]));
    fs.writeFileSync(config, `import {defineConfig} from '@playwright/test';\nexport default defineConfig(${JSON.stringify({ testDir: './tests/visual', testMatch: NATIVE_SUITES, grep: undefined, workers: options.workers, retries: 0, timeout: 125000, fullyParallel: true, outputDir: path.join(attempt, 'playwright'), reporter: [['json', { outputFile: reportFile }]], use: { baseURL, viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: 'block', trace: 'retain-on-failure', video: 'on', screenshot: 'only-on-failure' } })});\n`, { flag: 'wx' });
    const native = await command(workspace, ['node_modules/@playwright/test/cli.js', 'test', '--config', config, '--grep', NATIVE_GREP], childEnvironment(process.env, { ...nodeGuard, ...nativeEnv, COMPANION_QA_NODE_ORIGIN: baseURL, VIC_ACTIVITY_BASE_URL: baseURL.replace("127.0.0.1", "127.0.0.2"), COMPANION_QA_OUTPUT: nativeOutput, COMPANION_QA_CASES: JSON.stringify(cases), VISUAL_TEST_BUILD_DIR: path.join(workspace, '.next') }), path.join(attempt, 'native.log'), deadline, control);
    const nativeStage = { name: 'native-production-fixture', ...native }; stages.push(nativeStage);
    result.nativeEntries = nativeEntryEvidence(fs.existsSync(reportFile) ? readJson(reportFile) : undefined);
    stages.push({ name: 'native-personality-entry-proof', status: result.nativeEntries.status, detail: `${result.nativeEntries.passedEntries}/27 actual entry cases passed; skipped:${result.nativeEntries.skippedEntries}, failed:${result.nativeEntries.failedEntries}, not-run:${result.nativeEntries.notRunEntries}; ${result.nativeEntries.selectedCaseCount}/${PLANNED_NATIVE_CASE_COUNT} cases selected, ${result.nativeEntries.selectedPassedCases}/${PLANNED_NATIVE_CASE_COUNT} actually passed; ${result.nativeEntries.floatingTidy.passed}/${NATIVE_FLOATING_TIDY_TITLES.length} exact floating-house tidy cases passed` });
    if (!result.nativeEntries.gatePassed) { native.status = nativeStage.status = 'failed'; nativeStage.detail = `Exactly${PLANNED_NATIVE_CASE_COUNT} unique native cases including all27 entries and both exact floating-house tidy cases must actually pass once; skipped, missing and retried outcomes are not passes`; }

    const observedDirectory = path.join(nativeOutput, 'daily');
    const observed = fs.existsSync(observedDirectory) ? fs.readdirSync(observedDirectory).filter(file => /^daily-[a-z-]+\.json$/.test(file)).map(file => readJson(path.join(observedDirectory, file))) : [];
    result.nativeCoverage = coverageFor(observed.filter(caseResult => caseResult.status === 'passed').map(caseResult => caseResult.scenario));
    result.dailyCases = { required: cases.length, observed: observed.length, passed: observed.filter(caseResult => caseResult.status === 'passed').length };
    if (!dailyEvidenceGate(cases, observed)) { native.status = nativeStage.status = 'failed'; nativeStage.detail = 'All nine exact personality trace IDs must independently pass with sufficient actual ninety-second observations'; }
    if (fs.existsSync(nodeGuard.COMPANION_QA_NETWORK_LOG) && fs.statSync(nodeGuard.COMPANION_QA_NETWORK_LOG).size) throw Error('Node build/server network guard blocked a request; inspect preserved denial evidence');
    if (fs.readFileSync(path.join(workspace, '.next/BUILD_ID'), 'utf8').trim() !== build) throw Error('Build changed during native observations');
    result.status = native.status === 'passed' ? 'completed-scoped-checks' : 'failed';
  } catch (error) { stages.push({ name: 'stopped', status: 'failed', detail: String(error.message ?? error) }); }
  finally {
    try {
      for (const child of [...control.children]) await stopOwned(child);
      if (serverClosed) await serverClosed;
      if (serverLog) { serverLog.end(); await finished(serverLog); }
      stages.push({ name: 'owned-process-cleanup', status: 'passed', detail: 'Only this run\'s exact spawned PIDs/process trees terminated; child stdout/stderr and server log flushed before hashing' });
    } catch (error) { stages.push({ name: 'owned-process-cleanup', status: 'failed', detail: String(error.message ?? error) }); result.status = 'failed'; }
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
    if (baseline) {
      try {
        const after = fingerprints(root, sourcePaths), changed = baseline.filter((item, index) => item.sha256 !== after[index].sha256);
        const stateChanged = originalGitState !== sha(git(root, ['status', '--porcelain=v1', '-z']));
        stages.push({ name: 'original-tree-preserved', status: changed.length || stateChanged ? 'failed' : 'passed', detail: `${changed.length} original file hashes changed; git-state changed:${stateChanged}. No automatic restore/reset is performed` });
        if (changed.length || stateChanged) result.status = 'failed';
      } catch (error) { stages.push({ name: 'original-tree-preserved', status: 'failed', detail: `Preservation could not be proved: ${String(error.message ?? error)}. No automatic restore/reset is performed` }); result.status = 'failed'; }
    }
    for (const required of ['pure-models', 'pure-count-proof', 'metadata', 'build', 'typecheck', 'lint', 'native-production-fixture', 'native-personality-entry-proof']) if (!stages.some(stage => stage.name === required)) stages.push({ name: required, status: 'not-run', detail: 'Earlier gate or budget prevented execution' });
    writeReport(directory, result); writeNewJson(path.join(directory, 'evidence-manifest.json'), { files: evidenceFiles(attempt), report: ['source-freeze.json', 'universe.json', 'report.json', 'report.md', 'report.html'].filter(file => fs.existsSync(path.join(directory, file))).map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(directory, file))) })) });
    process.stdout.write(`Companion QA: ${result.status}; local evidence ${directory}\n`);
  }
  return result.status === 'completed-scoped-checks' ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = await run(parseOptions(process.argv.slice(2))); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
