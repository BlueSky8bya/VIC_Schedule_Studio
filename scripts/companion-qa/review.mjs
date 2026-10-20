/** Local, read-only finalization of one closed factory. This validates supplied
 * receipts; it cannot authenticate agents or replace three actual independent
 * invocations by the parent. It never runs repairs, browsers, commits or deploys. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PERSONALITIES, NATIVE_ENTRY_TITLES, NATIVE_FLOATING_TIDY_TITLES, PLANNED_NATIVE_CASE_COUNT } from './catalog.mjs';
import { snapshotEligible, nativeEntryEvidence, dailyEvidenceGate } from './runner.mjs';
import { traceSufficiency, traceContextComplete } from './trace-checks.mjs';
import { traceLivingContextComplete } from './living-criteria.mjs';
import { AUDITED_MACHINE_METADATA } from './machine-metadata.mjs';

export const REVIEW_PERSPECTIVES = Object.freeze(['living-and-goal-continuity', 'spatial-and-interaction-ux', 'boundary-off-and-evidence-qa']);
export const ITEMS_SCROLL_147_TITLES = Object.freeze([
  '147 native food and toy drag release keep the actual grip and unanchored flight',
  ...[['viewer',1920],['viewer',1100],['studio',1920],['preview',1920]].flatMap(([surface,width]) => ['full','soft','off'].map(mode => `147 ${surface} ${width} ${mode} floor food and toy follow rapid native scroll`))
]);
const REQUIRED_STAGES = Object.freeze(['isolated-snapshot', 'pure-models', 'pure-count-proof', 'metadata', 'build', 'typecheck', 'lint', 'native-production-fixture', 'native-personality-entry-proof', 'owned-process-cleanup', 'original-tree-preserved']);
const CATALOG = 'lib/ui/viewer-companion/personality-scene-catalog.ts';
const HEX = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_./:-]{1,120}$/;
const MAX_FILES = 12000, MAX_REFERENCES = 1200, MAX_FILE_BYTES = 64 * 1024 * 1024, MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const LIMITATIONS = Object.freeze([
  'Hashes establish local artifact integrity, not authenticated reviewer identity or honesty. The parent must actually dispatch three fresh, read-only, non-author agents and retain their receipts.',
  'This does not execute a scheduled run, repair code, authorize publication, run a browser, or prove all catalog recipes/all configurations were rendered.',
  'A native completion note is checked against its exact passing reporter case, immutable evidence manifest and visible decoded scene samples. Its physical/playback assertions remain the responsibility of that frozen native test and independent reviewers.',
  'The source snapshot is checked at finalization; this is not an operating-system lock or a proof of later unchanged files. Pure-model evidence is separate from native evidence.'
]);
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const array = x => Array.isArray(x) ? x : [];
const text = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 2000;
const hash = x => typeof x === 'string' && HEX.test(x);
const sha = x => createHash('sha256').update(x).digest('hex');
const all = (value, expected) => Array.isArray(value) && value.length === expected.length && new Set(value).size === expected.length && expected.every(x => value.includes(x));
const cleanList = x => Array.isArray(x) && x.length === 0;
function sameRun(x, report) { return x?.runId === report?.runId && x?.sourceDigest === report?.sourceDigest && x?.buildId === report?.buildId && x?.dayKst === (typeof report?.createdAtKst === 'string' ? report.createdAtKst.slice(0, 10) : undefined); }
function validDay(day) { if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false; const d = new Date(day + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === day; }
function actualCaseTitles(reporter) {
  const result = new Map();
  const visit = suites => { for (const suite of array(suites)) {
    for (const spec of array(suite?.specs)) { const test = array(spec.tests)[0], r = array(test?.results)[0];
      if (array(spec.tests).length === 1 && array(test?.results).length === 1 && test.expectedStatus === 'passed' && test.status === 'expected' && r.status === 'passed' && r.retry === 0) result.set(spec.title, r);
    }
    visit(suite?.suites);
  } };
  visit(reporter?.suites); return result;
}
/** Recompute candidates from all raw DOM phases. A claimed no-candidate label
 * cannot remove a scroll/rAF/post-timer observation from independent review. */
function itemRenderCandidates(raw, caseTitle) {
  if (!Array.isArray(raw?.frames) || raw.frames.length > 100000) return null;
  if (caseTitle.includes(' floor ') && (!raw.frames.length || !['scroll','frame','post-render'].every(phase => raw.frames.some(f => f?.phase === phase)))) return null;
  const candidates = [];
  for (const frame of raw.frames) {
    if (!['scroll','frame','post-render'].includes(frame?.phase) || !Number.isFinite(frame.at) || !Array.isArray(frame.items) || frame.items.length !== 2) return null;
    if (!all(frame.items.map(x => x?.type), ['food','toy'])) return null;
    for (const item of frame.items) {
      if (typeof item.eligible !== 'boolean' || typeof item.shown !== 'boolean' || !text(item.id) || !Number.isFinite(item.dx) || !Number.isFinite(item.dy)) return null;
      if (item.eligible && (!item.shown || Math.max(Math.abs(item.dx),Math.abs(item.dy)) >= 2)) candidates.push({phase:frame.phase,at:frame.at,type:item.type,id:item.id,shown:item.shown,dx:item.dx,dy:item.dy});
    }
  }
  return candidates;
}
function checkRenderedItems147(input, actualTitles, reviewed, report, add) {
  const entries = array(input.renderedNativeEvidence);
  if (!ITEMS_SCROLL_147_TITLES.every(title => actualTitles.has(title)) || !all(entries.map(e => e?.caseTitle), ITEMS_SCROLL_147_TITLES)) add('items147-exact-cases-or-attachments');
  const candidates = [];
  for (const entry of entries) {
    const raw = entry?.document, observed = itemRenderCandidates(raw, entry?.caseTitle ?? '');
    if (!ITEMS_SCROLL_147_TITLES.includes(entry?.caseTitle) || entry.attachmentBound !== true || !hash(entry.sha256) || !relative(entry.path) || raw?.schemaVersion !== 1 || raw?.kind !== 'companion-items-scroll-147' || raw?.caseTitle !== entry.caseTitle || raw?.buildId !== report?.buildId || raw?.build !== report?.buildId || raw?.status !== 'passed' || raw?.admissionStatus !== 'passed' || !cleanList(raw?.errors) || !cleanList(raw?.unexpected) || raw?.renderThresholdCssPx !== 2 || observed === null || JSON.stringify(raw?.renderCandidates) !== JSON.stringify(observed) || raw?.renderedStatus !== (observed?.length ? 'needs_render_review' : 'no_candidate_observed')) { add('items147-raw-unproved'); continue; }
    if (observed.length) candidates.push({entry,observed});
  }
  for (const review of reviewed) {
    const assessments = array(review?.document?.renderedAssessments);
    if (assessments.length !== candidates.length) add('items147-three-rendered-assessments');
    for (const {entry,observed} of candidates) {
      const matches = assessments.filter(a => a?.caseTitle === entry.caseTitle && a?.buildId === report?.buildId && a?.rawAttachment?.path === entry.path && a?.rawAttachment?.sha256 === entry.sha256);
      if (matches.length !== 1) { add('items147-three-rendered-assessments'); continue; }
      const assessment = matches[0], paints = array(assessment.paintEvidence);
      if (assessment.state !== 'prepaint_observation' || assessment.candidateCount !== observed.length || !Number.isFinite(assessment.maxRelativeErrorCssPx) || assessment.maxRelativeErrorCssPx < 0 || assessment.maxRelativeErrorCssPx >= 2 || assessment.missing !== 0 || !text(assessment.reason) || !['trace','video'].every(kind => paints.some(p => p?.kind === kind)) || new Set(paints.map(p => p?.path)).size !== paints.length || paints.length > 12 || paints.some(p => !['trace','video'].includes(p?.kind) || p.pixelScale !== 1 || !Number.isSafeInteger(p.sampleCount) || p.sampleCount < 2 || !array(entry.paintAttachments).some(original => original.attachmentBound === true && original.kind === p.kind && original.path === p.path && original.sha256 === p.sha256))) add('items147-rendered-unproved');
    }
  }
}
/** Parse declarations without executing product TypeScript or accepting a label
 * that merely occurs in a comment/string elsewhere in the file. Only explicit
 * literal records in the exported catalog are supported; unfamiliar syntax holds. */
export function registeredRecipes(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 2 * 1024 * 1024) throw Error('catalog-size');
  const file = ts.createSourceFile('catalog.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), found = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== 'COMPANION_PERSONALITY_SCENES') continue;
      const init = decl.initializer;
      if (!init || !ts.isCallExpression(init) || init.expression.getText(file) !== 'Object.freeze' || init.arguments.length !== 1 || !ts.isArrayLiteralExpression(init.arguments[0])) throw Error('catalog-shape');
      for (const record of init.arguments[0].elements) {
        if (!ts.isObjectLiteralExpression(record)) throw Error('catalog-record');
        const properties = new Map();
        for (const prop of record.properties) {
          if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) throw Error('catalog-record');
          const key=prop.name.text;
          if(properties.has(key)) throw Error('catalog-record');
          properties.set(key,prop.initializer);
        }
        const id = properties.get('id'), personality = properties.get('personality');
        if (!id || !personality || !ts.isStringLiteral(id) || !ts.isStringLiteral(personality) || !TOKEN.test(id.text) || !PERSONALITIES.includes(personality.text)) throw Error('catalog-registration');
        found.push({ id: id.text, personality: personality.text });
      }
    }
  }
  if (!found.length || new Set(found.map(x => x.id)).size !== found.length) throw Error('catalog-registration');
  return found;
}
/** Pure consistency checks only. Input has already been hash-verified by the
 * file wrapper; calling this function alone is never a native or release proof. */
export function evaluateReviewContracts(input) {
  const issues = [], add = code => { if (!issues.includes(code)) issues.push(code); };
  if (!obj(input)) return { passed: false, issues: ['input-shape'] };
  const { report, source, ideas, reviews, daily, reporter, registrations, nativeEvidence, pureReport, modelCoverage, authors: knownAuthors } = input;
  const day = typeof report?.createdAtKst === 'string' ? report.createdAtKst.slice(0, 10) : '';
  if (!pureReport?.success || pureReport.numFailedTests !== 0 || pureReport.numPendingTests !== 0 || !(pureReport.numTotalTests > 0) || modelCoverage?.recipeCount !== array(registrations).length || modelCoverage?.entries !== 9 || modelCoverage?.routineTemplates !== 54 || modelCoverage?.booleanPatterns !== 262144) add('pure-coverage-mismatch');
  if (!obj(report) || report.schemaVersion !== 1 || report.status !== 'completed-scoped-checks' || !hash(report.sourceDigest) || !TOKEN.test(report.runId ?? '') || !TOKEN.test(report.buildId ?? '') || !validDay(day) || typeof report.createdAtKst !== 'string' || !report.createdAtKst.endsWith(' KST')) add('factory-not-closed');
  if (!source || source.contentDigest !== report?.sourceDigest || source.recomputedDigest !== report?.sourceDigest || source.buildId !== report?.buildId || source.snapshotMatches !== true || source.privateSourceArtCopied !== false || source.sourceIllustrationsCopied !== 0 || source.sourceContractsCopied !== 0) add('source-build-mismatch');
  for (const name of REQUIRED_STAGES) {
    const matches = array(report?.stages).filter(s => s?.name === name);
    if (matches.length !== 1 || matches[0].status !== 'passed' || ('exitCode' in matches[0] && matches[0].exitCode !== 0)) add('factory-stage-' + name);
  }
  const gate = nativeEntryEvidence(reporter);
  if (!gate.gatePassed || report?.nativeEntries?.gatePassed !== true || report?.nativeEntries?.selectedPassedCases !== PLANNED_NATIVE_CASE_COUNT || report?.universe?.plannedNativeCaseCount !== PLANNED_NATIVE_CASE_COUNT || report?.universe?.plannedNativeEntryCases !== NATIVE_ENTRY_TITLES.length || report?.universe?.plannedNativeFloatingTidyCases !== NATIVE_FLOATING_TIDY_TITLES.length) add('native-exact-counts');
  const expected = PERSONALITIES.map(personality => ({ id: 'daily-' + personality, personality }));
  if (!dailyEvidenceGate(expected, array(daily)) || report?.dailyCases?.required !== 9 || report?.dailyCases?.observed !== 9 || report?.dailyCases?.passed !== 9) add('daily-nine-insufficient');
  for (const row of array(daily)) {
    if (!traceSufficiency(array(row.frames), 90).passed || !traceContextComplete(array(row.frames)) || !traceLivingContextComplete(array(row.frames)) || array(row.frames).some(f => f.visible && f.decoded && f.personality !== row.scenario?.personality)) add('daily-raw-insufficient');
    if (row.proof?.build !== report?.buildId || !cleanList(row.proof?.errors) || !cleanList(row.proof?.rejected) || !cleanList(row.proof?.mutations) || !cleanList(row.proof?.liveReads) || !Array.isArray(row.proof?.chunks) || row.proof.chunks.length < 1 || !row.proof.chunks.every(c => hash(c?.served) && c.served === c.local)) add('daily-source-or-boundary');
  }
  if (!obj(ideas) || ideas.schemaVersion !== 1 || ideas.kind !== 'companion-daily-ideas' || !sameRun(ideas, report) || !all(array(ideas.items).map(x => x?.personality), PERSONALITIES)) add('ideas-nine-binding');
  const items = array(ideas?.items), authors = array(ideas?.authors), ids = items.map(x => x?.id);
  if (!all(knownAuthors, authors) || !authors.length || authors.length > 20 || !authors.every(x => typeof x === 'string' && TOKEN.test(x)) || new Set(authors).size !== authors.length || ids.some(x => typeof x !== 'string' || !TOKEN.test(x)) || new Set(ids).size !== 9) add('idea-author-or-ids');
  const reviewed = array(reviews);
  if (reviewed.length !== 3 || !all(reviewed.map(x => x?.document?.perspective), REVIEW_PERSPECTIVES) || new Set(reviewed.map(x => x?.document?.agentId)).size !== 3) add('three-unique-reviewers');
  for (const record of reviewed) {
    const r = record?.document, call = record?.invocation;
    if (!obj(r) || r.schemaVersion !== 1 || r.kind !== 'companion-independent-review' || !sameRun(r, report) || typeof r.agentId !== 'string' || !TOKEN.test(r.agentId) || authors.includes(r.agentId) || r.readOnly !== true || r.fresh !== true || r.decision !== 'accept' || !REVIEW_PERSPECTIVES.includes(r.perspective)) add('review-not-independent-accepted');
    if (!obj(call) || call.schemaVersion !== 1 || call.kind !== 'companion-parent-grader-receipt' || !sameRun(call, report) || call.agentId !== r?.agentId || call.perspective !== r?.perspective || !authors.includes(call.parentAgentId) || call.fresh !== true || call.readOnly !== true || call.parentAgentId === call.agentId || !hash(call.dispatchReceiptSha256) || !hash(call.completionReceiptSha256)) add('review-parent-receipt');
    if (!all(array(r?.assessments).map(a => a?.ideaId), ids) || array(r?.assessments).some(a => !['accept', 'reject'].includes(a?.decision) || !text(a?.reason))) add('review-all-nine');
    if (!Array.isArray(r?.findings) || r.findings.length > 100 || r.findings.some(f => !obj(f) || !['P0', 'P1', 'P2', 'P3'].includes(f.severity) || !['resolved', 'open'].includes(f.status) || !text(f.reason) || (f.severity !== 'P3' && f.status !== 'resolved') || (f.status === 'resolved' && !array(f.evidence).length))) add('review-unresolved-findings');
    if (!Array.isArray(r?.evidence) || r.evidence.length < 1 || r.evidence.length > 50) add('review-missing-evidence');
  }
  const actualTitles = actualCaseTitles(reporter);
  checkRenderedItems147(input, actualTitles, reviewed, report, add);
  for (const item of items) {
    if (!text(item?.hypothesis) || !text(item?.reason) || !['adopted', 'rejected', 'blocked', 'deferred'].includes(item?.decision)) { add('idea-decision'); continue; }
    if (item.decision !== 'adopted') continue;
    if (!array(registrations).some(r => r.id === item.registeredRecipeId && r.personality === item.personality) || item.implementation?.path !== CATALOG || !hash(item.implementation?.sha256)) add('idea-unregistered-implementation');
    if (!array(item.pureModelEvidence).length || item.pureModelEvidence.length > 6) add('idea-missing-pure-evidence');
    for (const ref of array(item.pureModelEvidence)) {
      if (ref?.kind !== 'pure-model' || ref.path !== 'pure/vitest.json' || typeof ref.testFullName !== 'string' || !ref.testFullName.includes(item.registeredRecipeId) || !array(pureReport?.testResults).some(f => array(f?.assertionResults).some(t => t?.status === 'passed' && t.fullName === ref.testFullName))) add('idea-pure-model-unproved');
    }
    if (!array(item.actualCaseEvidence).length || item.actualCaseEvidence.length > 12) add('idea-missing-native-evidence');
    for (const ref of array(item.actualCaseEvidence)) {
      const bound = array(nativeEvidence).find(e => e.path === ref?.path && e.sha256 === ref?.sha256 && e.caseTitle === ref?.caseTitle);
      const raw = bound?.document;
      const completed = array(raw?.notes).flatMap(n => array(n?.reachedFinalBeatAndSubsequentSequence));
      const paints = array(raw?.frames).filter(f => f?.scene === item.registeredRecipeId && f.visible === true && f.decoded === true && Number.isFinite(f.at));
      if (ref?.kind !== 'native' || bound?.attachmentBound !== true || !actualTitles.has(ref?.caseTitle) || raw?.status !== 'passed' || !completed.some(x => x?.id === item.registeredRecipeId) || paints.length < 2 || !cleanList(raw?.errors) || !cleanList(raw?.rejected)) add('idea-native-completion-unproved');
    }
    if (reviewed.some(r => !array(r?.document?.assessments).some(a => a.ideaId === item.id && a.decision === 'accept'))) add('idea-not-three-accepted');
  }
  return { passed: issues.length === 0, issues };
}

function relative(value) { return typeof value === 'string' && value.length > 0 && value.length < 600 && !path.isAbsolute(value) && !/^[A-Za-z]:/.test(value) && !value.includes('\\') && !value.includes(':') && !value.includes('\0') && value.split('/').every(x => x && x !== '.' && x !== '..'); }
function assertUnlinked(absolute) {
  const resolved = path.resolve(absolute), parsed = path.parse(resolved); let at = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    if (/^(?:\.env(?:\..*)?|\.git|\.vercel|node_modules|credentials|secrets)$/i.test(part)) throw Error('sensitive-path-excluded');
    at = path.join(at, part); const stat = fs.lstatSync(at); if (stat.isSymbolicLink()) throw Error('linked-path');
  }
  return resolved;
}
function localFile(root, name, auditedMachine = false) { if (!relative(name)) throw Error('unsafe-relative-path'); if (name.split('/').some(x => /^(?:art-src|feedback_sources|user_turns|contracts?|capture_state)$/i.test(x)) && !auditedMachine) throw Error('sensitive-path-excluded'); const full = path.resolve(root, name); if (!full.startsWith(path.resolve(root) + path.sep)) throw Error('outside-root'); return assertUnlinked(full); }
function reader() {
  let total = 0; const cache = new Map();
  const fingerprint = file => {
    file = assertUnlinked(file); if (cache.has(file)) return cache.get(file);
    const stat = fs.statSync(file); if (!stat.isFile() || stat.size > MAX_FILE_BYTES || (total += stat.size) > MAX_TOTAL_BYTES) throw Error('file-budget');
    const digest = createHash('sha256'), fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(1024 * 1024);
    try { let bytes; while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, bytes)); } finally { fs.closeSync(fd); }
    const value = { sha256: digest.digest('hex'), bytes: stat.size }; cache.set(file, value); return value;
  };
  const json = (file, cap = 24 * 1024 * 1024) => { const f = fingerprint(file); if (f.bytes > cap) throw Error('json-budget'); return JSON.parse(fs.readFileSync(file, 'utf8')); };
  const verify = (root, ref, cap) => { if (!obj(ref) || !hash(ref.sha256)) throw Error('reference-shape'); const file = localFile(root, ref.path); const fp = fingerprint(file); if (fp.sha256 !== ref.sha256 || ('bytes' in ref && fp.bytes !== ref.bytes)) throw Error('reference-sha-mismatch'); return cap === undefined ? file : json(file, cap); };
  return { fingerprint, json, verify };
}
/** Reads only named local files. No live service, credential, subprocess or browser
 * is opened. Linked paths and traversal fail closed. Output must be a new file. */
export function finalizeDailyReview(options) {
  const failure = code => ({ schemaVersion: 1, kind: 'companion-daily-finalization', eligibleForAuthorizedRelease: false, decision: 'hold', issues: [code], limitations: LIMITATIONS });
  try {
    const read = reader(), run = assertUnlinked(options.run), reviewFile = assertUnlinked(options.reviews), ideaFile = assertUnlinked(options.ideas);
    const manifest = read.json(localFile(run, 'evidence-manifest.json')), reportMap = new Map(), evidence = new Map();
    if (!Array.isArray(manifest.report) || !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES || manifest.report.length > 8) throw Error('manifest-budget');
    for (const ref of manifest.report) { if (!relative(ref.path) || reportMap.has(ref.path)) throw Error('manifest-duplicate'); reportMap.set(ref.path, ref); }
    for (const ref of manifest.files) { if (!relative(ref.path) || evidence.has(ref.path)) throw Error('manifest-duplicate'); evidence.set(ref.path, ref); }
    const loadReport = name => { if (!reportMap.has(name)) throw Error('manifest-missing-report'); return read.verify(run, reportMap.get(name), 24 * 1024 * 1024); };
    const report = loadReport('report.json'), freeze = loadReport('source-freeze.json'); loadReport('universe.json');
    if (!Array.isArray(freeze.sourceFiles) || freeze.sourceFiles.length > MAX_FILES || new Set(freeze.sourceFiles.map(f => f?.path)).size !== freeze.sourceFiles.length) throw Error('source-list');
    const machine = new Set(AUDITED_MACHINE_METADATA.map(x => x.path)); let copied = 0;
    for (const entry of freeze.sourceFiles) {
      if (!relative(entry?.path) || (entry.sha256 !== null && !hash(entry.sha256))) throw Error('source-entry');
      if (!snapshotEligible(entry.path) && !machine.has(entry.path)) continue; // Never follow private artwork/contracts or references in JSON.
      if (entry.sha256 === null) { if (fs.existsSync(path.resolve(run, 'workspace', entry.path))) throw Error('deleted-source-reappeared'); continue; }
      if (read.fingerprint(localFile(path.join(run, 'workspace'), entry.path, machine.has(entry.path))).sha256 !== entry.sha256) throw Error('snapshot-source-changed'); copied++;
    }
    const buildFile = localFile(run, 'workspace/.next/BUILD_ID'); if (read.fingerprint(buildFile).bytes > 200) throw Error('build-id-budget');
    const source = { ...freeze, recomputedDigest: sha(JSON.stringify(freeze.sourceFiles)), buildId: fs.readFileSync(buildFile, 'utf8').trim(), snapshotMatches: true };
    const loadEvidence = (ref, parse = true) => { const frozen = evidence.get(ref?.path); if (!frozen || frozen.sha256 !== ref.sha256) throw Error('evidence-not-frozen'); return read.verify(path.join(run, 'attempt-01'), frozen, parse ? 24 * 1024 * 1024 : undefined); };
    if (!evidence.has('playwright.json')) throw Error('native-reporter-missing'); const reporter = loadEvidence(evidence.get('playwright.json'));
    const daily = PERSONALITIES.map(p => { const ref = evidence.get('native/daily/daily-' + p + '.json'); if (!ref) throw Error('daily-evidence-missing'); return loadEvidence(ref); });
    const ideas = read.json(ideaFile, 1024 * 1024), index = read.json(reviewFile, 256 * 1024), reviewRoot = path.dirname(reviewFile), reviews = [];
    if (index.schemaVersion !== 1 || index.kind !== 'companion-review-index' || !Array.isArray(index.reviews) || index.reviews.length !== 3) throw Error('review-index');
    const refs = [];
    for (const item of index.reviews) {
      const document = read.verify(reviewRoot, item.review, 512 * 1024), invocation = read.verify(reviewRoot, item.invocation, 256 * 1024);
      // Actual call/completion receipt files are preserved, not only a claimed digest.
      const dispatch = read.verify(reviewRoot, invocation.dispatchReceipt), completion = read.verify(reviewRoot, invocation.completionReceipt);
      if (read.fingerprint(dispatch).sha256 !== invocation.dispatchReceiptSha256 || read.fingerprint(completion).sha256 !== invocation.completionReceiptSha256) throw Error('invocation-receipt-sha');
      reviews.push({ document, invocation }); refs.push(...array(document.evidence), ...array(document.findings).flatMap(f => array(f?.evidence)), ...array(document.renderedAssessments).flatMap(a => [...array(a?.paintEvidence), a?.rawAttachment].filter(Boolean)));
    }
    const nativeEvidence = [], passedCases = actualCaseTitles(reporter);
    const frozenAttachment = attachment => {
      if (typeof attachment?.path !== 'string' || !path.isAbsolute(attachment.path)) throw Error('items147-attachment-not-frozen');
      const name = path.relative(path.join(run, 'attempt-01'), attachment.path).replaceAll('\\', '/');
      if (!relative(name)) throw Error('items147-attachment-not-frozen');
      const frozen = evidence.get(name); if (!frozen) throw Error('items147-attachment-not-frozen');
      read.verify(path.join(run,'attempt-01'),frozen); return frozen;
    };
    // These thirteen cases are checked independently of adopted idea references.
    // Removing all147 ideas/attachments cannot bypass the rendered-review gate.
    const renderedNativeEvidence = ITEMS_SCROLL_147_TITLES.map(caseTitle => {
      const attachments = array(passedCases.get(caseTitle)?.attachments), raw = attachments.filter(a => a?.name === 'actual-items-scroll-147' && a?.contentType === 'application/json');
      if (raw.length !== 1) throw Error('items147-exact-cases-or-attachments');
      const frozen = frozenAttachment(raw[0]);
      const paintAttachments = attachments.flatMap(a => {
        const kind = a?.name === 'trace' && a?.contentType === 'application/zip' ? 'trace' : a?.name === 'video' && a?.contentType?.startsWith('video/') ? 'video' : null;
        return kind ? [{...frozenAttachment(a),kind,attachmentBound:true}] : [];
      });
      return {...frozen,caseTitle,attachmentBound:true,document:loadEvidence(frozen),paintAttachments};
    });
    const attachmentMatches = ref => array(passedCases.get(ref?.caseTitle)?.attachments).some(attachment => {
      if (attachment?.contentType !== 'application/json' || typeof attachment.path !== 'string' || !path.isAbsolute(attachment.path)) return false;
      const name = path.relative(path.join(run, 'attempt-01'), attachment.path).replaceAll('\\', '/');
      if (!relative(name)) return false;
      const frozen = evidence.get(name); if (!frozen || frozen.sha256 !== ref.sha256) return false;
      read.verify(path.join(run, 'attempt-01'), frozen); return true;
    });
    for (const item of array(ideas.items)) if (item?.decision === 'adopted') {
      if (item.implementation?.path !== CATALOG || read.fingerprint(localFile(path.join(run, 'workspace'), CATALOG)).sha256 !== item.implementation?.sha256) throw Error('implementation-source-mismatch');
      refs.push(...array(item.pureModelEvidence));
      for (const ref of array(item.actualCaseEvidence)) nativeEvidence.push({ ...ref, attachmentBound: attachmentMatches(ref), document: loadEvidence(ref) });
    }
    if (refs.length > MAX_REFERENCES) throw Error('reference-budget'); for (const ref of refs) loadEvidence(ref, false);
    if (!freeze.sourceFiles.some(x => x.path === CATALOG && hash(x.sha256))) throw Error('catalog-not-frozen');
    const catalogFile = localFile(path.join(run, 'workspace'), CATALOG), registrations = registeredRecipes(fs.readFileSync(catalogFile, 'utf8'));
    const pureReport = loadEvidence(evidence.get('pure/vitest.json')), modelCoverage = loadEvidence(evidence.get('pure/model-coverage.json'));
    const assessed = evaluateReviewContracts({ report, source, ideas, reviews, daily, reporter, registrations, nativeEvidence, renderedNativeEvidence, pureReport, modelCoverage, authors: index.authors });
    const result = { schemaVersion: 1, kind: 'companion-daily-finalization', runId: report.runId, sourceDigest: report.sourceDigest, buildId: report.buildId, dayKst: report.createdAtKst?.slice(0, 10),
      eligibleForAuthorizedRelease: assessed.passed, decision: assessed.passed ? 'candidate-for-authorized-release' : 'hold', issues: assessed.issues,
      integrity: { copiedSourceFiles: copied, reportSha256: reportMap.get('report.json').sha256, evidenceManifestSha256: read.fingerprint(localFile(run, 'evidence-manifest.json')).sha256, reviewsIndexSha256: read.fingerprint(reviewFile).sha256, ideasSha256: read.fingerprint(ideaFile).sha256 },
      scope: { nativeCases: PLANNED_NATIVE_CASE_COUNT, actualEntryCases: NATIVE_ENTRY_TITLES.length, actualDailyCases: 9, registeredRecipes: registrations.length, reviewedIdeas: array(ideas.items).length, independentReceipts: reviews.length, nativeExhaustive: false, modelTraining: false, scheduledExecutionProved: false, automaticRelease: false, reviewerIdentity: 'parent-attested-not-authenticated' },
      ideas: array(ideas.items).map(x => ({ id: x.id, personality: x.personality, decision: x.decision })), limitations: LIMITATIONS };
    if (options.output) { const out = path.resolve(options.output); if (out.toLowerCase().startsWith(run.toLowerCase() + path.sep) || out.toLowerCase() === run.toLowerCase()) throw Error('output-inside-frozen-run'); assertUnlinked(path.dirname(out)); fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); }
    return result;
  } catch (error) {
    // Fixed codes only: never echo arbitrary file paths, file contents or raw errors.
    const known = ['linked-path', 'sensitive-path-excluded', 'unsafe-relative-path', 'outside-root', 'file-budget', 'json-budget', 'reference-shape', 'reference-sha-mismatch', 'manifest-budget', 'manifest-duplicate', 'manifest-missing-report', 'source-list', 'source-entry', 'deleted-source-reappeared', 'snapshot-source-changed', 'build-id-budget', 'evidence-not-frozen', 'native-reporter-missing', 'daily-evidence-missing', 'review-index', 'invocation-receipt-sha', 'implementation-source-mismatch', 'reference-budget', 'output-inside-frozen-run', 'catalog-not-frozen', 'catalog-size', 'catalog-shape', 'catalog-record', 'catalog-registration', 'items147-attachment-not-frozen', 'items147-exact-cases-or-attachments'];
    return failure(known.includes(error?.message) ? error.message : 'local-evidence-unreadable-or-output-exists');
  }
}
export function parseReviewOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) { if (!['--run', '--reviews', '--ideas', '--output'].includes(argv[i])) throw Error('review-arguments'); const key = argv[i].slice(2); if (key in options || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('review-arguments'); options[key] = path.resolve(argv[++i]); }
  if (!options.run || !options.reviews || !options.ideas) throw Error('review-arguments'); return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = finalizeDailyReview(parseReviewOptions(process.argv.slice(2))); process.stdout.write(JSON.stringify(result, null, 2) + '\n'); process.exitCode = result.eligibleForAuthorizedRelease ? 0 : 1; }
  catch { process.stderr.write('Review arguments invalid; no release performed.\n'); process.exitCode = 1; }
}
