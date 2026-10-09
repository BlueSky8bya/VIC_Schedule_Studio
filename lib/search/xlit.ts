// 영문·로마자 → 한글 읽기(2026-10-10 소유자: "래퍼·가수 이름이나 곡 제목이 영어면 한글로 쳐도 나와야 한다 —
// Okey Dokey는 오키도키, Artist는 아티스트. 새 가수가 나와도 자동으로"). 사람 손 없이 도는 규칙 엔진이다.
//
// 쓰임: 새 다시보기 챕터가 들어오면(lib/broadcast/vod-timeline) 아직 한글 짝이 없는 영문 가수·곡 제목을 읽어
// search_synonyms에 '한글 → 영문' 짝(source 'auto-xlit')으로 넣는다. 지금 있는 것들은 사람이 고른 시드(0145)가 먼저다.
// 정확할 필요는 없다 — 검색의 오타 교정(search_correct, 자모 거리 ≤ 3)이 사전의 이 한글 말과 대어 보므로
// "오끼도끼"·"하잎보이"처럼 조금 다르게 쳐도 가장 가까운 읽기로 붙는다. 그래서 읽기 후보를 몇 개(모음 갈래) 낸다.
//
// 두 갈래:
//  · 로마자(일본어): 낱말 전체가 일본어 음절(ka·shi·tsu·n…)로 끊기면 음절표로 읽는다(yoasobi → 요아소비, minho → 민호).
//  · 영어: 철자 규칙(magic e, ee/oo/ay/igh, -tion, 어말 y·ey, r 탈락 등)으로 소리 조각을 만든 뒤 한글 음절로 묶는다.

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function syl(cho: string, jung: string, jong = ""): string {
  const c = CHO.indexOf(cho);
  const v = JUNG.indexOf(jung);
  const t = JONG.indexOf(jong);
  if (c < 0 || v < 0 || t < 0) return "";
  return String.fromCharCode(0xac00 + (c * 21 + v) * 28 + t);
}
/** 받침 하나를 앞 음절에 붙인다(받침이 이미 있으면 따로 '으' 음절로). */
function addJong(out: string[], jong: string, fallbackCho: string): void {
  const last = out[out.length - 1];
  if (last) {
    const code = last.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172 && code % 28 === 0) {
      out[out.length - 1] = String.fromCharCode(last.charCodeAt(0) + JONG.indexOf(jong));
      return;
    }
  }
  out.push(syl(fallbackCho, "ㅡ"));
}

// ── 로마자(일본어) ───────────────────────────────────────────────────────────
// 초성 + 모음. 'n'(ん)은 받침 ㄴ, 겹자음(kk·tt·pp·ss)은 앞 음절 받침 ㅅ(잇테·깃테).
const ROMAJI_ONSET: Record<string, { cho: string; glide?: "y" | "w" }> = {
  "": { cho: "ㅇ" }, k: { cho: "ㅋ" }, g: { cho: "ㄱ" }, s: { cho: "ㅅ" }, z: { cho: "ㅈ" }, j: { cho: "ㅈ" },
  t: { cho: "ㅌ" }, d: { cho: "ㄷ" }, n: { cho: "ㄴ" }, h: { cho: "ㅎ" }, f: { cho: "ㅎ" }, b: { cho: "ㅂ" },
  p: { cho: "ㅍ" }, m: { cho: "ㅁ" }, y: { cho: "ㅇ", glide: "y" }, r: { cho: "ㄹ" }, w: { cho: "ㅇ", glide: "w" },
  sh: { cho: "ㅅ", glide: "y" }, ch: { cho: "ㅊ", glide: "y" }, ts: { cho: "ㅊ" },
  ky: { cho: "ㅋ", glide: "y" }, gy: { cho: "ㄱ", glide: "y" }, ny: { cho: "ㄴ", glide: "y" }, hy: { cho: "ㅎ", glide: "y" },
  by: { cho: "ㅂ", glide: "y" }, py: { cho: "ㅍ", glide: "y" }, my: { cho: "ㅁ", glide: "y" }, ry: { cho: "ㄹ", glide: "y" },
  jy: { cho: "ㅈ", glide: "y" }
};
const PLAIN_V: Record<string, string> = { a: "ㅏ", i: "ㅣ", u: "ㅜ", e: "ㅔ", o: "ㅗ" };
const Y_V: Record<string, string> = { a: "ㅑ", i: "ㅣ", u: "ㅠ", e: "ㅖ", o: "ㅛ" };
const W_V: Record<string, string> = { a: "ㅘ", i: "ㅟ", u: "ㅜ", e: "ㅞ", o: "ㅗ" };

function romajiVowel(onset: string, v: string): string {
  const o = ROMAJI_ONSET[onset];
  // 시·치·지·쥬: sh/ch/j + i = ㅣ, + u = ㅠ … 일본어 들리는 대로(츠는 ㅡ)
  if (onset === "ts") return v === "u" ? "ㅡ" : PLAIN_V[v];
  if (onset === "s" && v === "u") return "ㅡ"; // す → 스(데스·마스)
  if (onset === "z" && v === "u") return "ㅡ"; // ず → 즈
  if (o?.glide === "y") return Y_V[v];
  if (o?.glide === "w") return W_V[v];
  if (onset === "j") return Y_V[v] === "ㅣ" ? "ㅣ" : { a: "ㅏ", u: "ㅜ", o: "ㅗ", e: "ㅔ" }[v] ?? "ㅣ";
  return PLAIN_V[v];
}
const ROMAJI_ONSETS = Object.keys(ROMAJI_ONSET).filter(Boolean).sort((a, b) => b.length - a.length);

/** 낱말이 일본어 로마자로 온전히 끊기면 한글 읽기, 아니면 null. */
export function romajiToHangul(word: string): string | null {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w) || w.length < 2) return null;
  const out: string[] = [];
  let i = 0;
  let moras = 0;
  while (i < w.length) {
    const ch = w[i];
    // 겹자음(っ): 같은 자음 둘 → 앞 음절 받침 ㅅ
    if (i + 1 < w.length && ch === w[i + 1] && /[kgstdpbcfjmrzh]/.test(ch)) {
      if (!out.length) return null;
      addJong(out, "ㅅ", "ㅅ");
      i += 1;
      continue;
    }
    // ん: n 다음이 모음·y가 아니면 받침
    if (ch === "n" && (i + 1 === w.length || !/[aiueoy]/.test(w[i + 1]))) {
      if (!out.length) return null;
      addJong(out, "ㄴ", "ㄴ");
      i += 1;
      continue;
    }
    if (ch === "m" && i + 1 < w.length && /[bpm]/.test(w[i + 1]) && out.length) {
      addJong(out, "ㅁ", "ㅁ"); // 남바 ← namba 같은 표기
      i += 1;
      continue;
    }
    let onset = "";
    for (const o of ROMAJI_ONSETS) {
      if (w.startsWith(o, i) && /[aiueo]/.test(w[i + o.length] ?? "")) {
        onset = o;
        break;
      }
    }
    const v = w[i + onset.length];
    if (!v || !/[aiueo]/.test(v)) return null;
    // 장음(ou·uu·ei 뒤 같은 모음)은 한 번만 읽는다: yoasobi는 그대로, toukyou → 도쿄
    const jung = romajiVowel(onset, v);
    if (!jung) return null;
    out.push(syl(ROMAJI_ONSET[onset].cho, jung));
    moras += 1;
    i += onset.length + 1;
    if (onset && ((v === "o" && w[i] === "u") || (v === "u" && w[i] === "u"))) i += 1;
  }
  return moras >= 1 ? out.join("") : null;
}

// ── 영어 ────────────────────────────────────────────────────────────────────
// 소리 조각: 자음은 영어 자음 소리, 모음은 한글 중성(ㅏ ㅐ ㅓ ㅔ ㅗ ㅜ ㅡ ㅣ + 이중모음은 두 조각).
type Seg = { c: string } | { v: string };

const VOWELS = "aeiou";
const isV = (ch: string | undefined) => !!ch && VOWELS.includes(ch);

/** 철자 → 소리 조각. alt=true면 모호한 홑모음을 다른 갈래로(a: ㅐ↔ㅏ, o: ㅗ↔ㅓ, u: ㅓ↔ㅜ). */
function englishSegs(word: string, alt: 0 | 1 | 2): Seg[] {
  const w = word.toLowerCase();
  const segs: Seg[] = [];
  const silent = new Set<number>(); // magic e(긴 모음을 만든 뒤 소리 없는 e)
  const V = (v: string) => segs.push({ v });
  const C = (c: string) => segs.push({ c });
  let i = 0;
  while (i < w.length) {
    const rest = w.slice(i);
    const prev = w[i - 1];
    const atEnd = (n: number) => i + n >= w.length;
    if (silent.has(i)) { i += 1; continue; }
    // 어말 e는 소리 없음(magic e는 앞 모음에서 처리)
    if (rest === "e" && i > 0) break;
    if (rest === "ah") { V("ㅏ"); break; }
    if (rest.startsWith("cial") || rest.startsWith("tial")) { C("sh"); V("ㅓ"); C("l"); i += 4; continue; }
    if (rest.startsWith("chr")) { C("k"); i += 2; continue; }
    if (rest.startsWith("ue")) { V("ㅜ"); i += 2; continue; }
    // all·ball·call → 올
    if (rest.startsWith("all") && !isV(w[i + 3])) { V("ㅗ"); C("l"); i += 3; continue; }
    // 어말 -en(약한 모음): golden → 골든, garden → 가든
    if (rest === "en" && i >= 3 && !isV(prev)) { V("ㅡ"); C("n"); break; }
    if (rest === "es" && i > 1 && !isV(prev)) {
      C("s");
      break;
    }
    // 덩어리 철자
    if (rest.startsWith("tion") || rest.startsWith("sion")) { C("sh"); V("ㅕ"); C("n"); i += 4; continue; }
    if (rest.startsWith("igh")) { V("ㅏ"); V("ㅣ"); i += 3; continue; }
    if (rest.startsWith("ough")) { V("ㅓ"); C("f"); i += 4; continue; }
    if (rest.startsWith("tch")) { C("ch"); i += 3; continue; }
    if (rest.startsWith("sch")) { C("s"); C("k"); i += 3; continue; }
    if (rest.startsWith("ch")) { C("ch"); i += 2; continue; }
    if (rest.startsWith("sh")) { C("sh"); i += 2; continue; }
    if (rest.startsWith("th")) { C(i === 0 && /^the$|^th[aeiy]s?$|^thi[sn]/.test(w) ? "d" : "s"); i += 2; continue; }
    if (rest.startsWith("ph")) { C("f"); i += 2; continue; }
    if (rest.startsWith("ck")) { C("k"); i += 2; continue; }
    if (rest.startsWith("qu")) { C("k"); C("w"); i += 2; continue; }
    if (rest.startsWith("ng") && !isV(w[i + 2])) { C("ng"); i += 2; continue; }
    if (rest.startsWith("wh")) { C("w"); i += 2; continue; }
    if (rest.startsWith("wr")) { C("r"); i += 2; continue; }
    if (rest.startsWith("kn") && i === 0) { C("n"); i += 2; continue; }
    // 이중 모음 철자
    if (rest.startsWith("ee") || rest.startsWith("ea")) { V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("oo")) { V("ㅜ"); i += 2; continue; }
    if (rest.startsWith("ou")) { if (w === "you" || rest === "ou") V("ㅜ"); else { V("ㅏ"); V("ㅜ"); } i += 2; continue; }
    if (rest.startsWith("ow")) { if (atEnd(2)) { V("ㅗ"); V("ㅜ"); } else { V("ㅏ"); V("ㅜ"); } i += 2; continue; }
    if (rest.startsWith("ai") || rest.startsWith("ay")) { V("ㅔ"); V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("ey") && atEnd(2)) { V(i <= 1 ? "ㅔ" : "ㅣ"); if (i <= 1) V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("ei")) { V("ㅔ"); V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("oa")) { V("ㅗ"); i += 2; continue; }
    if (rest.startsWith("oi") || rest.startsWith("oy")) { V("ㅗ"); V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("au") || rest.startsWith("aw")) { V("ㅗ"); i += 2; continue; }
    if (rest.startsWith("ie") && atEnd(2)) { V("ㅣ"); i += 2; continue; }
    if (rest.startsWith("ue") && atEnd(2)) { V("ㅜ"); i += 2; continue; }
    if (rest.startsWith("ew")) { V("ㅠ"); i += 2; continue; }
    // r 뒤따르는 모음(er·ir·ur·ar·or): 모음 + r(자음 앞·어말이면 소리 없음)
    const ch = w[i];
    const next = w[i + 1];
    if (isV(ch) && next === "r" && !isV(w[i + 2]) && w[i + 2] !== "r") {
      V(ch === "a" ? "ㅏ" : ch === "o" ? "ㅗ" : "ㅓ");
      i += 2;
      continue;
    }
    if (isV(ch)) {
      // magic e: 모음 + 자음 하나 + 어말 e → 긴 소리
      // 모음 + 자음 하나 + e로 끝(또는 e 뒤 -s/-y/-d/-ly/-less/-ful) · 모음 + 자음 하나 + 어말 y(baby·lady)
      const tail = w.slice(i + 3);
      const magicE = !isV(next) && next !== undefined && next !== "r" && next !== "x" && w[i + 2] === "e" && /^(|s|y|d|ly|less|ful|r)$/.test(tail) && !(tail === "r" && ch !== "i");
      const magicY = !isV(next) && next !== undefined && next !== "r" && w[i + 2] === "y" && i + 3 === w.length && (ch === "a" || ch === "i") && i > 0;
      const magic = magicE || magicY;
      if (magicE) silent.add(i + 2);
      if (magic) {
        if (ch === "a") { V("ㅔ"); V("ㅣ"); }
        else if (ch === "i") { V("ㅏ"); V("ㅣ"); }
        else if (ch === "o") { if (next === "v") V("ㅓ"); else { V("ㅗ"); V(alt ? "ㅜ" : ""); } }
        else if (ch === "u") V("ㅠ");
        else V("ㅣ");
        i += 1;
        continue;
      }
      if (ch === "a") V(alt === 1 ? "ㅏ" : atEnd(1) ? "ㅏ" : "ㅐ");
      else if (ch === "e") V("ㅔ");
      else if (ch === "i") {
        if (i === 0 && /^[^aeiou][aeiou]/.test(w.slice(1, 3))) { V("ㅏ"); V("ㅣ"); } // iris·idol → 아이
        else V("ㅣ");
      } else if (ch === "o") V(alt === 2 ? "ㅓ" : "ㅗ");
      else {
        const open = !isV(next) && next !== undefined && isV(w[i + 2]); // super·tuna: 열린 음절의 u = ㅜ
        V(open ? (alt === 1 ? "ㅓ" : "ㅜ") : alt === 1 ? "ㅜ" : "ㅓ");
      }
      i += 1;
      continue;
    }
    if (ch === "y") {
      if (i === 0 || isV(next)) C("y");
      else if (atEnd(1)) V("ㅣ");
      else { V("ㅏ"); V("ㅣ"); }
      i += 1;
      continue;
    }
    if (ch === "x") { C("k"); C("s"); i += 1; continue; }
    if (ch === "s" && silent.has(i + 1) && isV(prev)) { C("z"); i += 1; continue; } // rose → 로즈
    if (ch === "c") { C(/[eiy]/.test(next ?? "") ? "s" : "k"); i += 1; continue; }
    if (ch === "g" && /[ei]/.test(next ?? "") && i > 0) { C("j"); i += 1; continue; }
    // 겹자음은 한 번만(ll은 ㄹㄹ로 아래 묶기에서 처리)
    if (next === ch && ch !== "l") { i += 1; continue; }
    if (ch === "r" && next === "r") { i += 1; continue; }
    if (ch === "r" && !isV(next) && next !== "y" && i > 0) { i += 1; continue; } // 자음 앞·어말 r 탈락(카드 → card)
    C(ch);
    i += 1;
  }
  return segs.filter((s) => !("v" in s) || s.v);
}

// 자음 소리 → 초성 / 받침(받침으로 쓸 수 있을 때)
const CONS: Record<string, { cho: string; jong?: string; tail?: string }> = {
  b: { cho: "ㅂ" }, p: { cho: "ㅍ", jong: "ㅂ" }, d: { cho: "ㄷ" }, t: { cho: "ㅌ", jong: "ㅅ" }, g: { cho: "ㄱ" },
  k: { cho: "ㅋ", jong: "ㄱ" }, f: { cho: "ㅍ" }, v: { cho: "ㅂ" }, s: { cho: "ㅅ" }, z: { cho: "ㅈ" }, j: { cho: "ㅈ", tail: "ㅣ" },
  ch: { cho: "ㅊ", tail: "ㅣ" }, sh: { cho: "ㅅ", tail: "ㅣ" }, h: { cho: "ㅎ" }, m: { cho: "ㅁ", jong: "ㅁ" }, n: { cho: "ㄴ", jong: "ㄴ" },
  ng: { cho: "ㅇ", jong: "ㅇ" }, l: { cho: "ㄹ", jong: "ㄹ" }, r: { cho: "ㄹ" }, w: { cho: "ㅇ" }, y: { cho: "ㅇ" }, q: { cho: "ㅋ" }
};
// 반모음 + 모음 → 이중모음
const W_GLIDE: Record<string, string> = { "ㅏ": "ㅘ", "ㅐ": "ㅙ", "ㅓ": "ㅝ", "ㅔ": "ㅞ", "ㅣ": "ㅟ", "ㅗ": "ㅝ", "ㅜ": "ㅜ", "ㅡ": "ㅜ" };
const Y_GLIDE: Record<string, string> = { "ㅏ": "ㅑ", "ㅐ": "ㅒ", "ㅓ": "ㅕ", "ㅔ": "ㅖ", "ㅗ": "ㅛ", "ㅜ": "ㅠ", "ㅣ": "ㅣ", "ㅡ": "ㅠ" };
const SH_GLIDE: Record<string, string> = { "ㅏ": "ㅑ", "ㅓ": "ㅕ", "ㅗ": "ㅛ", "ㅜ": "ㅠ", "ㅔ": "ㅔ", "ㅐ": "ㅐ", "ㅣ": "ㅣ", "ㅕ": "ㅕ" };
/** 짧은 모음 뒤에서 받침으로 닫히는 소리(캣·팝·록). 그 밖의 어말 자음은 '으'를 붙여 따로(스·즈·드). */
const SHORT = new Set(["ㅐ", "ㅔ", "ㅣ", "ㅗ", "ㅓ", "ㅏ", "ㅜ"]);

function segsToHangul(segs: Seg[]): string {
  const out: string[] = [];
  let lastVowel = "";
  let diph = false; // 바로 앞 소리가 이중모음(ai·ei·ou)이었다 → 뒤 자음은 받침으로 닫지 않는다(나이트·엘리베이트)
  let epenthetic = false; // 바로 앞 음절이 자음만 남아 붙인 '으'(블·플·클)
  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i];
    if ("v" in s) {
      out.push(syl("ㅇ", s.v));
      diph = !!lastVowel;
      lastVowel = s.v;
      epenthetic = false;
      continue;
    }
    const c = s.c;
    const nx = segs[i + 1];
    const info = CONS[c] ?? { cho: "ㅇ" };
    if (nx && "v" in nx) {
      let v = nx.v;
      if (c === "w") v = W_GLIDE[v] ?? v;
      else if (c === "y") v = Y_GLIDE[v] ?? v;
      else if (c === "sh") v = SH_GLIDE[v] ?? v;
      // 모음 사이 l → 앞 받침 ㄹ + ㄹ(헬로·멜로디), 자음 + l → 앞 '으'에 ㄹ 받침(블루·플라이·클래스)
      if (c === "l" && (lastVowel || epenthetic) && out.length) addJong(out, "ㄹ", "ㄹ");
      out.push(syl(info.cho, v));
      lastVowel = nx.v;
      diph = false;
      epenthetic = false;
      i += 1;
      // 자음 + 모음 뒤에 모음이 또 오면(ai·ei) 이중모음
      continue;
    }
    // 뒤에 모음이 없다: 받침으로 닫거나 '으/이'를 붙인다
    const prevSyl = out[out.length - 1];
    const open = prevSyl && (prevSyl.charCodeAt(0) - 0xac00) % 28 === 0;
    const closes = info.jong && open && (c === "m" || c === "n" || c === "ng" || c === "l" || (SHORT.has(lastVowel) && !diph && !nx));
    if (closes && info.jong) {
      addJong(out, info.jong, info.cho);
      epenthetic = false;
    } else if (c === "w" || c === "y") {
      out.push(syl("ㅇ", c === "w" ? "ㅜ" : "ㅣ"));
      epenthetic = false;
    } else {
      out.push(syl(info.cho, info.tail ?? "ㅡ"));
      epenthetic = !info.tail;
    }
    lastVowel = "";
    diph = false;
  }
  return out.join("");
}

/** 영어 낱말 하나의 읽기 후보(1~3개, 중복 없음). */
export function englishToHangul(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length < 2) return [];
  const outs = new Set<string>();
  for (const alt of [0, 1, 2] as const) {
    const h = segsToHangul(englishSegs(w, alt));
    if (h.length >= 1) outs.add(h);
  }
  return [...outs];
}

/** 낱말 하나: 로마자(일본어)로 끊기면 그 읽기를 먼저, 영어 읽기를 뒤에. */
export function wordToHangul(word: string): string[] {
  const out: string[] = [];
  const r = romajiToHangul(word);
  if (r) out.push(r);
  for (const e of englishToHangul(word)) if (!out.includes(e)) out.push(e);
  return out;
}

/**
 * 영문(로마자) 구절 → 한글 읽기 후보. 낱말마다 첫 후보를 이어 붙인 것 + 낱말 하나씩만 갈래를 바꾼 것(최대 max개).
 * 한글·숫자가 섞이면 그 부분은 그대로 둔다("Love wins all" → 러브윈즈올, "10CM" → 10씨엠은 만들지 않는다 — 숫자는 그대로).
 */
export function latinToHangul(phrase: string, max = 4): string[] {
  const parts = phrase.split(/[^A-Za-z0-9가-힣]+/).filter(Boolean);
  if (!parts.length || !parts.some((p) => /[A-Za-z]/.test(p))) return [];
  const options = parts.map((p) => (/^[A-Za-z]+$/.test(p) ? wordToHangul(p) : [p]));
  if (options.some((o) => o.length === 0)) return [];
  const base = options.map((o) => o[0]);
  const outs = new Set<string>([base.join("")]);
  for (let k = 0; k < options.length && outs.size < max; k += 1) {
    for (let a = 1; a < options[k].length && outs.size < max; a += 1) {
      outs.add(base.map((b, j) => (j === k ? options[k][a] : b)).join(""));
    }
  }
  return [...outs].filter((h) => /[가-힣]/.test(h) && h.replace(/[^가-힣]/g, "").length >= 2);
}
