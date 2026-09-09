// Current entity entry points. Run snapshots and all image bytes remain untouched.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { artManifest, root } from "./lib/ambient-art-manifest.mjs";
import { buildEntities } from "./lib/ambient-art-entities.mjs";

const MARKER = "<!-- ambient-art-catalog:generated v1 -->";
const GENERATED = new Set(["프롬프트.md", "레퍼런스/README.md", "반려본/README.md", "생성본/README.md", "검토/README.md"]);
const imageFile = (file) => /\.(png|gif|jpe?g|webp)$/i.test(file);
const referenceImage = (file) => /\.(png|gif)$/i.test(file);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const posix = (value) => value.split(path.sep).join("/");
const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function assertUnlinked(workspaceRoot, target) {
  const relative = path.relative(workspaceRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path leaves workspace: ${target}`);
  let current = workspaceRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Linked paths are not supported: ${current}`);
  }
}

function record(workspaceRoot, file) {
  assertUnlinked(workspaceRoot, file);
  const bytes = fs.readFileSync(file);
  return { path: posix(path.relative(workspaceRoot, file)), bytes: bytes.length, sha256: hash(bytes) };
}

function inventory(workspaceRoot, directory, exclude = () => false) {
  assertUnlinked(workspaceRoot, directory);
  if (!fs.existsSync(directory)) return [];
  const result = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Linked paths are not supported: ${file}`);
      if (exclude(posix(path.relative(directory, file)))) continue;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name !== ".gitkeep") result.push(record(workspaceRoot, file));
    }
  }
  visit(directory);
  return result;
}

function referencePairs(records, directory) {
  const direct = records.filter((file) => path.posix.dirname(file.path) === directory);
  const byPath = new Map(direct.map((file) => [file.path, file]));
  return direct.filter((file) => referenceImage(file.path) && byPath.has(`${file.path}.json`))
    .flatMap((file) => [file, byPath.get(`${file.path}.json`)]);
}

/** Regenerate owned Markdown only. check=true returns drift without writing anything. */
export function syncCatalog({ workspaceRoot = root, entityIds = [], check = false } = {}) {
  workspaceRoot = path.resolve(workspaceRoot);
  const manifest = artManifest();
  const entities = buildEntities(manifest), requested = new Set(entityIds);
  for (const id of requested) if (!entities.some((entity) => entity.id === id)) throw new Error(`Unknown art entity: ${id}`);
  const sourceHash = hash(JSON.stringify([
    "components/shared/ambient/art/manifest.ts", "components/shared/ambient/world/codex.ts",
    "scripts/lib/ambient-art-entities.mjs", "scripts/ambient-art-catalog.mjs"
  ].map((file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }))));
  const publicRecords = new Map();
  for (const entity of entities) for (const asset of entity.files) {
    const file = path.join(workspaceRoot, "public/ambient/art", asset.filename);
    if (fs.existsSync(file)) publicRecords.set(asset.filename, record(workspaceRoot, file));
  }
  const active = entities.filter((entity) => requested.has(entity.id) || fs.existsSync(path.join(workspaceRoot, "art-src", entity.category, entity.id)) || entity.files.some((asset) => publicRecords.has(asset.filename)));
  const expected = new Map(), snapshots = [];
  const link = (doc, target, label = path.basename(target)) => `[${cell(label)}](<${posix(path.relative(path.dirname(doc), target))}>)`;
  const existingLink = (doc, target, label) => fs.existsSync(target) ? link(doc, target, label) : `${label} (아직 없음)`;
  const listFiles = (doc, records, empty) => records.length ? records.map((file) => `- ${link(doc, path.join(workspaceRoot, file.path), file.path.split("/").slice(-2).join("/"))} · SHA-256 \`${file.sha256}\``).join("\n") : empty;
  const add = (file, body, stateHash) => {
    assertUnlinked(workspaceRoot, file);
    const content = `<!-- source-sha256: ${sourceHash}; state-sha256: ${stateHash} -->\n\n${body.trim()}\n`;
    expected.set(file, `${MARKER}\n<!-- content-sha256: ${hash(content)} -->\n${content}`);
  };

  for (const entity of active) {
    const directory = path.join(workspaceRoot, "art-src", entity.category, entity.id);
    const records = inventory(workspaceRoot, directory, (relative) => GENERATED.has(relative));
    const sharedDir = path.join(workspaceRoot, "art-src/reference", entity.category);
    const sharedRecords = inventory(workspaceRoot, sharedDir);
    const shared = referencePairs(sharedRecords, posix(path.relative(workspaceRoot, sharedDir)));
    const accepted = entity.files.flatMap((asset) => publicRecords.has(asset.filename) ? [publicRecords.get(asset.filename)] : []);
    const stateHash = hash(JSON.stringify({ records, shared: sharedRecords, accepted }));
    snapshots.push({ id: entity.id, stateHash });
    const prefix = posix(path.relative(workspaceRoot, directory));
    const local = (subdir) => records.filter((file) => file.path.startsWith(`${prefix}/${subdir}/`));
    const sources = local("생성본").filter((file) => imageFile(file.path));
    const references = referencePairs(records, `${prefix}/레퍼런스`);
    const rejected = local("반려본");
    const runs = local("runs").filter((file) => /^runs\/[^/]+\/request\.json$/.test(file.path.slice(prefix.length + 1))).map((file) => {
      const runDir = path.dirname(path.join(workspaceRoot, file.path));
      const request = json(path.join(runDir, "request.json"));
      const reviewFile = path.join(runDir, "review.json");
      const review = fs.existsSync(reviewFile) ? json(reviewFile) : null;
      const relativeRun = posix(path.relative(workspaceRoot, runDir));
      const raw = records.filter((entry) => entry.path.startsWith(`${relativeRun}/raw/`) && imageFile(entry.path));
      const normalized = records.filter((entry) => entry.path.startsWith(`${relativeRun}/normalized/`) && imageFile(entry.path));
      return { id: path.basename(runDir), runDir, request, review, raw, normalized };
    }).sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
    const pending = runs.filter((run) => run.review?.decision === "pending");
    const prompt = path.join(directory, "프롬프트.md");
    const slots = entity.slotIds.map(manifest.artSlot);
    const links = ["레퍼런스", "반려본", "생성본", "검토"].map((name) => link(prompt, path.join(directory, name, "README.md"), name)).join(" · ");
    const pendingText = pending.length ? pending.map((run) => `- ${existingLink(prompt, path.join(run.runDir, "request.md"), run.id)} · 요청 ${run.request.files?.length ?? "미기록"}장 / 원본 ${run.raw.length}장 / 정리본 ${run.normalized.length}장 · ${run.raw.length ? "납품 후 검토 대기" : "준비본, 현재 납품 없음"}`).join("\n") : "현재 pending 요청 없음. 새 요청을 만들면 이 페이지를 다시 생성한다.";
    add(prompt, `# ${slots.map((slot) => slot.nameKo).join(" / ")} · ${entity.id}\n\n엔티티 작업 진입점. ${links}\n\n## 현재 요청\n\n${pendingText}\n\n실제 생성 지시는 해당 run의 request.md와 고정 inputs 사본이다. 아래 전체 파일 계획이 현재 납품 범위를 늘리지 않는다. 기존 run의 경로·요청·입력·검토 기록은 바꾸지 않는다.\n\n새 요청 예: \`npm run art:pipeline -- request ${entity.id} --run <새-run-id> --variants 1\`. 기존 public 파일은 보호되므로 아직 없는 변형을 선택한다. 카탈로그 묶음은 자동으로 소나무 전용 검사 규칙을 부여하지 않는다.\n\n## 정확한 파일 계획\n\n${entity.slotIds.length} slots · ${entity.files.length}파일. seasons는 출현 시기이며 파일 수에 곱하지 않는다. 단일 시즌은 해당 계절 폴더, 여러 시즌은 공통 폴더를 쓴다. 파일 이름은 런타임 정본 그대로다.\n\n| 파일 | 자리 | 변형 | 계절 폴더 | 표시 크기 | 원본 보관 경로 |\n|---|---|---:|---|---|---|\n${entity.files.map((asset) => {
      const slot = manifest.artSlot(asset.slotId);
      return `| ${asset.filename} | ${asset.slotId} | ${asset.variant} | ${asset.seasonKo} | ${slot.px.join("×")} px | ${asset.relativePath} |`;
    }).join("\n")}\n\n생성 입력은 각 request의 규격을 따른다. 일반 원본은 1024×1024 투명 PNG이며 표시 크기와 구별한다. 그림 설명 정본: ${link(prompt, path.join(workspaceRoot, "components/shared/ambient/art/manifest.ts"), "manifest.ts")} 및 ${link(prompt, path.join(workspaceRoot, "docs/ambient/ART_RULES.md"), "ART_RULES")}에서 이 자리의 brief를 확인한다.\n\n## 자료 현황\n\n엔티티 생성본 ${sources.length}장 · 영감 후보 이미지 ${references.filter((file) => imageFile(file.path)).length}장 · 반려 이미지 ${rejected.filter((file) => imageFile(file.path)).length}장 · public 합격 런타임 파일 ${accepted.length}장 · run ${runs.length}개. public과 run baseline은 정규화된 합격 참고이며 최초 생성 원본으로 취급하지 않는다.`, stateHash);

    const refDoc = path.join(directory, "레퍼런스/README.md");
    add(refDoc, `# ${entity.id} 레퍼런스\n\n이 폴더의 이미지와 출처 sidecar는 대상 형태를 보고 분류한 외부 영감 후보다. 소유자 선별·화풍 승인이나 종 일치 보장을 뜻하지 않는다. 직접 자식 PNG/GIF와 짝 sidecar만 후보 목록에 표시한다. 출처 누락·라이선스 검사는 \`ref:notice --check\`로 확인한다. 실제 전달 여부는 run의 inputs와 request로 확인한다.\n\n${listFiles(refDoc, references, "엔티티 영감 후보 이미지·sidecar 없음.")}\n\n공용 후보: ${existingLink(refDoc, sharedDir, `${entity.category} 참고 라이브러리`)} · 이미지 ${shared.filter((file) => imageFile(file.path)).length}장. 후보 폴더 전체를 이번 생성의 고정 입력으로 간주하지 않는다. 현재 request.inputs 목록 밖 참고는 자동 전달되지 않는다. 고정 입력이나 요청 해시를 수작업으로 바꾸지 않는다.`, stateHash);
    const rejectDoc = path.join(directory, "반려본/README.md");
    const rejectionReviews = rejected.filter((file) => file.path.endsWith("/review.json"));
    add(rejectDoc, `# ${entity.id} 반려본\n\n반려 기록은 피해야 할 결과와 근거다. 합격 화풍 참고나 최초 합격 원본으로 사용하지 않는다. 과거 batch와 원래 파일 이름을 유지한다.\n\n${listFiles(rejectDoc, rejectionReviews, "엔티티 안의 과거 review.json 없음.")}\n\n반려 이미지 ${rejected.filter((file) => imageFile(file.path)).length}장.\n\n## Run 반려 기록\n\n${runs.filter((run) => run.review?.decision === "rejected").map((run) => `- ${link(rejectDoc, path.join(run.runDir, "review.json"), run.id)} · ${cell(run.review.note ?? "사유는 review.json 확인")}`).join("\n") || "반려된 run 없음."}`, stateHash);
    const sourceDoc = path.join(directory, "생성본/README.md");
    add(sourceDoc, `# ${entity.id} 생성본\n\n변형/실제 계절 또는 공통/정본 파일 이름으로 보관한다. 출처·바이트 이관 기록: ${existingLink(sourceDoc, path.join(workspaceRoot, "art-src/migrations/20260909-entity-layout.json"), "이관 기록")}. 이 폴더의 파일 존재만으로 합격 여부를 추정하지 않는다.\n\n${listFiles(sourceDoc, sources, "이 엔티티 폴더에 보관된 생성 원본 없음.")}\n\n## Run 원본\n\n${listFiles(sourceDoc, runs.flatMap((run) => run.raw), "run에 납품된 원본 없음.")}\n\n## 합격 런타임 파일\n\n아래 파일은 정규화된 public 합격본이다. 생성 원본 유실을 이 파일로 메웠다고 표시하지 않는다.\n\n${listFiles(sourceDoc, accepted, "public 합격본 없음.")}`, stateHash);
    const reviewDoc = path.join(directory, "검토/README.md");
    add(reviewDoc, `# ${entity.id} 검토\n\n각 run의 normalized는 정본 파일 이름을 유지한 flat 납품 뷰다. review.png는 실제 표시 크기, review-detail.png는 정수배 확대 보기다. 소유자의 실제 판정은 review.json에 기록한다. 카탈로그는 이미지나 승인 기록을 만들지 않는다.\n\n${runs.map((run) => {
      const files = ["request.md", "normalized", "checks.json", "review.png", "review-detail.png", "review.json"].map((name) => existingLink(reviewDoc, path.join(run.runDir, name), name)).join(" · ");
      return `- ${run.id} · 판정 ${run.review?.decision ?? "미기록"} · 원본 ${run.raw.length}장 / 정리본 ${run.normalized.length}장${!run.raw.length ? " · 현재 납품 없음" : ""}\n  ${files}`;
    }).join("\n") || "현재 run과 납품 없음."}`, stateHash);
  }

  const index = path.join(workspaceRoot, "art-src/목록.md");
  const activeIds = new Set(active.map((entity) => entity.id));
  add(index, `# 아트 엔티티 목록\n\n현재 manifest의 ${manifest.ART_SLOTS.length} slots를 ${entities.length}엔티티로 묶었다. 정확한 정본 파일 ${entities.reduce((sum, entity) => sum + entity.files.length, 0)}장. 출현 시즌을 곱하지 않는다. 현재 진입점 ${active.length}개. 생성되지 않은 엔티티는 링크를 만들지 않는다.\n\n새 진입점: \`npm run art:catalog -- --entity <entity-id>\`. 현재 상태 검사: \`npm run art:catalog -- --check\`. 이 문서들은 카탈로그가 생성한다. 직접 쓸 참고·메모·판정은 별도 파일에 보관한다.\n\n| 범주 | 엔티티 | slots | 파일 | 작업 진입점 |\n|---|---|---:|---:|---|\n${entities.map((entity) => `| ${entity.category} | ${entity.id} | ${entity.slotIds.length} | ${entity.files.length} | ${activeIds.has(entity.id) ? link(index, path.join(workspaceRoot, "art-src", entity.category, entity.id, "프롬프트.md"), "프롬프트") : "필요할 때 생성"} |`).join("\n")}`, hash(JSON.stringify(snapshots)));
  const changes = [], conflicts = [];
  for (const [file, contents] of expected) {
    if (fs.existsSync(file)) {
      const previous = fs.readFileSync(file, "utf8");
      const owned = previous.match(/^<!-- ambient-art-catalog:generated v1 -->\n<!-- content-sha256: ([a-f0-9]{64}) -->\n([\s\S]*)$/);
      if (!owned || hash(owned[2]) !== owned[1]) { conflicts.push(posix(path.relative(workspaceRoot, file))); continue; }
      if (previous === contents) continue;
    }
    changes.push(posix(path.relative(workspaceRoot, file)));
  }
  if (!check && conflicts.length) throw new Error(`Unowned documents protected: ${conflicts.join(", ")}`);
  if (!check) for (const relative of changes) {
    const file = path.join(workspaceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, expected.get(file), { flag: fs.existsSync(file) ? "w" : "wx" });
  }
  return { status: conflicts.length || (check && changes.length) ? "fail" : "pass", entities: active.map((entity) => entity.id), slots: manifest.ART_SLOTS.length, files: entities.reduce((sum, entity) => sum + entity.files.length, 0), changes, conflicts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), entityIds = [];
    let check = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === "--check") check = true;
      else if (args[index] === "--entity" && args[index + 1]) entityIds.push(...args[++index].split(","));
      else throw new Error(`Unknown catalog argument: ${args[index]}`);
    }
    const result = syncCatalog({ entityIds, check });
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "fail") process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
