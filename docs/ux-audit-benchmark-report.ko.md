# UX 감사 및 벤치마크 보고서

## 앱 진입 / 첫 화면 표시

* **컴포넌트 이름 / 코드 위치**: `app/layout.tsx` 및 `app/page.tsx`
* **발견된 UX 병목**: 루트 레이아웃은 문서 본문을 렌더링하기 전에 현재 사용자를 판별하고, 홈 라우트는 공개 화면, 스튜디오, 인증 화면 중 무엇을 보여줄지 결정하기 전에 사용자 역할, 비공개 레이어 잠금 상태, 일정 데이터를 모두 확인한다. 라우트 단위 `loading.tsx`가 없어 Supabase 인증 또는 역할 조회가 느려지면 첫 시각적 셸 표시가 지연될 수 있다. 특히 모바일에서 채팅 링크로 월간 포스터를 여는 KST 사용자에게 체감이 크다.
* **업계 벤치마크 분석**: Slack은 전체 모델 로딩을 기다리는 방식에서 벗어나, 첫 유용 화면을 더 빨리 보여주는 incremental boot를 도입했다. 이 접근은 "콘텐츠가 보이는 시점"과 "전체 로딩 완료 시점"을 분리하고, 준비되지 않은 UI만 일시적으로 비활성화한다.
* **우리 프로젝트 맞춤 전략**: 비공개 역할 데이터가 확정되기 전에 "VIC 일정 셸" 단계를 둔다. 이 셸은 캘린더 프레임, Asia/Seoul 기준 월 라벨 플레이스홀더, 포스터용 안전 배경, 민감 정보 없는 shimmer 블록을 즉시 보여준다. 공개/비공개 분리는 반드시 서버가 소유해야 하며, 셸에는 비공개 이벤트 필드가 포함되면 안 된다. 엔지니어링은 익명 사용자에게 안전한 chrome을 먼저 표시하고, 서버 역할 확인 후 사용자별 컨트롤을 hydrate하는 방식으로 첫 화면을 분리해야 한다.

## 스튜디오 초기 데이터 로드

* **컴포넌트 이름 / 코드 위치**: `app/(studio)/studio/page.tsx` 및 `lib/schedules/studio-loader.ts`
* **발견된 UX 병목**: 스튜디오는 `StudioShell`을 마운트하기 전에 사용자 역할, 잠금 상태, 공개 미리보기, 캘린더, 태그, 팔레트, 이벤트, 캠페인 데이터를 기다린다. 로더는 이미 일부 병렬화되어 있지만, 비공개 안전 DTO 필터링이 끝나는 동안 사용자는 라우트 단위의 점진적 셸을 보지 못한다.
* **업계 벤치마크 분석**: Slack의 방식은 이 화면에 바로 적용 가능하다. 작은 초기 payload로 첫 작업 화면을 렌더링하고, 이후 깊은 UI를 점진적으로 활성화한다. Notion의 오프라인 아키텍처 역시 빠른 페이지 접근을 위해 신뢰 가능한 로컬/영속 데이터가 중요하다는 점과, 불완전한 데이터를 보여줘 사용자를 오도하지 않는 원칙을 보여준다.
* **우리 프로젝트 맞춤 전략**: 스튜디오 부팅 단계를 정의한다. 첫째 KST 월간 그리드 셸, 둘째 공개 안전 이벤트, 셋째 비공개 레이어 affordance, 넷째 owner 전용 편집 컨트롤 순서가 적절하다. "viewer는 비공개 데이터에 접근할 수 없다"는 규칙 때문에 첫 두 단계는 반드시 공개 DTO만 사용해야 한다. 비공개 레이어 타일은 잠금 상태와 필터링된 스튜디오 이벤트가 도착할 때까지 경고성이 강한 placeholder로 유지한다.

## 월 라우트 이동

* **컴포넌트 이름 / 코드 위치**: `app/(studio)/studio/calendar/[year]/[month]/page.tsx`
* **발견된 UX 병목**: 월별 스튜디오 라우트는 이동 중 로컬 셸을 유지하기보다 같은 전체 스튜디오 일정을 다시 로드한다. `StudioShell`의 기존 `navMsg` 오버레이가 일부 링크에는 피드백을 주지만, 실제 라우트 이동은 데이터 확인이 느릴 때 전체 페이지 대기처럼 느껴질 수 있다.
* **업계 벤치마크 분석**: Figma의 프로토타입 가이드는 프레임 간 상태 연속성을 중요하게 다룬다. 스크롤 위치, 컴포넌트 상태, matching object 상태를 보존하면 이동이 리셋이 아니라 연속 동작처럼 느껴진다.
* **우리 프로젝트 맞춤 전략**: 월 변경 중 현재 월 그리드를 stale-while-refresh 시각 상태로 유지한다. 이전 월은 부드럽게 남겨두고, 다음/이전 월 skeleton을 즉시 슬라이드 인한다. KST 월 계산은 계속 권위 있는 기준이어야 하며, 최종 서버 payload는 전체 리마운트가 아니라 셸과 reconciliation해야 한다.

## 비공개 레이어 잠금 해제

* **컴포넌트 이름 / 코드 위치**: `components/studio/studio-shell.tsx` 및 `components/private-layer/private-layer-panel.tsx`
* **발견된 UX 병목**: 잠금 해제는 클라이언트 fetch 후 부모 refresh 동작을 유발한다. 로딩 오버레이가 있다는 점은 좋지만, 비공개 이벤트가 실제로 보이기 전까지 여전히 전체 서버 refresh에 의존한다. 이로 인해 "검증은 되었지만 아직 보이지 않는" 취약한 순간이 생긴다.
* **업계 벤치마크 분석**: 인증과 프라이버시 전환은 명시적인 handshake 상태가 있을 때 안정적으로 느껴진다. Firebase의 redirect 모범 사례는 브라우저 저장소와 redirect 흐름이 브라우저마다 취약할 수 있음을 설명하고, Supabase는 redirect destination 설정과 인증 실패 후 커스텀 에러 처리를 강조한다.
* **우리 프로젝트 맞춤 전략**: 비공개 잠금 해제를 세 단계 handshake로 다룬다: 비밀번호 확인 중, 비공개 일정 여는 중, 비공개 레이어 활성. 비밀번호 검증이 성공한 뒤에만 redacted cell을 비공개 skeleton cell로 대체하고, 그 전에는 경고성 강한 비공개 레이어 affordance를 유지한다. 실패 시 개수, 제목, 시간 패턴을 드러내지 않고 잠김 상태로 되돌린다.

## OAuth / 인앱 브라우저 handshake

* **컴포넌트 이름 / 코드 위치**: `components/auth/in-app-browser-notice.tsx`, `app/api/auth/login/route.ts`, `app/(auth)/auth/callback/route.ts`
* **발견된 UX 병목**: 프로젝트는 이미 인앱 브라우저를 감지하고 Chrome intent handoff 전에 "trying" 상태를 보여준다. 남은 위험은 외부 blank gap이다. 브라우저가 현재 앱을 떠나 OAuth를 처리하고, code exchange 후 다시 redirect되는 동안 사용자는 일반 브라우저 피드백만 보게 될 수 있다.
* **업계 벤치마크 분석**: Firebase는 third-party storage를 차단하는 브라우저에서 redirect sign-in이 실패하거나 저하될 수 있음을 문서화하고, 환경에 따라 same-domain auth, proxy, self-hosted helper를 권장한다. Supabase도 production redirect URL의 정확한 설정과 실패 응답 parsing을 강조한다.
* **우리 프로젝트 맞춤 전략**: OAuth 여정을 처음부터 끝까지 브랜드 경험으로 만든다. pre-handoff overlay, callback-processing overlay, post-login route restore overlay를 둔다. callback route는 최종 redirect 전에 최소한의 "VIC Schedule Studio로 돌아오는 중" 셸에 개념적으로 도착해야 한다. 에러는 query string이 아니라 복구 가능한 친절한 카드로 보여준다.

## 이벤트 생성 / 편집 / 삭제

* **컴포넌트 이름 / 코드 위치**: `components/studio/studio-shell.tsx`
* **발견된 UX 병목**: 이벤트 생성, 삭제, 연결, 재정렬, 되돌리기는 이미 rollback이 있는 optimistic local state를 사용한다. 이 영역은 현재 UX가 가장 강한 부분 중 하나다. 남은 병목은 pending temp ID가 후속 작업에 영향을 주어, 사용자가 저장 완료 전 빠르게 연속 조작할 때 "잠시 후 다시 시도" 순간이 생길 수 있다는 점이다.
* **업계 벤치마크 분석**: Linear의 공개 sync-engine 작업은 realtime sync를 중심으로 하고, Notion의 오프라인 작업은 작성 흐름을 막지 않는 background sync와 conflict handling을 강조한다.
* **우리 프로젝트 맞춤 전략**: optimistic model은 유지하되, pending entity 상태를 더 세밀하게 드러낸다. 새 이벤트에는 작은 "syncing" 표시를, 연결에는 임시 chain shimmer를, 저장 실패에는 영향을 받은 이벤트만 대상으로 rollback 설명을 보여준다. owner-only editing은 반드시 서버에서 강제되어야 하며, optimistic UI는 체감 속도일 뿐 권한이 아니다.

## 태그 편집 / 색상 전파

* **컴포넌트 이름 / 코드 위치**: `components/tags/tag-legend-editor.tsx`
* **발견된 UX 병목**: 기존 태그 업데이트는 optimistic하게 캘린더 색상을 다시 칠하지만, 새 태그 생성과 삭제는 서버 의존도가 더 높다. 태그가 제거되거나 생성될 때 사용자는 컨트롤이 비활성화된 상태로 canonical list 반환을 기다릴 수 있다.
* **업계 벤치마크 분석**: Figma의 interaction-state 모델은 이 상황에 유용하다. 상태는 matching surface 전체에 공유되어야 하고, reset은 해당 액션이 요구할 때만 일어나야 한다. VIC에서는 태그 상태가 editor, legend, calendar chip, poster color에 동시에 나타나기 때문에, 분리된 loading feedback은 하나의 global spinner보다 더 어색하게 느껴질 수 있다.
* **우리 프로젝트 맞춤 전략**: 태그를 동기화된 design-token layer로 다룬다. 기존 태그 편집은 계속 즉시 반영한다. 새 태그는 생성된 색상과 함께 pending chip으로 즉시 나타나야 한다. 삭제는 태그와 영향을 받는 calendar pill을 fade 처리한 뒤 확정 또는 복구한다. 공개 DTO는 private-only tag association을 절대 노출하면 안 된다.

## Trusted Members 패널

* **컴포넌트 이름 / 코드 위치**: `components/trusted-members/trusted-members-panel.tsx`
* **발견된 UX 병목**: 패널은 마운트 후 trusted member를 조회하고 단순 loading empty state를 보여준다. 추가/삭제는 서버가 반환한 전체 멤버 목록을 기다린 뒤 리스트가 변하므로, 관리 동작이 나머지 스튜디오 편집보다 느리게 느껴진다.
* **업계 벤치마크 분석**: Slack과 Linear는 둘 다 working model을 로컬에서 빠르게 유지한 뒤 서버 truth와 reconciliation하는 방향을 최적화한다. Canva의 가이드라인도 백엔드 시간을 제거할 수 없을 때 loading affordance가 체감 성능에 중요하다고 설명한다.
* **우리 프로젝트 맞춤 전략**: 멤버 목록을 optimistic roster로 전환한다. 추가 시 role과 email이 포함된 pending member row를 즉시 삽입한다. 삭제 시 row를 undo 가능한 pending-deletion 상태로 접는다. 권한의 최종 권위는 반드시 서버에 있어야 하며, manager/worker가 client-only state로 편집 affordance를 얻으면 안 된다.

## 포스터 캡처 / 클립보드 내보내기

* **컴포넌트 이름 / 코드 위치**: `components/poster/poster-export-actions.tsx`
* **발견된 UX 병목**: 포스터 export는 `html2canvas`를 동적으로 import하고, 높은 scale의 canvas를 렌더링한 뒤 blob으로 변환하고 clipboard에 쓴다. 버튼 라벨은 "캡처 중"으로 바뀌지만, 스티커와 커스텀 폰트가 많은 경우 DOM/canvas 작업 중 페이지 나머지가 멈춘 것처럼 느껴질 수 있다.
* **업계 벤치마크 분석**: Canva는 bundle size 감소, 가능한 경우 무거운 작업의 서버 offload, loading affordance 표시, 이미지 중심 workflow의 thumbnail 사용을 권장한다. 이는 poster export에 직접 대응된다. 공식 export는 server/Playwright 렌더링을 우선하고, client export는 더 풍부한 피드백이 필요하다.
* **우리 프로젝트 맞춤 전략**: export를 "포스터 준비 중", "이미지 렌더링 중", "클립보드 복사 중"으로 나눈다. 공식 월간 일정 이미지는 아키텍처 문서에 이미 명시된 canonical Playwright path를 우선한다. 편의 export에는 non-blocking overlay와 poster-safe microcopy를 제공하고, asset/font가 아직 안정화되지 않았을 때는 이를 알려준다.

## 스티커 이미지 업로드

* **컴포넌트 이름 / 코드 위치**: `components/poster/public-poster.tsx` 및 `lib/schedules/sticker-asset-actions.ts`
* **발견된 UX 병목**: 업로드는 순차 처리된다. UI는 local object URL preview와 pending asset chip을 생성하는데, 이는 매우 좋다. 다만 여러 이미지를 업로드할 때 network/storage 작업이 직렬화되고 drop zone이 넓은 "uploading" 상태로 남을 수 있다.
* **업계 벤치마크 분석**: Canva의 performance guidance는 이미지 workflow에서 thumbnail을 권장하고, preview에 full-size image 비용을 지불하지 말라고 설명한다. 또한 기기별 성능 편차를 줄이기 위해 무거운 작업을 서버로 offload하는 것을 권장한다.
* **우리 프로젝트 맞춤 전략**: local preview는 유지하되, 파일별 upload lane을 개념적으로 추가한다: queued, uploading, processing thumbnail, ready, failed. asset palette에는 가벼운 thumbnail을 생성 또는 저장하고, export에는 full-size URL을 유지한다. 실패한 파일은 조용히 사라지지 않고 retry 가능한 chip으로 남아야 한다.

## 스티커 Undo / Redo Snapshot 동기화

* **컴포넌트 이름 / 코드 위치**: `components/poster/public-poster.tsx`
* **발견된 UX 병목**: undo/redo는 snapshot을 적용한 뒤 delete/create/update 작업을 수행한다. 일부 작업은 batch 처리되지만 fallback 경로는 개별 server action loop가 될 수 있다. 큰 스티커 구성을 다룰 때 local UI는 즉시 변하지만 background persistence는 per-object 상태 없이 늦게 따라올 수 있다.
* **업계 벤치마크 분석**: Notion의 오프라인 아키텍처는 local state와 background sync에 robust dependency tracking이 필요하다는 점을 보여준다. 데이터 그래프가 불완전할 때 일부만 보여주는 것은 접근을 제한하는 것보다 더 나쁜 경험이 될 수 있다.
* **우리 프로젝트 맞춤 전략**: 스티커 snapshot을 composition transaction으로 다룬다. 캔버스는 즉시 업데이트하되, 작은 sync ledger가 pending create/delete/update를 추적한다. 어떤 작업이 실패하면 전체 포스터 panic state가 아니라 영향받은 sticker layer만 복구하거나 "이전 캔버스로 복원"을 제공한다.

## 공개 Heart / 관심 토글

* **컴포넌트 이름 / 코드 위치**: `components/poster/public-poster.tsx`
* **발견된 UX 병목**: heart toggle은 이미 optimistic하고 실패 시 rollback한다. 주요 hidden bottleneck은 count trust다. local animation 이후 서버 reconciliation으로 숫자가 바뀔 수 있고, 사용자는 이 숫자가 최종인지, 동기화 중인지, local-only인지 알기 어렵다.
* **업계 벤치마크 분석**: Linear식 realtime sync와 Slack식 local responsiveness는 모두 즉각적인 UI 응답과 이후 reconciliation을 지향한다. 중요한 것은 속도만이 아니라 reconciliation이 조용하고 이해 가능해야 한다는 점이다.
* **우리 프로젝트 맞춤 전략**: 즉시 heart animation은 유지한다. 서버 기반 heart가 있을 때만 aggregate count에 미묘한 syncing 상태를 추가한다. localStorage-only 모드에서는 전역 인기도처럼 보이지 않게 하고, "내가 저장한 일정" 동작으로 제시한다.

## 꾸미기 라우트 진입

* **컴포넌트 이름 / 코드 위치**: `app/(studio)/studio/decorate/[year]/[month]/page.tsx`
* **발견된 UX 병목**: 꾸미기 라우트는 poster decoration mode를 렌더링하기 전 사용자 역할과 공개 일정을 기다린다. 포스터 모드는 시각적으로 풍부하고 asset-heavy하기 때문에 utilitarian studio mode보다 첫 화면 지연이 더 크게 느껴진다.
* **업계 벤치마크 분석**: Canva의 guidance가 특히 관련 있다. 이미지 중심 creative tool은 bundle size를 최적화하고 URL/thumbnail을 활용하며 loading affordance를 드러내야 한다. Slack의 incremental boot 역시 모든 부가 기능이 준비되기 전에 첫 유용 화면을 표시하는 방식을 지지한다.
* **우리 프로젝트 맞춤 전략**: KST 월/제목 placeholder가 있는 poster canvas shell을 즉시 보여주고, 이후 stickers, asset drawer, export controls를 점진적으로 hydrate한다. decoration 권한은 편집 도구 활성화 전에 반드시 서버에서 확정되어야 한다. viewer는 edit handle을 아주 잠깐도 보면 안 된다.

## Presence 초기화

* **컴포넌트 이름 / 코드 위치**: `lib/presence/presence-client.ts` 및 `app/layout.tsx`
* **발견된 UX 병목**: presence는 인증된 layout render 이후 시작되고, realtime setup 실패 시 조용히 실패한다. 보조 기능으로는 괜찮지만 developer/admin panel은 "아무도 없음"과 "presence unavailable"을 구분하지 못한 채 오래된 값이나 빈 값을 보여줄 수 있다.
* **업계 벤치마크 분석**: Slack은 content-visible 상태와 fully-loaded 상태를 분리하고, backing data가 준비된 UI만 활성화한다. 같은 원칙이 realtime presence에도 적용된다. 핵심 일정은 막지 않되, presence 자체의 준비 상태는 알려야 한다.
* **우리 프로젝트 맞춤 전략**: presence는 계속 non-blocking으로 유지한다. connecting, live, degraded, unavailable 상태를 개념적으로 추가한다. 이 상세 정보는 developer-facing surface에만 필요하며, viewer mode는 기술적 소음 없이 cute하고 clean하게 유지한다.

## 공개 일정/API Fetch

* **컴포넌트 이름 / 코드 위치**: `lib/schedules/public-loader.ts` 및 `app/api/public/[calendarSlug]/events/route.ts`
* **발견된 UX 병목**: 공개 일정 로딩은 cache 및 병렬 처리가 되어 있지만, route는 poster 렌더링 전 여전히 schedule을 기다린다. Public API 소비자도 전체 schedule object를 기다린다. 무거운 sticker asset과 event-heart join은 "월간 일정만 보고 싶다"는 시각적 필요보다 느리게 느껴질 수 있다.
* **업계 벤치마크 분석**: Slack의 initial payload 전략은 첫 화면에 필요한 것만 먼저 가져오고 나머지를 이후 완료하라고 말한다. Canva의 thumbnail guidance도 이미지 중심 surface가 첫 화면 표시를 위해 full asset 비용을 지불하지 않아야 한다고 설명한다.
* **우리 프로젝트 맞춤 전략**: 공개 포스터 데이터를 calendar frame, event summary, reactions, stickers, full asset metadata로 개념적으로 분리한다. 첫 화면은 공개 안전 calendar/event summary만 필요해야 한다. stickers와 reaction count는 그리드가 보인 뒤 hydrate할 수 있으며, 어떤 단계에서도 private field가 포함되어서는 안 된다.

## 벤치마크 출처

* Slack Engineering, "Getting to Slack faster with incremental boot": https://slack.engineering/getting-to-slack-faster-with-incremental-boot/
* Notion Engineering, "How we made Notion available offline": https://www.notion.com/blog/how-we-made-notion-available-offline
* Linear, "Scaling the Linear Sync Engine": https://linear.app/blog/scaling-the-linear-sync-engine
* Canva Apps SDK, "Performance": https://www.canva.dev/docs/apps/design-guidelines/performance/
* Figma Help Center, "State management for prototypes": https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes
* Firebase Auth, "Best practices for using signInWithRedirect on browsers that block third-party storage access": https://firebase.google.com/docs/auth/web/redirect-best-practices
* Supabase Docs, "Redirect URLs": https://supabase.com/docs/guides/auth/redirect-urls
