// 레퍼런스 출처 목록 재굽기(2026-09-09, PLAN-011).
//
//   node scripts/ambient-ref-notice.mjs           # 다시 굽는다
//   node scripts/ambient-ref-notice.mjs --check   # 어긋나면 실패한다(CI·계약 테스트용)
//
// **살아남은 사이드카에서만** 굽는다. 소유자가 그림을 지우면 그 줄도 사라지고, 짝 잃은 사이드카도 같이 지운다.
// 손으로 관리하는 목록은 반드시 낡는다 — 이 저장소가 두 번 겪었다(species.ts ↔ codex.ts).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "art-src/reference");
const NOTICE = path.join(OUT, "NOTICE.md");
const check = process.argv.includes("--check");

const CATEGORY_KO = {
  tree: "나무", plant: "풀·꽃", ground: "지형", water: "물", prop: "소품",
  sky: "하늘·천체", fish: "물고기", bug: "곤충", animal: "동물",
};

const problems = [];
const rows = [];
let total = 0;

for (const cat of Object.keys(CATEGORY_KO)) {
  const dir = path.join(OUT, cat);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  const images = files.filter((f) => /\.(png|gif)$/i.test(f)).sort();
  const cards = files.filter((f) => f.endsWith(".json"));

  // 짝 잃은 사이드카는 지운다 — 소유자가 그림을 지웠다는 뜻이다.
  for (const c of cards) {
    if (!images.includes(c.replace(/\.json$/, ""))) {
      if (check) problems.push(`짝 잃은 사이드카: ${cat}/${c}`);
      else fs.rmSync(path.join(dir, c));
    }
  }

  for (const img of images) {
    const cardPath = path.join(dir, `${img}.json`);
    if (!fs.existsSync(cardPath)) {
      // 출처를 잃은 그림은 쓸 수 없다. 지우지는 않는다 — 소유자가 직접 넣은 것일 수 있다.
      problems.push(`출처 없는 그림: ${cat}/${img} — 사이드카 ${img}.json을 손으로 적어야 한다`);
      continue;
    }
    let card;
    try {
      card = JSON.parse(fs.readFileSync(cardPath, "utf8"));
    } catch {
      problems.push(`읽을 수 없는 사이드카: ${cat}/${img}.json`);
      continue;
    }
    if (!/^CC0/.test(card.license ?? "")) {
      problems.push(`CC0가 아닌 항목: ${cat}/${img} — ${card.license ?? "라이선스 없음"}`);
      continue;
    }
    total += 1;
    rows.push(`| ${CATEGORY_KO[cat]} | \`${img}\` | ${card.license} | ${card.author} | ${card.source} |`);
  }
}

const body = `# 레퍼런스 출처 (art-src/reference)

> **이 파일은 손으로 고치지 않는다.** \`node scripts/ambient-ref-notice.mjs\`가
> 각 그림 옆의 사이드카(\`<파일>.json\`)에서 다시 굽는다. 그림을 지우면 줄도 사라진다.

여기 있는 것은 **생성 의뢰에 붙이는 참고 그림**이다 — 형태의 발상만 얻고, 그리는 어법은
우리 합격본을 따른다. **베끼거나 트레이스한 결과물은 쓸 수 없다**(ADR-0019).
전부 **CC0**(퍼블릭 도메인 기증)만 받는다. 다른 라이선스는 \`ambient-ref-fetch.mjs\`가 거른다.

현재 ${total}장.

| 범주 | 파일 | 라이선스 | 작성자 | 출처 |
|---|---|---|---|---|
${rows.join("\n")}
`;

if (problems.length) {
  console.error("문제:");
  for (const p of problems) console.error(`  · ${p}`);
  if (check) process.exit(1);
}

if (check) {
  const cur = fs.existsSync(NOTICE) ? fs.readFileSync(NOTICE, "utf8") : "";
  if (cur !== body) {
    console.error("NOTICE.md가 폴더 내용과 어긋난다 — `node scripts/ambient-ref-notice.mjs`를 돌려라.");
    process.exit(1);
  }
  console.log(`NOTICE.md 최신 (${total}장).`);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(NOTICE, body, "utf8");
  console.log(`NOTICE.md 다시 구웠다 — ${total}장.`);
}
