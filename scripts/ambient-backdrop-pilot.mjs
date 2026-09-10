// Local-only stage-one candidate requests. No runtime registration or promotion.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { root } from "./lib/ambient-art-manifest.mjs";
import { ART_DIR, folderName } from "./lib/ambient-art-paths.mjs";
import { BACKDROP_PILOT } from "./lib/ambient-backdrop-spec.mjs";
import { styleSources, stylePath } from "./lib/ambient-style-library.mjs";

const hash = data => crypto.createHash("sha256").update(data).digest("hex");
const json = data => JSON.stringify(data, null, 2) + "\n";
const relative = file => path.relative(root, file).split(path.sep).join("/");

export function pilotMoodReferences(spec, workspaceRoot = root) {
  return ["dave", "acnh"].map(slug => {
    const source = styleSources({ workspaceRoot }).find(s => s.index?.slug === slug);
    if (!source) throw new Error(`Missing indexed style source: ${slug}`);
    const score = e => e.env.filter(v => spec.styleEnv.includes(v)).length * 20 + (e.season === spec.season ? 10 : 0) + (e.time === "day" ? 5 : 0);
    const entry = source.index.entries.filter(e => e.role === "mood" && !e.flags.some(f => ["watermark", "other-game", "stock", "license-unknown"].includes(f)))
      .sort((a, b) => score(b) - score(a) || a.file.localeCompare(b.file, "ko"))[0];
    if (!entry) throw new Error(`Missing usable mood reference: ${slug}`);
    const file = stylePath(workspaceRoot, path.relative(workspaceRoot, source.dir), entry.file);
    const bytes = fs.readFileSync(file);
    if (hash(bytes) !== entry.sha256) throw new Error(`Indexed image changed: ${file}`);
    return { file, bytes, source: source.name, sha256: entry.sha256,
      name: `${slug}-${entry.sha256.slice(0, 8)}${path.extname(file)}`,
      reason: slug === "dave" ? "밝고 차분한 장면 분위기만. 바다·인물·UI·고유 구도 복제 금지." : "높은 3/4 시점과 열린 봄 잔디 공간감만. 3D 재질·물체·UI·고유 구도 복제 금지." };
  });
}

export function createPilotRequest(runId) {
  folderName(runId);
  const spec = BACKDROP_PILOT;
  const runDir = stylePath(root, "art-src", "배경층", folderName(spec.nameKo), ART_DIR.runs, runId);
  if (fs.existsSync(runDir)) throw new Error("Existing run is immutable; choose a new run");
  const references = pilotMoodReferences(spec);
  const common = `Use case: stylized-concept. Asset: one original spring-meadow depth layer for a calm pixel-art schedule background. Output exactly ${spec.geometry.source.join("x")} PNG, full canvas origin preserved, real transparent alpha outside the painted region. Logical ${spec.geometry.grid.join("x")} grid, hard ${spec.geometry.block}x${spec.geometry.block} square pixel blocks. Only 6–10 opaque RGB colors, binary alpha 0/255. No gradients, antialiasing, blur, noise, dithering, painted checkerboard, text, UI, borders or labels. Cool muted sage, mint, gray teal and soft yellow-green; related-hue edges, no black outlines. High three-quarter view, flat quiet broad masses, intentionally simple and spacious. Ground horizon y=268 of 1024 (nearest 4px block to .26h). Shared origin across all three layers. No sky painted in this layer; sky is supplied separately by the renderer. No sun, clouds, fog, weather, shadows, creatures, standalone trees, rocks or interactive flower clumps. Two attached references are atmosphere/camera guidance ONLY, not pixel style or layouts to copy. Do not reproduce their UI, characters, objects or composition. This is a candidate, not approved/public art.`;
  const prompts = spec.layers.map(layer => ({ file: `${spec.id}-${spec.season}-${layer.id}.png`, layer: layer.id, nameKo: layer.nameKo,
    prompt: `${common}\nLAYER ${layer.id}: ${layer.brief}\n${layer.id === "far" ? "Paint only a shallow, continuous distant woodland silhouette band: treetops at y=176–252, opaque lower band ending y=320; all below y=320 and above the canopy is transparent. No distinct foreground trunks. Use pale desaturated mint/teal values. No mountains or islands." : layer.id === "ground" ? "All pixels y<268 transparent. All pixels y>=268 opaque through the bottom and both side edges. A flat open spring grassy plane, broad restrained color patches receding toward the straight horizon. Sparse small flat turf marks at edges, quiet middle. No path, pond, central emblem, objects or hills. No cast shadows." : "Only small low grass tufts growing inward from the bottom left and bottom right outside edges, confined to bottom 15% and outer 18% of width. More than 90% of canvas transparent. Center x=25–75% completely transparent from top to bottom. No tall plants, continuous hedge, land base, flowers, trunks or cast shadows. Muted gray-green with crisp related-hue accents."}` }));
  const request = { schemaVersion: "backdrop-pilot-1", previewOnly: true, ownerDecision: "pending", spec,
    files: prompts.map(p => p.file), prompts,
    inputs: references.map(r => ({ source: relative(r.file), path: `${ART_DIR.inputs}/${ART_DIR.style}/${r.name}`, kind: "style-mood", sha256: r.sha256, reason: r.reason })),
    contractSha256: hash(JSON.stringify(spec)), publication: "Forbidden for this partial spring-only candidate. Full seasonal run and loader belong to later stages." };
  request.requestSha256 = hash(JSON.stringify(request));
  const markdown = `# 봄 초원 세 겹 시안\n\n상태: 생성 준비 · 소유자 검토 전 · 공개 반영 불가\n\n이번 요청은 봄 3장뿐이다. 원본 보존, 투명 하늘, 원점 유지. 실제 앱 연결·사계절 확장·푸시는 별도 단계다.\n\n## 고정 참고\n\n${request.inputs.map(i => `- ${i.path}: ${i.reason} SHA-256 ${i.sha256}`).join("\n")}\n\n## 생성 프롬프트\n\n${prompts.map(p => `### ${p.nameKo} — ${p.file}\n\n${p.prompt}`).join("\n\n")}\n`;
  fs.mkdirSync(path.join(runDir, ART_DIR.raw), { recursive: true });
  fs.mkdirSync(path.join(runDir, ART_DIR.inputs, ART_DIR.style), { recursive: true });
  for (const r of references) fs.writeFileSync(path.join(runDir, ART_DIR.inputs, ART_DIR.style, r.name), r.bytes, { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "request.json"), json(request), { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "request.md"), markdown, { flag: "wx" });
  return { runDir, files: request.files, inputs: request.inputs, requestSha256: request.requestSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "request" || !process.argv[3]) throw new Error("Usage: node scripts/ambient-backdrop-pilot.mjs request <한글·숫자 회차>");
    console.log(json(createPilotRequest(process.argv[3])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
