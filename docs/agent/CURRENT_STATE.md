# Current State — VIC Schedule Studio

> **에이전트에게**: 이 파일이 "지금 이 프로젝트의 현재 시제"다. 과거 일기장이 아니다.
> 작업 시작 전에 여기부터 읽고, 의미 있는 작업(기능·구조·마이그레이션)이 끝나면 **여기를 갱신**한다.
> 완료된 역사는 여기 쌓지 말고 git log와 `docs/decisions/`(ADR)로 보낸다.
> 세션 시작 시 이 파일은 SessionStart 훅이 자동으로 읽어 넣는다(`.claude/settings.json`).

Last Updated: 2026-07-18
Project Version: 0.1.0
Harness: `agent-harness.yaml` (protocol `project-initializing_260710.md`, 최소 도입안)

---

## Current Objective

시청자 포스터의 **몰입·재미·편의 개선**(스냅샷 + 멀티에이전트 평가/리서치 기반)이 방금 끝났고,
지금은 **편집실 UX 다듬기**와 **시청자 참여 기능**으로 넘어가는 중.

## Current Status

- **운영 중(안정)**: 공개 포스터(`/`), 편집실(달력/태그/멤버/비공개 레이어), 꾸미기·PNG export,
  하트(비로그인 포함), 관리자 인사이트, 태그 2계층, 비공개 본문 암호화, 방송시간 기록.
- **2026-07-12에 끝난 것**(커밋 `9324779`…`c509657`):
  - 미니게임 opt-in화 + 시즌 테마 강제 해제 + 태블릿(641~1040px) 아젠다 전환 → [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md)
  - 포스터 마스트헤드/시각 위계/대비(WCAG AA) · 모션 토큰(`--ease-enter/exit`, `--dur-4/5`) ·
    빈 날 접기 · 셀 호버 · 하트 승급 토스트
  - **시청자 '이 달 기록'(공개 인사이트)** — 관리자와 같은 차트 재사용, 집계 RPC로만 개방 →
    [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) (마이그레이션 0049·0050 적용 완료)
  - 편집기: 공개 범위·옵션 접기(기본 접힘), 단축키 안내 축약, **새 일정 = Alt+N 하나로 통일**,
    카드 순서 드래그 삽입선 판정(카드 중심선 기준)
- **2026-07-17에 끝난 것**: '이 달 기록'·인사이트 잘림 3종 —
  (1) 하이라이트 카드 스타일이 `studio-shell.css`(= (studio) 레이아웃 전용)에만 있어 **비로그인
  시청자에겐 통째로 안 붙던 버그**를 발견해 `insights-charts.css`로 이동(차트가 이미 같은 이유로
  분리돼 있던 것과 동일 조치). (2) 긴 제목 = 가로 스크롤 대신 …+호버/탭 툴팁(`.hl-sub`도 검사),
  문장형 sub는 아랫줄 전체 폭. (3) 일별 방송시간 툴팁을 툴팁 실측 폭으로 clamp(고정 32px이라
  1일·말일에서 패널 `overflow-x:hidden`에 잘렸다). 포스터 상단 '내 관심'/'이 달 기록' 간격 추가.
- **2026-07-17(2)**: 꾸미기 — 업로드한 커스텀 이모지를 눌러도 달력에 안 올라가던 버그.
  칩 래퍼 div에 `setPointerCapture`를 걸면 뒤따르는 click이 **캡처 요소로 리타겟**돼 안쪽
  `<button>`의 onClick이 아예 오지 않는다(브라우저 실측). 캡처는 관리 권한자에게만 걸려
  관리자에게서만 재현됐고, 같은 이유로 칩의 × 삭제도 죽어 있었다. → 캡처 경로에선 pointerup에서
  직접 추가하고, ×는 캡처를 걸지 않는다. **교훈: 포인터 캡처 + 안쪽 버튼 onClick 조합 금지.**
- **2026-07-17(3)**: 꾸미기에서 놓은 스티커가 시청자 화면에서 칸 대비 위로 떠 보이던 문제.
  표면 **안**에 모드로 갈리는 것이 있으면 안 된다(ADR-0004). 범인은 **🔥 관심 등급 배지**
  (`tier`가 `interactive &&`로 게이팅 → 꾸미기엔 없음): 이 배지가 카드 흐름에 있어 1행 +7px,
  2행 +19px → 표면 26px 김 → 칸은 26px 내려가고 스티커는 비율이라 14px만 내려가 ≈12px 어긋남.
  같이 고친 것: 메모 칸(내용 없으면 시청자만 컬럼째 접혀 가로로 밀 수 있던 잠복 버그) → 항상
  자리 유지 + 라벨만 숨김 · 범례 태그(꾸미기만 `<span>`이라 3.8px 차) → 마크업 통일 + disabled ·
  ♥ 인기도 안내 박스도 모드 무관 렌더. 실측: 표면 높이·달력 42칸·범례 Δ **전부 0**.
  → 남은 리스크(2026-07-17 **감수하기로 결정**): 하트가 5개(`HEART_MIN`) 문턱을 넘으면 그 카드에
  배지가 생기며 칸이 7~19px 커진다 → 월초에 놓은 스티커가 하트가 쌓이며 조금씩 밀린다.
  단 그 순간에도 꾸미기·시청자·PNG는 서로 일치한다(등급 상승 🔥→🔥🔥→👑은 줄이 이미 있어 높이 불변
  — 문제는 0↔5 문턱 하나뿐). 배지를 absolute로 빼는 안은 **기각**: 표면이 26px 줄어 기존 스티커를
  전부 한 번 재조정해야 하고, 카드 네 귀퉁이가 이미 ♡(우상)·형식색 점(우하)·제목(좌상)·소제목(좌하)로
  차 있어 어디에 놔도 겹친다. '메타 줄 항상 예약' 안도 기각(35개 중 26개 카드가 그 줄이 없어 포스터가
  100px 넘게 길어진다). 다시 꺼내려면 이 비용부터 반박할 것.
- **2026-07-17(4)**: 작은 스티커의 크기·회전 핸들이 스티커를 삼키던 문제. 디자인 툴 밴치마킹
  (Sketch=선택박스 부풀리기 / Figma=핸들 숨김 / PS·AI=겹쳐 쌓기, 공통점은 **핸들을 객체 크기에
  비례시키는 툴이 없다**) 후 **Sketch식 최소 선택박스**를 채택: 스티커가 작으면 링을 화면 기준
  72px까지 부풀려 핸들을 스티커 밖으로 밀어내고, 링 안쪽 전체가 이동 손잡이가 된다.
  회전은 알약 버튼을 없애고 링 바깥 22px 띠(Photoshop식 핫존, 호버 시 점선+⟳ 힌트)로.
  핸들은 `--poster-scale` 역보정으로 **어느 배율에서도 화면 28px**(히트영역 44px).
  → 참고: 이 값들은 `.sticker-item`의 `--h-size/--h-hit/--ring-min/--rot-band/--ring-out`.
- **2026-07-17(5) — 개선안 배치 1~3 적용**(`1d50628`, `ba59cb3`, `3c30810`, `20f3682`):
  하트 2단계 햅틱 + 실패 토스트(액션이 **throw**하면 롤백조차 안 되던 구멍을 실물 테스트로 발견) ·
  월이동/관심토글/필터해제/시트X 촉감 통일 · 브로드 게이팅 3곳 제거(TagPicker·태그삭제·취소) +
  tags/palette prop에 in-flight 가드 · 미들웨어 matcher에서 비콘·공개 API 제외 · 월드컵 장난감
  dynamic 전환(`/` 177→152 kB, 꾸미기 181→151 kB).
  → **곁가지로 프로덕션 500 발견·수정**: `/api/public/vic/events`가 Server-Timing 헤더의 한글
  desc 때문에 매 요청 500이었다(헤더는 ByteString만). 공개 API 계약인데 e2e가 NOT RUN이라
  흘러갔다. `ServerTiming.header()`에서 방어 + 유닛 테스트 4개 추가(vitest 140).
  **교훈: e2e(`npm run test:e2e`)를 계속 안 돌리면 공개 계약이 조용히 깨진다.**
- **2026-07-17(6) — 개선안 배치 4~6**(`d276c91`, `c17955a`, `a52b1dd`, `3a5eac4`):
  필터 흐림에 업 도움 끈 포함 + 스르륵 전환 · 리사이즈 rAF 스로틀(폭 안 바뀌면 갱신 0회) ·
  `getEventsForDate` 정리(**단 감사의 "O(N²) 최우선"은 실측 결과 오판 — filter가 sort보다 먼저라
  병목 아님. 250건에서 0.22→0.20ms**) · 폰/태블릿 '이 달 기록' 진입점(ISSUE-002 해소) + 바텀시트 ·
  하트 탭타깃 44px(의사요소 — 표면 지오메트리 불변 확인).
  → 새 안전망: `tests/unit/events-for-date.test.ts` 10개(달력 정렬 규칙 고정). vitest 150.
  → **함정 2개 기록**: ① 미디어쿼리는 우선순위를 안 올린다(모바일 블록은 기본 규칙 뒤에 둘 것)
  ② **PowerShell 5.1 `Set-Content`로 한글 문서를 쓰면 깨진다**(시스템 코드페이지) — 문서 수정은
  Edit 도구로만.
- **2026-07-17(7) — 개선안 배치 7~10 + 신고 대응**(`69b619f`, `492de15`, `a07caf1`, `dc69957`,
  `29f5d6f`, `503d628`): 인사이트 로딩 점프 46→4px·정직한 실패 · 폰 뒤로가기로 시트만 닫히게 ·
  버튼 셋(켜기/이 달 기록/편집실) 옷 통일 + 미니게임 칩 32px · 하이라이트 네 장 골격 통일 ·
  Esc 해제/단축키 안내 · **드래그 이동 Ctrl+Z** · 서버 왕복(admin 싱글턴·캐시헤더·page 병렬·
  GoTrue N+1·0051 RPC+폴백) · **죽은 코드 1,483줄 제거**.
  → 겹친 오버레이 뒤로가기: 편집실과 그 안의 포스터가 **각각** popstate를 들어 한 번에 둘 다
  닫혔다. "안쪽이 표식 남기고 바깥이 건너뛴다"는 **실패**(바깥이 먼저 불려 안쪽을 언마운트시킨다).
  → `lib/ui/overlay-pop.ts` 카운터 방식으로 해결. 새 오버레이를 겹칠 땐 이걸 쓸 것.
    (**2026-07-18 정정**: 이 카운터도 '순서 무관'이 아니었다 — 아래 (8) 참고.)
- **2026-07-18 — 신고 2건**(`f5c058d`, `3272736`):
  ① '이 달 기록' X/바깥클릭이 미리보기까지 닫아 편집실로 튕김. 원인: overlay-pop 카운터를
     안쪽 메아리 핸들러가 **동기적으로** 내렸는데, 미리보기 안 포스터는 새로 마운트된 자식이라
     그 popstate 리스너가 바깥(StudioShell)보다 **먼저** 불릴 수 있다 → 바깥이 볼 땐 이미
     innerDepth=0 → '내 pop'이라 오인해 viewerMode를 닫았다. (7)의 '순서 무관' 가정이 틀림.
     → 메아리의 `popInnerOverlay()`를 `queueMicrotask`로 미뤄 그 디스패치가 끝난 뒤 내린다 →
     리스너 순서와 무관하게 바깥은 이번 pop을 안쪽 것으로 본다. **교훈: 겹친 popstate에서
     공유 카운터는 그 디스패치 안에서 내리지 말 것(microtask로 미룰 것).**
  ② 자동 '기타' 태그가 `display_name==="기타"` 리터럴에 묶여, 운영자가 그 태그를 지우자
     아무 태그도 안 붙었다. **불변식("이벤트당 콘텐츠 ≥1")을 버렸다**: 태그 0개 = 색 없는
     흰 카드 허용(서버·클라 강제 부착 제거), '기타'는 인사이트에서만 합성 버킷(태그 0개 공개
     일정, 휴뱅 제외)으로 카운트. **교훈: UI/DB 불변식을 특정 태그 '이름'에 묶지 말 것.**
- **부분 완료**: 축구/월드컵 시뮬 — taxonomy·기초 적립 완료(68 테스트). 물리·인지 제약 정밀화 남음.
  월드컵 자동 테마는 `KOREA_MATCHES` 수동 입력 대기.
- **2026-07-18 — 태그 색 커스텀화 프로젝트 시작**(계획 `docs/tags/custom-tag-color-plan.md` v4.1,
  코덱스 4라운드 적대검수 반영·디스코프). 방향: 무늬 유지(색맹 단서)+가독성만 고침+커스텀 bg_hex+
  단일 resolver. **Phase 0-pre 첫 슬라이스 완료**(`b36b01c`): 공개 sample/type 분리 —
  `sample-public-data.ts` 신설, 공개 트리(public-loader·proposals route)가 privateMeta·requests
  품은 sampleStudioSchedule을 import하던 공개경계 잠복 위반 제거 + `public-boundary.test.ts`(정적
  import 가드 + 폴백 누출검사). 공개 API 출력 불변.
  **Phase 0-pre 비주얼 스위트도 완료**(`76f5186`): dangling이던 `test:visual`을 실제 스위트로 —
  `app/visual-fixture/poster`(VISUAL_TEST_FIXTURE=1 전용 route, 플래그 없으면 not-found·포스터
  미노출) + `playwright.visual.config.ts`(production build, viewport/DPR 고정, 애니 정지) +
  baseline(viewer-surface, `[data-export-surface]`만, OS별=현재 win32). **함정**: 언더스코어 폴더
  (`app/__x`)는 Next private라 라우팅 제외 → route 폴더명에 언더스코어 금지.
  **Phase 0A 진행 중**: 특성화 테스트(`tag-visual-contract.test.ts`, 17개)로 현재 색/잉크 동작을
  못박고(`edbee1d`), 단일 resolver `lib/tags/tag-visual.ts`(`createTagVisualResolver`) 신설
  (`2263540`) — visualOf(rootTagId·kind·colorKey·bg·border·legacyTextColor·patternKey·missing),
  이벤트 분배는 month.ts에 위임(정의상 동일). **시청자 포스터 카드 색을 resolver로 이관**(`217cbce`),
  비주얼 하네스로 구코드 vs 이관 = **픽셀 동일 증명**. **비주얼 하네스 flaky였다**(교훈): render
  타이밍 변화가 전역 diff 유발 — 원인 ①월드컵 공 JS rAF(CSS animations:disabled로 안 멈춤)
  ②`--poster-scale`가 폰트 로드 타이밍에 좌우. → 스펙에 reduce-motion 토글(localStorage
  `vic.reduceMotion=on`)로 rAF 정지 + 폰트 후 resize 재측정 + 표면 높이 안정 대기로 굳힘.
  **다음**: 나머지 표면 이관(studio-shell 카드·insights 4맵·칩·범례). ⚠ Phase 1 전 필수:
  pattern_key CSS 재작업(`data-pattern` + {shape,ink,alpha}), 무늬 CVD 자동배정.
- **미착수**: 시청자 출석 도장(체크인) — 계획서만 있음(`docs/insights/viewer-checkin-attendance-plan.md`).

## Active Work

태그 색 커스텀화 — Phase 0A **category-색 경로 이관 완료**. resolver(`createTagVisualResolver`)로
통일: 시청자 카드·스튜디오 카드·시청자 필터범례 2곳·스튜디오 범례(TagLegendEditor)·태그 피커 칩.
뷰어 표면은 비주얼 카메라로 픽셀 동일 증명. **의도적 미이관**: ①읽기전용 상세 칩(studio-shell
2736·3712) = `tag.colorKey` 직접(세부 태그면 자기 색) → 카테고리 vs raw는 Phase 1 제품 결정
②insights(4맵) = 이미 DB에서 카테고리 롤업이 맞음, bg_hex는 Phase 1에서. **다음**: 0B(가독성
scrim, 눈에 보이는 첫 변화) 또는 Phase 1(bg_hex 컬럼). ⚠ Phase 1 전 필수: pattern_key CSS
재작업(`data-pattern`+{shape,ink,alpha}), 무늬 CVD 자동배정.

## 배포가 안 될 때 (2026-07-17 실제로 겪음 — 다음 에이전트가 같은 길로 헤매지 말 것)

**증상**: `git push`는 성공하는데 Vercel Deployments에 **새 항목이 아예 안 생긴다**(실패도 아니고 무반응).
프로덕션은 옛 빌드를 계속 서빙한다.

**원인은 대개 우리 코드/설정이 아니다.** 2026-07-17엔 **GitHub 장애**였다 — Vercel 대시보드가
"GitHub Outage — affecting automatic deployments and account connection" 배너를 직접 띄웠다.
곁가지 증상: 대시보드의 GitHub 관련 칸이 회색 스켈레톤으로 멈춤(=계정 연결 API 실패), 배포가
붙어도 8분+ 지연.

**진단 순서**(위에서부터, 각 단계가 서로 다른 원인을 배제한다)
1. `git ls-remote origin refs/heads/main` — 원격에 커밋이 실제로 갔는지. (갔으면 우리 잘못 아님)
2. **배포된 사이트를 직접 읽어** 어느 커밋까지 반영됐는지 확인(추측 금지). 예:
   `https://vic-schedule-studio.vercel.app/` HTML에서 `/_next/static/css/*` 를 받아 특정 클래스
   존재 여부로 판독. (2026-07-17엔 삭제한 `.home-grid`가 남아 있는지로 판정했다.)
3. Vercel → Deployments: **새 항목이 없다** = 이벤트 미수신(장애·연결). `Error` = 빌드 실패(로그 보기).
   `Canceled` = Ignored Build Step. `Queued/Building` = 그냥 밀린 것(기다린다).
4. Vercel 대시보드 상단 **배너**(장애 공지) · `status.vercel.com` · `githubstatus.com`.
5. GitHub 쪽: 저장소 Settings → **Webhooks는 비어 있는 게 정상**이다(Vercel은 GitHub App을 쓴다.
   여기서 헤맸다). 볼 곳은 Settings → **GitHub Apps** → Vercel → Repository access.

**장애/연결 문제일 때 우회 배포(=GitHub를 안 거치고 로컬 코드를 Vercel이 빌드)**
```bash
npx vercel link --yes --project vic-schedule-studio --scope bluesky-s-project3   # 최초 1회(.vercel 생성)
npx vercel --prod --yes                                                          # 즉시 프로덕션 배포
npx vercel ls vic-schedule-studio --scope bluesky-s-project3                     # 배포 목록 확인
```
- CLI는 이미 `bluesky8bya`로 로그인돼 있다. `.vercel/`은 `.gitignore`에 있다.
- **주의**: `vercel link`가 `.env.local`을 프로젝트 환경변수로 **덮어쓴다**(그리고 .gitignore에 추가).
  로컬에만 있던 값이 있었다면 확인할 것.
- Git 연결이 실제로 풀렸다면 `npx vercel git connect` (대화형 확인 필요 — 에이전트는 못 누른다.
  사용자에게 터미널에서 직접 실행 요청할 것. 성공 시 `> Connected` 출력).

**교훈**: "push했으니 배포됐겠지"로 보고하지 말 것. **배포된 사이트를 읽어서** 확인하고 말하라.

## Known Issues

- **ISSUE-001 — 편집실 실물 검증이 막혀 있음.** 편집실(`/studio/*`)은 Google 로그인이 필요해
  로컬 Playwright로 실물 확인을 못 한다. 최근 편집실 변경(공개범위 접기, 단축키, Alt+N, 드래그
  삽입선)은 타입·빌드·코드 리뷰까지만 검증됐다. Status: Open.
  → 다음에 편집실을 만질 땐 사용자에게 실물 확인을 요청하거나, 테스트용 로그인 경로를 마련할 것.
- **ISSUE-002 — 모바일에는 '이 달 기록' 진입점이 없다.** 버튼(`.insights-open`)이
  `.public-calendar-header`에만 있는데 모바일(≤640px)은 아젠다 레이아웃이라 이 헤더를 안 그린다
  → 모바일 시청자는 공개 인사이트를 열 수 없다. Status: Open(미요청, 별도 판단 필요).

## Locked / Stable Areas — 명시적 이유 없이 건드리지 말 것

| 영역 | 왜 잠겨 있나 | 근거 |
|---|---|---|
| `lib/schedules/public-loader.ts` + `app/api/public/*` | 공개 경계. 비공개 필드가 새면 제품의 핵심 약속이 깨진다 | [ADR-0001](decisions/ADR-0001-public-private-server-boundary.md) |
| 공개 인사이트에 들어가는 값 | 방문/체류(운영 지표)는 공개 금지. 방송·하트는 **집계만** | [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) |
| 포스터 표면 지오메트리(폭 1840 고정, JS 스케일) | 뷰포트 미디어쿼리로 표면 내부를 재배치하면 스티커 좌표가 어긋난다 | [ADR-0004](decisions/ADR-0004-poster-surface-geometry.md) |
| 시즌 연출(미니게임·테마) | 기본 꺼짐·클릭 통과·오너 테마 우선 | [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md) |
| `PRIVATE_DATA_ENC_KEY` / 암호화 배포 순서 | 키 분실 = 비공개 본문 복구 불가 | [ADR-0002](decisions/ADR-0002-private-content-encryption.md) |
| 오너 바인딩(`OWNER_EMAIL` + `calendars.owner_id`) | 한쪽만 바꾸면 RLS로 저장이 조용히 실패 | [ADR-0003](decisions/ADR-0003-owner-dual-binding.md) |
| 스튜디오 월 라우트 | 북마크/콜드 진입 전용. 런타임 라우트 월 이동 금지 | [ADR-0005](decisions/ADR-0005-month-routes-cold-entry-only.md) |

## Open Decisions

- 하트 인기 배지를 절대 임계값 → **상대 순위**로 전환하기로 합의만 됨(미구현).
- 공개 인사이트에 방문자 지표를 넣을지(현재는 의도적으로 제외 — ADR-0008).
- 꾸미기 심화 중 보류: 칸별 데코 / 스티커 그룹 / 스티커 팩.

## Next Exact Steps

0. **마이그레이션 0051 적용** — `node scripts/apply-db.mjs db/migrations/0051_visit_known_accounts.sql`
   (새/재방문 판정용 DISTINCT RPC + `(day, account_hash)` 인덱스. 미적용이어도 코드가 옛 경로로
   폴백하므로 급하진 않지만, 적용해야 인사이트 열 때의 순차 왕복 40회+가 사라진다.)
1. **개선안 백로그 배치 1~10 전부 완료**(`docs/plans/refinement-backlog-2026-07.md`).
   보류 항목과 "이 감사에서 배운 것"은 그 문서 머리에 정리돼 있다.

1. 시청자 출석 도장: `docs/insights/viewer-checkin-attendance-plan.md`의 A안(오늘만, 서버 KST 강제).
   `event_hearts` 패턴 복제(비로그인 기기 토큰 포함), 마이그레이션 + `*_grants.sql` 잊지 말 것.
2. 멀티에이전트 리뷰가 제안한 Phase 3 잔여(사용자 승인 시): 시청자 저장/공유 버튼 + OG 메타 +
   월별 고정 PNG URL, LIVE/카운트다운 pill, 꾸미기 스탬프 모드, 휴방 상태를 1급 셀 상태로.
3. 축구 시뮬: GK 손→패스/개인기 규칙·물리·인지 제약 정밀화(`docs/sim/`).

## Last Verified (2026-07-17, 배치 1~10 이후 · 프로덕션 실측)

| 확인 | 결과 |
|---|---|
| 프로덕션이 최신인가(사이트 직접 판독) | **예** — 삭제한 `.home-grid`가 배포 CSS에서 사라짐 = `503d628`까지 반영 |
| `/api/public/vic/events` | **200** (한글 Server-Timing 헤더로 매 요청 500이던 것 수정됨) |
| 배포 경로 | GitHub 장애로 자동배포가 멈춰 **`npx vercel --prod`로 직접 배포**함(위 "배포가 안 될 때" 참고) |
| GitHub 자동배포 | 장애 회복 중(8분+ 지연 관측). 복구되면 push→배포가 저절로 정상화된다 |

## Last Verified (2026-07-17, 배치 1~3 이후)

| command | result |
|---|---|
| `npm run typecheck` / `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — **140** tests (server-timing 4 신규) |
| `npm run test:e2e` | **여전히 NOT RUN** — 이것 때문에 공개 API 500을 오래 못 봤다. 다음에 꼭 돌릴 것 |
| 공개 API 실물 | `/api/public/vic/events` 200(240건) · `/api/soop-live` 200 · `/api/presence` start 200 |
| 하트 실물(Playwright, vibrate 후킹) | 정상 [12,12] 두 톡(37~43ms 간격) · 실패 [12,20-60-20] + 토스트 후 2.6초 자동 해제 |
| 번들(로컬 prod 빌드) | `/` 152 kB · 꾸미기 151 kB · 편집실 221 kB. 초기 스크립트 16개에 월드컵·축구 코드 없음 |
| 7월(월드컵 달) 연출 실물 | 미니게임 버튼·중력 공·결승 표기 497ms에 정상 등장 |

## Last Verified (2026-07-17, 이전)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4 — `--max-warnings=0`이라 exit 1) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| 공개 '이 달 기록' 실물(Playwright, prod build, 비로그인) | PASS — 하이라이트 카드 스타일 적용, `pi-body` 가로 넘침 0(560=560), 긴 제목 …+툴팁(그리드 폭 안), 일별 툴팁 안 잘림 |
| 편집실 인사이트 '트렌드' 탭 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001; 같은 컴포넌트를 공개 시트에서 검증) |
| 꾸미기 팔레트(DecoratePalette) 실물 | PASS — 로그인 벽 우회용 임시 라우트에 실제 컴포넌트를 올려 Playwright로: 수정 전 "칩 클릭→아무 일 없음"·"× 안 됨" 재현, 수정 후 클릭/터치탭 추가·× 삭제·드래그 순서·탭 분류이동 전부 OK, 중복 추가 없음. 임시 라우트는 삭제함 |

## Last Verified (2026-07-12)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| `npm run test:e2e` / `test:visual` | NOT RUN |
| 마이그레이션 0048·0049·0050 | 적용 완료(Supabase) |
| 공개 포스터 실물(Playwright, prod build) | PASS — 미니게임 opt-in, 태블릿 아젠다, 인사이트 시트 |
| 편집실 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001) |

---

## 이 저장소의 하네스 범위

`project-initializing_260710.md`의 **최소 도입안**만 채택했다.
채택: 이 파일 · ADR(`docs/decisions/`) · 매니페스트(`agent-harness.yaml`) · provenance ·
**자동화 훅**(`.claude/settings.json`: SessionStart 브리핑 + Stop 시 상태 갱신 확인).
미채택: `docs/agent/` 별도 트리, 상시 ExecPlan/Handoff, `CHANGELOG_AGENT.md`, 코드 내 `[WH-CHANGE]`
주석 규격 — 각각 기존 `docs/` 트리, `docs/plans/`, 한국어 git log, 이미 짙은 "왜" 주석과 중복이다.
