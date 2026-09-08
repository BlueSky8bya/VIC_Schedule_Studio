# 인계 — 소나무 21장 재작업 (2026-09-08)

> 다른 기기·다른 세션이 **이 문서만 읽고 이어받을 수 있게** 쓴다. 상태 · 왜 반려인가 · 다음에 무엇을.
> 상위 맥락은 [docs/agent/CURRENT_STATE.md](../agent/CURRENT_STATE.md), 규칙은 [docs/ambient/README.md](README.md).

## 지금 상태 (한 줄)

**소나무 21장이 배달됐고 반려다.** 반려본은 `art-src/incoming-pine/`에 **커밋돼 있다**(24장 = 21 + 덮어쓰인 `-1` 3장).
`public/ambient/art/`의 소나무는 **합격본 `-1` 세 장뿐**이다 — 반려본을 화면에 깔지 않으려고 되돌려 놨다.

## 파일이 어디에 있나

| 무엇 | 어디 | 비고 |
|---|---|---|
| 합격본 소나무 3장 | `public/ambient/art/tree-pine{,-autumn,-winter}-1.png` | 화풍 기준선. 240×432, 색 7~9 |
| **반려본 21장** | `art-src/incoming-pine/tree-pine{,-autumn,-winter}-{2..8}.png` | 1024 원본 그대로 |
| 코덱스가 덮어쓴 `-1` 3장 | `art-src/incoming-pine/tree-pine{,-autumn,-winter}-1.png` | ⚠ 아래 참조 |
| 이번에 쓴 프롬프트 | `.scratch-pw/prompt-pine21.md` | **추적 안 됨** — 아래 "프롬프트 다시 뽑기" |
| 합격한 바위 8장 | `public/ambient/art/rock-{1..8}.png` | 원본 `art-src/rock-*.png` |

⚠ **코덱스가 `-1` 세 장을 덮어썼다.** 합격본이라 `git checkout`으로 되돌렸고, 들어온 판은
`art-src/incoming-pine/`에 남겼다(잃지 않으려고). 이전에 그 반대 사고가 한 번 있었다(2026-09-07, `git checkout`으로
갓 받은 그림을 날려 재배달을 부탁했다) — **덮어쓰기를 발견하면 먼저 보관하고 되돌린다.**

## 반려 사유 (실측)

계측 도구: `.scratch-pw/pine-check.mjs`(짝·다양성 수치) · `.scratch-pw/pine-sheet.mjs`(3계절 × 8 대조표) —
둘 다 **추적 안 되는 스크래치**다. 다른 기기에서는 다시 만들어야 한다(아래 "도구 다시 만들기").

### ✅ 잘된 것 — 이건 유지시켜라

- **계절 짝이 완벽하다.** `-n`의 봄↔가을 실루엣 일치 **100%**, 봄↔겨울 **99%**. 이번 프롬프트가 짝을 못 박은 것이 먹혔다.
  (짝이 깨지면 달력을 넘길 때 나무가 다른 나무로 바뀐다 — `land.ts`가 달에 따라 파일을 갈아 끼운다.)
- 색 수 8/8/10(겨울만 눈 2색 추가) · 반투명 0 · 비 0.43~0.56(자리 0.55:1의 ±25% 안).

### ❌ 반려 셋

1. **잎 질감이 합격본과 다른 어법이다.** `-1`은 굵은 블록으로 단이 또렷한 톱니 원뿔인데, `-2~-8`은 잎이 **잘게 부서진
   스티플/노이즈**다. 도트가 잘고 산만해 "굵은 픽셀 블록" 규칙을 벗어난다. 한 화면에 `-1`과 나란히 서면 바로 갈린다.
2. **겨울 눈이 얇은 흰 줄이 됐다.** 브리프는 "단 **윗면에만** 두툼하게 얹혀 **윤곽이 둥글어진다**"인데, `-2~-8`은
   가로 흰 선 몇 개다. 눈이 실루엣을 안 바꾼다. `-1`은 제대로 두툼하다 — `-1`을 보고 맞추게 해야 한다.
3. **여덟이 충분히 안 갈렸다.** 같은 계절 안 실루엣 유사도 **74~91%**(대부분 80%대, `-4`↔`-7`은 91%).
   눈으로도 `-2·-3·-5·-6·-8`이 거의 같은 나무다.
4. (경미) **가을이 노란빛으로 뜬다.** 브리프는 "채도 낮은 올리브~암녹"인데 노랑기가 돈다 — 오행 규칙의
   "선명한 노랑 금지"에 가깝다.

## 다음에 할 일

1. **프롬프트를 다시 뽑고** 위 반려 사유 넷을 브리프에 박는다(특히 ①②는 `-1`을 **직접 열어 보고 맞추라**고 써야 한다).
   `tree-pine`·`tree-pine-autumn`·`tree-pine-winter` 세 브리프는 `components/shared/ambient/art/manifest.ts`에 있다.
2. 코덱스에 재요청 → 받으면 `public/ambient/art/`에 넣고 `npm run art:normalize`(원본은 `art-src/`에 자동 보관).
3. 게이트 → **짝 검사**(`-n` 셋의 실루엣 일치 ≥ 95%) → **다양성 검사**(같은 계절 안 유사도 상한 — 이번 74~91%보다 낮아야 한다)
   → 산 가을·겨울 장면 캡처(`/visual-fixture/biome?biome=mountain&season=winter&band=noon&weather=clear&seed=42&t=1500`).
4. 통과하면 커밋하고 `art-src/incoming-pine/`를 지운다.

### 프롬프트 다시 뽑기

`.scratch-pw/`는 추적하지 않으므로 다른 기기엔 없다. 두 길 중 하나:

- **아트 보드**(권장): `/studio/ambient-art`(개발자) → 자리를 누르면 `/studio/ambient-art/tree-pine` →
  **「이 자리 프롬프트」** 또는 **「남은 N장만」**. 목록 상단의 **「남은 파일만」**은 보이는 자리 전부를 한 장으로 만든다.
- **스크립트**: 임시 테스트 파일을 만들어 `batchPrompt`를 호출한다(매니페스트가 정본이므로 표와 프롬프트는 어긋나지 않는다).

```ts
// tests/unit/zz-dump.test.ts (쓰고 나면 지운다)
import { describe, it } from "vitest";
import fs from "node:fs";
import { ART_SLOTS, batchPrompt } from "@/components/shared/ambient/art/manifest";
describe("dump", () => {
  it("d", () => {
    const ids = (process.env.ART_IDS || "rock").split(",");
    const files = (process.env.ART_FILES || "").split(",").filter(Boolean);
    const slots = ART_SLOTS.filter((s) => ids.includes(s.id));
    const note = process.env.ART_NOTE || undefined;
    fs.writeFileSync(".scratch-pw/out.md", batchPrompt(slots, process.env.ART_TITLE || "배치", { ...(files.length ? { files } : {}), ...(note ? { note } : {}) }), "utf8");
  });
});
```
```bash
ART_IDS=tree-pine,tree-pine-autumn,tree-pine-winter ART_TITLE="소나무 21장 재작업" npx vitest run tests/unit/zz-dump.test.ts
```
**계절 셋을 반드시 한 배치로** 보낸다 — 나눠 보내면 짝이 깨진다.

### 도구 다시 만들기

`pine-check.mjs`(짝·다양성)와 `pine-sheet.mjs`(대조표)는 스크래치라 안 따라간다. 다시 만들 때 핵심만:

- **짝 검사**: 알파 상자를 16×16 격자로 나눠 칸별 불투명 비율을 내고, 계절 쌍의 IoU를 잰다. 목표 ≥ 95%.
- **다양성 검사**: 같은 계절 안 모든 쌍의 IoU. 이번이 74~91%였고 그래도 "비슷하다"고 읽혔다 — **80% 미만**을 목표로.
- **대조표**: 3계절 × 8을 한 장에. 알파 상자로 잘라 같은 높이로 세우면 실루엣 차이가 바로 보인다.
- 색 수·반투명·가로 연속 최빈은 `npm run art:normalize`가 이미 잰다.

## 함께 알아 둘 것 (이번 세션에서 바뀐 규칙)

- **변형 수는 `perScreen`에서 나온다**(PLAN-009). 자리에 "한 화면 동시 최대"를 적고 `recommendedVariants`가 권장 수를 낸다.
  계약 테스트가 `variants ≥ 권장`을 강제한다. 소나무는 한 화면 16그루 → 8변형.
- **브리프에 "변형 N개"를 쓰지 않는다.** 개수는 표가 말한다 — 산문에 박으면 변형 수를 올릴 때마다 낡는다(실제로 16곳이 낡아 있었다).
  계약 테스트가 막는다.
- **자리 비가 못 그리는 실루엣을 요구하지 않는다.** 바위 브리프가 1.3:1 자리에 "세로로 선 돌"을 요구했다 —
  가이드의 ±25% 규칙상 불가능했다. 소나무도 0.55:1이라 **폭으로는 못 가른다**: 단 수·꼭대기·기울기로 가른다.
  점검 도구는 `.scratch-pw/ratio-scan.mjs`(스크래치).
- **아트 보드가 목록/상세로 갈렸다**(PLAN-010). 목록은 "무엇이 남았나"만, 자리 상세(`/studio/ambient-art/<자리>`)가
  변형·규격·프롬프트를 맡는다.

## 1차 남은 파일

**148장 · 자리 30개**(소나무 21 포함). 우선순위는 반복 × 개체 크기:
소나무(16×, 92×168) → 참나무 20장(12×, 120×150) → 낮은 구름 8장(하늘이 화면의 26%) → 잔 소품(풀·클로버·자갈·데이지).
