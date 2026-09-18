// 한글 오타 도우미(PLAN-20260918-023 후속, 소유자 2026-09-18): 영타로 잘못 친 검색어("shfo")를 두벌식 자판으로
// 되돌려 "노래"로 알아듣는다. 서버 로더(searchPublic)가 질의를 RPC에 넘기기 전에 쓴다.
//
// 규칙: 질의가 라틴 글자·공백뿐이고, 두벌식 변환 결과에 완성형 음절이 하나라도 생기면 변환본을 쓴다.
// "zelda"·"pubg"처럼 실제 영어 검색어도 변환은 되지만("ㅋ디ㅣㅇㅁ") 완성 음절이 안 나오거나 아주 적어
// 원문을 유지한다(완성 음절 비율 ≥ 0.5일 때만 변환).

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

// 두벌식: 키 → 자모(쉬프트 = 된소리·이중모음)
const KEY: Record<string, string> = {
  q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ", y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
  a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ", h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
  z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ", b: "ㅠ", n: "ㅜ", m: "ㅡ",
  Q: "ㅃ", W: "ㅉ", E: "ㄸ", R: "ㄲ", T: "ㅆ", O: "ㅒ", P: "ㅖ"
};
const VOWEL_COMBO: Record<string, string> = { "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ" };
const JONG_COMBO: Record<string, string> = {
  "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ"
};
const isVowel = (j: string) => JUNG.includes(j);

function compose(cho: string, jung: string, jong: string): string {
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  const gi = JONG.indexOf(jong);
  if (ci < 0 || ji < 0 || gi < 0) return cho + jung + jong;
  return String.fromCharCode(0xac00 + (ci * 21 + ji) * 28 + gi);
}

/** 두벌식 자판 문자열 → 한글. 라틴이 아닌 글자는 그대로. */
export function qwertyToHangul(input: string): string {
  const jamos: string[] = [];
  for (const ch of input) {
    const j = KEY[ch] ?? KEY[ch.toLowerCase()];
    jamos.push(j ?? ch);
  }
  let out = "";
  let cho = "";
  let jung = "";
  let jong = "";
  const flush = () => {
    if (cho && jung) out += compose(cho, jung, jong);
    else out += cho + jung + jong;
    cho = jung = jong = "";
  };
  for (let i = 0; i < jamos.length; i += 1) {
    const j = jamos[i];
    const isJamo = CHO.includes(j) || JUNG.includes(j) || JONG.includes(j);
    if (!isJamo) {
      flush();
      out += j;
      continue;
    }
    if (isVowel(j)) {
      if (cho && jung && !jong && VOWEL_COMBO[jung + j]) {
        jung = VOWEL_COMBO[jung + j];
      } else if (cho && jung && jong) {
        // 받침이 다음 음절의 초성이 된다(ㄴ+ㅗ+ㄹ+ㅐ → 노 + 래)
        const combo = Object.entries(JONG_COMBO).find(([, v]) => v === jong);
        if (combo) {
          const [pair] = combo;
          jong = pair[0];
          flush();
          cho = pair[1];
        } else {
          const next = jong;
          jong = "";
          flush();
          cho = next;
        }
        jung = j;
      } else if (cho && !jung) {
        jung = j;
      } else if (!cho && !jung) {
        out += j; // 초성 없는 모음
      } else {
        flush();
        out += j;
      }
    } else {
      // 자음
      if (!cho) {
        cho = j;
      } else if (cho && !jung) {
        flush();
        cho = j;
      } else if (cho && jung && !jong) {
        if (JONG.includes(j)) jong = j;
        else {
          flush();
          cho = j;
        }
      } else if (cho && jung && jong) {
        const c = JONG_COMBO[jong + j];
        if (c) jong = c;
        else {
          flush();
          cho = j;
        }
      }
    }
  }
  flush();
  return out;
}

/** 영타 오타로 보이면 한글로 되돌린 질의를, 아니면 null. */
export function fixLatinTypo(q: string): string | null {
  const t = q.trim();
  if (!/^[a-zA-Z\s]+$/.test(t)) return null;
  const converted = qwertyToHangul(t);
  const syll = (converted.match(/[가-힣]/g) ?? []).length;
  const letters = t.replace(/\s/g, "").length;
  // 두벌식 한 음절 = 보통 2~4키("종"=3키, "겜"=3키). 완성 음절이 글자 수의 1/4 이상이면 영타로 본다.
  if (syll === 0 || syll < Math.floor(letters / 4)) return null;
  // 미완성 자모가 절반 넘게 남으면(예: "pubg"→"ㅔㅕㅠㅎ") 영어다.
  const loose = (converted.match(/[ㄱ-ㅎㅏ-ㅣ]/g) ?? []).length;
  if (loose > syll) return null;
  return converted;
}
