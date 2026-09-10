// 전 엔티티 레퍼런스 일괄 수집(2026-09-11, 소유자 지시) — 자리 이름과 부류에서 질의를 만들어
// OpenGameArt 픽셀아트와 위키미디어 커먼즈 사진을 각 엔티티 `레퍼런스/`에 사이드카와 함께 받는다.
//
//   node scripts/ambient-ref-fetch-all.mjs --dry                       # 엔티티별 질의만 본다(네트워크 없음)
//   node scripts/ambient-ref-fetch-all.mjs                             # 전부(이미 그림이 있는 엔티티는 건너뛴다)
//   node scripts/ambient-ref-fetch-all.mjs --only fish-crucian,rock    # 일부만
//   node scripts/ambient-ref-fetch-all.mjs --skip tree-pine --pixel 4 --photo 3 --license free --sources oga,commons
//   node scripts/ambient-ref-fetch-all.mjs --refill                    # 이미 그림이 있어도 상한까지 채운다
//
// 라이선스 정책(소유자 결정 2026-09-11): 자유 라이선스 전부(CC0·퍼블릭 도메인·CC-BY·CC-BY-SA·OGA-BY), NC·ND·GPL·출처 불명 제외.
// 받은 그림은 형태·구조·생태 참고다. 복제·트레이스·public 반출 금지(ART-11). 저장 뒤 `node scripts/ambient-ref-notice.mjs`.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { artManifest, root } from "./lib/ambient-art-manifest.mjs";
import { buildEntities } from "./lib/ambient-art-entities.mjs";
import { entityPath } from "./lib/ambient-art-paths.mjs";
import { licenseAccepted, writeReferencePair } from "./lib/ambient-ref-library.mjs";
import { loadVocabulary } from "./lib/ambient-style-library.mjs";
import { collectInto, download, get, safe, setRequestDelay } from "./ambient-ref-fetch.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

/** 이름에서 상태·계절·소품 접미어를 걷어 검색어 줄기를 만든다. "Oak, spring" → "oak", "Snowman, one ball" → "snowman". */
const STATE_WORDS = /\b(spring|summer|autumn|winter|leafy|bare|complete|one|two|balls?|phases?|seed|head|low|mid|high|long|short)\b/gi;
export function cleanName(nameEn) {
  const head = nameEn.split(/[,/(]/)[0];
  return head.toLowerCase().replace(STATE_WORDS, " ").replace(/[^a-z\- ]/g, " ").replace(/\s+/g, " ").trim();
}

/** OpenGameArt는 게임 소품 이름으로 검색된다. 종 이름이 안 통하거나 머리 단어가 잡동사니를 부르는 자리만 덮어쓴다. */
const OGA_QUERY = {
  pinecone: "pinecone", footlog: "fallen log", "grass-tall": "tall grass", "grass-dry": "dry grass", "sea-stack": "sea rock", "tide-pool": "tide pool",
  "swim-ring": "swim ring float", "snow-pile": "snow", "snow-drift": "snow", "soil-mound": "dirt mound", molehill: "mole hill", "grass-patch": "grass",
  "gravel-patch": "gravel", "moss-patch": "moss", "shell-clam": "seashell", "seaweed-clump": "seaweed", "silver-grass": "grass", "dune-grass": "grass",
  "berry-bush": "berry bush", "flower-white": "flower", "flower-violet": "flower", "flower-cream": "flower", "dandelion-puff": "dandelion",
  "cloud-low": "cloud", "cloud-mid": "cloud", "cloud-high": "cloud", "cloud-wisp": "cloud", "cloud-storm": "storm cloud", "sun-disc": "sun", "moon-phase": "moon",
  "shooting-star": "shooting star", "fish-ray": "stingray", "fish-jelly": "jellyfish", "fish-whale-shadow": "whale", "fish-dolphinfish": "mahi",
  "bug-cabbagewhite": "white butterfly", "bug-blue": "blue butterfly", "bug-comma": "butterfly", "bug-waterstrider": "water strider",
  "animal-raccoondog": "raccoon", "animal-leopardcat": "wild cat", "animal-mallard": "duck", "animal-mandarinduck": "duck", "animal-porpoise": "dolphin",
  "animal-turtle-sea": "sea turtle", "animal-softshell": "turtle", "animal-terrapin": "turtle", "animal-ratsnake": "snake", "animal-fieldmouse": "mouse",
  "animal-waterdeer": "deer", "animal-roedeer": "deer", "animal-hare": "rabbit", "animal-woodpecker": "woodpecker", "animal-skylark": "lark",
  "animal-gull": "seagull", "animal-spoonbill": "spoonbill", "animal-fiddlercrab": "crab", "animal-mudcrab": "crab", "animal-hermitcrab": "hermit crab",
  "animal-treefrog": "frog", "animal-anemone": "sea anemone", "animal-minkewhale": "whale"
};

/** 커먼즈는 실물 사진이다 — 종 이름은 그대로, 소품·하늘은 사진에서 찾을 이름으로. */
const PHOTO_QUERY = {
  "tree-oak": "oak tree", "tree-pine": "pine tree", "tree-birch": "birch tree", sapling: "tree sapling", shrub: "shrub", sprout: "seedling sprout",
  "grass-tuft": "grass tuft", "grass-tall": "foxtail grass Setaria", "grass-dry": "dry grass", "silver-grass": "Miscanthus sinensis", reed: "Phragmites reed",
  cattail: "Typha cattail", sedge: "Carex sedge", "dune-grass": "marram grass dune", "seaweed-clump": "seaweed on beach", lilypad: "water lily pad",
  lotus: "lotus flower Nelumbo", puddle: "puddle", pebble: "pebble", rock: "rock outcrop", boulder: "boulder", twig: "twig", log: "log wood", stump: "tree stump",
  driftwood: "driftwood", "shell-clam": "clam shell", "gravel-patch": "gravel", "moss-patch": "moss", fern: "fern frond", bramble: "bramble Rubus",
  "berry-bush": "berry bush", "flower-white": "white wildflower", "flower-violet": "violet wildflower", "flower-cream": "cream wildflower",
  mushroom: "mushroom forest floor", acorn: "acorn", pinecone: "pine cone", feather: "bird feather", icicle: "icicle", "snow-pile": "snow pile",
  "snow-drift": "snowdrift", "snowman-1": "snowman", "snowman-2": "snowman", "snowman-3": "snowman", daisy: "daisy Bellis", clover: "clover Trifolium",
  "dandelion-flower": "dandelion flower", "dandelion-puff": "dandelion seed head", "soil-mound": "soil mound", molehill: "molehill", "grass-patch": "grass patch",
  "sea-stack": "sea stack", "tide-pool": "tide pool", "swim-ring": "swim ring", footlog: "fallen tree trunk", "sun-disc": "sun in sky", "moon-phase": "moon phases",
  comet: "comet", "shooting-star": "meteor night sky", "cloud-low": "cumulus cloud", "cloud-mid": "altocumulus cloud", "cloud-high": "cirrus cloud",
  "cloud-wisp": "cirrus cloud", "cloud-storm": "cumulonimbus cloud", "fish-ray": "stingray", "fish-jelly": "siphonophore", "fish-whale-shadow": "sperm whale",
  "fish-seabass": "Sebastes schlegelii", "fish-sweetfish": "Plecoglossus altivelis", "fish-lenok": "Brachymystax lenok", "fish-halibut": "righteye flounder",
  "bug-blue": "Lycaenidae butterfly", "bug-comma": "Polygonia c-album", "bug-spider": "Nephila clavata", "animal-fieldmouse": "Apodemus agrarius",
  "animal-squirrel": "Sciurus vulgaris", "animal-hare": "Lepus coreanus", "animal-leopardcat": "Prionailurus bengalensis",
  "animal-turtle-sea": "loggerhead sea turtle", "animal-terrapin": "Mauremys reevesii", "animal-porpoise": "finless porpoise", "animal-fiddlercrab": "fiddler crab",
  "animal-mudcrab": "Helice tridens", "animal-anemone": "sea anemone", "animal-starfish": "starfish",
  // Common names that collide with sports, cities or other meanings on Commons get the species name instead.
  "bug-cricket": "Gryllidae cricket insect", "bug-grasshopper": "Acrididae grasshopper", "bug-locust": "Locusta migratoria", "bug-mantis": "Mantis religiosa",
  "bug-katydid": "Tettigoniidae katydid", "animal-seal": "Phoca largha spotted seal", "fish-bitterling": "Rhodeus uyekii", "fish-eel": "Anguilla japonica",
  "fish-snakehead": "Channa argus", "fish-goby": "Gobiidae goby fish", "fish-wrasse": "Labridae wrasse", "fish-mullet": "Mugil cephalus", "fish-shad": "Konosirus punctatus",
  "animal-mole": "Talpidae mole animal", "animal-bat": "Rhinolophus horseshoe bat", "animal-crow": "Corvus macrorhynchos", "animal-swallow": "Hirundo rustica"
};

const PHOTO_EXCLUDE = /\b(map|range|distribution|skeleton|microscop\w*|micrograph|SEM|fossil|diagram|logo|icon|chart|stamp|coin|statue|scale|eggs?|larvae?|pupa|cocoon|nymph|caterpillar|nest|track|footprint|dish|food|market|cooked|sushi|fillet|caught|fishing|drawer|label)\b/i;
const STRIP_HTML = (value) => String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** 엔티티 하나의 질의 묶음: 픽셀은 이름 → 부류 순, 사진은 이름 하나. */
export function entityQueries(entity, manifest, vocabulary) {
  const slot = manifest.artSlot(entity.slotIds[0]);
  const cleaned = cleanName(slot.nameEn);
  const specific = OGA_QUERY[entity.id] ?? cleaned;
  const groups = Object.entries(vocabulary.groups)
    .filter(([, group]) => group.members.some((member) => member === entity.id || entity.slotIds.includes(member)))
    .sort((a, b) => a[1].members.length - b[1].members.length)
    .map(([id]) => id.replaceAll("-", " "));
  const photo = PHOTO_QUERY[entity.id] ?? slot.nameEn.split(/[,/(]/)[0].trim();
  return { specific, groups, photo, nameEn: slot.nameEn };
}

/** 슬러그의 마지막 낱말(머리 명사)이 토큰으로 있거나, 질의 전체가 이어 붙어 있어야 관련 팩이다. `ant`가 `plant`에 걸리지 않게 토큰 비교. */
export function relevanceFor(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const head = words.at(-1), phrase = words.join("-");
  return (slug) => {
    const tokens = slug.toLowerCase().split("-");
    // A one-word phrase would be a substring test again ("ant" inside "plant"), so only multi-word phrases match by substring.
    return tokens.includes(head) || (words.length > 1 && slug.toLowerCase().includes(phrase));
  };
}

/** 위키미디어 커먼즈 — 검색 API가 라이선스·작성자를 같이 준다. 정책에 맞는 것만, 640px 썸네일을 JPEG로 다시 저장한다. */
export async function collectPhotos({ entity, dir, query, limit, policy, log = console }) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    `&gsrnamespace=6&gsrlimit=${Math.max(10, limit * 4)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=640` +
    `&iiextmetadatafilter=LicenseShortName|Artist|Credit|ObjectName|ImageDescription&format=json`;
  let payload;
  try { payload = JSON.parse(await get(url)); } catch (error) { log.error(`  커먼즈 검색 실패: ${error.message}`); return { saved: 0, rejected: ["검색 실패"], files: [] }; }
  const pages = Object.values(payload.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  let saved = 0;
  const rejected = [], files = [];
  for (const page of pages) {
    if (saved >= limit) break;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const title = page.title.replace(/^File:/, "");
    const license = STRIP_HTML(info.extmetadata?.LicenseShortName?.value);
    if (!/^image\/(jpeg|png)$/.test(info.mime ?? "")) { rejected.push(`${title}: ${info.mime}`); continue; }
    if (PHOTO_EXCLUDE.test(title)) { rejected.push(`${title}: 제목이 참고 대상이 아님`); continue; }
    if (!licenseAccepted([license], policy)) { rejected.push(`${title}: ${license || "라이선스 없음"}`); continue; }
    if ((info.width ?? 0) < 400 || (info.height ?? 0) < 300) { rejected.push(`${title}: ${info.width}×${info.height} 너무 작음`); continue; }
    const base = safe(`commons--${title.replace(/\.[a-z]+$/i, "")}.jpg`);
    if (fs.existsSync(path.join(dir, base))) continue;
    try {
      const raw = await download(info.thumburl ?? info.url);
      if (!raw) { rejected.push(`${title}: 내려받기 실패`); continue; }
      const image = await sharp(raw).rotate().resize(640, 640, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      const result = writeReferencePair({
        workspaceRoot: root, category: entity.category, entity: entity.id, manifest: artManifest(), filename: base, image,
        card: {
          file: base, kind: "photo", source: info.descriptionurl, downloadedFrom: info.thumburl ?? info.url, license,
          author: STRIP_HTML(info.extmetadata?.Artist?.value) || "unknown", credit: STRIP_HTML(info.extmetadata?.Credit?.value) || undefined,
          title, originalSize: `${info.width}×${info.height}`, storedAs: "640px JPEG re-encode", fetched: new Date().toISOString().slice(0, 10)
        }
      });
      if (!result.saved) continue;
      saved += 1;
      files.push(base);
      log.log(`  ✓ ${base}  (${license}, ${STRIP_HTML(info.extmetadata?.Artist?.value) || "unknown"})`);
    } catch (error) {
      rejected.push(`${title}: ${error.message}`);
    }
  }
  return { saved, rejected, files };
}

function parseArgs(args) {
  const options = { only: null, skip: new Set(["tree-pine"]), sources: ["oga", "commons"], license: "free", pixel: 4, photo: 3, dry: false, refill: false, delay: 250, report: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i], value = () => { const v = args[++i]; if (v === undefined) throw new Error(`Missing value for ${arg}`); return v; };
    if (arg === "--only") options.only = new Set(value().split(","));
    else if (arg === "--skip") options.skip = new Set(value().split(",").filter(Boolean));
    else if (arg === "--sources") options.sources = value().split(",");
    else if (arg === "--license") options.license = value();
    else if (arg === "--pixel") options.pixel = Number(value());
    else if (arg === "--photo") options.photo = Number(value());
    else if (arg === "--delay") options.delay = Number(value());
    else if (arg === "--report") options.report = value();
    else if (arg === "--dry") options.dry = true;
    else if (arg === "--refill") options.refill = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["cc0", "free", "any"].includes(options.license)) throw new Error("--license는 cc0|free|any");
  if (options.sources.some((s) => !["oga", "commons"].includes(s))) throw new Error("--sources는 oga,commons 중에서");
  return options;
}

export async function fetchAllMain(args = process.argv.slice(2), { logger = console } = {}) {
  const options = parseArgs(args);
  setRequestDelay(options.delay);
  const manifest = artManifest(), vocabulary = loadVocabulary({ workspaceRoot: root });
  const entities = buildEntities(manifest).filter((entity) => (!options.only || options.only.has(entity.id)) && !options.skip.has(entity.id));
  const report = { schemaVersion: 1, date: new Date().toISOString().slice(0, 10), license: options.license, sources: options.sources, limits: { pixel: options.pixel, photo: options.photo }, entities: [] };
  for (const entity of entities) {
    const dir = path.join(root, entityPath(entity, manifest), "레퍼런스");
    const existing = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|gif|jpe?g|webp)$/i.test(f)) : [];
    const queries = entityQueries(entity, manifest, vocabulary);
    if (options.dry) { logger.log(`${entity.id.padEnd(22)} 픽셀: ${queries.specific} → ${queries.groups.join(" · ") || "—"} | 사진: ${queries.photo}`); continue; }
    if (existing.length && !options.refill) { logger.log(`${entity.id}: 이미 ${existing.length}장 — 건너뜀(--refill로 채움)`); continue; }
    logger.log(`\n▶ ${entity.id} (${queries.nameEn})`);
    const row = { id: entity.id, category: entity.category, queries, pixel: [], photo: [], rejected: 0 };
    if (options.sources.includes("oga")) {
      const existingPixel = existing.filter((f) => /\.(png|gif)$/i.test(f)).length;
      let want = Math.max(0, options.pixel - existingPixel);
      const tiers = [[queries.specific, 3], ...queries.groups.map((g) => [g, 2])];
      for (const [query, perTier] of tiers) {
        if (want <= 0) break;
        const result = await collectInto({ category: entity.category, entity: entity.id, dir, queries: [query], limit: Math.min(want, perTier), policy: options.license, isRelevant: relevanceFor(query), log: logger });
        want -= result.saved; row.pixel.push(...result.files); row.rejected += result.rejected.length;
      }
    }
    if (options.sources.includes("commons")) {
      const existingPhoto = existing.filter((f) => /\.jpe?g$/i.test(f)).length;
      const want = Math.max(0, options.photo - existingPhoto);
      if (want > 0) {
        const result = await collectPhotos({ entity, dir, query: queries.photo, limit: want, policy: options.license, log: logger });
        row.photo.push(...result.files); row.rejected += result.rejected.length;
      }
    }
    logger.log(`  = 픽셀 ${row.pixel.length} · 사진 ${row.photo.length}`);
    report.entities.push(row);
  }
  if (options.dry) return report;
  const totals = { entities: report.entities.length, pixel: report.entities.reduce((n, r) => n + r.pixel.length, 0), photo: report.entities.reduce((n, r) => n + r.photo.length, 0) };
  report.totals = totals;
  report.empty = report.entities.filter((r) => !r.pixel.length && !r.photo.length).map((r) => r.id);
  if (options.report) fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  logger.log(`\n합계 — 엔티티 ${totals.entities}, 이번 실행에서 픽셀 ${totals.pixel}장, 사진 ${totals.photo}장. 이번에 새 그림이 없던 엔티티 ${report.empty.length}개(이미 찼거나 결과 없음).`);
  logger.log("다음: node scripts/ambient-ref-notice.mjs → npm run art:catalog -- --all → 소유자가 솎아낸다.");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fetchAllMain().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
