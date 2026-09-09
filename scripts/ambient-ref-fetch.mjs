// 취향 레퍼런스 수집(2026-09-09, PLAN-011) — 엔티티 범주별로 **CC0 픽셀아트만** 받아 둔다.
//
// 소유자가 여기서 마음에 드는 것만 남기고 나머지를 지운다. 남은 것이 생성 의뢰의 첨부 시트 ② 구역이 된다.
//
//   node scripts/ambient-ref-fetch.mjs fish --limit 30
//   node scripts/ambient-ref-fetch.mjs fish --query "fish sprite" --limit 20
//   node scripts/ambient-ref-fetch.mjs --all
//
// 규칙 셋(어기면 저장소에 남의 저작물이 남는다):
//  ① **CC0만.** 검색의 라이선스 필터를 믿지 않고 개별 페이지에서 다시 읽어 확인한다.
//     필터는 속도를 위한 것이고, 판정은 페이지가 한다.
//  ② 그림마다 **사이드카 JSON**(출처·라이선스·작성자·원제·받은 날)을 함께 쓴다.
//     사이드카 없는 그림은 출처를 잃은 그림이고, 출처를 잃으면 쓸 수 없다.
//  ③ NOTICE는 여기서 쓰지 않는다 — `ambient-ref-notice.mjs`가 **살아남은 사이드카에서** 다시 굽는다.
//     소유자가 그림을 지우면 그 줄도 사라져야 하는데, 여기서 덧붙이면 지운 그림이 목록에 남는다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "art-src/reference");

/** `manifest.ts`의 `ArtCategory`와 **같은 아홉**이다. 새 분류를 만들지 않는다 —
 *  갈라진 두 목록은 이 저장소에서 이미 사고를 냈다(species.ts ↔ codex.ts). */
const CATEGORIES = {
  tree: { ko: "나무", queries: ["tree", "pine tree", "oak tree", "forest tree"] },
  plant: { ko: "풀·꽃", queries: ["grass", "flower", "plant", "bush"] },
  ground: { ko: "지형", queries: ["rock", "stone", "terrain tile", "ground tile"] },
  water: { ko: "물", queries: ["water", "pond", "wave", "lily pad"] },
  prop: { ko: "소품", queries: ["mushroom", "log stump", "fence", "signpost"] },
  sky: { ko: "하늘·천체", queries: ["cloud", "moon", "star sky", "sun"] },
  fish: { ko: "물고기", queries: ["fish", "fish sprite", "sea creature"] },
  bug: { ko: "곤충", queries: ["insect", "bug sprite", "butterfly", "beetle"] },
  animal: { ko: "동물", queries: ["animal sprite", "rabbit", "bird sprite", "squirrel"] },
};

const IMG = /\.(png|gif)$/i;
const UA = "VIC-Schedule-Studio reference collector (CC0 only)";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const has = (name) => args.includes(`--${name}`);

async function get(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** 검색 결과에서 작품 페이지 주소만 뽑는다. `/content/faq` 같은 붙박이 페이지는 뺀다.
 *  ⚠ **정렬을 건드리지 않는다.** `sort_by=count`(내려받은 횟수)로 뽑으면 유명한 대형 팩이 위로 올라와
 *  질의와 상관없는 것이 온다(실측: "fish"에 monkey-lad·pixel-land가 왔다). 기본값이 관련성 정렬이다. */
async function search(query, pages) {
  const found = new Set();
  for (let p = 0; p < pages; p += 1) {
    const url =
      `https://opengameart.org/art-search-advanced?keys=${encodeURIComponent(query)}` +
      `&field_art_type_tid%5B%5D=9` + // 2D Art
      `&field_art_licenses_tid%5B%5D=4` + // CC0 (속도용 — 판정은 페이지가 한다)
      `&page=${p}`;
    let html;
    try {
      html = await get(url);
    } catch {
      break;
    }
    const before = found.size;
    for (const m of html.matchAll(/href="\/content\/([a-z0-9][a-z0-9-]{2,})"/g)) {
      if (m[1] !== "faq") found.add(m[1]);
    }
    if (found.size === before) break; // 더 없으면 그만
  }
  return [...found];
}

/** 질의어가 슬러그나 파일 이름에 실제로 들어 있는가. 검색이 관련성 정렬이어도 팩 안의 곁다리 파일이
 *  같이 딸려 오므로(미리보기·타일셋), 이름이 말해 주는 것만 남긴다. */
function relevant(text, queries) {
  const t = text.toLowerCase();
  return queries.some((q) => q.toLowerCase().split(/\s+/).some((w) => w.length > 2 && t.includes(w)));
}

/** 작품 페이지 하나 — 라이선스를 **다시** 확인하고, 그림 주소와 출처를 돌려준다. */
async function inspect(slug) {
  const html = await get(`https://opengameart.org/content/${slug}`);
  const licenses = [...html.matchAll(/license-name'>([^<]+)</g)].map((m) => m[1].trim());
  // ① CC0만. 여러 라이선스가 붙은 작품은 **전부** CC0일 때만 받는다 —
  //    하나라도 조건부가 섞이면 어느 파일이 어느 라이선스인지 페이지가 말해 주지 않는다.
  if (!licenses.length || !licenses.every((l) => /^CC0/.test(l))) return null;
  const files = [...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => IMG.test(u) && !/\/(css|js)\//.test(u) && !/styles\/thumbnail/.test(u));
  if (!files.length) return null; // zip만 있는 작품은 건너뛴다(사람이 풀어야 한다)
  const author = html.match(/class='username'><a href="\/users\/[^"]*">([^<]+)</)?.[1] ?? "unknown";
  const title = html.match(/<h2 class="element-invisible">[^<]*<\/h2>|<title>([^<|]+)/)?.[1]?.trim() ?? slug;
  return { slug, licenses, files: [...new Set(files)], author, title };
}

/** 이름을 줄이되 **확장자는 자르지 않는다.** 그냥 `slice(0,60)`을 쓰면 `…water_0.` 처럼 점으로 끝나는 이름이 나오고,
 *  Windows는 그런 파일을 만들지도 git에 넣지도 못한다(2026-09-09에 `git add`가 여기서 실패했다). */
const safe = (s) => {
  const ext = (s.match(/\.(png|gif)$/i)?.[0] ?? ".png").toLowerCase();
  const stem = s.slice(0, s.length - ext.length).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/\.+$/, "");
  return `${stem.slice(0, 56) || "ref"}${ext}`;
};

/** 사이트가 "2D Art"라고 말해도 벡터 만화체가 절반이다. **태그를 믿지 않고 잰다.**
 *  실측(2026-09-09) — 우리 합격본: 색 6~8 · 반투명 0.0% · 가로 런 13~29.
 *  내려받은 벡터: 색 254~13,447 · 런 1.4~10. 색 수가 두 어법을 갈라놓는다.
 *  참고 그림이 우리만큼 적을 필요는 없지만(여러 스프라이트가 한 장에 있다), 수천 색은 도트를 안 가르친다. */
async function pixelness(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const colors = new Set();
  let opaque = 0, semi = 0, runs = 0, runPx = 0;
  for (let y = 0; y < h; y += 1) {
    let prev = -1;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 8) { prev = -1; continue; }
      opaque += 1;
      if (a < 248) semi += 1;
      const c = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      if (c !== prev) runs += 1;
      prev = c; runPx += 1;
      if (colors.size <= 4096) colors.add(c);
    }
  }
  if (!opaque) return null;
  return { colors: colors.size, semi: (100 * semi) / opaque, run: runPx / Math.max(1, runs), w, h, logical: await logicalRes(buf) };
}

/** **논리 해상도** — 픽셀아트를 가르는 진짜 지표다. 색 수만으로는 매끈한 플랫 벡터가 통과한다
 *  (실측: 300px 만화 물고기가 색 40개·런 8로 색 게이트를 넘었다).
 *  도트 격자를 `art:check`와 같은 방식으로 추정하고(정렬 b×b 칸이 95% 단색인 가장 큰 b),
 *  긴 변을 그 격자로 나눈다. 우리 규격은 64~96칸이다(CLAUDE.md) — 벡터는 수백 칸이 나온다. */
async function logicalRes(buf) {
  const t = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = t.info, d = t.data;
  const at = (x, y) => { const i = (y * W + x) * C; return d[i + 3] > 128 ? `${d[i]},${d[i + 1]},${d[i + 2]}` : null; };
  let block = 1;
  for (const b of [2, 3, 4, 6, 8, 12, 16]) {
    if (W % b || H % b) continue;
    let ok = 0, all = 0;
    for (let cy = 0; cy < H / b; cy += 1) for (let cx = 0; cx < W / b; cx += 1) {
      all += 1;
      const c0 = at(cx * b, cy * b);
      let uni = true;
      for (let y = 0; y < b && uni; y += 1) for (let x = 0; x < b; x += 1) if (at(cx * b + x, cy * b + y) !== c0) { uni = false; break; }
      if (uni) ok += 1;
    }
    if (all && ok / all >= 0.95) block = b;
  }
  return Math.round(Math.max(W, H) / block);
}

/** 홍보 배너는 그림이 아니다 — 로고와 라이선스 문구가 박혀 있어서 참고로 쓰면 그것까지 배운다
 *  (실측: 케니 fish-pack "preview"에 CC0 배지·문장·브랜드 로고가 들어 있었다). */
const BANNER = /(preview|banner|logo|promo|title|cover|screenshot|watermark)/i;

/** 픽셀아트인가. 게이트를 통과 못 하면 왜 떨어졌는지 한 줄로 말한다 — 조용히 버리면 수확이 왜 적은지 알 수 없다. */
function verdict(m) {
  if (!m) return "빈 그림";
  if (m.colors > 128) return `색 ${m.colors}개(벡터·사진 계열)`;
  if (m.semi > 6) return `반투명 ${m.semi.toFixed(1)}%(안티에일리어싱)`;
  if (m.run < 2.5) return `가로 런 ${m.run.toFixed(2)}(도트가 아니다)`;
  if (m.logical > 160) return `논리 해상도 ${m.logical}칸(매끈한 벡터 — 우리 규격은 64~96칸)`;
  return null;
}

async function collect(cat, limit, query) {
  const meta = CATEGORIES[cat];
  if (!meta) throw new Error(`모르는 범주: ${cat} (${Object.keys(CATEGORIES).join(", ")})`);
  const dir = path.join(OUT, cat);
  fs.mkdirSync(dir, { recursive: true });

  const queries = query ? [query] : meta.queries;
  const slugs = [];
  for (const q of queries) {
    for (const s of await search(q, 2)) if (!slugs.includes(s)) slugs.push(s);
  }

  let saved = 0;
  const rejected = [];
  for (const slug of slugs) {
    if (saved >= limit) break;
    if (!relevant(slug, queries)) continue; // 이름이 질의와 무관하면 팩 통째로 건너뛴다
    let info;
    try {
      info = await inspect(slug);
    } catch {
      continue;
    }
    if (!info) continue;
    // 한 작품에서 두 장까지만 — 같은 팩이 폴더를 메우면 소유자가 고를 폭이 줄어든다.
    for (const url of info.files.slice(0, 2)) {
      if (saved >= limit) break;
      const base = safe(`${slug}--${path.basename(new URL(url).pathname)}`);
      if (BANNER.test(base)) { rejected.push(`${base}: 홍보 배너`); continue; }
      const dest = path.join(dir, base);
      if (fs.existsSync(dest)) continue;
      try {
        const r = await fetch(url, { headers: { "user-agent": UA } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 300 || buf.length > 3_000_000) continue; // 빈 파일·거대한 시트 제외
        let why = null;
        try {
          why = verdict(await pixelness(buf));
        } catch {
          why = "읽을 수 없는 그림";
        }
        if (why) { rejected.push(`${base}: ${why}`); continue; }
        fs.writeFileSync(dest, buf);
        // ② 사이드카 — 출처를 잃은 그림은 쓸 수 없다.
        fs.writeFileSync(
          `${dest}.json`,
          `${JSON.stringify(
            {
              file: base,
              source: `https://opengameart.org/content/${slug}`,
              downloadedFrom: url,
              license: info.licenses.join(" / "),
              author: info.author,
              title: info.title,
              fetched: new Date().toISOString().slice(0, 10),
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
        saved += 1;
        console.log(`  ✓ ${base}  (${info.licenses.join("/")}, ${info.author})`);
      } catch {
        /* 한 장 실패는 수집 전체를 멈추지 않는다 */
      }
    }
  }
  console.log(`${cat}(${meta.ko}): ${saved}장 받음 → art-src/reference/${cat}/`);
  // 떨어진 것을 조용히 버리지 않는다 — 수확이 적을 때 원인이 게이트인지 소스인지 알아야 한다.
  if (rejected.length) {
    console.log(`  게이트에서 떨어진 것 ${rejected.length}장:`);
    for (const r of rejected.slice(0, 8)) console.log(`    · ${r}`);
    if (rejected.length > 8) console.log(`    · … 외 ${rejected.length - 8}장`);
  }
  return saved;
}

const limit = Number(flag("limit", "24"));
const targets = has("all") ? Object.keys(CATEGORIES) : args.filter((a) => CATEGORIES[a]);
if (!targets.length) {
  console.error(`범주를 달라 — ${Object.keys(CATEGORIES).join(" · ")} 또는 --all`);
  process.exit(1);
}
let total = 0;
for (const cat of targets) total += await collect(cat, limit, flag("query", ""));
console.log(`\n합계 ${total}장. 소유자가 솎아낸 뒤 \`node scripts/ambient-ref-notice.mjs\`로 NOTICE를 다시 굽는다.`);
