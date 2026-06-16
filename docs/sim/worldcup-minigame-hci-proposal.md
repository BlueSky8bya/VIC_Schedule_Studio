# World Cup Web Mini-game HCI Proposal

작성일: 2026-06-11 KST  
범위: 웹 전용 시즌 이벤트 제안서  
대상 화면: 시청자 화면, 편집실 화면  
상태: 구현 전 기획안. 코드 변경 없음.

## 1. 결론 요약

월드컵 기간에는 기존 일정표 위에 `WorldCupPlayLayer`라는 얇은 클라이언트 전용 놀이 레이어를 얹는 방식이 가장 적합하다. 핵심은 "일정표를 방해하지 않는 공놀이"다. 사용자가 공을 톡 치거나 드래그해서 골대에 넣으면 큰 골 이펙트가 나오고, 평소에는 몇 개의 공이 화면 가장자리와 안전 영역 안에서 낮은 강도로 통통 튄다.

추천 MVP는 다음 순서다.

1. 시청자 화면: 공 2-4개, 작은 골대 1-2개, 정지/숨김 토글, reduced motion 대응.
2. 시청자 상호작용: 탭 킥, 드래그 플릭, 골 판정, 큰 `GOAL` 이펙트, 기존 confetti와 하트 레이어 재사용.
3. 편집실 화면: 작업 방해가 적은 상단/측면 미니 필드. 편집 중, 모달 중, 비공개 레이어 중에는 자동 정지.
4. 포스터/export: 기본은 export 대상 밖에 배치. 추후 "월드컵 스냅샷 포함" 옵션을 만들 때만 deterministic seed로 고정 프레임 출력.

이 제안은 세 가지 원칙을 가진다.

- 재미: 자율성, 유능감, 관계성을 충족시키되 일정표의 목적을 흐리지 않는다.
- 몰입: 명확한 목표, 입력에 대한 즉각 피드백, 적절한 난이도-기술 균형을 만든다.
- 안전: 공개/비공개 경계를 넘지 않고, owner-only 편집 모델을 건드리지 않으며, 자동 움직임은 정지/숨김 가능해야 한다.

## 2. 프로젝트 맥락

현재 프로젝트에는 월드컵 시즌 훅을 걸기 좋은 지점이 이미 있다.

- `lib/calendar/worldcup.ts`: `WORLD_CUP_START = "2026-06-11"`, `WORLD_CUP_END = "2026-07-19"` 기준이 있다.
- `components/poster/public-poster.tsx`: `isWorldCupMonth(view.year, view.month)`로 월드컵 테마를 자동 적용한다.
- `components/poster/public-poster.tsx`: 기존 confetti, heart floater, decorative layer가 있어 goal burst와 감정 피드백을 재사용하기 좋다.
- `lib/ui/motion.ts`: `vic.reduceMotion`, `vic.eyeComfort` 기반 motion preference가 있다.
- `lib/ui/haptics.ts`: `hapticTick`, `hapticSuccess`, `hapticWarn`, `hapticError`가 있다.
- `lib/permissions/roles.ts`: owner/developer 중심 편집 권한, manager/worker 장식 권한, private layer 읽기 권한이 분리되어 있다.
- public loader와 public DTO 테스트가 private field 노출 방지를 맡고 있다.

따라서 미니게임은 schedule data 모델 안에 넣지 말고, 공개 가능한 시즌 상태와 로컬 UI 상태만 쓰는 편이 안전하다. MVP에서 서버 저장은 하지 않는다. 점수, 첫 방문 여부, 효과 켜짐 여부는 localStorage로 충분하다.

## 3. 핵심 목표

시청자 화면 목표:

- 일정표를 보는 사람이 월드컵 시즌을 즉시 느낀다.
- 아무 설명 없이 공을 눌러보고 싶다.
- 한 번 골을 넣으면 "방금 내가 만들었다"는 손맛이 생긴다.
- 일정 확인, 태그 확인, 링크 클릭을 방해하지 않는다.

편집실 화면 목표:

- 운영자가 시즌감을 느끼지만 업무 속도는 떨어지지 않는다.
- 편집 중에는 포커스와 클릭을 가로채지 않는다.
- 비공개/경고 맥락에서는 장난스러운 효과를 멈춘다.
- 포스터/export 품질에 랜덤 애니메이션이 끼어들지 않는다.

## 4. 연구 기반: 재미의 3대 요소

여기서는 자기결정성이론과 PENS(Player Experience of Needs Satisfaction)를 기준으로 "게임의 재미 3대 요소"를 정한다. 게임에서 지속적인 재미를 만드는 기본 욕구는 자율성, 유능감, 관계성으로 보는 것이 가장 실용적이다.

| 요소 | 의미 | 월드컵 미니게임 적용 | 실패하면 생기는 문제 |
| --- | --- | --- | --- |
| 자율성 | 내가 원해서 조작한다는 느낌 | 효과 끄기, 공 직접 치기, 드래그 방향 선택, 자동 움직임 숨김 | 강제 광고처럼 느껴짐 |
| 유능감 | 점점 잘해지고 있다는 느낌 | 골 판정, 포스트 맞춤, 근접 실패, 연속 골, 예측 가능한 물리 | 랜덤 장식처럼 느껴짐 |
| 관계성 | 함께 보는 시즌 분위기 | 월드컵 기간 공통 연출, 일정 카드와 응원 분위기, 공유 가능한 순간 | 혼자만 보는 장난으로 끝남 |

중요한 점은 관계성을 "공개 랭킹"으로 바로 풀 필요가 없다는 것이다. 시청자 화면은 공개 경계가 중요하므로 MVP에서는 로컬 목표와 시각적 축하만으로 충분하다. 추후 커뮤니티 골 수를 넣더라도 일정/비공개 정보와 분리된 public-only 이벤트 집계로 설계해야 한다.

## 5. 연구 기반: 손맛의 3대 도메인

`Designing Game Feel. A Survey`는 game feel을 세 도메인으로 정리한다. 이 프레임은 이번 기능에 매우 직접적이다.

| 도메인 | 디자인 행위 | 미니게임에서의 해석 | 구체 설계 |
| --- | --- | --- | --- |
| Physicality | tuning | 공이 실제로 존재하는 것처럼 느껴지게 함 | 튕김, 마찰, 회전, 압축, 그림자 |
| Amplification | juicing | 중요한 사건을 크게 읽히게 함 | 골 순간 GOAL, confetti, 화면 glow, 진동 |
| Support | streamlining | 사용자의 의도를 시스템이 부드럽게 보조 | 골대 근처 aim assist, 약한 플릭 보정, 오입력 방지 |

이 세 가지는 순서도 중요하다. 먼저 공이 예측 가능해야 한다. 그다음 골이 시원해야 한다. 마지막으로 사용자가 "내가 잘해서 넣었다"고 느끼도록 보조는 숨겨야 한다.

## 6. 연구 기반: 몰입의 3대 조건

Flow와 GameFlow를 웹 미니게임에 맞게 압축하면 몰입의 3대 조건은 다음이다.

1. 명확한 목표: 공을 골대에 넣는다.
2. 적절한 난이도와 통제감: 너무 어렵지 않고, 조작이 내 의도대로 반응한다.
3. 즉각 피드백: 잡기, 차기, 충돌, 골, 실패가 100ms 안에 읽힌다.

GameFlow의 8요소도 체크리스트로 쓸 수 있다.

| GameFlow 요소 | 이번 기능 적용 |
| --- | --- |
| Concentration | 일정 확인을 방해하지 않는 작은 놀이. 집중을 뺏지 않음 |
| Challenge | 골대 각도, 벽 튕김, 연속 골로 작은 도전 제공 |
| Skills | 드래그 거리와 방향으로 실력 차이 발생 |
| Control | pointer capture, 입력 지연 최소화, 예측 가능한 속도 |
| Clear goals | 골대와 공이 즉시 보임 |
| Feedback | 충돌음 대신 시각적 ping, haptic tick, net bulge |
| Immersion | 월드컵 테마, 잔디 라인, 골 이펙트 |
| Social interaction | 시청자와 편집자가 같은 시즌감을 공유. public 집계는 후순위 |

## 7. MDA 분석

MDA는 Mechanics, Dynamics, Aesthetics로 게임 경험을 분해한다. 이번 기능의 핵심은 작은 mechanic이 일정표 위에서 어떤 dynamic을 만들고, 그 결과 어떤 감정을 주는지 보는 것이다.

| Mechanics | Dynamics | Aesthetics |
| --- | --- | --- |
| 공이 벽에 튕김 | 화면이 살아 있음 | 시즌감, 감각적 즐거움 |
| 탭하면 공이 근처 골대로 감 | 누구나 한 번에 성공 가능 | 쉬운 재미, 호기심 |
| 드래그 플릭 | 각도와 세기로 실력 표현 | 유능감, 도전 |
| 골 판정 | 큰 축하 연출 발생 | 성취, 축제 |
| 포스트 맞춤 | 아쉬운 실패가 보임 | 재도전 욕구 |
| reduced motion | 움직임 부담 줄임 | 편안함, 접근성 |
| 숨김/정지 | 사용자가 제어 | 자율성, 신뢰 |

## 8. Lazzaro 4 Keys to Fun 적용

이번 기능은 네 가지 재미 중 최소 세 가지를 만족해야 한다.

| 재미 유형 | 적용 | 구현 포인트 |
| --- | --- | --- |
| Easy Fun | 호기심과 발견 | 공을 만지면 예상보다 귀엽게 반응. 첫 골 때 특별 연출 |
| Hard Fun | 도전과 성취 | 벽 튕김 골, 연속 골, 포스트 맞춤 후 재도전 |
| People Fun | 함께 보는 느낌 | 월드컵 기간 모두 같은 분위기. 추후 public-only 전체 골 수 가능 |
| Serious Fun | 의미와 시즌성 | 실제 월드컵 기간, KST 일정, 한국 경기일 강조 |

MVP는 Easy Fun과 Hard Fun에 집중하고, People Fun은 안전한 범위에서 분위기 공유 정도로 둔다. Serious Fun은 월드컵 기간과 일정 데이터 연결만으로 충분하다.

## 9. 시청자 화면 상세 UX

### 9.1 기본 배치

- 공 수: 데스크톱 3개, 모바일 2개.
- 골대: 데스크톱 좌하단/우하단 중 1-2개, 모바일 하단 한쪽 1개.
- 공 크기: 모바일 28-36px, 데스크톱 34-48px.
- 골대 크기: 모바일 64-80px, 데스크톱 88-120px.
- 레이어 위치: 일정 카드 텍스트, 링크, 하트 버튼, 주요 CTA를 덮지 않는 safe area.
- z-index: 장식 배경보다는 위, 클릭 가능한 일정 UI보다는 아래. 조작 가능한 순간에만 특정 공이 pointer target.

### 9.2 첫 방문 경험

첫 방문에서는 큰 튜토리얼 문구를 띄우지 않는다. 대신 첫 공에 1.2초 동안 아주 짧은 pulse를 준다. 사용자가 공을 건드리면 첫 도움은 사라진다.

추천 상태:

- `vic.worldcupSeenIntro:YYYY-MM-DD = true`
- 하루 1회만 힌트 표시
- reduced motion이면 pulse 대신 작은 static highlight

### 9.3 탭 킥

공을 탭하면 가장 가까운 골대를 향해 짧게 찬다. 이 기능은 어린 사용자, 모바일 사용자, 빠르게 일정만 보는 사용자에게 중요하다.

동작:

1. pointer down: 공이 살짝 눌린다.
2. pointer up within 180ms and movement < 8px: 탭으로 판정.
3. 공 중심에서 가장 가까운 골대 중심으로 방향 계산.
4. 속도는 현재 거리 기준으로 360-720px/s 사이로 clamp.
5. 골대와 너무 가까우면 살짝 위로 뜨는 arc 느낌을 회전/scale로만 표현한다.

손맛 포인트:

- 탭 즉시 40-60ms 안에 공 scale 반응.
- 공이 출발할 때 그림자가 뒤늦게 따라오며 깊이감 생성.
- 탭이 너무 약해도 공이 최소 80px은 이동해서 "먹혔다"는 느낌 제공.

### 9.4 드래그 플릭

드래그는 skill 표현을 담당한다.

동작:

1. pointer down: `setPointerCapture`.
2. drag: 공은 포인터를 8-12px 늦게 따라간다.
3. drag 중: 골대 방향 aim line 표시. 120ms fade.
4. release: 마지막 80ms pointer 이동량으로 velocity 계산.
5. velocity clamp: 데스크톱 360-900px/s, 모바일 300-720px/s.
6. 회전량: x velocity 기반. 너무 빠른 회전은 720deg/s 이하.

보정:

- 골대 입구 12px 안쪽으로 향하면 미세 aim assist.
- 보정은 velocity 방향을 최대 6도까지만 수정.
- 사용자가 실패했다고 느낄 수 있어야 하므로 강제 골 유도는 금지.

### 9.5 골 판정

골 판정은 "내가 넣었다"는 느낌을 해치지 않도록 관대하지만, 완전 자동처럼 보이면 안 된다.

조건:

- 공 중심이 goal mouth rectangle을 통과한다.
- 공 velocity가 골대 안쪽 방향이다.
- 공이 골대 뒤쪽에서 역방향으로 들어온 경우는 골로 보지 않는다.
- 입구 주변 8-12px grace area 허용.
- 같은 공은 goal cooldown 1.2초.

판정 후:

- 0-80ms: net bulge, 공 scale squash.
- 80-220ms: `GOAL` 텍스트 pop.
- 120-700ms: confetti burst.
- 200-900ms: 일정표 가장자리 또는 월드컵 badge glow.
- 0-300ms: `hapticSuccess`.

### 9.6 실패 피드백

실패도 재미가 있어야 한다. 아무 반응 없는 실패는 재도전 욕구를 줄인다.

- 골대 기둥 충돌: post ping ring 1개, 짧은 wobble, `hapticTick`.
- 아슬아슬하게 빗나감: 공 뒤 trail 색이 200ms 바뀜.
- 너무 약한 슛: 공이 1번 더 굴러가며 멈춤. "입력이 무시됐다"는 느낌 방지.
- 화면 밖으로 나갈 뻔함: 벽이 살짝 elastic하게 반응.

### 9.7 연속 골과 보상

MVP에서는 서버 랭킹 없이 로컬 세션 보상만 둔다.

- 오늘 골 수: `vic.worldcupGoals:YYYY-MM-DD`.
- 1골: 기본 GOAL.
- 3골: 공 trail이 10초 동안 골드 포인트로 변경.
- 5골: 골대 net가 10초 동안 월드컵 테마 색으로 변경.
- 10골: 큰 이펙트 대신 조용한 badge. 반복 과자극 방지.

큰 GOAL 이펙트는 최소 10초 cooldown을 둔다. 그 사이 골은 작은 burst만 낸다.

## 10. 편집실 화면 상세 UX

편집실은 놀이보다 업무가 우선이다. 따라서 "상시 미니게임"이 아니라 "시즌감을 주는 조작 가능한 장식"으로 설계한다.

### 10.1 배치

추천 위치:

- 데스크톱: 상단 바 우측, 월/테마 컨트롤 근처의 160-220px 폭 미니 필드.
- 모바일 studio: 기본 숨김. 사용자가 seasonal 버튼을 열었을 때만 표시.
- poster preview 주변: preview 안쪽이 아니라 preview 외곽 safe rail.

금지 위치:

- 저장/게시/권한/비공개 관련 버튼 위.
- 일정 title input, date picker, memo editor 위.
- passcode 입력, private warning, unlock layer 위.
- export surface 내부 기본 배치.

### 10.2 작업 상태별 동작

| 상태 | 동작 |
| --- | --- |
| 기본 탐색 | 낮은 idle bounce 허용 |
| 일정 편집 중 | 자동 bounce 정지, pointer-events none |
| 모달 열림 | 숨김 또는 완전 정지 |
| 저장 중 | 저장 피드백과 충돌하지 않게 정지 |
| 저장 성공 | 옵션으로 작은 공 굴러가기 가능 |
| 비공개 레이어/unlock | 숨김. warning-heavy 맥락 유지 |
| export 중 | deterministic pause 또는 exclude |

### 10.3 편집실 전용 재미

편집실에서는 골 넣기보다 "작업 완료 피드백"과 연결하는 편이 낫다.

- 저장 성공: 작은 공이 미니 골대로 굴러가며 net만 흔들림.
- 월드컵 테마 선택: 공 하나가 짧게 점프.
- 공개 포스터 미리보기 열기: 공이 preview 바깥을 한 바퀴 도는 intro.

단, 이 효과들은 전부 reduced motion과 eye comfort를 존중해야 한다.

## 11. 접근성과 편의성

### 11.1 움직임 제어

WCAG 2.2.2 Pause, Stop, Hide 기준상 자동으로 시작하고 5초 이상 지속되며 다른 콘텐츠와 병렬로 보이는 움직임은 사용자가 멈추거나 숨길 수 있어야 한다. 이번 기능은 반드시 전역 토글을 둔다.

필수:

- "시즌 효과 숨김" 또는 아이콘 버튼.
- reduced motion이면 자동 bounce 비활성.
- `prefers-reduced-motion: reduce`와 프로젝트의 `vic.reduceMotion` 둘 다 존중.
- 이펙트는 3회/초 이상 번쩍이지 않게 설계.
- 자동 움직임은 tab hidden 상태에서 rAF 중지.

### 11.2 입력 편의성

- Pointer Events로 mouse/touch/pen을 통합한다.
- 공 target은 최소 36px. 모바일에서는 44px 권장.
- `setPointerCapture`로 드래그 중 스크롤/포인터 이탈 문제를 줄인다.
- 스크롤 영역에서는 첫 move 방향이 세로 스크롤이면 공 조작을 취소한다.
- 키보드 사용자에게는 별도 플레이 필수 기능을 요구하지 않는다. 이 기능은 장식/보너스여야 한다.

### 11.3 시각 피로

- idle 공 속도는 낮게 유지한다.
- 배경 잔디 라인은 opacity 0.04-0.08 수준.
- 큰 burst는 골 성공 시에만.
- confetti particle은 24-40개 이하.
- 화면 전체 흔들림은 금지. 필요한 경우 골대 주변만 흔든다.

### 11.4 소리 정책

웹에서는 기본 무음이 안전하다. 자동 재생 제한, 시청 환경, 접근성을 고려하면 소리는 MVP에서 제외한다. 추후 넣더라도 명시적 사용자 토글 후에만 켠다.

## 12. 물리와 모션 튜닝

추천 수치:

| 항목 | 값 |
| --- | --- |
| wall restitution | 0.82 |
| post restitution | 0.72 |
| friction per frame | 0.992 |
| min velocity after kick | 240px/s |
| max velocity desktop | 900px/s |
| max velocity mobile | 720px/s |
| idle velocity | 24-64px/s |
| ball squash on grab | scaleX 1.08, scaleY 0.88 |
| collision squash | 60-90ms |
| net bulge | 180-260ms |
| GOAL pop | 700-900ms |
| burst cooldown | 10s |

모션 원칙:

- 위치 이동은 `transform: translate3d(...)`.
- fade는 `opacity`.
- layout 속성인 `top/left/width/height`를 매 프레임 바꾸지 않는다.
- rAF loop는 active ball이 없고 idle disabled이면 멈춘다.
- `ResizeObserver`로 container size가 바뀔 때만 boundary 재계산.

## 13. 구현 아키텍처 제안

### 13.1 컴포넌트

```ts
type WorldCupPlayLayerProps = {
  variant: "viewer" | "studio";
  active: boolean;
  reducedMotion?: boolean;
  privateMode?: boolean;
  exportMode?: "exclude" | "deterministic";
  calendarMonth: { year: number; month: number };
  safeSelectors?: string[];
};
```

예상 파일:

- `components/seasonal/worldcup-play-layer.tsx`
- `components/seasonal/worldcup-play-layer.css`
- `components/seasonal/worldcup-play-physics.ts`
- `components/seasonal/worldcup-play-layer.test.ts` 또는 기존 테스트 구조에 맞춘 unit test

### 13.2 배치

시청자 화면:

- `PublicPoster`의 page root 안쪽에 배치.
- 기본적으로 `[data-export-surface]` 밖에 둔다.
- z-index는 decorative layer와 controls 사이에서 조정한다.
- `isWorldCupMonth(view.year, view.month)`가 true일 때 active.

편집실 화면:

- `StudioShell` root 안쪽에 배치.
- role 자체로 기능을 열지 않는다. 편집 권한과 무관한 시즌 장식이다.
- private/unlock/editing/modal 상태에서는 숨기거나 pause.

### 13.3 상태 저장

MVP localStorage:

- `vic.worldcupEffect = "on" | "off"`
- `vic.worldcupGoals:YYYY-MM-DD = number`
- `vic.worldcupSeenIntro:YYYY-MM-DD = "true"`

KST 날짜 키:

- 서버 시간이 아니라 UI 기준 KST 날짜를 써야 한다.
- 이미 프로젝트가 KST를 중요시하므로 helper를 만들거나 기존 date util을 재사용한다.

서버 저장은 후순위다. 추후 공개 커뮤니티 골 수를 넣는다면:

- schedule event와 분리된 public-only table.
- 익명 rate limit.
- IP/UA 저장 최소화.
- owner-only 편집과 무관.
- public API DTO에 private schedule field 결합 금지.
- RLS와 API route 권한 리뷰 필수.

## 14. 보안/권한 경계

이 기능은 장식 레이어다. 절대 일정 권한 모델을 바꾸면 안 된다.

필수 규칙:

- private event, owner_private event, memo, private tag, passcode 상태를 레이어 props로 넘기지 않는다.
- `PublicPoster`에서는 public DTO만 사용한다.
- 편집실에서 manager/worker가 이 기능 때문에 편집 가능해지면 안 된다.
- 서버 mutation은 MVP에서 없음.
- 추후 집계를 만들면 client-only permission check 금지. 서버에서 role/rate/RLS 검증.
- private layer unlock 중에는 재미 효과를 숨긴다. warning-heavy UX 우선.

위험한 설계:

- "한국 경기일이면 비공개 일정도 반응" 같은 데이터 연결.
- public viewer에서 studio schedule object를 그대로 넘기는 방식.
- 골 횟수를 schedule id와 함께 public API로 보내는 방식.
- export surface 안에 랜덤 confetti를 넣어 포스터 품질을 매번 다르게 만드는 방식.

## 15. 성능 설계

MVP에서는 DOM/SVG 기반이 충분하다. 공 2-4개와 입자 40개 이하라면 React state로 매 프레임 렌더링하지 않고 ref + rAF + transform style만 갱신하면 된다.

권장:

- 공, 골대, net는 DOM/SVG.
- confetti burst는 기존 구현 재사용 또는 작은 DOM particle.
- physics state는 React state가 아니라 ref에 보관.
- React state는 enabled/goalCount/reducedMotion 정도만.
- Page Visibility API로 background tab에서 stop.
- IntersectionObserver로 viewer 영역이 보이지 않으면 stop.

Canvas 전환 조건:

- 공이 8개 이상.
- particle이 80개 이상.
- 충돌 object가 많아짐.
- pixel-level effect가 필요.

현 단계에서는 Canvas보다 DOM/SVG가 유지보수와 접근성, export 제어에 유리하다.

## 16. 이펙트 상세

### 16.1 GOAL burst

레이어:

1. net bulge: 골대 내부 path 또는 div scale.
2. text pop: `GOAL` 1개. 900ms 후 제거.
3. confetti: 24-40 particles. 좌우로 퍼지고 아래로 fade.
4. calendar glow: 전체 화면이 아니라 월드컵 badge/테두리 주변만.
5. ball settle: 골 뒤에서 300ms 굴러가다 fade 또는 reset.

색:

- 잔디 green은 배경으로 약하게.
- accent는 월드컵 테마와 충돌하지 않는 red, gold, blue를 소량 사용.
- 한 hue 계열로만 도배하지 않는다.

### 16.2 공 재생성

골 후 공을 즉시 원위치시키면 "순간이 사라진" 느낌이 난다.

추천:

- 골 후 600ms 동안 net 안쪽에 머문다.
- 600-900ms 사이 작게 fade.
- 화면 safe edge에서 새 공이 300ms fade-in.
- reduced motion이면 위치만 조용히 reset.

### 16.3 공끼리 충돌

MVP에서는 공끼리 충돌을 생략해도 된다. 공이 적으면 벽/골대 충돌만으로 충분하다. 공끼리 충돌을 넣으면 재미는 늘지만 edge case와 성능 관리가 늘어난다.

후순위로 넣는다면:

- circle collision.
- impulse exchange 단순 모델.
- overlap correction.
- max pair count 제한.

## 17. 사용자별 경험 튜닝

| 사용자 | 니즈 | 튜닝 |
| --- | --- | --- |
| 빠르게 일정만 보는 시청자 | 방해 없음 | idle 낮음, 숨김 버튼, 이벤트 텍스트 미가림 |
| 모바일 시청자 | 쉬운 터치 | 큰 target, 탭 킥, 스크롤 우선 |
| 놀이 좋아하는 시청자 | 손맛 | 드래그 플릭, 골/포스트 피드백 |
| 운영자/편집자 | 업무 집중 | 미니 필드, 편집 중 pause |
| motion 민감 사용자 | 편안함 | reduced motion, static badge |
| 포스터 제작자 | 결과물 안정성 | export exclude/deterministic |

## 18. 단계별 구현 제안

### Phase 0: 문서와 설계 확정

- 이 문서 리뷰.
- 시청자/편집실 placement 결정.
- 숨김 토글 문구와 아이콘 결정.
- export 포함 여부 결정. 기본은 exclude.

### Phase 1: Passive Layer

- 공 2-4개 idle bounce.
- 골대 static.
- reduced motion 대응.
- hide/pause 토글.
- safe area collision.

완료 기준:

- 시청자 모바일 320/390/430px에서 텍스트 가림 없음.
- 편집실 주요 버튼 클릭 방해 없음.
- 5초 이상 움직임 정지/숨김 가능.

### Phase 2: Interaction and Goal

- 탭 킥.
- 드래그 플릭.
- 골 판정.
- small/large burst.
- haptic progressive enhancement.

완료 기준:

- 공 조작이 scroll을 과하게 막지 않음.
- goal burst cooldown 작동.
- reduced motion에서 burst가 static/fade로 대체.

### Phase 3: Studio Integration

- 편집실 미니 필드.
- editing/modal/private/export 상태 pause.
- 저장 성공 optional micro feedback.

완료 기준:

- manager/worker 권한 변화 없음.
- private layer에서 효과 숨김.
- 저장/게시 UI와 겹치지 않음.

### Phase 4: Export Option

- 기본 exclude 유지.
- optional deterministic snapshot.
- random seed 고정.
- html2canvas export 확인.

완료 기준:

- 같은 상태에서 export 이미지가 반복 가능.
- confetti가 텍스트를 가리지 않음.

### Phase 5: Optional Public Challenge

- public-only aggregate 설계.
- rate limit.
- RLS/API security review.
- abuse 방지.

완료 기준:

- public API private leakage test 통과.
- private schedule field 결합 없음.
- 삭제/만료 정책 명확.

## 19. 테스트/QA 체크리스트

기능 테스트:

- 월드컵 기간 active, 기간 외 inactive.
- KST 기준 날짜 키 생성.
- 탭 킥 성공.
- 드래그 플릭 성공.
- post hit feedback.
- goal cooldown.
- hide/pause 토글 persistent.

접근성:

- `prefers-reduced-motion`에서 idle 없음.
- `vic.reduceMotion`에서 idle 없음.
- 자동 움직임 정지/숨김 가능.
- flash 3회/초 이상 없음.
- keyboard focus order 오염 없음.

시청자 화면:

- public DTO private field 노출 없음.
- event title, tag, CTA 가림 없음.
- 모바일 320/390/430px screenshot.
- 데스크톱 wide screenshot.
- heart floater/confetti와 겹침 확인.

편집실:

- owner/developer 편집 가능 기존 유지.
- manager/worker 편집 권한 변화 없음.
- modal/editing/private unlock 중 pause.
- 저장/게시 버튼 클릭 방해 없음.

성능:

- idle rAF tab hidden에서 stop.
- React re-render per frame 없음.
- transform/opacity 위주.
- burst particle 40개 이하.
- low-end mobile에서 jank 확인.

포스터/export:

- 기본 export에 레이어 제외.
- deterministic mode 반복 출력 동일.
- 텍스트 위 confetti 없음.
- html2canvas 결과 확인.

## 20. 의사결정 필요 항목

1. 시청자 화면에서 골대를 한 개로 둘지, 양쪽 두 개로 둘지.
2. 편집실에서 미니 필드를 항상 보일지, 월드컵 버튼을 열 때만 보일지.
3. export에 시즌 놀이 snapshot을 넣을지. 기본 권장은 제외.
4. public community goal count를 넣을지. 기본 권장은 MVP 제외.
5. 소리를 완전히 제외할지, future toggle로만 남길지. 기본 권장은 MVP 제외.

## 21. 추천 기본값

초기 구현 기본값:

```ts
const WORLD_CUP_PLAY_DEFAULTS = {
  viewerBallsDesktop: 3,
  viewerBallsMobile: 2,
  studioBalls: 1,
  particlesPerGoal: 32,
  burstCooldownMs: 10_000,
  idleSpeedMin: 24,
  idleSpeedMax: 64,
  wallRestitution: 0.82,
  postRestitution: 0.72,
  frictionPerFrame: 0.992,
  maxVelocityDesktop: 900,
  maxVelocityMobile: 720,
  exportMode: "exclude",
};
```

## 22. 구현 시 피해야 할 것

- 화면 전체 shake.
- 자동 재생 소리.
- 큰 튜토리얼 card.
- 일정 카드 위를 계속 지나가는 공.
- public viewer에 studio event object 전달.
- private/unlock 화면에서 축제 이펙트.
- 매 프레임 React state update.
- 랜덤 export 결과.
- 효과 끄기 버튼 없는 자동 애니메이션.
- 과도한 purple/blue gradient나 단일 hue palette.

## 23. 근거 자료

월드컵 일정:

- [FIFA World Cup 26 official page](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026)
- [FIFA host cities and dates article](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/fifa-world-cup-2026-hosts-cities-dates-usa-mexico-canada)

게임 재미, 몰입, 손맛:

- [Player Experience of Needs Satisfaction, Center for Self-Determination Theory](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)
- [Ryan, Rigby, Przybylski: The Motivational Pull of Video Games, PDF](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)
- [Designing Game Feel. A Survey, arXiv](https://arxiv.org/abs/2011.09201)
- [How does Juicy Game Feedback Motivate?, CHI 2024](https://dl.acm.org/doi/10.1145/3613904.3642656)
- [Author PDF: How does Juicy Game Feedback Motivate?](https://people.csail.mit.edu/dkao/pdf/3613904.3642656.pdf)
- [GameFlow: a model for evaluating player enjoyment in games](https://dl.acm.org/doi/10.1145/1077246.1077253)
- [GameFlow 2020: 15 Years of a Model of Player Enjoyment](https://dl.acm.org/doi/fullHtml/10.1145/3441000.3441048)
- [MDA: A Formal Approach to Game Design and Game Research, PDF](https://www.cs.northwestern.edu/~hunicke/MDA.pdf)
- [Nicole Lazzaro: The 4 Keys 2 Fun](https://www.nicolelazzaro.com/the4-keys-to-fun/)
- [Flow in Games, Jenova Chen PDF](https://jenovachen.com/flowingames/p31-chen.pdf)

HCI, microinteraction, livestream engagement:

- [Microinteractions: Designing with Details, ACM](https://dl.acm.org/doi/fullHtml/10.1145/3452853.3452865)
- [NN/g: Microinteractions in User Experience](https://www.nngroup.com/articles/microinteractions/)
- [Social presence in live-streaming, Humanities and Social Sciences Communications](https://www.nature.com/articles/s41599-023-01892-8)
- [VIBES: Designing Interactive Spatial Participation in Live Streaming, arXiv](https://arxiv.org/abs/2504.09016)

웹 접근성/성능/API:

- [WCAG 2.2 Understanding SC 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [WCAG Understanding Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Material Design 3 Motion overview](https://m3.material.io/styles/motion/overview/how-it-works)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN: Element.setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [web.dev: How to create high-performance CSS animations](https://web.dev/articles/animations-guide)

