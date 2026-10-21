import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_STAGES = ['isolated-snapshot', 'pure-models', 'pure-count-proof', 'metadata', 'build', 'typecheck', 'lint', 'owned-process-cleanup', 'original-tree-preserved'];
const NATIVE_STAGES = ['native-production-fixture', 'native-personality-entry-proof'];
const REQUIRED_SOURCE_PATHS = ['scripts/companion-qa/runner.mjs', 'scripts/companion-qa/catalog.mjs', 'scripts/companion-qa/network-guard.mjs'];
const REQUIRED_METADATA_PATHS = ['report.json', 'source-freeze.json', 'attempt-01/playwright.json'];
const MAX_JSON_BYTES = 24 * 1024 * 1024;
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const relativeFile = value => typeof value === 'string' && value.length > 0 && !/[\\:\0]/.test(value) && !value.startsWith('/') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
const safeSource = value => relativeFile(value) && !value.split('/').some(part => /^\.env(?:\.|$)|^\.git$|^\.scratch|^node_modules$|^art-src$|^\.vercel$/i.test(part)) && !/^docs\//.test(value);

function selectedSpecs(reporter, issues) {
  const specs = [];
  function visit(suites) {
    if (!Array.isArray(suites)) { issues.push('Malformed or missing Playwright suites'); return; }
    for (const suite of suites) {
      if (!record(suite)) { issues.push('Malformed Playwright suite'); continue; }
      if (suite.specs !== undefined) {
        if (!Array.isArray(suite.specs)) issues.push('Malformed Playwright specs');
        else for (const spec of suite.specs) {
          if (!record(spec)) { issues.push('Malformed selected spec'); continue; }
          specs.push(spec);
        }
      }
      if (suite.suites !== undefined) visit(suite.suites);
    }
  }
  visit(reporter?.suites);
  return specs;
}

function selectedSourcePaths(specs, issues) {
  const paths = [];
  for (const spec of specs) {
    if (!relativeFile(spec.file) || !spec.file.endsWith('.spec.ts')) { issues.push(`Unsafe or missing selected spec path: ${String(spec.file)}`); continue; }
    paths.push(spec.file.startsWith('tests/visual/') ? spec.file : `tests/visual/${spec.file}`);
  }
  return [...new Set(paths)].sort();
}

/**
 * Interpret a diagnostic selection only. The verification facts must come from
 * inspectCompanionDiagnostic (or an equally trusted, read-only hash verifier).
 * This is deliberately NOT a release gate and cannot grant release eligibility.
 * No filesystem reads, writes, subprocesses, clock or randomness occur here.
 */
export function evaluateCompanionDiagnostic({ report, source, reporter, evidenceVerification } = {}) {
  const issues = [];
  const specs = selectedSpecs(reporter, issues);
  const selected = { count: specs.length, passed: 0, failed: 0, skipped: 0, retried: 0, expectedFailure: 0, duplicateTitles: [], cases: [] };
  const titles = new Set();
  for (const spec of specs) {
    const title = typeof spec.title === 'string' ? spec.title : '';
    const caseIssues = [];
    if (!title.trim()) caseIssues.push('Missing selected case title');
    if (titles.has(title)) { selected.duplicateTitles.push(title); caseIssues.push('Duplicate selected title'); }
    titles.add(title);
    const tests = Array.isArray(spec.tests) ? spec.tests : [];
    if (tests.length !== 1) caseIssues.push('Selected spec must have exactly one project/test');
    const results = tests.flatMap(test => Array.isArray(test?.results) ? test.results : []);
    const errors = results.flatMap(result => [...(Array.isArray(result?.errors) ? result.errors : []), ...(result?.error ? [result.error] : [])]);
    const skipped = tests.some(test => test?.expectedStatus === 'skipped' || test?.status === 'skipped') || results.some(result => result?.status === 'skipped');
    const expectedFailure = tests.some(test => test?.expectedStatus !== 'passed' && test?.expectedStatus !== 'skipped');
    const retried = results.length > 1 || results.some(result => result?.retry !== 0);
    if (skipped) selected.skipped++;
    if (expectedFailure) selected.expectedFailure++;
    if (retried) selected.retried++;
    if (spec.ok !== true) caseIssues.push('Playwright spec is not ok');
    if (tests.length === 1 && tests[0]?.expectedStatus !== 'passed') caseIssues.push('Expected failure/skip is not an actual pass');
    if (tests.length === 1 && tests[0]?.status !== 'expected') caseIssues.push('Unexpected, flaky or missing test outcome');
    if (results.length !== 1 || results[0]?.status !== 'passed' || results[0]?.retry !== 0) caseIssues.push('Exactly one actual passed result without retry is required');
    if (results.some(result => !Number.isFinite(result?.duration) || result.duration <= 0)) caseIssues.push('Missing actual browser-result duration');
    if (results.some(result => !Array.isArray(result?.errors))) caseIssues.push('Missing result errors field');
    if (errors.length) caseIssues.push('Original result errors are present');
    const annotations = [...tests.flatMap(test => Array.isArray(test?.annotations) ? test.annotations : []), ...results.flatMap(result => Array.isArray(result?.annotations) ? result.annotations : [])];
    if (annotations.some(annotation => ['fail', 'fixme', 'skip'].includes(annotation?.type))) caseIssues.push('Expected-failure/skip annotation is present');
    if (caseIssues.length === 0) selected.passed++; else selected.failed++;
    selected.cases.push({ title, file: spec.file ?? null, passed: caseIssues.length === 0, status: tests[0]?.status ?? null, expectedStatus: tests[0]?.expectedStatus ?? null, results: results.map(result => ({ status: result?.status ?? null, retry: result?.retry ?? null, duration: result?.duration ?? null })), errors, issues: caseIssues });
  }
  if (specs.length === 0) issues.push('No actual selected cases');
  if (selected.failed) issues.push('One or more selected cases did not actually pass once');
  if (!record(reporter) || !Array.isArray(reporter.errors)) issues.push('Missing Playwright global errors field');
  else if (reporter.errors.length) issues.push('Playwright global errors are present');
  const stats = reporter?.stats;
  if (!record(stats) || stats.expected !== selected.passed || stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0 || !Number.isFinite(stats.duration) || stats.duration <= 0) issues.push('Playwright statistics do not match clean actual selected passes');
  const projects = reporter?.config?.projects;
  if (!Array.isArray(projects) || projects.length !== 1 || projects[0]?.retries !== 0 || projects[0]?.repeatEach !== 1) issues.push('Exactly one non-retrying, non-repeated Playwright project is required');

  const diagnostic = report?.diagnosticScope;
  if (!record(diagnostic) || typeof diagnostic.nativeGrep !== 'string' || !diagnostic.nativeGrep.trim() || diagnostic.nativeGrep.length > 1024 || diagnostic.eligibleForRelease !== false || diagnostic.fullRunStillRequired !== true) issues.push('Missing explicit diagnostic-only scope guard');
  else { try { const expression=new RegExp(diagnostic.nativeGrep);if(specs.some(spec=>!expression.test(spec.title)))issues.push('Actual selected title does not match recorded diagnostic grep'); } catch { issues.push('Invalid diagnostic selection expression'); } }
  if (report?.schemaVersion !== 1 || !['failed', 'completed-diagnostic-checks'].includes(report?.status)) issues.push('Not a supported diagnostic report');
  if (typeof report?.runId !== 'string' || !report.runId.trim()) issues.push('Missing run identity');
  if (report?.automaticCodeEdits !== 0 || report?.automaticAssetEdits !== 0) issues.push('Snapshot run unexpectedly edited source/assets');
  const stages = Array.isArray(report?.stages) ? report.stages : [];
  const stageNames = stages.map(stage => stage?.name);
  if (new Set(stageNames).size !== stageNames.length) issues.push('Duplicate stage guard');
  for (const name of REQUIRED_STAGES) if (stages.find(stage => stage?.name === name)?.status !== 'passed') issues.push(`Missing or failed guard stage: ${name}`);
  for (const name of ['pure-models', 'metadata', 'build', 'typecheck', 'lint']) if (stages.find(stage => stage?.name === name)?.exitCode !== 0) issues.push(`Command guard did not exit cleanly: ${name}`);
  for (const stage of stages) if (!REQUIRED_STAGES.includes(stage?.name) && !NATIVE_STAGES.includes(stage?.name) && stage?.status !== 'passed') issues.push(`Unresolved run stage: ${String(stage?.name)}`);
  const preserved = stages.find(stage => stage?.name === 'original-tree-preserved');
  if (typeof preserved?.detail !== 'string' || !/^0 original file hashes changed; git-state changed:false\./.test(preserved.detail)) issues.push('Source/Git preservation was not recorded as unchanged');
  for (const name of NATIVE_STAGES) if (!stages.some(stage => stage?.name === name)) issues.push(`Missing native gate record: ${name}`);
  const native = stages.find(stage => stage?.name === 'native-production-fixture');
  if (native?.exitCode !== 0) issues.push('Native process did not exit successfully');
  if (native?.status !== 'passed' && (typeof native?.detail !== 'string' || !['Exactly200 unique native cases', 'All nine exact personality trace IDs'].some(prefix => native.detail.startsWith(prefix)))) issues.push('Native stage failure is not the deliberately unselected full-coverage gate');
  const entries = report?.nativeEntries;
  if (!record(entries) || entries.plannedSelectedCases !== 200 || entries.selectedCaseCount !== selected.count || entries.selectedPassedCases !== selected.passed || entries.selectedUniqueTitles !== titles.size) issues.push('Recorded selected native counts differ from the actual reporter');

  if (!record(source) || !Array.isArray(source.sourceFiles) || !SHA256.test(source.contentDigest ?? '') || hash(JSON.stringify(source.sourceFiles)) !== source.contentDigest || source.contentDigest !== report?.sourceDigest) issues.push('Frozen source digest is missing or inconsistent');
  const sourceRows = Array.isArray(source?.sourceFiles) ? source.sourceFiles : [];
  if (sourceRows.some(row => !record(row) || !relativeFile(row.path) || !(row.sha256 === null || SHA256.test(row.sha256 ?? ''))) || new Set(sourceRows.map(row => row?.path)).size !== sourceRows.length) issues.push('Malformed or duplicate frozen source manifest');
  if (source?.privateSourceArtCopied !== false || source?.sourceIllustrationsCopied !== 0 || source?.sourceContractsCopied !== 0) issues.push('Credential-free snapshot exclusion guard is missing');

  const verification = record(evidenceVerification) ? evidenceVerification : {};
  if (!Array.isArray(verification.issues) || verification.issues.length) issues.push(...(Array.isArray(verification.issues) ? verification.issues.map(issue => `Evidence: ${issue}`) : ['Missing evidence verification']));
  if (verification.runId !== report?.runId || verification.sourceDigest !== report?.sourceDigest) issues.push('Evidence run/source binding differs');
  if (typeof report?.buildId !== 'string' || !report.buildId.trim() || verification.buildId !== report.buildId) issues.push('Build identity is missing or changed');
  const metadata = Array.isArray(verification.metadataFiles) ? verification.metadataFiles : [];
  if (new Set(metadata.map(row => row?.path)).size !== metadata.length) issues.push('Duplicate metadata verification');
  for (const name of REQUIRED_METADATA_PATHS) {
    const row = metadata.find(item => item?.path === name);
    if (!row || !SHA256.test(row.expectedSha256 ?? '') || row.expectedSha256 !== row.actualSha256) issues.push(`Missing or changed evidence hash: ${name}`);
  }
  const requiredSources = [...new Set([...REQUIRED_SOURCE_PATHS, ...selectedSourcePaths(specs, issues)])].sort();
  const verifiedSources = Array.isArray(verification.sourceFiles) ? verification.sourceFiles : [];
  if (new Set(verifiedSources.map(row => row?.path)).size !== verifiedSources.length) issues.push('Duplicate source verification');
  for (const name of requiredSources) if (!verifiedSources.some(row => row?.path === name)) issues.push(`Missing source binding: ${name}`);
  for (const row of verifiedSources) {
    const frozen = sourceRows.find(item => item?.path === row?.path);
    if (!safeSource(row?.path) || !frozen || !SHA256.test(frozen.sha256 ?? '') || row?.expectedSha256 !== frozen.sha256 || row?.workspaceSha256 !== frozen.sha256 || row?.rootSha256 !== frozen.sha256) issues.push(`Changed or unbound source subset: ${String(row?.path)}`);
  }
  const guardIssues = [...new Set(issues)];
  return {
    schemaVersion: 1, kind: 'companion-native-diagnostic', classification: 'diagnostic-only',
    diagnosticPassed: guardIssues.length === 0, releaseEligible: false,
    full200NotExecuted: selected.count !== 200, fullReleaseCertificationNotExecuted: true,
    runId: report?.runId ?? null, sourceDigest: report?.sourceDigest ?? null, buildId: report?.buildId ?? null,
    originalReportStatus: report?.status ?? null, originalStages: stages,
    selected, originalGlobalErrors: Array.isArray(reporter?.errors) ? reporter.errors : [],
    failures: selected.cases.filter(item => !item.passed), guardIssues,
    evidenceScope: { sourceVerification: 'explicit-subset', sourcePaths: verifiedSources.map(row => row?.path), metadataPaths: metadata.map(row => row?.path), fullSourceVerified: false, rawMediaVerified: false, originalGitPreservation: 'recorded-run-guard-only', releaseCertificationVerified: false },
  };
}

function within(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function canonicalDirectory(value) {
  const absolute = path.resolve(value);
  const real = fs.realpathSync(absolute);
  const comparable = item => process.platform === 'win32' ? item.toLowerCase() : item;
  if (comparable(real) !== comparable(absolute) || !fs.lstatSync(absolute).isDirectory()) throw Error('Directory traverses a symbolic link/junction or is not a directory');
  return absolute;
}

function checkedFile(base, relative, maximum) {
  if (!relativeFile(relative)) throw Error('Unsafe evidence/source path');
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (!within(base, current) || fs.lstatSync(current).isSymbolicLink()) throw Error('Evidence/source path escapes its root or traverses a symbolic link/junction');
  }
  const stat = fs.statSync(current);
  if (!stat.isFile() || stat.size > maximum) throw Error('Evidence/source is not a bounded regular file');
  const bytes = fs.readFileSync(current);
  if (bytes.length !== stat.size || bytes.length > maximum) throw Error('Evidence/source changed while being read');
  return bytes;
}

/**
 * Read-only adapter. `run` is an absolute path inside `root` or a root-relative
 * retained run path. Automatically verifies the three harness source files and
 * all selected spec sources, plus caller-declared `sourcePaths`, against BOTH
 * current root and frozen workspace. Raw media and all other source files remain
 * explicitly unverified; unchanged originals are a recorded guard, not a new Git
 * audit. This function does not execute tests or edit/repair retained evidence.
 */
export function inspectCompanionDiagnostic({ root, run, sourcePaths = [] } = {}) {
  const issues = [];
  let report, source, reporter;
  const verification = { issues, metadataFiles: [], sourceFiles: [], buildId: null, runId: null, sourceDigest: null };
  try {
    if (typeof root !== 'string' || typeof run !== 'string' || !Array.isArray(sourcePaths)) throw Error('Explicit root, run and a sourcePaths array are required');
    const rootDirectory = canonicalDirectory(root);
    const runDirectory = path.resolve(rootDirectory, run);
    if (!within(rootDirectory, runDirectory) || runDirectory === rootDirectory) throw Error('Run must be a retained child directory of root');
    canonicalDirectory(runDirectory);
    const manifest = JSON.parse(checkedFile(runDirectory, 'evidence-manifest.json', MAX_JSON_BYTES).toString('utf8'));
    for (const key of ['report', 'files']) {
      const rows = manifest[key];
      if (!Array.isArray(rows) || rows.some(row => !record(row) || !relativeFile(row.path) || !SHA256.test(row.sha256 ?? '')) || new Set(rows.map(row => row.path)).size !== rows.length) throw Error(`Malformed or duplicate evidence manifest ${key}`);
    }
    function metadataFile(relative, entries, manifestPath) {
      const bytes = checkedFile(runDirectory, relative, MAX_JSON_BYTES);
      const row = entries.find(item => item.path === manifestPath);
      if (!row || (row.bytes !== undefined && row.bytes !== bytes.length)) issues.push(`Missing manifest entry or changed byte count: ${relative}`);
      verification.metadataFiles.push({ path: relative, expectedSha256: row?.sha256 ?? null, actualSha256: hash(bytes) });
      return JSON.parse(bytes.toString('utf8'));
    }
    report = metadataFile('report.json', manifest.report, 'report.json');
    source = metadataFile('source-freeze.json', manifest.report, 'source-freeze.json');
    reporter = metadataFile('attempt-01/playwright.json', manifest.files, 'playwright.json');
    verification.runId = path.basename(runDirectory);
    verification.sourceDigest = source.contentDigest;
    verification.buildId = checkedFile(runDirectory, 'workspace/.next/BUILD_ID', 4096).toString('utf8').trim();
    const selected = selectedSpecs(reporter, issues);
    const paths = [...new Set([...REQUIRED_SOURCE_PATHS, ...selectedSourcePaths(selected, issues), ...sourcePaths])].sort();
    if (sourcePaths.some(item => !safeSource(item))) issues.push('Caller source subset contains an unsafe/private path');
    const frozenRows = Array.isArray(source.sourceFiles) ? source.sourceFiles : [];
    for (const name of paths) {
      if (!safeSource(name)) { issues.push('Unsafe/private source subset entry was not read'); continue; }
      const frozen = frozenRows.find(row => row?.path === name);
      if (!frozen || !SHA256.test(frozen.sha256 ?? '')) { issues.push(`Source subset absent from frozen manifest: ${name}`); continue; }
      try {
        verification.sourceFiles.push({ path: name, expectedSha256: frozen.sha256, workspaceSha256: hash(checkedFile(runDirectory, `workspace/${name}`, MAX_SOURCE_BYTES)), rootSha256: hash(checkedFile(rootDirectory, name, MAX_SOURCE_BYTES)) });
      } catch (error) { issues.push(`Cannot verify source subset ${name}: ${String(error.message ?? error)}`); }
    }
  } catch (error) { issues.push(String(error.message ?? error)); }
  return evaluateCompanionDiagnostic({ report, source, reporter, evidenceVerification: verification });
}

/** A passing arbitrary subset is not a completed daily plan. */
export function bindDiagnosticPlan(plan, diagnostic, recordedGrep) {
  const issues=[];
  const selection=plan?.companion,titles=diagnostic?.selected?.cases?.map(row=>row.title)??[];
  if(plan?.kind!=='site-daily-triage-plan'||selection?.mode!=='diagnostic-only'||selection?.fullRequired!==false)issues.push('Not a diagnostic daily plan');
  if(typeof selection?.nativePattern!=='string'||selection.nativePattern!==recordedGrep)issues.push('Planned and recorded grep differ');
  if(!Number.isInteger(selection?.expectedSelectedCases)||selection.expectedSelectedCases!==titles.length)issues.push('Planned selected count differs from actual selected count');
  const patterns=selection?.requiredTitlePatterns;
  if(!Array.isArray(patterns)||!patterns.length||patterns.length!==selection?.expectedSelectedCases||new Set(patterns).size!==patterns.length)issues.push('Missing exact per-case plan requirements');
  else for(const pattern of patterns){try{if(typeof pattern!=='string'||pattern.length>1024||titles.filter(title=>new RegExp(pattern).test(title)).length!==1)issues.push('Missing or duplicate required planned case');}catch{issues.push('Invalid planned case pattern');}}
  if(diagnostic?.diagnosticPassed!==true)issues.push('Underlying evidence diagnostic did not pass');
  return {kind:'site-daily-plan-bound-diagnostic',planSatisfied:issues.length===0,releaseEligible:false,selectedCount:titles.length,issues};
}
