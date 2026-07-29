# VIC Schedule Studio 페이지별 Apple 기조 리디자인 계획

- 작성일: 2026-07-30 (KST)
- 상태: Approved — 2026-07-30 사용자 구조 승인 및 피드백 3건 반영
- 개정: 체감 품질·사용 빈도 우선. 일정 그림판은 X1 signature 예외로 iPad drawing studio 지향
- 범위: 시각 스타일, 반응형 레이아웃, 모션, 햅틱 계획만
- 비범위: 서버 권한, RLS, API/DTO, 공개·비공개 데이터 경계, 데이터 모델, 저장 동작
- 선행 문서:
  - `CLAUDE.md`
  - `docs/agent/CURRENT_STATE.md`
  - `docs/ux/audit/vic-schedule-studio-ux-hci-improvement-plan_260729.md`
  - `docs/agent/decisions/ADR-0011-ux-overhaul-l-decisions.md`
  - `docs/agent/decisions/ADR-0012-phase0-capability-matrix.md`
  - `docs/ux/apple-hci-benchmark-report.md`
  - `docs/agent/plans/ACTIVE_PLAN.md` (`PLAN-20260730-002`, Completed)

## 0. 계획 원칙과 판정 기준

### 0.1 목표

“Apple처럼 보이는 복제품”이 아니라 Apple HIG의 기조를 VIC 고유 브랜드에 적용한다.

1. 콘텐츠가 먼저 읽힌다. Studio는 관리 콘솔보다 몰입형 작업대로 보인다.
2. 계층은 크기·무게·여백·재질로 설명한다. 강한 색과 테두리로 모든 것을 구획하지 않는다.
3. 같은 객체는 이동·확장·축소로 이어진다. 갑자기 다른 객체로 교체되는 느낌을 줄인다.
4. 모바일과 웹은 각 장치에 맞는 별도 레이아웃을 쓴다.
5. 공개 포스터는 VIC 브랜드 출력물이다. 관리 도구의 Apple 기조가 포스터 작품 표면을 덮지 않는다.
6. **가장 자주 보는 화면과 가장 자주 누르는 버튼부터 개선한다.** 장식 완성도보다 월 이동,
   오늘, 날짜 선택, 일정 추가·편집·저장, 필터, 하트, 시트 닫기처럼 반복되는 조작의 위치·크기·
   상태 피드백을 우선한다.

### 0.2 상태 분류

| 상태 | 판정 기준 |
|---|---|
| 이미 리디자인됨 | 2026-07-30 Apple 리디자인 커밋에서 해당 표면을 직접 수정했고 현재 코드에 유지됨 |
| 부분 적용 | 전역 토큰·공통 셸·일부 컨트롤은 적용됐으나 해당 화면 전체의 위계·여백·재질·네이티브 반응형 감사가 끝나지 않음 |
| 미적용 | 해당 표면 전용 Apple 리디자인 이력과 일관된 역할 토큰 적용이 없음 |

최근 완료 커밋:

| 커밋 | 적용 범위 | 중복 금지 |
|---|---|---|
| `c64dbc5` | Studio 데스크톱 편집 패널 타이포 역할 수렴, `--text-*` 기반 | 편집 패널 타이포 전면 재작성 금지 |
| `b63644f` | Studio 상단 IA, 관리 3종 드롭다운 | 관리 메뉴를 다시 상시 버튼 3개로 복귀 금지 |
| `0f88418` | 월 이동 화살표를 헤더 월 라벨 양옆으로 통합 | 별도 월 이동 행 재도입 금지 |
| `6a6129c` | Studio 모바일 아젠다·시트 타이포 역할 수렴 | 모바일 타이포 전면 재작성 금지 |
| `2f31c05` | 꾸미기 크롬 라벨 타이포 토큰화 | export 표면까지 같은 스타일을 확장 금지 |

사용자 롤백 이력도 불변으로 취급한다.

- 모달 카드는 불투명 유지. 전면 글래스 재질 재시도 금지.
- 카드→패널 fly/morph 전이 재시도 금지.
- 제목칸 라이브 미러/레일 재시도 금지.
- 이동/복제 헤더 버튼 재도입 금지.

### 0.3 사용 빈도 우선순위

현재 문서에는 실제 클릭 분석 자료가 없다. 아래 빈도는 핵심 사용자 흐름, 화면 내 반복 횟수,
현재 기능 구조를 근거로 한 계획 가설이다. 구현 전 사용자 검토로 보정하고, 근거 없이 저빈도
관리 화면을 먼저 미화하지 않는다.

| 등급 | 정의 | 대표 표면·행동 | 투자 원칙 |
|---|---|---|---|
| F1 반복 핵심 | 한 방문에서 여러 번 보거나 누름 | 공개 월 이동·오늘·필터·일정·하트, Studio 날짜 선택·월 이동·Quick Add·편집·저장·닫기·undo/redo | 첫 구현 배치. 위치·hit target·상태·모바일 도달성까지 완성 |
| F2 세션 핵심 | 한 방문에서 0~몇 번 사용 | 이 달 기록, preview, 관리 메뉴, tag picker, 공개 범위, 꾸미기 선택·내보내기, 설정 토글 | F1과 같은 문법 재사용. 별도 장식 최소화 |
| F3 간헐 관리 | 특정 상황에만 사용 | 로그인 오류, passcode 관리, 태그 정의, 멤버 관리, 공지, 개발자 기록, error/not-found | 보안·명료성 유지. F1/F2 완료 후 정돈 |

우선순위 점수는 `빈도 × 역할 도달 범위 × 반복 비용 × 실패 비용`으로 본다.

- viewer 전체가 쓰는 공개 조작과 owner가 하루 작업 중 반복하는 편집 조작을 동급 F1로 둔다.
- 보안 화면은 사용 빈도가 낮아도 잘못된 이해의 비용이 크므로 구조·경고 명료성은 선행 가드로
  유지한다. 단, 장식 폴리시는 F1 뒤에 한다.
- 화면당 주 CTA 하나. 같은 작업의 primary action은 상태가 바뀌어도 가능한 한 같은 자리에 둔다.
- 버튼은 label, icon, 위치를 함께 바꾸지 않는다. 한 배치에서 한 축씩 검증한다.
- 모바일 조작 target은 기존 44px 계약을 지키고, bottom sheet 저장·닫기·오늘을 thumb zone에 둔다.
- F1 배치가 전체 리디자인 노력의 최소 60%를 차지하도록 한다.
- **예외 — 일정 그림판:** 진입 빈도와 무관하게 제품의 signature surface로 본다. F1/F2 이후
  별도 X1 배치에서 Apple iPad drawing app에 가까운 체감 완성도를 목표로 충분히 투자한다.

### 0.4 체감 품질 성공 기준

리디자인 성공은 blur·radius 개수가 아니라 “사용자가 더 빠르고 편안하며 믿을 수 있게 작업하는가”로
판정한다.

| 체감 축 | 목표 | 금지 |
|---|---|---|
| 즉각성 | 누르면 100ms 안에 pressed/pending 반응, 저장·이동 중 현재 상태 표시 | 무반응 후 결과만 갑자기 등장 |
| 위치 안정성 | pending/success/error에서도 button·card·sheet 위치 유지 | label 폭 변화, layout jump, focus 유실 |
| 조작 효율 | 자주 쓰는 action까지 눈·pointer·thumb 이동 단축, 반복 단계 증가 없음 | 예쁜 메뉴 안에 F1 action 숨김 |
| 직접성 | 선택한 card/sticker/stroke가 그대로 움직이고 결과를 즉시 보여줌 | control과 결과가 먼 곳에서 따로 반응 |
| 이해성 | 현재 선택·권한·저장·잠금 상태를 1초 안에 판독 | 색 하나만으로 상태 전달 |
| 신뢰성 | optimistic feedback 뒤 server 결과·복구 경로 명확 | 실패를 성공처럼 보이거나 입력 소실 |
| 정서 | 차분한 기본 상태 + 완료·하트·snap 같은 순간만 playful | 모든 요소의 상시 bounce/glass/gradient |
| 적응성 | web과 mobile에서 각 장치에 자연스러운 정보량·조작 위치 | desktop DOM 단순 축소 |

배치 전후 확인:

1. 동일한 핵심 작업의 click/tap 단계 수가 늘지 않는다.
2. 첫 유효 action과 반복 action이 fold 밖이나 추가 menu 안으로 밀리지 않는다.
3. pending/error를 강제로 재현해 cumulative layout shift와 focus 이동을 비교한다.
4. desktop mouse/keyboard, mobile touch, 일정 그림판 iPad touch/Pencil을 각각 실기기 확인한다.
5. 시각 선호가 갈리면 “Apple처럼 보이는가”보다 완료 시간·오조작·상태 이해도를 우선한다.

## 1. 화면 인벤토리

### 1.1 실제 라우트

| 라우트 | 사용자 표면 | 현재 상태 | 근거·주의 |
|---|---|---|---|
| `/` | 익명·viewer 공개 포스터, 데스크톱 월 포스터, 모바일 아젠다 | 부분 적용 | 전역 스프링·버튼·재질 토큰과 모바일 정돈 적용. `PLAN-20260730-002` 5번은 전면 재수렴 이득이 낮아 보류됨 |
| `/` | Supabase 미설정 시 최소 로그인 안내 | 미적용 | `AuthFirstPage`의 최소 Google 로그인 표면. 공개 포스터와 다른 인증 상태 |
| `/login` | Google 로그인, 오류, 인앱 브라우저 안내 | 부분 적용 | 기존 브랜드·버튼·상태 모션은 있으나 역할형 타이포/네이티브 폭별 구성 전수 감사 없음 |
| `/studio` | Studio 기본 달력/편집실 | 이미 리디자인됨 | 데스크톱 패널, 상단 IA, 월 내비, 모바일 아젠다·시트가 최근 직접 수정됨. 이후 작업은 폴리시·누락 표면만 |
| `/studio/calendar/[year]/[month]` | 북마크·콜드 엔트리용 특정 월 Studio | 이미 리디자인됨 | 같은 `StudioShell`; 런타임 월 이동은 route 전환이 아님. URL 월 우선순위/KST 동작 불변 |
| `/studio/decorate/[year]/[month]` | 포스터 꾸미기, 스티커 팔레트, 내보내기 | 이미 리디자인됨 | 크롬 라벨 토큰화 완료. `[data-export-surface]` 내부 색·크기·지오메트리 불변 |
| `/studio/private-layer` | 잠금 해제, 잠그기, 비밀번호 설정·변경 | 부분 적용 | 전역 버튼/카드 토큰은 상속. 경고 중심 정보 위계와 모바일 전용 구성이 아직 독립 리디자인되지 않음 |
| `/studio/tags` | 레거시 북마크 | 이미 리디자인됨 | 독립 페이지 아님. `/studio?panel=tags`로 redirect. redirect 동작 유지 |
| `/studio/trusted-members` | 레거시 북마크 | 이미 리디자인됨 | 독립 페이지 아님. `/studio?panel=members`로 redirect. redirect 동작 유지 |
| `/visual-fixture/poster` | 테스트 전용 공개/꾸미기 fixture | 적용 대상 아님 | production flag 없으면 404. 실제 poster 스타일을 검증하는 기준면 |
| `/visual-fixture/studio` | 테스트 전용 Studio/역할 fixture | 적용 대상 아님 | 실제 `StudioShell` 회귀 기준면. 독립 디자인 금지 |
| `not-found`, `loading`, `error`, `global-error` | 전역 시스템 상태 | 미적용 | 기능 화면과 별도 상태 표면. 로딩 스켈레톤 위치 보존 필수 |

`/auth/callback`과 `/api/*`는 UI 페이지가 아니므로 화면 인벤토리에서 제외한다.

### 1.2 Studio 내부 화면·패널·시트·오버레이

| 표면 | 접근 역할 | 현재 상태 | 리디자인 범위 |
|---|---|---|---|
| 월 달력 그리드 + 좌측 필터/범례 | owner/developer/manager/worker | 이미 리디자인됨 | 폴리시만. 카드 지오메트리·범위선택·drag·zoom 불변 |
| 데스크톱 일정 편집 패널 | owner 중심 | 이미 리디자인됨 | 역할 토큰 누락·동심 반경·상태 피드백 감사 |
| 데스크톱 읽기 전용 상세 | manager/worker | 부분 적용 | owner 편집 폼처럼 보이지 않게 정보형 위계 강화 |
| 모바일 일정 편집 바텀시트 | owner 중심 | 이미 리디자인됨 | 키보드 회피·저장 고정 위치 불변, 동심·모션 폴리시 |
| 모바일 읽기 전용 상세 | manager/worker | 부분 적용 | role별 동작 차이 유지, 정보형 시트로 명확화 |
| Quick Add와 접이식 설정 | owner | 부분 적용 | 점진 공개 구조 유지, 선택 상태·요약 행 폴리시 |
| 업 도움 설정 시트 | manager/owner | 부분 적용 | manager의 제한된 수정 범위를 시각적으로 명확화 |
| manager 태그 편집 시트 | manager | 부분 적용 | 최대 2 대표 태그·public 일정만이라는 기존 제약을 시각적으로 유지 |
| 태그 편집 모달 `/studio?panel=tags` | owner/developer | 부분 적용 | taxonomy 계층·색 picker·빈/저장 상태의 역할형 위계 |
| 멤버 관리 모달 `/studio?panel=members` | owner | 부분 적용 | 계정·역할·활성 상태 그룹 리스트 리디자인 |
| 공지 모달 | 허용 역할 | 부분 적용 | 작성/미리보기/상태 구획 폴리시 |
| 개발자 패널 모달 | developer | 부분 적용 | 진단 도구임을 명확히 하되 owner 도구처럼 보이지 않게 |
| 날짜 방문 기록 모달 | developer | 부분 적용 | 데이터 목록·필터·빈/로딩 상태 정돈 |
| 비공개 암호 모달 | 권한 역할 | 부분 적용 | 경고 우선, 다른 모달 위 overlay stack 불변 |
| 역할 배지 설정 팝오버 | 인증 역할 | 부분 적용 | 진동·동작 줄이기·눈 편한 테마 토글. 로컬 설정 동작 불변 |
| 날짜/시각 picker | owner | 부분 적용 | 웹 popover, 모바일 bottom sheet라는 이중 네이티브 구조 유지 |
| tag picker·color picker popover | 권한 역할 | 부분 적용 | 포털 위치·화면 밖 flip·색상 가독성 불변 |
| 휴방 미니메뉴 | 편집 가능 역할 | 미적용 | 소형 context menu 재질·선택 피드백 통일 |
| 미리보기 드롭다운 | 허용 역할 | 부분 적용 | 현재 역할 preview와 실제 권한이 다르다는 의미 유지 |
| 관리 드롭다운 | 권한별 항목 | 이미 리디자인됨 | A안 구조 고정. 항목별 권한 노출 차이 유지 |
| 공개 미리보기 overlay | Studio 역할 | 부분 적용 | public DTO만 사용, private badge·관리 UI 미렌더 유지 |
| “이 달 기록” 공개 인사이트 시트 | viewer 및 허용 역할 | 부분 적용 | 모바일 sheet/웹 dialog 레이아웃과 차트 위계 폴리시 |
| 일정 그림판/방송 판서 전체화면 패널 | 허용 역할 | 부분 적용 | X1 signature 예외. 기존 기능은 유지하고 시각·반응형 문법은 iPad drawing studio로 전면 재설계 |
| 꾸미기 팔레트·스티커 선택 툴바 | 꾸미기 가능 역할 | 이미 리디자인됨 | 직접 조작·러버밴딩·스냅 노치 유지 |
| PNG export 진행·성공 보상 | 꾸미기 가능 역할 | 이미 리디자인됨 | export surface 밖에서만 표시. 성공 썸네일·fallback 불변 |
| 오프라인 badge/toast | 전체 | 부분 적용 | 화면 모서리 안전영역·클릭 방해 금지 |

### 1.3 자주 사용하는 장소·버튼 인벤토리

이 표가 화면별 미적 완성도보다 먼저 적용할 리디자인 정본이다.

| 우선 | 장소 | 자주 쓰는 control | 리디자인 목표 | 위치·동작 불변식 |
|---|---|---|---|---|
| F1 | 공개 포스터 web/mobile | 이전 달·오늘·다음 달 | 월 라벨과 한 시선축, 현재/pressed/disabled 즉시 구분 | 기존 월 이동·오늘 복귀 동작 |
| F1 | 공개 포스터 mobile | 하단 “오늘” | thumb reach, safe-area, 다른 action과 폭 균형 | 왼쪽 고정 slot과 오늘 카드 중앙 scroll |
| F1 | 공개 포스터 | 태그 filter chip | 선택 대비, 다중 선택 상태, 짧은 feedback | 실제 공개 tag와 필터 결과 |
| F1 | 공개 포스터 | 일정 card/link | 제목→상세→시간→link 읽기 순서, 충분한 tap target | poster/agenda 내용과 link 동작 |
| F1 | 공개 포스터 | heart | 누른 위치 유지, 낙관 상태와 실패 복구 명확 | heart 저장·집계 동작 |
| F1 | Studio header | 이전 달·월 라벨·다음 달·오늘 | 반복 이동 시 pointer/눈 이동 최소화 | 헤더 통합 구조와 KST 월 |
| F1 | Studio calendar | 날짜 cell | 선택·오늘·range·focus가 겹쳐도 구분 | roving focus, drag range, event hit target |
| F1 | Studio calendar/mobile agenda | 일정 card | 선택 가능성·공개 범위·대표 태그를 빠르게 판독 | role별 click 결과와 카드 geometry |
| F1 | Studio | Quick Add/일정 추가 | 화면 내 가장 명확한 creation entry | owner-only create |
| F1 | 일정 편집 panel/sheet | 저장 | sticky/안정 위치, pending·saved·error 같은 자리 표시 | 명시 저장, serialized queue |
| F1 | 일정 편집 panel/sheet | 닫기/취소 | 저장과 오인되지 않는 보조 action, thumb/keyboard 접근 | dirty navigation 경고 |
| F1 | 일정 편집 | 제목·공개 범위·tag | field 위계, 선택 상태, 오류 위치 일관 | ADR-0011 L2/L7, capability |
| F1 | Studio | undo/redo | 현재 가능 여부와 적용 결과 즉시 표시 | history stack·shortcut |
| F1 | 모바일 editor | sheet grabber·저장 footer | keyboard가 떠도 항상 보임 | drag close, focus, visualViewport 회피 |
| F2 | 공개 포스터 | “이 달 기록” | tag 유무와 무관하게 발견 가능, 보조 CTA 위계 | public aggregate API만 |
| F2 | Studio header | preview·관리 menu | primary 작업 방해 없이 발견 가능 | 관리 A안, role별 item 노출 |
| F2 | 꾸미기 | palette tab·sticker·lock·export | 선택 객체/도구/완료 action 명확화 | 1840 좌표와 직접 조작 |
| F2 | 역할 badge 설정 | 진동·동작 줄이기·눈 편한 테마 | grouped settings, toggle 상태 명확화 | local setting 정본 |
| X1 | 일정 그림판 | tool·color·width·undo/redo·layer | canvas-first iPad floating tool shelf와 Pencil feedback | 기존 stroke/card/layer/history 동작 |
| F3 | 관리 modal | 태그 저장·멤버 role·삭제 | 위험 action 분리, 계층 명료화 | owner/developer capability |

F1 control 공통 합격 기준:

- normal, hover, focus-visible, pressed, selected, pending, disabled, success, error 중 해당 상태가
  색 하나에만 의존하지 않는다.
- 아이콘 단독 control은 접근 가능한 이름과 44px hit target을 가진다.
- pending 중 label과 폭을 불필요하게 바꾸지 않아 주변 control이 움직이지 않는다.
- 저장 성공·실패 메시지는 누른 control 근처에 나타나며 다음 작업을 막지 않는다.
- web은 hover/focus와 정렬, mobile은 thumb reach/bottom action을 각각 설계한다.

## 2. VIC용 Apple 기조

토큰은 선투입하지 않는다. **처음 실제로 소비하는 화면 배치에서 정의와 사용을 같은 커밋에
넣는다.** 배치 1에는 즉시 소비가 확정된 타이포·스페이싱·반경 별칭만 둔다. material·status
별칭은 아래 후보 이름을 예약할 뿐이며, 첫 소비 배치 전에는 `:root`에 선언하지 않는다.

### 2.1 타이포 역할

기존 `--text-caption`, `--text-label`, `--text-body`, `--text-ui`, `--text-input`,
`--text-title`, `--text-display`를 정본으로 유지한다. 새 화면별 `font-size: Npx` 추가 금지.

확장 제안:

| 새 토큰 | 목적 |
|---|---|
| `--text-hero` | 로그인·빈 상태처럼 단일 메시지가 주인공인 표면. Studio 달력 hero에는 사용 금지 |
| `--lh-tight` | display/title |
| `--lh-body` | 본문·설명 |
| `--lh-relaxed` | 경고·도움말 긴 문장 |
| `--tracking-tight` | 큰 제목 |
| `--tracking-ui` | 버튼·탭·칩 |
| `--weight-regular` / `--weight-medium` / `--weight-semibold` / `--weight-bold` | 역할별 굵기 산재 제거 |

배치 1 예상 범위는 기존 동일값 selector가 즉시 소비할 `--lh-body`, `--tracking-tight`,
`--weight-semibold`뿐이다. 실제 치환 근거가 없는 `--text-hero`, `--lh-tight`,
`--lh-relaxed`, `--tracking-ui`, 나머지 weight는 첫 화면 소비 배치로 미룬다.

모바일 `:root`가 기본값. 웹은 `@media (min-width: 641px)`에서 필요한 역할 토큰만 상향한다.
포스터 작품용 타이포는 UI 역할 토큰과 분리한다.

| 포스터 전용 후보 | 목적 |
|---|---|
| `--poster-type-title` | 월 포스터 제목 |
| `--poster-type-month` | 월 표기 |
| `--poster-type-day` | 날짜 |
| `--poster-type-event-title` | 일정 제목 |
| `--poster-type-event-detail` | 상세 |

포스터 토큰 도입은 현행 실측값을 그대로 옮기는 “값 변화 0” 배치로 시작한다. 이후 값 변경은
1840 geometry snapshot 승인과 별도 커밋이 필요하다.

### 2.2 여백 리듬

기존 `--space-1`~`--space-6`만 사용한다. 필요 시 값이 아니라 역할 별칭을 추가한다.

| 새 토큰 | 매핑 제안 | 용도 |
|---|---|---|
| `--space-control-x` | `var(--space-4)` | 공용 버튼의 현행 16px 가로 padding을 값 변화 없이 별칭화 |
| `--space-control-y` | `var(--space-2)` | 버튼·칩 세로 padding |
| `--space-card` | `var(--space-4)` | 모바일 카드 내부 |
| `--space-panel` | `var(--space-5)` | 웹 패널 내부 |
| `--space-section` | `var(--space-6)` | 큰 섹션 간 |
| `--safe-bottom` | `env(safe-area-inset-bottom, 0px)` | 모바일 bottom rail/sheet |

배치 1에는 `--space-control-x`처럼 기존 selector가 같은 커밋에서 바로 소비하는 별칭만 넣는다.
나머지 표 항목은 실제 화면의 첫 소비 배치까지 선언을 미룬다. 역할 별칭도 `:root`에만 둔다.
개별 컴포넌트에서 `17px`, `22px` 같은 새 간격 금지.
좌우 padding은 항상 대칭. 모바일은 한 열·짧은 문구·하단 조작, 웹은 다열·정렬 행·충분한 호흡을
쓴다.

### 2.3 코너 반경

기존 `--r-sm`, `--r-md`, `--r-card`, `--r-lg`, `--r-xl`, `--r-pill` 유지.
중첩 표면은 `inner radius = outer radius - padding` 관계를 지킨다.

필요한 파생 토큰 후보:

| 새 토큰 | 정의 제안 |
|---|---|
| `--r-control` | `var(--r-md)` |
| `--r-sheet` | `var(--r-xl)` |
| `--r-nested-sm` | `calc(var(--r-card) - var(--space-1))` |
| `--r-nested-md` | `calc(var(--r-lg) - var(--space-2))` |

모든 것을 pill로 만들지 않는다. pill은 상태·짧은 필터·단일 행 selector에만 사용한다.
배치 1에는 `--r-control`처럼 기존 공용 selector가 즉시 소비하는 별칭만 넣고, sheet/nested
파생 토큰은 해당 화면 배치에서 처음 정의한다.

### 2.4 모션과 스프링

이미 구축된 `--spring-smooth`, `--spring-bouncy`, `--dur-spring-*`, `--dur-1`~`--dur-5`,
`--ease-enter`, `--ease-exit`를 유지한다.

모션 문법:

| 상황 | 토큰 | 원칙 |
|---|---|---|
| press | `--dur-1` + `--ease-exit` | 즉시 눌림 |
| release·하트·완료 | `--spring-bouncy` | 드문 보상에만 |
| sheet·panel 진입 | `--spring-smooth` | 위치 연속성 |
| popover 등장 | `--dur-2` + `--ease-enter` | 짧은 fade+scale |
| popover 퇴장 | `--dur-1` + `--ease-exit` | 진입보다 빠르게 |
| 월 변경 | 최대 `--dur-5` | 콘텐츠 방향성과 일치 |
| drag·sticker | 직접 조작 | pointer를 transition으로 추격시키지 않음 |

모든 신규 animation/transition은 `html[data-reduce-motion]`에서 animation 제거 또는 즉시
상태 전환으로 강등한다. CSS의 `@media (prefers-reduced-motion)` 직접 게이트 금지.

### 2.5 머티리얼

기존 `--material-bg`, `--material-bg-strong`, `--material-blur`, `--glass*`를 우선 사용한다.
재질은 “떠 있는 chrome”에만 쓴다.

추가 후보 이름과 예상 첫 소비 배치:

| 새 토큰 | 목적 | 예상 첫 소비 |
|---|---|---|
| `--material-thin` | 메뉴·작은 popover | 배치 7 picker/menu |
| `--material-regular` | 상단 chrome·floating toolbar | 배치 9a 일정 그림판 |
| `--material-thick` | sheet header·중요 floating surface | 배치 9b 또는 10 |
| `--material-border` | 반투명 표면 경계 | 위 material 첫 소비 배치 |
| `--overlay-dim` | backdrop 명도 | 배치 8 공개 기록 sheet |

표의 배치는 예상일 뿐이다. 해당 배치가 기존 토큰으로 충분하면 새 토큰을 만들지 않는다.

적용 규칙:

- `@supports (backdrop-filter: blur(1px))` 안에서만 반투명 덮어쓰기.
- fallback은 기존 불투명 `--surface*`.
- 모달 본문 카드는 사용자 결정대로 불투명 유지.
- `[data-export-surface]` 내부 재질 금지.
- private warning은 예쁜 glass보다 경고 대비 우선.

**테마별 해석:** 기본 light에서는 배경 콘텐츠가 은은하게 비치되 글자 대비를 잃지 않는 alpha와
blur를 쓴다. `html[data-eye-comfort]`에서는 전역 filter와 재질이 겹쳐 탁해지거나 경계가
사라지지 않는지 실측하고, 필요하면 같은 소비 배치에서 alpha·border·shadow를 테마 override한다.
dark에서는 light 값을 단순 반전하지 않고 elevated surface가 배경보다 한 단계 밝게 읽히는 별도
값을 둔다. 얇은 재질보다 regular/thick 재질을 우선해 글자와 fine icon 대비를 확보한다.
`backdrop-filter` 지원/미지원 모두에서 본문 4.5:1, 큰 글자·핵심 UI 3:1 이상을 확인한다. 현재
global dark toggle을 재도입하는 계획은 아니며, 지원되는 dark surface/검증 fixture에서 토큰
해석만 고정한다.

### 2.6 색 사용

기존 semantic/brand 토큰만 쓴다. 새 hex/rgb/hsl 직접 지정 금지.

- `--accent`: 주 CTA·오늘·핵심 선택. 한 화면 주 CTA 하나.
- `--violet`: 선택·focus·무대 의미.
- `--green`: 참여·작업자·성공.
- `--pink`: 팬 반응·하트.
- `--coral`/`--amber`: 위험·주의. 의미를 섞지 않는다.
- 배경 대부분은 `--paper`, `--surface`, `--surface-2`, `--studio-workbench`.
- 한 화면 강한 브랜드 색 최대 3종. 나머지는 색이 아닌 타이포·공간으로 위계 표현.
- 태그 사용자 지정색은 도메인 데이터이므로 UI palette 토큰화 대상이 아니다. resolver와 대비 계약 유지.

추가 semantic 별칭 후보:

`--status-success`, `--status-warning`, `--status-danger`, `--status-info`,
`--focus-ring`, `--selection-fill`, `--selection-border`.

값은 기존 색 토큰 참조로만 정의한다.

후보 이름은 첫 소비 전 선언하지 않는다. 예를 들어 shared control이 `--focus-ring`을 실제로
쓰는 배치, private 화면이 `--status-warning`을 실제로 쓰는 배치에서 정의·소비·테스트를 함께
한다.

**테마별 해석:** status는 foreground 하나가 아니라 `text/background/border/icon` 조합으로
판독한다. light에서는 기존 brand hue를 낮은 채도의 wash와 짙은 text로 쓴다. 눈 편한 테마에서는
전역 saturation/brightness filter 이후 success·warning·danger가 서로 구분되는지 재측정하고,
색만 약해지면 icon·label·border를 보강한다. dark에서는 hue를 그대로 반전하지 않고 낮은 명도의
surface + 충분히 밝은 text/icon + 절제된 border로 다시 매핑한다. success/warning/danger 의미는
테마가 바뀌어도 뒤바뀌지 않으며, 색만으로 상태를 전달하지 않는다. global dark mode 신규 도입은
비범위다.

## 3. 화면별 작업 명세

### 3.1 공개 포스터 `/`

**빈도 우선순위: F1.** 월 이동·오늘·filter·일정 card·heart를 먼저 다루고, theme·계정 chrome은
같은 배치 후반에 다룬다.

**바꿀 것**

- export 표면 밖 viewer chrome 재감사: **월 이동·오늘·필터·일정·하트부터**, 이후 계정 전환,
  “이 달 기록”, theme, live/offline 상태를 역할형 타이포·한 단계 낮은 surface로 통일.
- 공개 콘텐츠→보조 chrome 순으로 초점이 흐르도록 테두리 밀도를 줄이고 여백으로 그룹화.
- 빈 일정·로딩·오류가 실제 poster/agenda 위치를 유지하도록 skeleton 역할 토큰 통일.

**지킬 것**

- public loader/DTO만 사용. private 키·scope·badge·unlock/edit control 렌더 금지.
- `[data-export-surface]` 1840px 고정폭, 행 높이, sticker 좌표, 제목 wrapping 계약 불변.
- desktop poster와 mobile agenda의 정보·링크·heart·filter 동작 유지.

**웹**

- poster 중심. chrome는 외곽에 얇은 toolbar/side rail로 배치.
- hover lift와 pointer feedback 허용. export surface 위를 가리지 않음.

**모바일**

- agenda 한 열, thumb reach 중심 bottom rail.
- copy 축약. poster 1840 DOM을 축소해 주 UI로 쓰지 않음.
- safe-area와 “오늘” 고정 slot 유지.

**모션·햅틱**

- 월 이동 방향성 transition, filter 카드 FLIP 유지·폴리시.
- heart는 bouncy+`hapticTick()`. reduce-motion에서는 정적 상태 교체.

### 3.2 로그인·인앱 안내 `/login`, `/` 미설정 상태

**빈도 우선순위: F3.** 인증 실패 비용은 높으므로 명료성은 필수지만, 반복 작업 표면 뒤에
폴리시한다.

**바꿀 것**

- 브랜드, 제목, 인증 설명, 오류, CTA 순서 명확화.
- 오류·환경 미설정·인앱 브라우저를 동일한 warning 카드 문법으로 통일하되 원인 copy 유지.
- Google 공식 로고 색은 예외 자산으로 보존; 주변 UI 색은 토큰만 사용.

**지킬 것**

- OAuth 경로, `next` sanitization, 자동 submit, Chrome 열기/링크 복사 동작 불변.
- 권한을 이메일 주소만으로 얻지 못한다는 설명 유지.

**웹**

- 중앙 단일 카드. 불필요한 hero/마케팅 레이아웃 금지.

**모바일**

- full-height 한 열, CTA를 thumb zone에 두되 keyboard/브라우저 chrome과 겹치지 않음.
- 인앱 안내 action은 세로 stack.

**모션·햅틱**

- 카드/오류 짧은 enter. 로그인 pending은 위치 고정 progress.
- 링크 복사 성공 `hapticTick()`. 자동 이동에는 햅틱 없음.

### 3.3 Studio 달력 `/studio`, `/studio/calendar/[year]/[month]`

**빈도 우선순위: F1.** 월 이동·오늘·날짜 cell·일정 card·Quick Add·저장 상태가 최우선이다.

**바꿀 것**

- 완료된 IA·타이포 구조는 유지하고 잔여 hardcoded 시각값을 역할 토큰으로 이관.
- 월 제목, 저장 상태, 역할 badge, 필터, grid, inspector 간 시선 위계 폴리시.
- 읽기 전용 역할은 비활성 owner 폼이 아니라 정보 카드로 보이게 강화.
- 헤더 반복 control과 선택 날짜→일정 card→편집 panel 사이 pointer/눈 이동을 줄인다.

**지킬 것**

- URL→cookie→KST 월 우선순위, 월 route cold-entry 계약.
- owner만 일정 생성/본문 수정/삭제.
- manager/worker 역할별 도구 차이.
- range selection, drag/reorder, undo/redo, Quick Add, optimistic serialized queue, zoom.
- 1000px 미만 compact/mobile agenda 전환과 641px 모바일 경계.

**웹**

- 1000px 이상: multi-column 작업대, 달력 주인공, inspector 보조.
- 641~999px: compact 단일 작업 흐름. 억지 두 열 금지.

**모바일**

- agenda 한 열 + 선택 일정 sheet.
- header 월 라벨 양옆 화살표 구조 고정.
- keyboard 노출 시 sheet 저장 action 가시성 유지.

**모션·햅틱**

- 날짜 선택·filter·save confirmation에 의미 있는 feedback.
- server-confirm은 두 번째 tick. background save는 unrelated control을 막지 않음.
- 카드→패널 fly/morph 금지. 단순 sheet enter만 사용.

### 3.4 일정 편집·읽기 전용·Quick Add·제한 편집 시트

**빈도 우선순위: F1.** 제목·공개 범위·tag·저장·닫기와 모바일 고정 footer부터 다룬다.

**바꿀 것**

- field label/helper/error typography를 역할 토큰으로 정리.
- 공개 범위·업 도움·태그를 grouped list 형태로 정돈.
- owner, manager, worker의 시각 차이를 제목·행동 영역·설명으로 명확히 함.

**지킬 것**

- ADR-0011 L1 무제한 일정, L2 첫 줄 제목/이후 상세, L3 명시 저장+memory-only draft.
- L7 전체 태그 6·대표 2. manager는 public 일정 tag assignment만.
- manager support edit, worker read-only, developer 제한은 ADR-0011/0012 그대로.
- 제목 라이브 미러/레일, 이동/복제 헤더 버튼 금지.

**웹**

- label/value/action 정렬 행. 긴 도움말은 필요 시 disclosure.
- read-only는 form control이 아닌 description list/card.

**모바일**

- one task per sheet. Quick Add 핵심 필드 우선, 설정 접힘.
- action footer 고정, safe-area 반영.

**모션·햅틱**

- disclosure chevron·height transition은 smooth.
- selector/toggle tick, save confirm second tick.
- validation error는 색+문구+focus 이동. shake는 reduce-motion에서 제거.

### 3.5 꾸미기 `/studio/decorate/[year]/[month]`

**빈도 우선순위: F2.** 꾸미기 세션 안에서는 반복도가 높으므로 palette 선택·sticker 상태·
lock·export 순으로 다룬다.

**바꿀 것**

- 완료된 label tokenization 유지. palette group·empty/upload 상태·선택 toolbar의 여백과 동심만 감사.
- chrome와 작품 표면을 재질·shadow 단계로 분리.

**지킬 것**

- `[data-export-surface]` 내부 시각과 1840 geometry 전부 불변.
- sticker select/move/resize/rotate/lock, keyboard shortcut, asset upload/delete.
- screen 기준 선택 링·44px hit area 역보정.

**웹**

- poster canvas + side palette. palette는 정렬된 inspector형.

**모바일**

- poster preview + bottom palette/segmented category.
- 같은 desktop palette DOM을 단순 축소해 옆에 두지 않음.

**모션·햅틱**

- 기존 rubberband, snap notch, keyboard step 유지.
- 선택·snap·lock에 tick. D2 위글은 P3 실험이며 기본 배치에 포함하지 않음.

### 3.6 비공개 레이어 `/studio/private-layer`

**빈도 우선순위: F3, 실패 비용 상향.** 장식보다 잠금 상태·경고·주 action 이해를 우선한다.

**바꿀 것**

- 경고→현재 잠금 상태→주 action→보조 관리 순서.
- unlock과 passcode manage를 시각적으로 분리.
- 기본 passcode 경고는 surface보다 높은 대비·명확한 문구 사용.

**지킬 것**

- Google login + passcode grant, auth-session 결속, 만료/revoke.
- plaintext passcode 미저장.
- manager는 private access 없음. worker는 unlocked work만. owner_private는 owner만.
- exact private banner 문구와 unlock/logout 동작.

**웹**

- 560px 안팎 집중형 보안 panel. 상태와 action을 같은 눈 경로에 둠.

**모바일**

- full-width one-column, passcode input+확인 action overflow 금지.
- 보안 경고와 잠그기 action을 thumb reach에 배치.

**모션·햅틱**

- unlock success는 단일 상태 morph 후보. 경고 배너는 움직이지 않음.
- submit tick + server success second tick.
- reduce-motion 시 즉시 상태 교체.

### 3.7 태그 편집 `/studio?panel=tags`

**빈도 우선순위: F3.** 자주 쓰는 event tag picker(F1/F2)와 태그 정의 관리 화면을 구분한다.

**바꿀 것**

- taxonomy root/child hierarchy를 indentation만 아닌 type/spacing으로 표현.
- color picker trigger, selected swatch, save state, empty/error의 공통 문법.
- modal header/body/footer의 fixed hierarchy.

**지킬 것**

- `/studio/tags` redirect.
- owner/developer create/delete/recolor. manager는 정의 변경 불가.
- event 전체 6/대표 2, custom `bg_hex`, resolver, forced-colors 계약.
- color picker portal/flip.

**웹**

- 2-pane taxonomy + inspector 가능. modal width 내에서만.

**모바일**

- list→선택 항목 detail sheet/stack. desktop two-pane 축소 금지.

**모션·햅틱**

- selection tick, reorder/저장 feedback.
- destructive delete는 장식 motion보다 확인·복구 정보 우선.

### 3.8 멤버 관리 `/studio?panel=members`

**빈도 우선순위: F3.**

**바꿀 것**

- account, manager/worker dual flag, active/inactive, action을 grouped list로 재구성.
- 위험 action과 일반 role toggle 분리.

**지킬 것**

- `/studio/trusted-members` redirect.
- owner만 관리. developer/manager/worker는 관리 불가.
- manager+worker 겸직과 effective role 규칙.

**웹**

- table-like aligned rows, 이메일·역할·상태·action column.

**모바일**

- member card 한 열, 핵심 상태 우선, action disclosure.

**모션·햅틱**

- role toggle tick, confirmed save second tick.
- remove/inactivate는 명확한 확인. 데이터 동작 변경 없음.

### 3.9 설정 팝오버와 공통 메뉴

대상: 역할 배지 설정, 관리/미리보기 dropdown, 휴방 메뉴, datetime/tag/color picker.

**빈도 우선순위: F2.** 단, 일정 편집 중 쓰는 datetime/tag picker는 F1 배치에 포함한다.

**바꿀 것**

- trigger와 popup radius 동심.
- selected/checkmark/disabled/focus 상태 통일.
- material은 작은 떠 있는 surface에만 사용.

**지킬 것**

- 권한별 menu item 노출.
- role preview는 client-only이며 실제 권한 상승 없음.
- motion/haptic/eye-comfort local setting 정본.
- focus trap, Esc, focus restore, portal 위치.

**웹**

- trigger anchor popover, pointer/keyboard 탐색.

**모바일**

- 복잡 picker는 bottom sheet. 1~3개 menu action은 compact popup 허용.
- 44px target과 safe-area.

**모션·햅틱**

- popup enter/exit, selector tick.
- `html[data-reduce-motion]`에서 scale/slide 제거.

### 3.10 공지·개발자·방문 기록·공개 인사이트 모달

**빈도 우선순위: 혼합.** 공개 “이 달 기록” 진입·닫기는 F2, 공지·개발자·방문 기록은 F3.

**바꿀 것**

- 공통 modal shell은 불투명 카드 유지.
- title/action/footer 위치 통일, 콘텐츠 타입별 내부 layout만 분리.
- chart tooltip은 centered+clamped, 텍스트 대안 유지.

**지킬 것**

- modal stack, passcode overlay 상위 z-order, focus trap/Esc/restore.
- 공개 인사이트는 public API 집계만.
- developer diagnostics가 owner content capability로 보이지 않게.

**웹**

- 공지/진단은 wide modal, 방문 기록은 aligned list, 인사이트는 grid.

**모바일**

- bottom/full-height sheet, sticky close/header, content one-column.

**모션·햅틱**

- backdrop fade + card/sheet enter. 카드 morph 금지.
- close/selector tick. 차트 장식 motion은 reduce-motion에서 제거.

### 3.11 일정 그림판 — 방송 판서 전체화면 패널

대상: `components/studio/broadcast-panel.tsx`, `components/studio/broadcast-panel.css`.

**우선순위: X1 signature exception.** 진입 빈도는 낮아도 이 화면만큼은 제한적 chrome 폴리시가
아니라 Apple iPad drawing app 체감을 최대한 살린 독립 리디자인 대상으로 본다. 기존
Windows 그림판/Clip Studio 참고는 기능 발견성 연구 기록으로만 남기고, **시각 문법은 이번 사용자
결정이 supersede**한다. Accepted ADR 변경은 아니다.

공식 기준:

- [Apple Pencil and Scribble](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble):
  실제 필기 도구처럼 자연스러운 직접 조작, hover, pressure, compact 환경의 undo/redo.
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars):
  자주 쓰는 command만 논리 그룹으로 노출하고 과밀화 방지.
- [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars):
  넓은 화면에서는 canvas 위에 떠 있는 inspector, 공간 부족 시 compact control로 적응.
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials):
  glass는 control/navigation layer에만, canvas/content layer에는 사용하지 않음.

#### 체감 목표

1. 화면을 열면 **일정 canvas가 가장 먼저 보이고**, tool chrome은 canvas 위에 가볍게 떠 있다.
2. Pencil이 닿기 전 hover cursor로 도구 종류·굵기·접촉 예상 면적을 이해한다.
3. tool→굵기→색→그리기의 눈 이동이 짧고, 현재 tool/layer가 한눈에 읽힌다.
4. 일정 card와 stroke를 같은 canvas 객체처럼 직접 선택·이동·복구한다.
5. 기존 일정 source tray를 접으면 iPad sketchbook처럼 canvas에 몰입하고, 다시 열 위치가
   예측 가능하다.
6. blur를 많이 쓰는 것이 아니라 낮은 지연·안정된 pointer·차분한 chrome으로 고급감을 만든다.

#### 바꿀 것

- 상단의 넓은 “현재 작업/명령/도구/색” 띠를 iPad형 3층 구조로 재편한다.
  - leading: 닫기, 일정 picker 열기/접기, 문서명 “일정 그림판”.
  - center 또는 canvas 하단: 가장 자주 쓰는 선택·펜·형광펜·지우개·도형 floating tool shelf.
  - trailing: undo, redo, 단축키, 시각적으로 분리된 전체 지우기 danger action.
- 선택 tool은 아이콘만 색칠하지 않고 capsule 배경, tool footprint, label/tooltip으로 구분한다.
- pen color·width는 선택 tool에 붙는 작은 floating inspector로 묶는다. canvas 반대편까지
  pointer를 옮기지 않게 한다.
- 오른쪽 layer panel은 iPad landscape의 floating inspector로 정돈한다. 현재 layer,
  visibility, lock, thumbnail, reorder가 한 행 rhythm을 갖는다.
- 날짜 picker는 canvas에 일정을 가져오는 source tray로 보이게 한다. 보내기 완료 후 접혀
  canvas 공간을 돌려주는 기존 동작을 강조한다.
- canvas는 불투명 content surface, chrome만 `--material-*` 재질. canvas 위 과도한 glass,
  gradient, 그림자 중첩 금지.
- neutral chrome + 현재 ink/VIC accent만 사용. tool마다 무관한 강색 배정 금지.
- icon은 기존 라이브러리/SVG 체계를 사용하고 Apple 소유 자산을 복제하지 않는다.

#### X1 기능 경계

- 기존 action·state·shortcut·canvas engine을 그대로 사용하고 배치·재질·타이포·상태 표현만 바꾼다.
- 새 drawing tool, 새 저장 방식, Pencil squeeze/barrel roll gesture, native framework 연동은 제외.
- 자주 쓰는 action을 새 menu 안에 숨겨 click 수를 늘리지 않는다.
- presentational wrapper/class 분리는 허용하되 server/API/DTO/permission 코드는 건드리지 않는다.
- 새 toggle이나 sheet 동작이 꼭 필요해지면 X1 style 배치에 섞지 않고 별도 제안·승인 대상으로
  돌린다.

#### 지킬 것

- 공개 preview DTO만 canvas 배경으로 사용. private 일정·badge·memo 전달 금지.
- 일정 보내기/제거, card 선택·이동·크기 조절, stroke 선택·그리기·지우기·도형.
- canvas 좌표·scroll·zoom, 통합 undo/redo, layer add/reorder/visibility/lock.
- 현재 구현된 Pointer Events pressure mapping, coalesced samples, pen hover cursor,
  pen/touch arbitration을 보존한다.
- 전체 지우기 2단계 확인과 undo 불가 안내.
- 닫으면 판서 상태가 사라진다는 현재 lifecycle과 안내.
- 시청자와 `[data-export-surface]`에 판서·확대·layer·tool UI 없음.

#### iPad landscape

- canvas 최대화 + floating bottom tool shelf + 접을 수 있는 trailing layer inspector.
- 일정 source tray는 leading floating panel 또는 상단 compact tray. layer inspector와 동시에
  열려도 canvas 핵심 영역을 과도하게 압축하지 않는다.
- Pencil hover는 기존 cursor preview를 사용. touch target은 44px 이상, Pencil target은
  시각 크기를 작게 유지해도 hit area 확보.
- hardware keyboard의 기존 shortcut과 toolbar state가 항상 일치.

#### iPad portrait

- canvas full-width.
- tool shelf는 하단 safe-area 위 floating capsule.
- 일정 source는 기존 open/close state를 이용해 bottom surface로 적응. layer는 compact trailing
  surface로 줄이고, 새 sheet toggle이 필요하면 X1 비범위로 분리.
- compact 환경에서도 undo/redo는 숨기지 않는다.

#### desktop web

- iPad visual language를 유지하되 mouse hover·keyboard shortcut·right inspector를 강화.
- toolbar item에 짧은 label/tooltip 제공. icon-only 암기 강요 금지.
- canvas 중심과 layer inspector의 resize/scroll 안정성 유지.

#### 좁은 mobile

- desktop/iPad 3-pane 축소 금지.
- canvas + compact bottom tool shelf. 기존 state로 가능한 일정 source·색/굵기만 compact surface로
  전환하고, layer 새 sheet 동작은 별도 승인 없이는 추가하지 않는다.
- 현재 기능을 감추기만 하지 말고 undo/redo·닫기·현재 tool을 항상 접근 가능하게 둔다.

#### 모션·햅틱

- tool 선택: 빠른 press + `--spring-bouncy`의 짧은 selection indicator 이동 + `hapticTick()`.
- tool shelf/layer inspector: `--spring-smooth`; pointer drawing 중에는 chrome layout motion 중단.
- snap·lock·layer reorder 완료에 tick. stroke 매 sample에는 햅틱 금지.
- drawing pointer path, canvas transform, live stroke에 CSS transition 금지.
- `html[data-reduce-motion]`에서 shelf/inspector slide·selection spring 제거. 선택 상태 자체는 유지.
- 웹은 Apple Pencil squeeze/barrel roll/native Pencil haptic을 보장할 수 없으므로 계획 범위에서
  약속하지 않는다. 현재 브라우저가 제공하는 pressure·hover·coalesced input만 정확히 활용한다.

#### X1 실기기 합격 기준

- iPad landscape/portrait Safari에서 Pencil 첫 stroke 누락·touch 간섭·scroll 오작동 없음.
- hover 지원 기기에서 cursor가 실제 tool·width와 일치. 미지원 기기에서도 기능 손실 없음.
- tool 변경→색/굵기 변경→stroke까지 canvas를 가로지르는 불필요한 왕복 없음.
- layer inspector 접기 전후 canvas 좌표와 선택 객체 위치 불변.
- 10회 연속 undo/redo에서 toolbar enable 상태와 canvas 결과 일치.
- 일정 source·layer·tool shelf를 열고 닫아도 active tool/layer/focus 보존.
- reduce-motion 상태에서도 tool/layer 변화가 즉시 판독됨.

### 3.12 loading/error/not-found/offline

**빈도 우선순위: F3, 복구 비용 상향.** 장식보다 현재 상태와 retry 발견성을 우선한다.

**바꿀 것**

- 상태 icon, title, body, retry 역할 통일.
- loading skeleton은 최종 콘텐츠와 같은 geometry.
- offline badge/toast를 material·status 토큰으로 통일.

**지킬 것**

- error detail 비노출, digest만.
- offline public snapshot 외 private/auth/studio cache 금지.
- retry/navigation 동작.

**웹**

- 콘텐츠 column 폭에 맞춘 inline 상태.

**모바일**

- 한 열, retry thumb target, safe-area.

**모션·햅틱**

- loading shimmer는 reduce-motion에서 정적.
- retry press feedback. 자동 오류에는 햅틱 없음.

## 4. 배치와 커밋 순서

각 배치는 독립 커밋 가능해야 한다. 한 배치에 여러 화면의 기능 변경을 섞지 않는다.
순서는 라우트 구조가 아니라 사용 빈도 순이다. F1 반복 핵심을 전부 검증한 뒤 F2, F3로 이동한다.

| 순서 | 빈도 | 배치/권장 커밋 | 의존 | 작업 |
|---:|---|---|---|---|
| 0 | — | `docs(ux): approve apple redesign plan` | 사용자 승인 | 이 문서 승인본. 구현 없음 |
| 1 | 기반 | `style(tokens): add consumed role aliases` | 0 | 같은 커밋에서 즉시 소비되는 typography line-height/weight/tracking·spacing·control radius 별칭만. material/status/sheet/nested 미선언 |
| 2 | 공유 | `style(ui): align imported shared controls` | 1 | 2개 이상 화면 모듈이 실제 import하는 공유 control component만. `TagPicker`, `ColorPickerPopover` 등 구현 시 import 근거 확인. 전역 `.button`·화면 로컬 selector 제외 |
| 3 | F1 | `style(studio): polish calendar controls` | 1~2 | 월 이동·오늘·날짜 cell·일정 card·Quick Add·undo/redo·저장 상태와 Studio 로컬 control 상태. 완료된 IA 구조 유지 |
| 4 | F1 | `style(studio): polish editor sheets` | 3 | 제목·공개 범위·tag·저장·닫기, mobile editor footer, readonly detail과 해당 화면 로컬 control 상태 |
| 5 | F1 | `style(poster): polish frequent viewer controls` | 1~2 | `/` 월 이동·오늘·filter·일정 card·heart 및 viewer 로컬 control 상태. export surface 밖만 |
| 6 | F2 | `style(decorate): polish frequent editor controls` | 1~2 | palette tab·sticker 선택·lock·export. 작품 표면 불가침 |
| 7 | F2 | `style(studio): align frequent pickers and menus` | 2~4 | datetime/tag picker, preview·관리 menu, role settings. 휴방 menu 포함 |
| 8 | F2 | `style(insights): polish public records sheet` | 2, 5 | “이 달 기록” 진입·닫기·loading·chart hierarchy. public API만 |
| 9a | X1 | `style(broadcast): establish ipad canvas hierarchy` | 1~2 | canvas-first, compact top bar, source tray, content/control layer 분리 |
| 9b | X1 | `style(broadcast): build floating tool shelf` | 9a | tool·color·width·undo/redo floating chrome, layer inspector |
| 9c | X1 | `style(broadcast): adapt ipad portrait layout` | 9b | landscape inspector, 기존 state 기반 portrait surface, narrow mobile compact layout |
| 9d | X1 | `style(broadcast): polish pencil feedback` | 9c | 기존 pressure·hover·coalesced input 시각 feedback, reduce-motion, iPad 실기기 회귀 |
| 10 | F3/고위험 | `style(private): redesign unlock surface` | 1~2 | `/studio/private-layer`, passcode modal. 경고·상태·주 action 우선, 보안 동작 무변경 |
| 11 | F3 | `style(auth): redesign login states` | 1~2 | `/login`, `/` 미설정, 인앱 안내 |
| 12 | F3 | `style(tags): redesign taxonomy management` | 1~2, 7 | `/studio?panel=tags` 정의 관리. F1/F2 event tag picker와 분리 |
| 13 | F3 | `style(members): redesign member modal` | 1~2 | `/studio?panel=members` |
| 14 | F3 | `style(modals): align occasional modal surfaces` | 2 | 공지, developer, 방문 기록. 모달 불투명 유지 |
| 15 | F3/복구 | `style(states): align loading and errors` | 1~2 | loading/error/not-found/offline. 상태·retry 우선 |
| 16 | 검증 | `test(visual): expand redesign regression matrix` | 3~15, 9d | route/role/viewport/theme/overlay screenshots, poster geometry, iPad 그림판 assertions, 미사용 토큰 감사 |

의존 관계:

```text
승인 → 즉시 소비 기반 alias → imported shared control만
                   ├─ Studio 반복 조작 → editor/role sheets
                   └─ viewer 반복 조작
          F1 사용자 검증 gate
                   ├─ decorate 반복 조작
                   ├─ picker/settings/menu
                   └─ 공개 기록 sheet
          F2 사용자 검증 gate
                   └─ X1 일정 그림판
                      canvas hierarchy → tool shelf/layers
                      → portrait/mobile → Pencil feedback/실기기 gate
          X1 사용자 검증 gate
                   ├─ private/auth
                   ├─ tags/members
                   ├─ occasional modal
                   └─ system states
모든 화면 배치 → visual matrix 확정
```

실행 규칙:

1. 화면당 한 배치. 배치 안에서도 표의 control 순서대로 수정한다.
2. 배치 2는 `components/ui` 경로만이 아니라 **실제 2개 이상 화면이 import하는 component**인지
   import 근거로 판정한다. 화면 전용 CSS와 전역 selector는 건드리지 않는다. 대상이 없으면 새
   추상화나 빈 커밋을 만들지 않고 `Skipped — eligible shared control 없음`으로 기록한다.
3. Studio·viewer 로컬 control의 기본/pressed/selected/pending/error는 배치 3~5에서 정리하고
   장식 요소는 마지막에 본다.
4. 새 토큰은 최초 소비 selector와 같은 커밋에 들어가야 한다. 각 배치 끝에 선언-사용 감사.
5. 배치마다 web/mobile screenshot과 실제 반복 흐름을 비교한다.
6. F1 배치 3~5는 **각 배치별** 사용자 확인 후 다음 F1 배치로 이동한다. 배치 5 확인 전 F2 금지.
7. X1 일정 그림판은 9a~9d 각 단계에서 iPad landscape/portrait 화면을 확인한 뒤 다음 단계로
   이동한다. 한 커밋에서 전체 구조·재질·모션을 동시에 바꾸지 않는다.
8. 사용자가 “자주 쓴다”고 확인한 control은 추정 등급보다 우선한다.
9. fixture snapshot 갱신은 의도한 차이 설명과 승인 후 별도 포함.
10. 서버·API·RLS·DTO 파일이 diff에 나타나면 배치 중단.

## 5. 배치별 회귀 가드

### 5.1 모든 배치 공통

- `git diff --name-only`에 server permission, API, RLS, DB migration, loader/DTO 변경 없음.
- `npm run harness:verify`
- `npx tsc --noEmit`
- `npm run lint`
- 커밋 직전 `npm run build` 실행, exit code `0` 확인.
- 관련 Vitest.
- 관련 Playwright E2E.
- web `≥641px`, mobile `≤640px` 각각 확인. 단순 동일 DOM scale 여부 검사.
- `html[data-reduce-motion]`에서 신규 motion 제거/강등 확인.
- 눈 편한 테마와 지원 dark surface/fixture에서 신규 material/status 토큰 대비·blur fallback 확인.
- 신규 CSS literal 색/치수 lint 또는 `rg` 감사. 새 값은 `app/globals.css :root` 토큰만.
- 해당 배치가 추가한 custom property가 같은 커밋에서 실제 소비되는지 선언-사용 감사.

### 5.2 공개·비공개 경계

- `tests/unit/public-boundary.test.ts`
- `tests/unit/public-dto.test.ts`
- `tests/e2e/public-api.spec.ts`
- public DOM/text에 `privateTitle`, `privateMemo`, `privateMeta`, `owner_private`, unlock control 없음.
- public preview와 broadcast background는 `schedule.viewerModePreview`/public DTO만.
- manager는 private unlock/access 없음.
- worker는 unlock 후 work만, owner_private 없음.
- developer는 ADR-0011 L6/ADR-0012 범위만.

### 5.3 owner-only·역할별 화면

`/visual-fixture/studio?role=owner|developer|manager|worker`별 screenshot/assertion:

- owner: 일정 본문 create/edit/delete.
- developer: 허용된 tag/decorate/work 진단 범위만. owner_private 본문 없음.
- manager: 일정 본문 편집 없음, support·public tag 제한 UI만.
- worker: 일정 본문·tag/member/passcode 편집 없음.
- viewer: public poster만.
- role preview가 실제 권한/서버 action을 늘리지 않음.

### 5.4 poster/export

- `tests/visual/geometry.spec.ts`: `[data-export-surface]` width `1840`, 기존 row/ratio snapshot.
- `tests/visual/poster.spec.ts`: viewer surface pixel baseline.
- export surface 내부에 다음 없음:
  - 관리 dropdown
  - edit/unlock control
  - private badge/banner
  - broadcast/zoom UI
  - export progress/reward
- decorate 배치 전후 sticker position/scale/rotation 동일.
- 실제 PNG dimension·파일명 KST·clipboard→download fallback 확인.

### 5.5 overlay·sheet·focus

- modal/popover/sheet open 시 initial focus.
- Tab/Shift+Tab trap, Esc, close 후 trigger focus restore.
- passcode modal이 기존 modal 위에서 올바른 z-order.
- backdrop click 정책 유지. 공개 인사이트는 backdrop 오클릭 닫기 금지 유지.
- mobile keyboard에서 save/confirm action 가림 없음.
- safe-area, 320px 폭, 390px short-height에서 overflow 없음.

### 5.6 interaction·motion·haptic

- press state 즉시, release spring은 pointer action을 방해하지 않음.
- drag/sticker/drawing pointer path에 transition 없음.
- `html[data-reduce-motion]`만 최종 CSS gate.
- toggle/select/confirm `hapticTick()` 호출 유지 또는 추가.
- server-confirm two-tick은 실제 성공 후만.
- background save가 unrelated action을 disable하지 않음.
- serialized queue, undo/redo, in-flight beforeunload 기준 불변.

### 5.7 배치별 최소 visual matrix

| 배치 | Desktop | Mobile | 테마 축 | 추가 상태 |
|---|---|---|---|---|
| auth | 1440×900 | 390×844 | light·눈 편한·dark fixture | 정상/오류/인앱/미설정 |
| Studio | 1440×900, 1024×768 | 390×844, 844×390 | light·눈 편한·dark fixture | owner/manager/worker, empty/loading |
| private | 1440×900 | 390×844 | light·눈 편한·dark fixture | locked/unlocked/default-passcode/error |
| tags | 1440×900 | 390×844 | light·눈 편한·dark fixture | root/child/color popup/empty/error |
| members | 1440×900 | 390×844 | light·눈 편한·dark fixture | active/inactive/dual-role |
| viewer | 1440×900 | 390×844 | light·눈 편한·지원 dark poster theme | tag 0/1/6, insights open |
| decorate | 1440×900 | 390×844 | light·눈 편한·지원 dark poster theme | selected/locked/uploading/export |
| 일정 그림판 | desktop + iPad landscape | iPad portrait + narrow mobile | light·눈 편한·dark fixture | Pencil hover/contact, tool/layer/zoom, public-only background |

`dark fixture`는 신규 global dark mode나 사용자 toggle을 뜻하지 않는다. 해당 token의 dark 해석과
대비를 검증하기 위한 테스트 축이다.

배치 16에서 `app/globals.css :root`와 테마 override의 신규 custom property를 전수 검색한다.
선언 외 사용처가 0인 토큰은 삭제한다. 예약 이름만 문서에 남기고 CSS에는 두지 않는다.

### 5.8 F1 반복 흐름 회귀

각 F1 배치는 단일 screenshot만으로 통과시키지 않는다. 아래 순서를 연속 실행해 control 위치,
폭, focus, 상태가 불필요하게 점프하지 않는지 확인한다.

**공개 viewer**

1. 이전 달→다음 달→오늘.
2. filter 2개 선택→1개 해제→전체 해제.
3. 일정 card 열기/link 이동 가능성 확인.
4. heart 켜기→pending→성공, 실패 fixture에서는 원상 복구.
5. 모바일에서 다른 달로 이동 후 하단 “오늘”→오늘 card 중앙 scroll.

**owner Studio**

1. 이전 달→다음 달→오늘.
2. 날짜 keyboard 이동→pointer 선택→range 선택.
3. Quick Add→제목 입력→공개 범위→tag→저장.
4. 저장 pending 중 다른 날짜/관련 없는 control이 불필요하게 막히지 않는지 확인.
5. 저장 성공 위치 고정→undo→redo.
6. 모바일 card 선택→sheet 열기→keyboard 표시→저장 footer 가시→닫기.

**manager/worker**

1. 같은 일정 card 선택.
2. manager는 support/public tag 제한 action만 확인.
3. worker는 읽기 전용 detail만 확인.
4. owner 편집 button이 disabled 상태로 남는 것이 아니라 아예 역할 전용 화면인지 확인.

**꾸미기**

1. palette tab 전환→sticker 추가→선택→이동→resize/rotate→lock.
2. undo/redo→export.
3. 조작 전후 `[data-export-surface]` geometry와 관리 chrome 미포함 확인.

F1 합격 기준:

- 반복 5회 동안 primary control의 화면 위치가 상태 text 때문에 이동하지 않는다.
- desktop pointer travel과 mobile thumb travel이 기존보다 늘지 않는다.
- focus가 열리거나 닫힌 sheet/menu 뒤에서 유실되지 않는다.
- 한 action의 pending 상태가 다른 action을 broad-disable하지 않는다.
- 장식 motion을 전부 끈 `html[data-reduce-motion]`에서도 상태 변화가 이해된다.

## 6. ADR 정합성

본 계획은 ADR-0011/0012를 supersede하지 않는다.

- L1: 하루 일정 hard cap 추가 없음.
- L2: 첫 줄 제목/이후 상세 계약 유지. 별도 필드 분리 계획 없음.
- L3: 명시 저장·memory-only draft 유지.
- L4: iPad portrait compact 월 개요 + 선택 agenda + bottom sheet 유지.
- L5: 삭제 복구 동작 변경 없음.
- L6: developer 권한 변경 없음.
- L7: 전체 태그 6/대표 2 유지.
- L8: auth-session 단위 private grant 유지.
- ADR-0012 capability matrix와 fail-closed/public-only preview/error redaction/KST 기준 유지.

일정 그림판의 iPad drawing studio 전환은 과거 Windows 그림판/Clip Studio 기반 **시각 참고 방향만**
supersede한다. 권한, public preview DTO, canvas 데이터, 저장 lifecycle, export 경계는 변경하지
않으므로 ADR-0011/0012와 충돌하지 않는다.

향후 디자인 요구가 다음 중 하나를 필요로 하면 구현하지 않고 supersede ADR을 먼저 제안한다.

- 역할별 control 노출을 위해 실제 capability 변경
- public preview에 studio/private 데이터를 전달
- manager/worker의 일정 본문 편집
- unlock grant 범위·기간·저장 방식 변경
- poster geometry 또는 제목 저장 모델 변경

## 7. 승인 체크포인트

승인 후에도 아래 선택은 배치별 시안/스크린샷 확인을 거친다.

1. F1 인벤토리에 빠진 실제 자주 쓰는 버튼이 있는지.
2. 공개 viewer와 Studio 반복 조작 중 어느 쪽을 먼저 실행할지.
3. 토큰 확장 이름과 기존 값 alias 방식.
4. 공개 viewer chrome의 변경 강도. 현재 “부분 적용”이므로 전면 재구축하지 않음.
5. private layer 경고 밀도.
6. tags/members 모바일의 list→detail sheet 구조.
7. X1 일정 그림판 9a~9d 단계별 시안과 iPad landscape/portrait 결과.

승인 전 구현·snapshot 갱신·코드 수정 없음.
