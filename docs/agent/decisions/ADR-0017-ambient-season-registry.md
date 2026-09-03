# ADR-0017 — 앰비언트 배경 레지스트리: 물결은 상수, 계절은 강세

Status: Accepted (같은 날 개정 — 아래 "개정 2026-09-04" 참조)
- Date: 2026-09-04

> **개정 2026-09-04(사용자 재정의, 결정 2·3 대체)**: ① 계절은 오늘 날짜가 아니라 **보고 있는 달력의 달**이 정한다
> — 12~2월 겨울 · 3~5월 봄 · 6~8월 여름 · 9~11월 가을(달을 넘기면 즉시 바뀐다). ② **물결은 여름의 전유물** — 봄·
> 가을·겨울은 물 없이 그 계절의 소품만(가을 = 낙엽, 겨울 = 눈, 봄 = 초목). ③ ~~계절 배경 스위치 OFF = 계절 소품
> 없이 사철 물결~~(개정 2로 대체). 특정일(3단계)은 실제 날짜(KST)로 판정한다. 아래 본문의 "절기·물결 상수"
> 문장은 이 개정으로 대체됐다.
>
> **개정 2, 2026-09-04(같은 날, 사용자)**: ① **계절 배경 스위치 OFF = 전부 내려간다** — 물결은 여름의 것이라 OFF에서
> 사철 물결로 남지 않는다(`html[data-ambient="off"]`가 `.gs-tide`·`.gs-season` 둘 다 숨긴다). ② 봄·가을·겨울은 CSS
> 소품이 아니라 **상호작용 캔버스 장면**(`season-canvas.tsx` + `scene-engine.ts` + `scenes/*`), 전부 여름 물결과 같은
> **위에서 내려다보는 시점**: 겨울 = 소복한 눈밭·걸어간 발자국·내려앉는 눈·바탕 클릭 → 발자국+눈가루, 가을 = 낙엽
> 물리(원 충돌·바닥 마찰·돌풍·포인터 바람·집어 끌기), 봄 = 풀밭·클로버·데이지·나비(그림자·포인터 회피·클릭 → 꽃잎
> 폭발). 애플 결·귀엽게, 오행 보정 색 그대로. 스프라이트·바탕은 한 번 굽고 매 프레임 drawImage만, 장면 코드는 동적
> import, 탭 숨김·스위치 OFF면 루프 정지, 자체 조절기(늦은 프레임 20%↑ → 입자 단계 ↓). ③ gfx 판정 v3(lib/ui/gfx.ts):
> full/lite/soft — lite는 **보이게 유지**(물결 1겹·입자 절반), soft(소프트웨어 렌더·코어 ≤2)만 배경 OFF+눈 편한 팔레트,
> 설정 "배경 효과"(자동/항상 최대/가볍게/**끄기** — 끄기는 배경만, 필터 유지)가 판정을 덮어쓴다. ④ 설정 세대 2026-09-04:
> 스위치 4종 기본 ON 재시딩. ⑤ 같은 날 2차: 여름도 캔버스 한 장(마우스 잔물결) — 사계절 전부 마우스에 반응(회피·바람·
> 눈가루·잔물결), 낙엽 수종 7, 나비·발자국 리디자인(착지·걷는 사람), 캔버스는 zoom 보정(offsetWidth·포인터÷zoom).
- 관련: ADR-0016(금생수 — 물결 레이어), `components/shared/ambient/*`, `app/ambient.css`, `lib/ui/motion.ts`
  (`vic.ambient`), `docs/ux/seasonal-ambient-plan.md`(설계안), CLAUDE.md "Owner-fit palette rule"
- Supersedes(예정, 4단계): 포스터 테마 7종(`calendars.poster_theme` = sakura/summer/autumn/winter/sunset/mint/dot/
  starry/confetti/mist, `.poster-page[data-poster-theme]`). 이 ADR 시점엔 **공존**(옛 셀렉트 그대로) — 철거는 별도
  커밋 + 이 ADR 개정.

## 맥락

관리자(사용자) 아이디어 2026-09-04: "지금 물결 배경처럼 봄·여름·가을·겨울 배경(물결 = 여름) + 별도 ON/OFF, 특정일
(성탄·할로윈·24절기) 배경도, 이걸 따로 관리하는 루트. 디자인은 사주 원리 — 여름은 火가 많으니 물을 강조한 것처럼
토리님에게 필요한 기운 쪽으로(겨울은 축축함, 봄은 햇빛(火)보다 초목(木))."

이미 배경 시스템이 둘 있었다: (a) 물결 레이어(.gs-tide, ADR-0016)는 CSS 게이트로 켜지는 단일 컴포넌트, (b) 포스터
테마 7종은 시청자 전용·정적 그라데이션·DB 저장. 2026-09-03에 (b)의 라이브 값 'autumn'이 (a)를 통째로 덮어 "시청자
화면이 안 바뀐다"의 원인이 됐다 — 같은 배경을 두고 두 시스템이 싸운다. 계절 4 + 특정일 N을 (a) 방식으로 흩뿌리면
게이트·성능·검증이 N배로 갈라진다.

## 결정

1. **레지스트리 하나**(`components/shared/ambient/registry.ts`)가 "오늘(KST) → 배경"을 정한다. 편집실·시청자 화면
   모두 `<AmbientLayer />` 하나만 마운트한다(옛 `<WaterTide />` 직접 마운트 대체).
2. **물결은 상수, 계절은 강세.** 소유자 용신이 수(水)라 얕은 물결은 사철 깔린다. 계절 레이어는 그 위의 소품:
   봄 = 물가의 초목 그림자(木)·이슬, 여름 = 물결 그대로(레이어 없음), 가을 = 물 위에 뜬 낙엽(채도 낮춘 갈색·와인 —
   붉·주황·노랑 금지) + 은빛 서리 안개(金), 겨울 = 물가에 내리는 눈(水의 결정 = 흰 金) + 서리 광택.
3. **계절 구분은 절기**(사주의 월 구분과 동일): 입춘 2/4 · 입하 5/5 · 입추 8/7 · 입동 11/7(고정, ±1일 무시).
   시간은 KST(Intl Asia/Seoul) — 서버(UTC)·클라이언트 동일.
4. **스위치 "계절 배경"**(`vic.ambient`, 기본 ON, 설정 톱니 목록) — OFF면 `html[data-ambient="off"]`로 계절 레이어만
   숨고 물결은 남는다. 물결 자체는 계속 '생동감 있는 동작'이 단독으로 쥔다. 시청자 화면엔 설정 UI가 없어 늘 ON.
5. **성능·품질 규칙은 물결과 동일**: 표시 게이트 = 생동감 ON ∧ `data-gfx≠lite` ∧ ≥641px; 무한 애니는 transform/
   opacity만, scale·blur·mix-blend·filter 애니 금지(잎 그림자는 SVG 오프셋 사본), 어두운 얼룩 금지, `html` background
   금지, 표면(`data-export-surface`) 밖(캡처·비주얼 기준선 무영향 — 비주얼 테스트는 동작 줄이기 ON이라 전부 숨김).
   회귀 게이트 = 헤드리스 드래그 스펙(studio-drag-indicator) + perf-frames 실측.
6. **특정일**은 `SPECIAL_DAYS`(레지스트리)에 추가, 계절보다 우선. 이 ADR 시점엔 비어 있다(3단계). 숨은 요소(트리·
   산타 등)는 표면 바깥 여백·`aria-hidden`·포인터 무시. 공개/비공개 경계·관리 UI와 무관.
7. fixture(`/visual-fixture/*?ambient=`)만 계절 강제 — 실제 화면은 강제 prop을 넘기지 않는다.

## 결과

- 새 파일: `components/shared/ambient/{registry.ts,ambient-layer.tsx,season-autumn.tsx,season-winter.tsx,
  season-spring.tsx}`, `app/ambient.css`. 물결(`water-tide.tsx`, `metal-water.css`)은 그대로.
  (개정 2에서 `season-*.tsx`는 `season-canvas.tsx` + `scene-engine.ts` + `scenes/{util,autumn,winter,spring}.ts`로 대체.)
- 되돌리기: `<AmbientLayer />`를 `<WaterTide />`로 바꾸고 ambient.css import 제거 — 물결만 남는다.

## 다음(이 ADR 범위 밖)

- 3단계 특정일(성탄 → 할로윈 → 24절기 표). 4단계 포스터 테마 셀렉트를 `auto/none`으로 축소 + 옛 7종 CSS 철거.
