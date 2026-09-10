// 공통화풍참고 색인 — 소유자가 모은 게임 캡처를 태그로 분류하고, 엔티티 요청에 붙일 장면을 고른다.
//
// 저장 계약
//   art-src/공통화풍참고/분류어휘.json            닫힌 태그 목록(roles·kinds·envs·groups…)
//   art-src/공통화풍참고/<출처 게임>/색인.json     그 폴더의 그림 한 장당 한 항목(sha256·크기·태그·역할)
//   art-src/공통화풍참고/<출처 게임>/분류대기.json  scan이 만드는 미분류 작업지. 분류 에이전트가 채우고 apply로 합친다.
//   art-src/공통화풍참고/목록.md                   catalog가 굽는 사람용 요약. 손으로 고치지 않는다.
//
// 그림 바이트와 파일 이름은 건드리지 않는다. 색인은 그림 옆에 놓인 메타데이터일 뿐이다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildEntities } from "./ambient-art-entities.mjs";
import { ART_DIR } from "./ambient-art-paths.mjs";

export const STYLE_DIR = ART_DIR.reference;
export const INDEX_FILE = "색인.json";
export const WORKSHEET_FILE = "분류대기.json";
export const VOCABULARY_FILE = "분류어휘.json";
export const CATALOG_FILE = "목록.md";
export const IMAGE_NAME = /\.(png|jpe?g|webp|gif)$/i;
const SLUG = /^[a-z][a-z0-9-]{1,15}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const ROLE_LABEL = { mood: "화풍·분위기", depiction: "화풍·그림체", form: "형태 비율만", none: "첨부 안 함" };
const KIND_OF_ROLE = { mood: "style-mood", depiction: "style-depiction", form: "style-form" };
const MOOD_LIMIT = 2, DEPICTION_LIMIT = 3, FORM_LIMIT = 1;

const posix = (value) => value.split(path.sep).join("/");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** Style paths never traverse symlinks or leave the workspace; the folder holds owner assets. */
export function stylePath(workspaceRoot, ...segments) {
  const root = path.resolve(workspaceRoot), target = path.resolve(root, ...segments);
  const rel = path.relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error("Style reference path leaves workspace");
  let cursor = root;
  for (const part of rel.split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Style reference symlink is not allowed: ${posix(path.relative(root, cursor))}`);
  }
  return target;
}

export function styleRoot(workspaceRoot) {
  return stylePath(workspaceRoot, "art-src", STYLE_DIR);
}

export function loadVocabulary({ workspaceRoot }) {
  const file = stylePath(workspaceRoot, "art-src", STYLE_DIR, VOCABULARY_FILE);
  if (!fs.existsSync(file)) throw new Error(`Missing style vocabulary: ${posix(path.relative(workspaceRoot, file))}`);
  const vocabulary = readJson(file);
  if (vocabulary.schemaVersion !== 1) throw new Error("Unknown style vocabulary version");
  for (const key of ["roles", "kinds", "styles", "views", "envs", "times", "seasons", "flags", "biomeEnv", "categoryEnv", "groups"]) {
    if (!vocabulary[key]) throw new Error(`Style vocabulary lacks ${key}`);
  }
  return vocabulary;
}

/** Direct child folders of 공통화풍참고 are the sources (one per game). Files at the root are documents, never references. */
export function styleSources({ workspaceRoot }) {
  const root = styleRoot(workspaceRoot);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((name) => {
      const dir = stylePath(workspaceRoot, "art-src", STYLE_DIR, name);
      const indexFile = path.join(dir, INDEX_FILE);
      const index = fs.existsSync(indexFile) ? readJson(indexFile) : null;
      if (index && index.schemaVersion !== 1) throw new Error(`Unknown style index version: ${name}`);
      return { name, dir, indexFile, index };
    });
}

/** Every image beneath a source, recursively, as posix paths relative to the source folder. */
export function walkImages(workspaceRoot, dir) {
  const result = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "ko"))) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Style reference symlink is not allowed: ${posix(path.relative(workspaceRoot, file))}`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && IMAGE_NAME.test(entry.name)) result.push(posix(path.relative(dir, file)));
    }
  }
  visit(dir);
  return result.sort((a, b) => a.localeCompare(b, "ko"));
}

function fileRecord(dir, file) {
  const bytes = fs.readFileSync(path.join(dir, file));
  return { file, sha256: sha256(bytes), bytes: bytes.length };
}

/** Subject tags may name a manifest/codex slot, an entity, a category or a vocabulary group. */
export function knownSubjects({ manifest, vocabulary }) {
  const known = new Set(Object.keys(vocabulary.groups));
  for (const slot of manifest.ART_SLOTS) known.add(slot.id);
  for (const entity of buildEntities(manifest)) known.add(entity.id);
  for (const category of Object.keys(manifest.CATEGORY_KO)) known.add(category);
  return known;
}

export function validateEntry(entry, { vocabulary, subjects }) {
  const problems = [];
  const oneOf = (field, list, optional = false) => {
    const value = entry[field];
    if (value == null) { if (!optional) problems.push(`${field} 없음`); return; }
    if (!list.includes(value)) problems.push(`${field} 값이 어휘에 없음: ${value}`);
  };
  const listOf = (field, list) => {
    const value = entry[field];
    if (!Array.isArray(value)) { problems.push(`${field}는 배열이어야 한다`); return; }
    for (const item of value) if (!list.has(item)) problems.push(`${field} 값이 어휘에 없음: ${item}`);
  };
  if (typeof entry.file !== "string" || !entry.file || entry.file.includes("..") || path.isAbsolute(entry.file)) problems.push("file 경로가 잘못됨");
  if (!HEX64.test(entry.sha256 ?? "")) problems.push("sha256 없음");
  for (const field of ["bytes", "width", "height"]) if (!Number.isSafeInteger(entry[field]) || entry[field] <= 0) problems.push(`${field}는 양의 정수`);
  oneOf("kind", vocabulary.kinds);
  oneOf("style", vocabulary.styles);
  oneOf("view", vocabulary.views, true);
  oneOf("time", vocabulary.times, true);
  oneOf("season", vocabulary.seasons, true);
  oneOf("role", Object.keys(vocabulary.roles));
  listOf("subjects", subjects);
  listOf("env", new Set(vocabulary.envs));
  listOf("flags", new Set(vocabulary.flags));
  if (typeof entry.note !== "string") problems.push("note는 문자열(빈 문자열 가능)");
  if (typeof entry.classifiedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.classifiedAt)) problems.push("classifiedAt은 YYYY-MM-DD");
  if (typeof entry.classifiedBy !== "string" || !entry.classifiedBy) problems.push("classifiedBy 없음");
  if (entry.role === "depiction" && !(entry.subjects ?? []).length) problems.push("depiction 항목은 subjects가 필요하다");
  if (entry.role === "form" && !(entry.subjects ?? []).length) problems.push("form 항목은 subjects가 필요하다");
  return problems;
}

function validateHeader(index, sourceName) {
  const problems = [];
  if (index.source !== sourceName) problems.push(`source 이름이 폴더와 다름: ${index.source}`);
  if (!SLUG.test(index.slug ?? "")) problems.push("slug는 소문자 영문·숫자·하이픈 2~16자");
  for (const field of ["origin", "usage"]) if (typeof index[field] !== "string" || !index[field].trim()) problems.push(`${field} 없음`);
  if (!Array.isArray(index.entries)) problems.push("entries 없음");
  return problems;
}

/** Compare every source folder against its index. Read-only; never writes. */
export function scanStyleLibrary({ workspaceRoot, manifest, vocabulary = loadVocabulary({ workspaceRoot }) }) {
  const subjects = knownSubjects({ manifest, vocabulary });
  const slugs = new Map();
  const sources = styleSources({ workspaceRoot }).map((source) => {
    const images = walkImages(workspaceRoot, source.dir).map((file) => fileRecord(source.dir, file));
    const byFile = new Map(images.map((image) => [image.file, image]));
    const problems = [], unindexed = [], stale = [], changed = [];
    const entries = source.index?.entries ?? [];
    if (source.index) {
      problems.push(...validateHeader(source.index, source.name).map((problem) => `${source.name}/${INDEX_FILE}: ${problem}`));
      if (source.index.slug) {
        if (slugs.has(source.index.slug)) problems.push(`slug 중복: ${source.index.slug} (${slugs.get(source.index.slug)}, ${source.name})`);
        slugs.set(source.index.slug, source.name);
      }
    }
    const indexed = new Set();
    for (const entry of entries) {
      const label = `${source.name}/${entry.file}`;
      if (indexed.has(entry.file)) problems.push(`색인 중복: ${label}`);
      indexed.add(entry.file);
      for (const problem of validateEntry(entry, { vocabulary, subjects })) problems.push(`${label}: ${problem}`);
      const current = byFile.get(entry.file);
      if (!current) stale.push(entry.file);
      else if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) changed.push(entry.file);
    }
    for (const image of images) if (!indexed.has(image.file)) unindexed.push(image.file);
    const sorted = entries.map((entry) => entry.file);
    if (json(sorted) !== json([...sorted].sort((a, b) => a.localeCompare(b, "ko")))) problems.push(`${source.name}: 색인 항목이 파일 이름순이 아니다`);
    return { ...source, images, entries, unindexed, stale, changed, problems };
  });
  // Validation problems mean the index itself is wrong; pending items only mean the owner added, changed or removed pictures.
  const validation = sources.flatMap((source) => source.problems);
  const pending = sources.flatMap((source) => [
    ...source.unindexed.map((file) => `미분류 그림: ${source.name}/${file} — style:scan으로 작업지를 만들고 분류한 뒤 apply`),
    ...source.stale.map((file) => `색인에만 있는 그림: ${source.name}/${file} — 지웠으면 apply --prune`),
    ...source.changed.map((file) => `바이트가 바뀐 그림: ${source.name}/${file} — 다시 분류하거나 원본을 되돌린다`)
  ]);
  const problems = [...validation, ...pending];
  return { sources, validation, pending, problems, ok: !problems.length, total: sources.reduce((sum, source) => sum + source.entries.length, 0), images: sources.reduce((sum, source) => sum + source.images.length, 0) };
}

const stub = (image, dims) => ({
  file: image.file, sha256: image.sha256, bytes: image.bytes, width: dims?.width ?? null, height: dims?.height ?? null, format: dims?.format ?? null,
  kind: null, style: null, view: null, subjects: [], env: [], time: null, season: null, role: null, flags: [], note: "", classifiedAt: null, classifiedBy: null
});

/** Write one worksheet per source with unindexed/changed images. `measure(file) -> {width,height,format}` may be async. */
export async function writeWorksheets({ workspaceRoot, manifest, measure, sourceName = null, force = false }) {
  const scan = scanStyleLibrary({ workspaceRoot, manifest });
  const written = [];
  for (const source of scan.sources) {
    if (sourceName && source.name !== sourceName) continue;
    const pending = [...source.unindexed, ...source.changed];
    const worksheet = path.join(source.dir, WORKSHEET_FILE);
    if (!pending.length) continue;
    if (fs.existsSync(worksheet) && !force) throw new Error(`작업지가 이미 있다: ${posix(path.relative(workspaceRoot, worksheet))} — apply하거나 --force로 다시 만든다`);
    const entries = [];
    for (const file of pending) {
      const image = source.images.find((item) => item.file === file);
      entries.push(stub(image, measure ? await measure(path.join(source.dir, file)) : null));
    }
    const body = { schemaVersion: 1, source: source.name, slug: source.index?.slug ?? null, origin: source.index?.origin ?? null, usage: source.index?.usage ?? null, generatedAt: new Date().toISOString(), entries };
    fs.writeFileSync(worksheet, json(body), "utf8");
    written.push({ source: source.name, worksheet: posix(path.relative(workspaceRoot, worksheet)), count: entries.length });
  }
  return { scan, written };
}

/** Merge a completed worksheet into the source index. Every entry must be fully classified and still match its file. */
export function applyWorksheet({ workspaceRoot, manifest, sourceName, prune = false, vocabulary = loadVocabulary({ workspaceRoot }) }) {
  const source = styleSources({ workspaceRoot }).find((item) => item.name === sourceName);
  if (!source) throw new Error(`Unknown style source: ${sourceName}`);
  const worksheetFile = path.join(source.dir, WORKSHEET_FILE);
  const worksheet = fs.existsSync(worksheetFile) ? readJson(worksheetFile) : null;
  if (!worksheet && !prune) throw new Error(`작업지 없음: ${posix(path.relative(workspaceRoot, worksheetFile))}`);
  const subjects = knownSubjects({ manifest, vocabulary });
  const images = new Map(walkImages(workspaceRoot, source.dir).map((file) => [file, fileRecord(source.dir, file)]));
  const header = {
    schemaVersion: 1, source: source.name,
    slug: worksheet?.slug ?? source.index?.slug ?? null, origin: worksheet?.origin ?? source.index?.origin ?? null, usage: worksheet?.usage ?? source.index?.usage ?? null
  };
  const problems = validateHeader({ ...header, entries: [] }, source.name);
  const merged = new Map((source.index?.entries ?? []).map((entry) => [entry.file, entry]));
  for (const entry of worksheet?.entries ?? []) {
    const label = `${source.name}/${entry.file}`;
    const current = images.get(entry.file);
    if (!current) { problems.push(`${label}: 그림이 없다`); continue; }
    if (current.sha256 !== entry.sha256) { problems.push(`${label}: 작업지의 sha256이 현재 파일과 다르다`); continue; }
    const clean = { ...entry, bytes: current.bytes };
    for (const problem of validateEntry(clean, { vocabulary, subjects })) problems.push(`${label}: ${problem}`);
    merged.set(entry.file, clean);
  }
  let pruned = 0;
  for (const file of [...merged.keys()]) if (!images.has(file)) { if (prune) { merged.delete(file); pruned += 1; } else problems.push(`${source.name}/${file}: 색인에만 있다 — --prune으로 지운다`); }
  if (problems.length) return { ok: false, problems, applied: 0, pruned: 0 };
  const entries = [...merged.values()].sort((a, b) => a.file.localeCompare(b.file, "ko"));
  fs.writeFileSync(source.indexFile, json({ ...header, updatedAt: new Date().toISOString().slice(0, 10), entries }), "utf8");
  if (worksheet) fs.rmSync(worksheetFile);
  return { ok: true, problems: [], applied: worksheet?.entries.length ?? 0, pruned, total: entries.length };
}

/** What an entity is looking for: weighted subject tags, environments, seasons and slot cameras. */
export function entityWants({ entity, manifest, codex, vocabulary }) {
  const slots = entity.slotIds.map((id) => manifest.artSlot(id)).filter(Boolean);
  const weights = new Map();
  const add = (tag, weight) => weights.set(tag, Math.max(weights.get(tag) ?? 0, weight));
  for (const id of [entity.id, ...entity.slotIds]) add(id, 100);
  for (const [group, definition] of Object.entries(vocabulary.groups)) {
    if (definition.members.some((member) => member === entity.id || entity.slotIds.includes(member))) add(group, 60);
  }
  add(entity.category, 25);
  const envs = new Set(vocabulary.categoryEnv[entity.category] ?? []);
  for (const species of codex.filter((item) => entity.slotIds.includes(item.id))) {
    for (const biome of species.biomes) for (const env of vocabulary.biomeEnv[biome] ?? []) envs.add(env);
    if (species.kind === "fish") envs.add("underwater");
  }
  const seasons = new Set(slots.flatMap((slot) => slot.seasons));
  const views = new Set(slots.map((slot) => slot.view));
  return { weights, envs, seasons, views };
}

function scoreEntry(entry, wants) {
  let subject = 0, matched = null;
  for (const tag of entry.subjects) {
    const weight = wants.weights.get(tag) ?? 0;
    if (weight > subject) { subject = weight; matched = tag; }
  }
  const envHits = entry.env.filter((env) => wants.envs.has(env));
  let score = subject + Math.min(2, envHits.length) * 15;
  const seasonHit = !!entry.season && wants.seasons.size < 4 && wants.seasons.has(entry.season);
  if (seasonHit) score += 10;
  if (entry.style === "pixel") score += 10;
  if (entry.view === "top" && (wants.views.has("shadow") || wants.views.has("flat"))) score += 10;
  if (entry.view === "side" && wants.views.has("side")) score += 10;
  if ((entry.view === "three-quarter" || entry.view === "front") && wants.views.has("stand")) score += 5;
  if (entry.flags.includes("low-res")) score -= 10;
  if (entry.flags.includes("icon-chunky")) score -= 5;
  if (entry.flags.includes("duplicate")) score -= 30;
  return { score, subject, matched, envHits, seasonHit };
}

const SEASON_KO = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
const TIME_KO = { day: "낮", dusk: "해질녘", night: "밤" };

function reasonFor(pick, vocabulary, entity) {
  const parts = [ROLE_LABEL[pick.entry.role]];
  if (pick.matched) {
    const group = vocabulary.groups[pick.matched];
    parts.push(pick.subject >= 100 ? `${entity.id} 정확 일치` : group ? `${group.ko} 부류` : `${pick.matched} 범주`);
  }
  if (pick.envHits.length) parts.push(`환경 ${pick.envHits.join("·")}`);
  if (pick.entry.season) parts.push(`${SEASON_KO[pick.entry.season]}${pick.seasonHit ? "(계절 일치)" : ""}`);
  if (pick.entry.time) parts.push(TIME_KO[pick.entry.time]);
  return parts.join(" · ");
}

/** Deterministic choice: mood ≤ 2, depiction ≤ 3, one 3D form only when no same-group depiction exists, total ≤ limit. */
export function selectStyleReferences({ workspaceRoot, manifest, entity, codex, limit = 6, vocabulary = loadVocabulary({ workspaceRoot }) }) {
  if (limit <= 0) return [];
  const wants = entityWants({ entity, manifest, codex, vocabulary });
  const candidates = [];
  for (const source of styleSources({ workspaceRoot })) {
    if (!source.index) continue;
    for (const entry of source.index.entries) {
      if (entry.role === "none") continue;
      const scored = scoreEntry(entry, wants);
      candidates.push({ ...scored, entry, source: source.name, slug: source.index.slug, absolute: path.join(source.dir, entry.file) });
    }
  }
  const order = (a, b) => b.score - a.score || a.source.localeCompare(b.source, "ko") || a.entry.file.localeCompare(b.entry.file, "ko");
  const chosen = [];
  const moods = candidates.filter((item) => item.entry.role === "mood" && (item.envHits.length || item.subject)).sort(order);
  for (const item of moods) {
    if (chosen.filter((pick) => pick.entry.role === "mood").length >= MOOD_LIMIT) break;
    if (chosen.some((pick) => pick.entry.role === "mood" && pick.entry.time === item.entry.time && pick.entry.season === item.entry.season && pick.source === item.source)) continue;
    chosen.push(item);
  }
  // A category-only match ("animal") must also share an environment, or a chipmunk would receive crabs and octopuses.
  const depictions = candidates.filter((item) => item.entry.role === "depiction" && (item.subject >= 60 || (item.subject >= 25 && item.envHits.length))).sort(order);
  for (const item of depictions) {
    if (chosen.filter((pick) => pick.entry.role === "depiction").length >= DEPICTION_LIMIT) break;
    const primary = item.entry.subjects[0];
    if (chosen.filter((pick) => pick.entry.role === "depiction" && pick.entry.subjects[0] === primary && pick.source === item.source).length >= 2) continue;
    chosen.push(item);
  }
  if (!chosen.some((pick) => pick.entry.role === "depiction" && pick.subject >= 60)) {
    const forms = candidates.filter((item) => item.entry.role === "form" && item.subject >= 60).sort(order);
    for (const item of forms.slice(0, FORM_LIMIT)) chosen.push(item);
  }
  chosen.sort(order);
  const picks = chosen.slice(0, limit).map((pick) => {
    const bytes = fs.readFileSync(pick.absolute);
    if (sha256(bytes) !== pick.entry.sha256) throw new Error(`Style reference changed since indexing: ${pick.source}/${pick.entry.file} — run style:check`);
    return {
      source: pick.source, slug: pick.slug, file: pick.entry.file, absolute: pick.absolute, sha256: pick.entry.sha256,
      role: pick.entry.role, kind: KIND_OF_ROLE[pick.entry.role], score: pick.score, subjects: pick.entry.subjects, env: pick.entry.env,
      frozenName: `${pick.slug}-${pick.entry.sha256.slice(0, 8)}${path.extname(pick.entry.file).toLowerCase()}`,
      reason: reasonFor(pick, vocabulary, entity)
    };
  });
  return picks.sort((a, b) => ["mood", "depiction", "form"].indexOf(a.role) - ["mood", "depiction", "form"].indexOf(b.role) || b.score - a.score || a.frozenName.localeCompare(b.frozenName));
}

const cell = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
const CATALOG_MARKER = "<!-- ambient-style-catalog:generated v1 -->";

export function renderStyleCatalog({ scan, vocabulary, manifest }) {
  const roleCount = (entries, role) => entries.filter((entry) => entry.role === role).length;
  const groupRows = Object.entries(vocabulary.groups).map(([group, definition]) => {
    const perSource = scan.sources.map((source) => source.entries.filter((entry) => entry.role !== "none" && entry.subjects.includes(group)).length);
    return { group, ko: definition.ko, perSource, total: perSource.reduce((sum, count) => sum + count, 0), members: definition.members.length };
  }).filter((row) => row.total || row.members);
  const categoryRows = Object.entries(manifest.CATEGORY_KO).map(([category, ko]) => {
    const perSource = scan.sources.map((source) => source.entries.filter((entry) => entry.role !== "none" && entry.subjects.includes(category)).length);
    return `| ${ko} (${category}) | ${perSource.join(" | ")} |`;
  });
  const sourceHeader = scan.sources.map((source) => cell(source.index?.slug ?? source.name)).join(" | ");
  return `# 공통 화풍 참고 색인

> **이 파일은 손으로 고치지 않는다.** \`npm run style:catalog\`가 각 출처 폴더의 \`${INDEX_FILE}\`에서 다시 굽는다.

출처 폴더마다 그림 한 장에 색인 항목 하나가 있다. 역할이 \`none\`이 아닌 항목만 요청에 자동 첨부 후보가 된다. 첨부 규칙과 명령은 [README](README.md), 어휘는 [${VOCABULARY_FILE}](${VOCABULARY_FILE}).

## 출처

| 출처 | slug | 그림 | 색인 | 분위기 | 그림체 | 형태 | 첨부 안 함 | 미분류 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
${scan.sources.map((source) => `| ${cell(source.name)} | ${cell(source.index?.slug ?? "—")} | ${source.images.length} | ${source.entries.length} | ${roleCount(source.entries, "mood")} | ${roleCount(source.entries, "depiction")} | ${roleCount(source.entries, "form")} | ${roleCount(source.entries, "none")} | ${source.unindexed.length + source.changed.length} |`).join("\n")}

## 범주별 첨부 후보(subjects에 범주 태그가 달린 항목)

| 범주 | ${sourceHeader} |
|---|${scan.sources.map(() => "---:").join("|")}|
${categoryRows.join("\n")}

## 부류별 첨부 후보

부류의 구성원(manifest/codex 자리)은 어휘 파일이 정한다. 구성원이 없는 부류는 검색용 태그다.

| 부류 | 한글 | 구성원 | ${sourceHeader} | 합계 |
|---|---|---:|${scan.sources.map(() => "---:").join("|")}|---:|
${groupRows.map((row) => `| ${row.group} | ${row.ko} | ${row.members} | ${row.perSource.join(" | ")} | ${row.total} |`).join("\n")}

## 첨부하지 않는 항목의 사유

| 출처 | 사유 태그 | 장수 |
|---|---|---:|
${scan.sources.flatMap((source) => {
    const counts = new Map();
    for (const entry of source.entries.filter((item) => item.role === "none")) {
      const key = entry.flags.length ? entry.flags.join("+") : entry.kind;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, count]) => `| ${cell(source.name)} | ${cell(key)} | ${count} |`);
  }).join("\n") || "| — | — | 0 |"}
`;
}

export function updateStyleCatalog({ workspaceRoot, manifest, check = false, vocabulary = loadVocabulary({ workspaceRoot }) }) {
  const scan = scanStyleLibrary({ workspaceRoot, manifest, vocabulary });
  const content = renderStyleCatalog({ scan, vocabulary, manifest });
  const body = `${CATALOG_MARKER}\n<!-- content-sha256: ${sha256(content)} -->\n${content}`;
  const file = stylePath(workspaceRoot, "art-src", STYLE_DIR, CATALOG_FILE);
  const problems = [...scan.problems];
  let written = false;
  if (check) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (current !== body) problems.push(`${CATALOG_FILE}가 색인과 어긋난다 — \`npm run style:catalog\`를 돌려라.`);
  } else if (!scan.validation.length) {
    // Pending pictures are listed in the catalog's 미분류 column; only a broken index blocks the bake.
    fs.writeFileSync(file, body, "utf8");
    written = true;
  }
  return { scan, problems, ok: !problems.length, written, file };
}

export { ROLE_LABEL };
