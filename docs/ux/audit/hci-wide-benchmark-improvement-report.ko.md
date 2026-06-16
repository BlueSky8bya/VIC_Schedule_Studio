# VIC Schedule Studio 제품 경험·커뮤니티 연결·운영 신뢰 개선 조사 보고서

작성일: 2026-06-04 KST  
범위: 코드 읽기 + 기존 docs 검토 + 웹 벤치마크/논문/가이드 조사 + 제품 경험/몰입/협업/저장 신뢰 분석  
원칙: public/private boundary, KST, owner-only editing 우선

## 0. 요약

VIC Schedule Studio는 일반 캘린더가 아니라 “방송 일정 공개 포스터 + 운영 스튜디오 + 비공개 레이어 + 꾸미기/내보내기 툴”이다. 그래서 개선도 단순 UI polish보다 넓게 봐야 한다.

핵심 개선 축:

1. **모바일 조작감**: 버튼 크기, 엄지 도달 영역, bottom controls, 터치 피드백, swipe/long-press 규칙 정리.
2. **웹 작업감**: owner studio는 조밀하지만 예측 가능해야 함. 버튼 그룹, drag/drop, undo, 저장 상태, keyboard flow 강화.
3. **몰입감**: 모션/햅틱은 “결과를 느끼게 하는 피드백”이어야 함. 장식용 과잉 금지.
4. **화면 비율 대응**: viewer agenda, studio workbench, poster export canvas를 분리. poster는 고정 비율 출력물로 다룬다.
5. **달력 꾸미기**: sticker/text/theme를 “시각 레이어 시스템”으로 정리. 레이어 잠금, 템플릿, 안전 영역, export preview 중요.
6. **인사이트 패널**: 현재 기능량은 좋지만, dashboard cognition 관점에서 overview/filter/detail 흐름과 decision next-action이 부족하다.
7. **성능/지각 속도**: public-safe shell 먼저, heavy asset/insight/sticker 후속 hydrate.
8. **시선 피로와 visual load**: 한 화면에서 눈이 이동해야 하는 거리, fixation 수, 시각 밀도, 대비, 밝기, 반복 스캔 비용을 줄인다.
9. **몰입/재미/유기적 연결감**: viewer가 “일정표를 보는 중”이 아니라 “스트리머의 다음 방송을 같이 기다리는 중”이라고 느끼게 만든다.
10. **사용자-사용자 연결**: owner-viewer, owner-worker, owner-manager 사이에 awareness, handoff, accountability를 만든다. 단 private data 공개로 연결감을 만들면 안 된다.
11. **저장 신뢰**: “분명 바꿨는데 적용 안 됨”을 막기 위해 dirty/saving/failed/conflict 상태, keepalive 저장, route guard, export guard가 필요하다.

## 1. 현재 코드 기반 관찰

### 1.1 큰 표면

- `components/studio/studio-shell.tsx`: 약 4014줄. 일정 편집, 모바일 sheet, private layer, tag modal, insight modal이 한 컴포넌트에 밀집.
- `components/studio/studio-shell.css`: 약 7420줄. studio, mobile, insights, private warning, event pill, modal 스타일이 혼재.
- `components/poster/public-poster.tsx`: 약 3318줄. viewer, decorate, stickers, hearts, export affordance가 공존. 현재 sticker save/delete/batch는 `/api/sticker-write` keepalive fetch로 감싸져 있고, decorate 화면에서 pending save가 있으면 `beforeunload` 경고를 건다.
- `components/poster/public-poster.css`: 약 3321줄. agenda, poster surface, theme, sticker toolbar, mobile까지 포함.
- `components/developer/insights-dashboard.tsx`: developer용 8패널 carousel dashboard.
- `components/studio/member-insights.tsx`: member/owner용 4~5패널 dashboard.
- `app/api/sticker-write/route.ts`: 꾸미기 sticker 저장/삭제/일괄 작업을 keepalive-friendly 단일 endpoint로 받는다. 기존 server action 권한 검사를 재사용한다.
- `lib/ui/haptics.ts`: Android/지원 브라우저에서만 동작하는 haptic helper가 있다. unsupported 환경은 no-op로 둔다.
- `lib/presence/presence-client.ts`, `components/presence/presence-beacon.tsx`: role/device 기반 presence count 구조가 있다. worker/manager awareness 기능의 기반으로 확장 가능.
- `components/trusted-members/trusted-members-panel.tsx`, `lib/permissions/roles.ts`: manager/worker 역할이 분리되어 있고, schedule edit은 owner/developer 중심이다. 향후 연결 기능은 edit 권한이 아니라 suggestion/prepare/flag/notice로 설계해야 한다.

판단: 기능은 빠르게 쌓였고, viewer/studio/decorate/insight가 제품 정체성을 만든다. 다만 HCI 관점에서는 “한 화면에 많이 담은 힘”이 “사용자가 지금 해야 할 일”을 흐릴 수 있다.
추가 판단: 최근 sticker 저장 안정성 개선은 이 보고서 2.9의 방향과 맞다. 다만 현재는 pending request 기반 `beforeunload`에 가깝고, entity별 dirty/saved/failed/conflict 모델과 export 전 저장본 보장은 아직 별도 설계가 필요하다.

### 1.2 보안/권한 경계

- 공개 일정은 `lib/schedules/public-loader.ts`에서 `visibility_scope = "public"` 및 draft 제외.
- studio private filtering은 `lib/schedules/studio-loader.ts`에서 role/unlock 기준으로 2차 방어.
- role helper는 `lib/permissions/roles.ts`.
- public DTO 누출 테스트는 `tests/unit/public-dto.test.ts`, `tests/e2e/public-api.spec.ts`.

개선 시 주의:

- viewer mode에서 CSS hide로 private 보호 금지.
- manager/worker 조작 허용 범위는 AGENTS의 owner-only editing과 충돌 가능. “decorate/support/tag assignment”가 edit인지 operation인지 정책 명명 필요.
- private layer unlock 중 skeleton도 title/time/count pattern을 새면 안 됨.

## 2. 벤치마크와 연구 근거

### 2.1 버튼 크기와 터치 목표

근거:

- Material Design은 touch target 최소 48dp를 권장한다. 손가락 터치 오류를 줄이기 위한 넉넉한 hit area 기준이다.  
  https://m3.material.io/foundations/layout/applying-layout/touch-targets
- Apple HIG는 iOS controls의 tappable area를 충분히 크게 유지하라고 권장하고, 일반적으로 44pt 계열 기준을 사용한다.  
  https://developer.apple.com/design/human-interface-guidelines/buttons  
  https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- WCAG 2.2 Target Size 2.5.8은 최소 24 CSS px target을 다룬다. 접근성 기준은 “최소 방어선”이고, 모바일 앱 수준 조작감은 40~48px 이상이 낫다.  
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Parhi, Karlson, Bederson(2006)은 mobile touch target size 연구에서 작은 타깃 오류와 속도 문제를 다뤘다.  
  https://dl.acm.org/doi/10.1145/1152215.1152260

프로젝트 적용:

- `.agenda-heart`, month nav, private toggle, mobile sheet buttons는 최소 40~48px 유지.
- 아이콘 버튼은 시각 크기와 hit area를 분리한다. 아이콘은 18~22px, hit box는 44~48px.
- destructive action은 가까이 두지 말고 spatial separation + confirmation/undo 제공.

### 2.2 버튼 생김새와 배치

근거:

- Fitts’s Law: 목표가 크고 가까울수록 빠르고 정확하다. 모바일 bottom zone은 thumb reach와 연결된다.  
  https://www.interaction-design.org/literature/topics/fitts-law
- Nielsen Norman Group은 모바일에서 터치 타깃, spacing, reachability, bottom navigation의 실용성을 반복적으로 강조한다.  
  https://www.nngroup.com/articles/touch-target-size/
- Material Design button guidance는 filled/outlined/text/icon button을 목적과 위계에 따라 구분한다.  
  https://m3.material.io/components/buttons/guidelines

프로젝트 적용:

- Studio topbar:
  - Primary: 저장, 공개 미리보기, 비공개 보기.
  - Secondary: 태그, 멤버, 인사이트, 꾸미기.
  - Dangerous: 삭제, unlock reset, passcode 변경은 별도 위험 zone.
- Mobile:
  - bottom fixed month nav는 좋음. 다음 단계는 action rail: heart/filter/view mode 같이 반복 사용 버튼을 엄지 영역에 둔다.
  - edit sheet 내부 primary button은 sheet 하단 sticky.
- Poster decorate:
  - tool buttons는 icon-first. 텍스트는 tooltip/aria-label로 보조.

### 2.3 모션, 애니메이션, 유동성

근거:

- Material Motion은 motion이 spatial relationship, continuity, hierarchy를 설명해야 한다고 본다.  
  https://m3.material.io/styles/motion/overview
- Apple HIG Motion은 motion이 피드백과 continuity를 주되 과도한 움직임/멀미를 피하라고 한다.  
  https://developer.apple.com/design/human-interface-guidelines/motion
- WCAG 2.3.3 Animation from Interactions는 사용자가 interaction-triggered animation을 끌 수 있어야 함을 다룬다.  
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- `prefers-reduced-motion`는 OS motion sensitivity를 존중하는 표준 CSS media feature.  
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

프로젝트 적용:

- 좋은 모션:
  - event 이동 후 settle.
  - delete 후 collapse/poof.
  - private unlock 성공 후 warning-heavy reveal.
  - month swipe 전환.
  - sticker drag의 물리감.
- 피해야 할 모션:
  - 계속 반짝이는 장식.
  - dashboard 숫자 과한 count-up.
  - private layer에서 즐거운 느낌만 주는 모션. 여기서는 경고감 필요.
- 공통 규칙:
  - transform/opacity 위주.
  - 120/180/240ms token 유지.
  - reduced-motion에서는 fade 또는 instant로 대체.

### 2.4 햅틱/진동

근거:

- Vibration API는 일부 브라우저/기기에서만 동작한다. iOS Safari는 일반 web vibration 지원이 제한적이다.  
  https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API  
  https://caniuse.com/mdn-api_navigator_vibrate
- Apple HIG는 haptics를 “중요한 상태 변화나 직접 조작 피드백”에 맞춰 절제해 쓰라고 한다.  
  https://developer.apple.com/design/human-interface-guidelines/playing-haptics

프로젝트 적용:

- 햅틱은 progressive enhancement:
  - Android: `navigator.vibrate`.
  - iOS: no-op 허용. 시각/음영 피드백이 본체.
- 추천 패턴:
  - tick: month nav, filter toggle, tag select.
  - success: save 완료, unlock 성공, sticker duplicate.
  - warning/error: passcode 실패, delete confirm.
- 설정:
  - “동작/진동 줄이기” toggle.
  - localStorage 기반이면 충분. 서버 저장 불필요.

### 2.5 유명 학회 논문 기반 추가 근거 매트릭스

아래는 ACM CHI, MobileHCI, UIST, CSCW, IEEE VIS/TVCG 계열에서 VIC Schedule Studio와 직접 연결 가능한 논문/연구다. 접근 가능한 공개 초록/논문 페이지/PDF를 기준으로 정리했다.

| 분야 | 논문/학회 | 핵심 근거 | VIC 적용 |
| --- | --- | --- | --- |
| 모바일 터치 | Parhi, Karlson, Bederson, “Target Size Study for One-Handed Thumb Use on Small Touchscreen Devices”, MobileHCI 2006 | 한 손 엄지 조작에서 약 9.2~9.6mm target이 성능/선호에 충분하다는 실험 근거 | mobile agenda card, heart, month nav, sheet button을 44~48px 이상 hit area로 유지 |
| 모바일 시선 | Leiva et al., “Understanding Visual Saliency in Mobile User Interfaces”, MobileHCI 2020 | 모바일 UI에서는 top-left bias, text/image 기대, UI-specific saliency가 중요 | mobile header/agenda 첫 시선 anchor를 월/다음 방송/오늘에 고정. 강한 색보다 위치/텍스트 위계를 우선 |
| GUI 시선 예측 | Xu, Sugano, Bulling, “Spatio-Temporal Modeling and Prediction of Visual Attention in Graphical User Interfaces”, CHI 2016 | mouse/keyboard/UI component 정보만으로도 attention map 예측 가능 | Studio에서 selected event, focused input, hover/drag target 기준으로 visual heat budget을 추정하는 QA 가능 |
| attention capture | Monge Roffarello et al., “Defining and Identifying Attention Capture Damaging Patterns in Digital Interfaces”, CHI 2023 | 무한 autoplay/attention capture pattern은 사용자의 목표/시간 감각/통제감을 해칠 수 있음 | 반복 sparkle/무한 sticker animation을 selected/hover/export-preview로 제한. dashboard active animation 수 제한 |
| UI animation | Gonzalez, “Does Animation in User Interfaces Improve Decision Making?”, CHI 1996 | animation 효과는 task domain, transition style, interactivity style에 따라 다름. 무조건 도움 아님 | event 이동/삭제처럼 상태 변화 설명에만 motion. decorative motion은 절제 |
| motion icon | Harrison et al., “Kineticons: Using Iconographic Motion in Graphical User Interface Design”, CHI 2011 | motion을 iconographic signal로 쓰면 attention/meaning 전달 가능하지만 해석/과잉 주의 필요 | private unlock, save success, warning 같은 상태 icon motion만 짧게. 버튼 idle animation 금지 |
| animation method | Hudson & Stasko, “Animation Support in a User Interface Toolkit”, UIST 1993 / path-transition paradigm | UI animation은 상태 변화 경로를 보여주는 practical technique로 쓸 수 있음 | desktop reorder FLIP, month transition, sticker drag ghost를 “경로 설명”용으로 설계 |
| 캘린더 사용 | Palen, “Social, Individual and Technological Issues for Groupware Calendar Systems”, CHI 1999 | calendar는 단순 개인 일정표가 아니라 사회적/조직적 coordination artifact | VIC는 viewer-facing poster와 operator studio를 분리해야 함. 공개/비공개/운영 역할이 다른 이유의 학술 근거 |
| 캘린더 사용 | “An Exploratory Study of Calendar Use”, CHI 2004 | reminders, paper trail, reporting/life archive 등 calendar의 다중 용도 확인 | 월간 poster export, archive, .ics, next broadcast reminder는 “부가기능”이 아니라 calendar practice와 맞음 |
| shared calendar privacy | “I love you, let’s share calendars: calendar sharing as relationship work”, CSCW 2012 | calendar sharing은 관계/신뢰/경계 설정 작업 | trusted member UI는 권한 설명과 disclosure boundary를 계속 보여줘야 함 |
| privacy adaptive calendar | “PriCal: Dynamic Privacy Adaptation of Collaborative Calendar Displays” | shared/public display에서 calendar privacy adaptation 필요 | private layer unlock, redaction, owner-only scope, viewer-safe export 강화 근거 |
| schedule disclosure | Posit shared-office calendar disclosure research | 물리적 배치/상황에 따라 calendar disclosure level을 바꾸는 접근 | VIC도 viewer/studio/private/export context마다 disclosure level이 달라야 함 |
| dashboard design | Shneiderman, “The Eyes Have It”, 1996 | overview first, zoom/filter, details-on-demand | insights 첫 화면은 overview summary, tab별 detail은 후속. recent logs는 접힘 기본 |
| visualization validation | Munzner, “A Nested Model for Visualization Design and Validation”, TVCG 2009 | domain/task abstraction -> encoding/interaction -> algorithm 층위 분리 | insights 개선은 chart부터 고치지 말고 “owner가 어떤 결정을 해야 하는가”부터 정의 |
| infovis evaluation | Lam et al., “Empirical Studies in Information Visualization: Seven Scenarios”, TVCG 2012 | visualization evaluation 목적을 user performance, experience, communication, collaborative analysis 등으로 분리 | insights QA를 screenshot 예쁨이 아니라 decision speed, recall, error, collaboration 관점으로 나눔 |
| visual embellishment | Bateman et al., “Useful Junk?”, CHI 2010 | 장식이 항상 나쁜 것은 아니며 기억/이해에 영향을 줄 수 있음 | poster sticker/emoji는 viewer memorability에 도움 가능. 단 schedule legibility를 해치면 실패 |
| visual embellishment | Borgo et al., “An Empirical Study on Using Visual Embellishments in Visualization”, TVCG 2012 | rhetorical/figurative embellishment가 추상 개념 전달에 도움 가능성 | support campaign, heart popularity, rest day는 은유적 sticker/pictogram 사용 가능 |
| memorability | Borkin et al., “What Makes a Visualization Memorable?”, TVCG 2013 | memorable visualization은 familiar+unique 요소, pictorial 요소와 관련. 단 memorability가 곧 good visualization은 아님 | public poster는 기억성 필요, studio insights는 정확성/비교성이 우선 |
| recognition/recall | Borkin et al., “Beyond Memorability”, TVCG 2015 | title/supporting text, pictogram, redundancy가 message recall에 도움 | insights chart title은 “6개월 추이”보다 “금요일 방문 집중”처럼 메시지형으로 |
| sticker communication | Cha et al., “Complex and Ambiguous: Understanding Sticker Misinterpretations in Instant Messaging”, CSCW 2018 | sticker는 풍부하지만 복잡성/동작/맥락 차이로 오해 가능 | sticker decoration은 공개 poster에서 귀여움 담당, 운영 상태/권한 의미 전달에는 텍스트/아이콘 병행 |
| customization | Griggio et al., “Customizations and Expression Breakdowns in Ecosystems of Communication Apps”, CSCW 2019 | emoji/sticker/GIF/customization은 개인 표현을 강화하지만 앱 간 맥락 차이 발생 | custom sticker asset은 streamer identity 강화. 단 export/social context별 safe preset 필요 |
| personalization | Bunt, Conati, McGrenere, mixed-initiative interface personalization | feature-rich app에서 personalization은 효율을 높일 수 있지만 control/understandability 필요 | owner/operator fatigue mode, dashboard panel reorder, toolbar pinning을 user-controlled로 제공 |

### 2.6 논문에서 새로 뽑은 보강 제안

1. **Mobile Visual Saliency QA**
   - MobileHCI 2020 saliency 연구 기반.
   - mobile screenshot에서 top-left/header/text/image가 과도하게 시선을 먹는지 검사.
   - agenda 첫 시선이 “현재 월/오늘/다음 방송”으로 가야 함.

2. **Attention Capture Budget**
   - CHI 2023 attention-capture damaging pattern 기반.
   - 한 화면에서 무한 animation 0~1개, 반복 sparkle 1개 이하.
   - sticker animation은 편집 중 selected/hover일 때만 preview.

3. **Calendar Disclosure Levels**
   - CHI/CSCW calendar sharing/privacy 연구 기반.
   - public, viewer-auth, trusted-locked, trusted-unlocked, owner-private, export-context를 명시적 disclosure level로 문서화.

4. **Dashboard Decision Contract**
   - Munzner nested model + Shneiderman mantra 기반.
   - 각 insight panel은 “이 패널이 도와주는 결정”을 코드 주석/문서에 둔다.
   - 예: Content Mix = 다음 달 방송 유형 균형 결정. Visits = 공지 시간/동선 결정. Security = unlock 위험 대응.

5. **Poster Embellishment Guardrail**
   - CHI/TVCG embellishment/memorability 연구 기반.
   - 꾸밈은 viewer recall을 위해 허용하되, event title/date/CTA를 가리는 순간 실패.
   - export QA에 “가독성 > 기억성 > 장식성” 순서 추가.

6. **Personalization With Control**
   - mixed-initiative personalization 연구 기반.
   - 자동 추천은 “적용”보다 “제안”으로. owner가 toolbar/order/theme를 직접 확정.
   - fatigue mode, compact mode, poster preset은 사용자 선택형.

### 2.7 몰입감, 재미감, 유기적 연결감 연구 기반 제안

HCI 좁은 의미를 넘어 game studies, media psychology, live streaming research까지 보면 VIC Schedule Studio의 viewer UX는 단순 schedule lookup이 아니라 “스트리머의 시간표 안에 내가 들어와 있다”는 감각을 만들어야 한다. 이 감각은 조작감(game feel), 즉각 반응(juiciness), flow, social presence, parasocial relationship, aesthetic interaction으로 설명할 수 있다.

| 관점 | 논문/분야 | 핵심 근거 | VIC 적용 |
| --- | --- | --- | --- |
| flow | Pace, “A Grounded Theory of the Flow Experiences of Web Users”, IJHCS 2004 | web flow는 clear goal, feedback, control, focused attention, temporal distortion 같은 경험과 연결 | viewer calendar 첫 화면은 “다음 방송 확인”이라는 clear goal을 즉시 해결. 탐색은 부드럽게 이어지게 |
| game flow | Chen, “Flow in Games”, Communications of the ACM 2007 | challenge와 ability가 맞을 때 몰입이 생김. 너무 어렵거나 너무 단조로우면 이탈 | studio는 dense 기능, viewer는 low-friction 탐색. role별 challenge level 분리 |
| self-determination | Ryan, Rigby, Przybylski, “The Motivational Pull of Video Games”, Motivation and Emotion 2006 | autonomy, competence, relatedness 만족이 게임 동기와 즐거움에 연결 | viewer에게 theme/filter/bookmark/알림 선택권을 주고, “내가 일정 흐름을 이해했다”는 competence feedback 제공 |
| presence + flow | Jin, “I Feel Present. Therefore, I Experience Flow”, Journal of Broadcasting & Electronic Media 2011 | video game에서 presence가 flow 경험과 연결 | poster/viewer 화면은 방송 세계관의 공간처럼 느껴져야 함. 날짜 grid만 두지 말고 stream identity, next-live state, ambient feedback 배치 |
| immersion + emotion | Baños et al., “Immersion and Emotion”, CyberPsychology & Behavior 2004 | media form과 emotional content가 sense of presence에 함께 작용 | 단순 장식보다 “방송 전 설렘/휴방 안정감/특별 일정 기대감”을 색, microcopy, motion으로 구분 |
| game feel / juiciness | Hicks et al., “The Effects of Juiciness in an Action RPG”, Entertainment Computing 2019 | 작은 입력에 풍부하고 즉각적인 반응을 주면 alive/control 감각이 커짐 | 좋아요, 날짜 선택, sticker hover, export preview에 작은 scale/soundless pulse/haptic. 단 infinite attention capture 금지 |
| game feel survey | “Designing Game Feel: A Survey” | tuning, juicing, streamlining이 조작감을 만든다 | tap latency, drag threshold, hover delay, sheet spring을 token화. 기능 완성 후 마지막 polish가 아니라 UX 기본 품질로 관리 |
| parasocial live streaming | McLaughlin, Wohn, “Predictors of Parasocial Interaction and Relationships in Live Streaming”, Convergence 2021 | live streaming에서는 streamer 특성과 viewer/relationship 요인이 parasocial interaction/relationship을 예측 | schedule UI는 streamer presence를 보여줘야 함: streamer voice 문구, recurring ritual, “오늘 같이 볼 것” 같은 연결 신호 |
| social presence | Nature HSS Communications 2023 live streaming social presence 연구 | network social presence, parasocial interaction, emotional response가 social support willingness에 영향 | viewer가 “다른 사람도 기다린다”를 느끼게: upcoming count, community-safe reaction, shared anticipation. 개인정보/조작 권한 노출 금지 |
| narrative participation | “StoryChat”, viewer participation tool for live streaming, 2023 | narrative-based participation은 streamer/viewer/other viewers 연결감을 높일 수 있음 | schedule decoration에 episode arc 추가: 이번 주 테마, 연속 기획, milestone badge, 회차형 schedule |
| aesthetic interaction | Lenz, Diefenbach, Hassenzahl 계열 aesthetic interaction 연구 | interaction의 미감은 시각만이 아니라 action quality와 experiential quality의 fit | 버튼 모양보다 누르는 느낌, 전환 리듬, 정보가 펼쳐지는 방식까지 brand mood와 맞춰야 함 |

이 관점에서 새로 추천하는 개선:

1. **Living Schedule**
   - calendar가 정적 표가 아니라 “방송까지 남은 시간, 오늘의 상태, 다음 변화”를 가진 생물처럼 반응.
   - next live card에 subtle breathing motion, KST countdown, live/offline/changed state를 넣되 reduced-motion 준수.

2. **Ritual Loop**
   - viewer가 매번 같은 감정 루프를 돈다: 들어옴 -> 다음 방송 확인 -> 기대감 확인 -> 꾸민 poster 저장/공유.
   - 홈 첫 5초 안에 이 루프가 보여야 함.

3. **Organic Feedback**
   - 날짜 tap, tag filter, sticker select가 모두 같은 물리감으로 반응.
   - scale 0.98 -> 1.00, 120~180ms, spring easing, Android vibration 8~12ms 정도. iOS/web unsupported는 no-op.

4. **Shared Anticipation**
   - social presence를 직접 chat처럼 만들 필요 없다.
   - 안전한 범위에서 “이번 주 하이라이트”, “곧 시작”, “최근 변경됨”, “팬들이 기다리는 일정” 같은 집단 기대 신호 제공.

5. **Streamer Voice Layer**
   - schedule 항목에 owner가 짧은 tone text를 붙일 수 있게 한다.
   - 예: “이 날은 오래 기다린 합방”, “짧방 가능성 있음”. 공개 DTO에는 owner가 public으로 지정한 voice text만 포함.

6. **Viewer Agency Without Editing**
   - viewer는 일정 편집 권한이 없어야 한다.
   - 대신 favorite, local reminder, personal highlight color, display density, calendar subscription 같은 개인화 권한 제공.

7. **Micro-Drama For Calendar Decoration**
   - sticker는 예쁜 물체가 아니라 event mood marker로 쓰기.
   - 반복 방송, 특별 방송, 휴방, 굿즈/공지, 합방을 서로 다른 motion/density rule로 표현.

8. **Fun Budget**
   - 화면마다 “재미 요소” 개수를 제한.
   - viewer poster: high fun 허용. studio: low fun, high clarity. private layer: fun보다 warning/clarity 우선.

### 2.8 사용자-사용자 연결고리 증강 시스템 제안

VIC의 특색은 단순 calendar app이 아니라 streamer schedule을 둘러싼 작은 운영 공동체다. 따라서 연결감은 세 층으로 나뉜다.

- streamer/owner -> viewer: 기대감, 참여감, 함께 기다리는 감각.
- owner -> worker: 일정 제작/수정/검수의 handoff와 common ground.
- owner -> manager: 권한, 책임, 운영 상태의 visibility와 accountability.

CSCW 연구에서는 이런 연결을 visibility, awareness, accountability, common ground, coordination mechanism으로 본다. 단, VIC 보안 원칙상 viewer에게 private field나 운영 내부 정보를 노출하면 안 된다. 연결감은 “정보 더 많이 공개”가 아니라 “공개 가능한 상태 신호를 잘 디자인”하는 쪽이어야 한다.

| 연결 축 | 논문/근거 | 핵심 근거 | VIC 기능 아이디어 |
| --- | --- | --- | --- |
| 공통 사회 신호 | Erickson, Kellogg, “Social Translucence”, 2000 | visibility, awareness, accountability가 사회적 상호작용을 돕는다 | `Socially Translucent Schedule`: 누가 무엇을 볼 수 있는지, 어떤 상태인지 역할별로 다르게 보이는 상태 배지 |
| 협업 awareness | Gutwin, Greenberg, “Workspace Awareness”, CSCW 2002 | 공동 작업에는 누가 어디서 무엇을 하고 무엇을 할지 아는 단서가 필요 | `Studio Presence Rail`: owner/worker/manager가 보고 있는 월, 편집 중 event, 최근 저장을 private studio 안에서만 표시 |
| passive awareness | Dourish, Bellotti, “Awareness and Coordination in Shared Workspaces”, CSCW 1992 | 별도 보고보다 shared workspace 자체에서 자연스럽게 awareness가 생기면 협업 비용이 줄어듦 | `Ghost Cursor`보다 안전한 `soft presence dot`: 과한 실시간 커서 대신 event card corner에 “검토 중/작성 중” 표시 |
| common ground | Clark, Brennan, “Grounding in Communication” | 이해가 맞았다는 상호 확인이 협업 진행의 조건 | `Schedule Handoff Card`: “초안 작성됨 -> owner 검토 필요 -> 공개 예약됨”처럼 서로 같은 상태 문장 사용 |
| coordination mechanism | Schmidt, Simone, CSCW 1996 | 협업 artifact는 업무 조율 장치가 된다 | calendar event 자체를 task ticket처럼 확장: 담당자, 공개 여부, 검수 상태, export readiness |
| role support | Guzdial et al., “Recognizing and Supporting Roles in CSCW”, CSCW 2000 | 실제 사용에서 드러나는 역할을 인식하고 도구가 지원해야 함 | owner/worker/manager 화면을 완전히 같게 만들지 말고 role dashboard 분리. worker는 “내가 해야 할 일정”, manager는 “승인/위험” |
| role-based collaboration | Zhu, Zhou, IEEE SMC 2006 | 역할 기반 협업은 responsibilities/rights를 명확히 해서 협업을 돕는다 | 권한 matrix를 UI에 녹임: `can suggest`, `can prepare`, `can approve`, `can publish`를 분리. trusted member에게 edit 권한 자동 부여 금지 |
| live co-performance | Li et al., “Live Streaming as Co-Performance”, CSCW 2019 | live streaming은 streamer 중심 performance와 audience 주변 참여가 함께 만들어진다 | viewer schedule에 `Audience Ritual`: 이번 주 같이 기다릴 event, countdown reaction, 공개-safe 응원 stamp |
| scalable mediation | StreamFunnel, 2023 | streamer와 다수 spectator 사이에 co-host/중재자 역할이 유용 | VIC manager를 “방송자 대신 일정 커뮤니케이션을 정리하는 co-host”로 설계. 단 일정 수정은 owner 승인 필요 |
| mod emotional labor | Wohn, “Volunteer Moderators in Twitch Micro Communities”, CHI 2019 | moderator는 역할, 감정 노동, 커뮤니티 보호 부담을 가진다 | manager panel에 `Mod Care`: 공지 초안, 위험 일정 flag, 휴식/업무량 표시. manager를 보이지 않는 노동자로 방치하지 않기 |
| moderation evidence | Cai, Wohn, CSCW 2021 | live community moderator는 위반자 판단 전 증거 수집/분류를 한다 | schedule abuse/report가 생기면 manager에게 public report evidence bundle 제공. private schedule data와 분리 |
| multimodal participation | StreamSketch, CSCW 2021 | text/emoji만으로는 creative livestream 참여가 제한된다 | viewer가 공개 poster에 `stamp vote`, `mood sticker suggestion`, `fan highlight request`를 남길 수 있게. owner 승인 후 반영 |
| direct viewer input | VIBES, 2025 | 영상 위 spatial interaction은 viewer-streamer/viewer-viewer 참여를 늘릴 가능성 | calendar poster에서 날짜 위 reaction heat만 허용. 개별 viewer identity 노출 없이 aggregate만 표시 |

특색 기능 후보:

1. **Schedule Campfire**
   - 다음 방송 주변에 viewer reaction이 작은 불빛처럼 모이는 공개-safe aggregate.
   - 개인 이름/식별자 없이 count와 mood만 표시. private 일정에는 절대 표시 금지.

2. **Promise Ribbon**
   - owner가 “이번 주 약속한 방송/변경 가능성/확정”을 ribbon으로 표시.
   - viewer는 schedule reliability를 감정적으로 이해. manager는 변경 공지 누락을 감지.

3. **Relay Baton**
   - worker가 일정 초안을 만들면 baton이 owner에게 넘어감.
   - owner 승인 후 manager에게 “공지/포스터 확인” baton 이동. 권한과 책임 흐름이 시각화됨.

4. **Behind-the-Scenes Pulse**
   - viewer에게 내부 내용은 숨기되 “이번 달 일정 준비 중”, “포스터 업데이트됨”, “공지 반영됨” 같은 공개-safe 운영 pulse 제공.
   - 프로그램이 살아 움직인다는 느낌 제공.

5. **Manager Co-Host Mode**
   - manager는 편집자가 아니라 communication co-host.
   - 변경 감지, 공지 초안, viewer FAQ, 위험 flag, report triage를 담당. publish/edit은 owner 승인.

6. **Worker Craft Queue**
   - worker는 “내 작업 큐”만 본다: 태그 정리, 썸네일/스티커 배치, 초안 검수, KST 날짜 확인.
   - owner-private memo나 sensitive analytics는 보이지 않음.

7. **Shared Ritual Templates**
   - recurring event를 단순 반복이 아니라 ritual로 저장.
   - 예: “월요일 잡담”, “합방 주간”, “휴방 회복일”, “기념일 카운트다운”. viewer poster에도 정체성으로 드러남.

8. **Audience Echo Board**
   - viewer가 남긴 공개-safe 질문/기대/응원 중 owner가 채택한 것만 schedule 옆에 노출.
   - raw chat이 아니라 curated echo. moderation 부담과 위험 감소.

9. **Common Ground Checklist**
   - 공개 전 event마다 `KST 확인`, `public/private 확인`, `poster legible`, `manager notice done` 체크.
   - owner/worker/manager가 같은 완료 기준을 공유.

10. **Connection Safety Rules**
   - viewer aggregate는 익명/집계만.
   - worker/manager awareness는 studio 내부 전용.
   - trusted role은 suggestion/prepare/flag까지만 기본. edit/publish는 owner-only 또는 서버 승인.
   - public DTO에 manager/worker private state, owner memo, unlock state, report evidence 원문 포함 금지.

### 2.9 “변경했는데 적용이 안 됨”을 막는 저장 신뢰 시스템

사용자에게 가장 치명적인 경험 중 하나는 “내가 분명 바꿨는데 나중에 보니 반영이 안 됐다”다. 이 문제는 단순히 “저장 버튼 크게 만들기”로 해결되지 않는다. HCI/error recovery 연구, warning habituation 연구, design system 가이드, fault-tolerant UI 관점에서 보면 핵심은 네 가지다.

- 사용자가 지금 상태를 항상 알 수 있어야 한다.
- 저장 실패가 조용히 묻히면 안 된다.
- 이동/닫기/역할 전환/공개/export 같은 위험 행동 앞에서만 경고해야 한다.
- 경고가 너무 자주 나오면 사용자가 무시한다.

현재 코드 반영 상태:

- `PublicPoster`의 sticker save/delete/batch는 `/api/sticker-write` keepalive fetch를 사용한다. 꾸미기 화면에서 sticker 작업 직후 이동/닫기/새로고침으로 전송이 끊기는 위험을 줄이는 방향이다.
- decorate 화면에서 `pendingSaveRef.current > 0`이면 `beforeunload` 경고가 뜬다. “위험한 위치에만 경고” 원칙과 맞다.
- poster surface는 고정 16:9 design canvas를 scaler로 줄여 보여준다. export와 화면 표시의 불일치를 줄이는 방향이다.
- `haptics.ts`는 unsupported 환경을 no-op로 처리해 햅틱 기능이 저장/조작 실패를 만들지 않게 한다.

남은 gap:

- 현재 guard는 pending network request 중심이다. 사용자가 입력했지만 아직 저장 요청이 예약되지 않은 `dirty` 상태, 저장 실패 후 `failed` 상태, 동시 수정 `conflict` 상태까지 확장해야 한다.
- sticker 외 event/tag/support/poster theme도 동일한 저장 신뢰 모델을 공유해야 한다.
- export는 client dirty state가 아니라 server의 최신 saved version을 기준으로 캡처/공개되는지 검증해야 한다.
- 저장 완료 시각은 KST로 표시해야 한다. UTC/local browser time 혼용 금지.

| 근거 | 핵심 내용 | VIC 적용 |
| --- | --- | --- |
| Nielsen/Shneiderman 계열 visibility of system status, informative feedback | 시스템은 합리적 시간 안에 현재 상태와 결과를 보여줘야 함 | 모든 편집 표면에 `저장됨 / 저장 중 / 저장 실패 / 저장 안 됨` 상태를 명시 |
| Rasmussen/Beltracchi ecological interface design, error recovery 연구 | 오류를 완전히 제거하기보다 감지, 설명, 복구를 지원해야 함 | 실패 시 “무엇이 저장 안 됐는지”, “왜 실패했는지”, “다시 시도/복사/되돌리기” 제공 |
| Toward Fault-Tolerant User Interfaces, Dependability at the User Interface | UI 결함도 시스템 reliability 문제로 봐야 함 | autosave 실패를 toast 하나로 끝내지 말고 queue/retry/audit 상태로 관리 |
| Material dialogs/snackbars/banners | snackbar는 낮은 우선순위, banner는 중간, dialog는 최고 우선순위 | `저장 완료`는 snackbar/status text, `저장 실패 지속`은 banner, `나가면 손실`은 dialog |
| Material full-screen dialog save guidance | Close 같은 모호한 버튼보다 Save/Discard 같은 명확한 동사 필요 | poster editor, event editor에서 `닫기` 대신 `저장`, `저장하지 않고 닫기`, `계속 편집` |
| VA.gov autosave | autosave가 되는 환경에서는 언제 저장됐는지 confirmation 제공 | studio 상단에 “마지막 저장: 21:34 KST” 표시. 비로그인/권한 없음이면 autosave 표시 금지 |
| warning habituation / Fog of Warnings | 반복 경고와 비슷한 알림이 critical warning까지 무시하게 만듦 | 모든 위험 위치에 같은 문구를 뿌리지 말고 risk tier별 다른 표면/문구/빈도 사용 |
| Baymard validation vs warning | 막아야 할 오류와 확인만 시킬 warning을 분리해야 함 | private/public boundary, owner-only publish는 blocking. tag 색상 미세 위험은 non-blocking warning |

#### 저장 신뢰 상태 모델

모든 편집 가능한 entity는 아래 상태 중 하나를 가져야 한다.

| 상태 | UI | 행동 |
| --- | --- | --- |
| `clean` | “저장됨 · 21:34 KST” | 이동 경고 없음 |
| `dirty` | “저장 안 됨” 또는 save button 강조 | route/tab 닫기/role switch/export 전 경고 |
| `saving` | spinner + “저장 중” | 중복 저장 방지. 이동 시 “저장 완료 후 이동” 선택 제공 |
| `saved` | 짧은 confirmation | snackbar 또는 inline status. 과한 modal 금지 |
| `failed` | persistent banner | 재시도, 변경 복사, 원인 보기 |
| `conflict` | blocking dialog 또는 side-by-side diff | owner/worker 동시 수정, stale version이면 overwrite 금지 |
| `readonly` | “보기 전용” | save UI 숨김. “저장 안 될 수 있음” 대신 권한 설명 |
| `offlineQueued` | “연결 복구 시 저장 예정” | viewer-facing publish/export 차단. draft local backup 제공 |

#### 경고가 필요한 위험 위치

경고 문구는 아래 위치에만 둔다. 평상시 모든 form 옆에 “저장 안 될 수 있음”을 붙이면 habituation 때문에 진짜 위험 순간에 무시된다.

1. **dirty 상태에서 route 이동**
   - 예: studio -> viewer, event editor -> month view, poster editor 닫기.
   - 문구: `저장되지 않은 변경사항이 있습니다. 이 화면을 나가면 변경사항이 사라질 수 있습니다.`
   - 액션: `계속 편집`, `저장 후 나가기`, `저장하지 않고 나가기`.

2. **dirty/saving 상태에서 publish/export**
   - 공개물 품질과 신뢰에 직접 영향.
   - 문구: `아직 저장되지 않은 변경사항이 있어 export에 반영되지 않을 수 있습니다.`
   - 액션: `저장 후 export`, `현재 저장본으로 export`, `취소`.

3. **autosave 실패 후 일정 시간 경과**
   - snackbar 말고 banner.
   - 문구: `변경사항 저장에 실패했습니다. 다시 시도하거나 내용을 복사해 보관하세요.`
   - 액션: `다시 시도`, `변경사항 복사`, `상세 보기`.

4. **권한/역할 때문에 저장 불가**
   - viewer/trusted/manager가 편집처럼 보이는 조작을 했을 때.
   - 문구: `이 역할에서는 직접 저장되지 않습니다. 제안으로 보낼 수 있습니다.`
   - 액션: `제안 보내기`, `취소`.

5. **동시 수정 conflict**
   - owner/worker가 같은 event 수정.
   - 문구: `다른 사용자가 이 일정을 먼저 변경했습니다. 덮어쓰기 전에 차이를 확인하세요.`
   - 액션: `차이 보기`, `내 변경 복사`, `새 버전으로 다시 편집`.

6. **KST/date boundary 위험**
   - 23:00~01:00 KST 근처, month/day rollover, timezone 변환 가능성이 있는 경우.
   - 문구: `KST 기준 날짜가 바뀌는 시간대입니다. 공개 날짜를 확인하세요.`
   - 액션: `KST로 확인`, `계속`.

7. **private/public boundary 변경**
   - private -> public, trusted unlock -> public export.
   - 문구: `공개 범위가 바뀝니다. private memo와 내부 상태는 공개되지 않아야 합니다.`
   - 액션: `공개 미리보기`, `계속`, `취소`.

#### 경고를 남발하지 않는 규칙

- `clean` 상태에서는 경고 없음.
- 같은 dirty 화면에서 같은 경고는 한 navigation attempt에 한 번만.
- 저장 완료 confirmation은 2초 이하 inline/snackbar. modal 금지.
- 저장 실패는 자동 사라지는 snackbar 금지. 사용자가 해결할 때까지 banner 유지.
- critical warning은 일반 snackbar와 색/위치/형태를 다르게 해서 habituation/generalization 감소.
- 버튼 문구는 `확인`, `닫기`, `OK` 금지. 반드시 결과 동사 사용: `저장 후 나가기`, `저장하지 않고 닫기`.
- “저장 안 될 수 있습니다” 같은 vague warning은 금지. 언제/왜/무엇이 손실되는지 말해야 함.

#### 구현 체크리스트

- 각 editor에 `dirtySince`, `lastSavedAtKst`, `saveAttemptId`, `serverVersion`, `saveError` 저장.
- mutation은 optimistic update 후 server ack를 받아 `saved`로 전환. 실패하면 dirty 복구.
- route guard는 `dirty || saving || failed || conflict`만 감지.
- `beforeunload`는 dirty/failed일 때만 등록.
- autosave debounce는 text field 500~1000ms, drag/layout edit은 interaction end 후 저장.
- save queue는 entity 단위 직렬화. 같은 event에 동시 mutation race 금지.
- server는 version/etag 확인. stale update는 409 conflict로 응답.
- publish/export는 server에서 최신 saved version만 사용. client dirty state를 믿지 않음.
- audit log에는 owner/worker/manager의 saved/published action만 저장. viewer local preference는 별도.
- Playwright test: dirty navigation warning, failed save banner, conflict dialog, export dirty guard, KST rollover guard.

## 3. 화면 비율과 레이아웃

### 3.1 viewer, studio, poster를 분리해서 생각

근거:

- WCAG Reflow는 320 CSS px 폭에서 정보 손실 없이 세로 스크롤로 사용 가능해야 한다고 본다.  
  https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- CSS `aspect-ratio`는 출력/미디어 surface의 비율 안정화에 적합하다.  
  https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
- Container Queries는 viewport가 아니라 component container 기준 반응형을 가능하게 한다.  
  https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries

프로젝트 적용:

- Viewer mobile: agenda/list 기본. 7열 달력 고집 금지.
- Studio desktop: workbench. left filters + center calendar + right editor.
- Studio mobile: agenda/list + bottom sheet. desktop 축소판 금지.
- Poster export: 고정 비율 canvas. viewer page와 같은 컴포넌트를 쓰더라도 CSS mode는 분리.

### 3.2 poster 비율

선택지:

- 16:9: 현재 코드의 design canvas와 잘 맞음. 방송/스크린 공유에 좋음.
- 4:5: X/Instagram/커뮤니티 이미지 공유에 좋음. 모바일에서 강함.
- A4 portrait: 인쇄/공지 문서에 좋음.
- 9:16: shorts/story용. 월간 7열 캘린더에는 좁음.

추천:

- MVP 유지: 16:9 canonical export 유지.
- 추가 template: 4:5 “social poster” 별도.
- 장기: export preset system.

이유:

- 현재 `POSTER_DESIGN_W = 1840`, 16:9 기반. sticker ratio 데이터도 현 canvas 감각에 묶여 있을 가능성 큼.
- 바로 4:5로 바꾸면 기존 스티커 위치가 흔들린다.
- preset별 sticker layout migration 또는 compatibility mode 필요.

### 3.3 breakpoint 정책

추천 breakpoint:

- `<= 640px`: mobile agenda + sheet.
- `641-860px`: compact/tablet portrait, one-column 또는 two-zone.
- `861-1180px`: narrow studio, side panels collapse.
- `>1180px`: full studio workbench.
- `>1700px`: max-width 중심. `zoom` 회피.

현재 docs에서도 `zoom` 제거와 container query 전환을 제안한다. 이 보고서도 같은 결론이다. `zoom`은 pointer coordinate, sticky, export, browser zoom과 충돌 위험이 있다.

## 4. 모바일 HCI 개선안

### 4.1 엄지 영역 중심 액션

개선:

- 하단 month nav 유지.
- agenda mode에서 “필터/관심/오늘/보기전환”을 bottom action rail로 제공.
- destructive/delete는 bottom rail이 아니라 sheet 내부 하단 danger zone.

이유:

- 반복 액션은 엄지 접근성 우선.
- 위험 액션은 reachability보다 사고 방지가 우선.

### 4.2 mobile event card

개선:

- card tap: edit sheet open.
- long press: owner만 reorder mode.
- swipe left/right: month 이동과 충돌하므로 event-level swipe는 보류.
- heart tap: 44px hit area, LiquidHeart feedback 유지.

검증:

- vertical scroll 방해 없음.
- private warning sticky 노출.
- manager/worker edit affordance 없음.

### 4.3 bottom sheet

개선:

- sheet 상태: peek, half, full.
- save/delete footer sticky.
- 비공개 scope 선택은 unlock 전 disabled with reason.
- keyboard open 시 footer가 입력창을 가리지 않게 `visualViewport` 또는 CSS safe area 대응.

참고:

- Material bottom sheets guidance.  
  https://m3.material.io/components/bottom-sheets/overview

## 5. 웹 Studio 개선안

### 5.1 Button grouping

현재 문제:

- owner는 일정 편집, private toggle, viewer preview, tag/member, insights, decorate가 거의 같은 층위로 보일 수 있다.

추천 그룹:

- Schedule Desk: month nav, new event, save, viewer preview.
- Visibility: public/private toggle, unlock state, private warning.
- Publishing: decorate, export, notice writing.
- Management: tags, members, passcode.
- Analytics: insights.

이유:

- Norman의 affordance/signifier 관점에서 사용자는 “무엇을 할 수 있는가”보다 “지금 어떤 작업 영역인가”를 먼저 알아야 한다.  
  참고: Don Norman, The Design of Everyday Things.

### 5.2 Drag/drop

개선:

- desktop event reorder: FLIP animation.
- drop line: 현재보다 더 명확하게, target cell 전체 subtle highlight.
- pending write 표시: 이동된 event에 syncing badge.
- 실패 시 affected event만 rollback.

근거:

- Direct manipulation interface는 immediate feedback, reversible actions, visible state가 중요하다. Shneiderman의 direct manipulation 원칙과 맞다.  
  https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf

### 5.3 Keyboard workflow

추천:

- `N`: selected date에 새 일정.
- `Cmd/Ctrl+S`: 저장.
- `Delete`: 선택 event 삭제 confirm.
- Arrow: 날짜 이동.
- `Esc`: sheet/modal 닫기.

주의:

- textarea/input focus 때 shortcut 비활성.
- 화면 내 visible help는 과잉 금지. command palette나 tooltip 수준.

## 6. 달력 꾸미기 개선안

### 6.1 Layer model

현재 sticker는 emoji/image/text/shape, z-index, locked, anim, flip, opacity 등 기능이 많다. 개선은 기능 추가보다 model 정리 우선.

추천 레이어:

- Calendar base layer: 날짜/이벤트.
- Campaign layer: support band/card.
- Sticker layer: decorative objects.
- Text layer: public memo, decorative captions.
- Export safety layer: margin/safe area/bleed guide.

추가 UI:

- layer list: 이름, visibility, lock, order.
- “send to front/back” 외 “move up/down one layer”.
- selected item breadcrumb: `Sticker > Text > Neon`.

### 6.2 Template system

추천 preset:

- Clean monthly.
- Cute sticker.
- Campaign focus.
- Mobile social 4:5.
- Broadcast screen 16:9.

이유:

- 사용자는 매번 빈 캔버스에서 꾸미기보다 “이번 달 분위기”를 빠르게 고르고 미세 조정하는 쪽이 빠르다.
- Canva식 creative workflow도 template-first 접근이 강하다.  
  https://www.canva.dev/docs/apps/design-guidelines/performance/

### 6.3 Safe area와 export QA

개선:

- export mode에서 safe margin overlay.
- text/sticker out-of-bounds warning.
- tiny text contrast warning.
- asset loading complete indicator.
- 공식 export는 Playwright canonical path 유지.

근거:

- Responsive Images/object-fit는 contain/cover 목적 분리에 중요.  
  https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit

### 6.4 Sticker 조작감

개선:

- selected object handles는 최소 24px, mobile은 32px 이상.
- rotate/resize handle과 delete handle 분리.
- snap lines: center, thirds, calendar grid edge.
- multi-select bounding box.
- undo ledger: create/delete/move/resize/text edit 단위.

## 7. 인사이트 패널 개선안

### 7.1 Dashboard 정보구조

근거:

- Shneiderman mantra: “Overview first, zoom and filter, then details-on-demand.”  
  https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf
- Dashboard는 한눈에 status와 outlier를 보여주고, 다음 행동으로 이어져야 한다. Stephen Few의 dashboard design 원칙도 clutter 최소화, 비교 가능성, 맥락 제공을 강조한다.  
  https://www.perceptualedge.com/articles/visual_business_intelligence/dboard_confusion_revisited.pdf
- Nielsen Norman Group은 dashboard가 사용자의 목표와 의사결정 흐름에 맞아야 한다고 설명한다.  
  https://www.nngroup.com/articles/dashboards/

현재:

- DeveloperDashboard: 8패널 carousel. content, engagement, trend, highlight, live, visits, security, system.
- MemberInsights: 4~5패널. content, engagement, trend, highlight, security.
- 장점: 패널 분리, swipe/keyboard, skeleton, live visits refresh.
- 약점: 각 패널이 “그래서 무엇을 해야 하나?”까지 연결하지 않음.

### 7.2 개선 구조

추천:

- 첫 화면: Monthly Command Summary.
  - 다음 방송
  - 이번 달 공개 일정 수
  - 쉬는 날
  - 관심 높은 일정
  - 방문 peak
  - security warning
- 두 번째: Content Mix.
- 세 번째: Engagement.
- 네 번째: Visits.
- 다섯 번째: Security/System.

패널마다 `Insight -> Reason -> Action` 구조:

- Insight: “금요일 방문이 높음”
- Reason: “최근 6개월 대비 +23%, 20~22시 집중”
- Action: “다음 공지 후보 시간으로 표시”

### 7.3 Visualization 개선

추천:

- sparkline만 있는 trend는 baseline/previous month marker 추가.
- bar chart는 max 기준만 말고 absolute count와 percentage 둘 다 제공.
- role/device colors는 legend 고정.
- small multiples: content by tag, hearts by tag, visits by role를 같은 scale family로 묶기.
- empty state는 “기록 없음”뿐 아니라 “어떤 행동으로 데이터가 생기는지” 안내.

접근성:

- `role="img"` charts에는 aria-label 구체화.
- color-only encoding 금지. pattern/label/tooltip 병행.
- data table fallback 제공.

## 8. 공개 Viewer 경험 개선안

### 8.1 Viewer mobile agenda

개선:

- “오늘/이번 주/전체 월” segmented control.
- filter chips sticky horizontal rail.
- support campaign card는 상단 또는 relevant day 아래.
- local timezone 보조 표기: KST canonical 유지, viewer local은 작은 sublabel.

벤치마크:

- Luma는 calendar page, filtering, subscribe/newsletter 흐름이 강하다.  
  https://help.luma.com/p/helpart-hJI2JawEcFaH6he/luma-calendar-overview
- Twitch schedule은 timezone과 recurring schedule model이 핵심이다.  
  https://dev.twitch.tv/docs/api/schedule

### 8.2 구독/알림

개선:

- `.ics` export/subscription.
- “이번 달 이미지 저장”과 “캘린더 구독” 분리.
- support event link CTA 강화.

주의:

- public DTO만 사용.
- private/work/embargo 정보는 구독 파일에도 절대 포함 금지.

## 9. 성능과 지각 속도

### 9.1 progressive boot

추천 load ladder:

1. public-safe calendar chrome.
2. public event summary.
3. hearts/reactions.
4. sticker assets.
5. private affordance.
6. private events after unlock.
7. insight panels on demand.

근거:

- Slack incremental boot 사례는 전체 앱 완성보다 먼저 usable shell을 보여주는 방향.  
  https://slack.engineering/getting-to-slack-faster-with-incremental-boot/

### 9.2 heavy panel on demand

현재 insights는 modal open 후 actions 호출. 좋다. 다음 개선:

- selected insight tab만 load.
- visits live refresh는 visible tab에서만 유지.
- hidden carousel panels는 charts 렌더 비용 줄이기.

## 10. 접근성

체크:

- Button hit area 44~48px.
- WCAG text contrast 4.5:1, UI component contrast 3:1.  
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html  
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Target size 24 CSS px minimum, 실사용은 44~48px.
- Reflow 320px.
- Reduced motion.
- Keyboard trap 없는 modal.
- Private warning은 색만 말고 icon/text 병행.
- Tag colors는 color-only 금지. pattern/shape/label 병행.

## 11. 시선 처리와 눈 피로

### 11.1 왜 별도 축으로 봐야 하나

시선 피로는 “글자가 잘 보이는가”만의 문제가 아니다. 사용자가 한 화면에서 어디를 먼저 봐야 하는지, 같은 정보를 찾기 위해 몇 번 왕복해야 하는지, 색/아이콘/배지/모션이 서로 경쟁하는지가 함께 작동한다.

근거:

- website complexity eye-tracking 연구는 웹사이트 복잡도가 visual attention과 cognitive load에 영향을 준다고 설명한다.  
  https://www.sciencedirect.com/science/article/pii/S0167923614000402
- dashboard layout order eye-tracking 연구는 dashboard interface complexity와 chart grouping/order가 visual processing time과 cognitive load에 영향을 준다고 본다.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11435723/
- 정보 위계가 낮으면 사용자는 더 많은 시선 이동과 재탐색을 하게 된다. mobile feed 연구도 navigation structure와 visual hierarchy가 cognitive load를 줄이는 핵심이라고 본다.  
  https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003307688
- dark mode/light mode는 무조건 한쪽이 우월하지 않다. 환경 밝기, 글자 크기, 대비, 사용자의 시력 상태에 따라 visual fatigue 결과가 달라진다. tablet user 실험 연구는 mode에 따른 즉각적 visual fatigue를 비교했다.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12027292/

### 11.2 VIC에서 피로가 생길 수 있는 지점

- Studio desktop: 좌측 필터, 중앙 달력, 우측 editor, 상단 role/action, private warning이 동시에 경쟁한다.
- Studio mobile: sticky header, agenda legend, event list, bottom month nav, sheet가 겹치면 시선 anchor가 흔들린다.
- Poster decorate: toolbar, sticker palette, selected toolbar, shortcut help, export button이 canvas보다 강하게 보이면 창작 대상보다 도구가 눈을 잡아먹는다.
- Insights: carousel tab, KPI tile, chart, hover tooltip, recent log가 한 패널 안에 많아지면 “어디부터 봐야 하는가”가 흐려진다.
- Tag editor: swatch 수가 많고 색이 강하면 이름보다 색상 그리드가 먼저 튄다.

### 11.3 시선 피로 개선 원칙

1. **한 화면 하나의 시선 중심**
   - Studio: selected date/event가 중심.
   - Viewer: 오늘/다음 방송이 중심.
   - Decorate: canvas가 중심.
   - Insights: 이번 달 핵심 판단 1개가 중심.

2. **시선 왕복 줄이기**
   - event pill을 클릭했을 때 editor title/date가 같은 위치에 즉시 반영되어야 한다.
   - tag filter 선택 결과를 달력과 legend 양쪽에서 동시에 보여준다.
   - insight chart의 legend를 멀리 두지 말고 chart 안/가까이에 둔다.

3. **visual hierarchy 고정**
   - Primary action은 한 개만 강한 색.
   - private warning은 강해야 하지만, private mode가 아닐 때는 화면 중심을 빼앗지 않는다.
   - decorate mode에서는 canvas 외 도구 채도를 낮춘다.

4. **색채 피로 관리**
   - tag color는 충분히 구분하되 saturation이 너무 높은 색을 대량으로 쓰지 않는다.
   - dashboard role/device 색상은 consistent mapping.
   - dark mode를 넣는다면 pure black/pure white 고대비만 쓰지 않는다.

5. **움직임 피로 관리**
   - 반복/무한 animation은 today marker, selected object 등 꼭 필요한 곳만.
   - dashboard chart transition은 panel enter 때 1회만.
   - private warning animation은 최초 reveal 1회, 이후 정적.

### 11.4 구체 개선안

#### Studio desktop

- Calendar center에 시선 anchor를 둔다.
- 상단 action row는 2줄 이상으로 늘어지지 않게 grouping.
- editor panel의 label/value 간격을 좁혀 눈의 좌우 왕복을 줄인다.
- selected event와 editor panel 사이에 matching highlight 색을 쓴다.
- private mode active 때만 red/warn 계열을 강하게 쓴다.

#### Studio mobile

- sticky header에는 월/모드만 남긴다.
- legend는 접을 수 있는 chip rail로 만든다.
- agenda list에서 날짜 column은 고정 폭 유지. 사용자가 매번 날짜 위치를 다시 찾지 않게 한다.
- bottom nav opacity를 낮춰 event content를 가리지 않는다.
- sheet open 시 background calendar는 dim 처리하되 private warning은 보존.

#### Poster/decorate

- canvas 주변 도구는 neutral surface로 낮춘다.
- selected sticker toolbar는 object 근처에 뜨되 canvas 핵심 텍스트를 가리지 않게 collision avoidance.
- shortcut help는 collapsed 기본. 필요할 때 열기.
- safe area overlay는 export preview mode에서만 강하게.
- sticker animation preview는 hover/selected 때만 재생.

#### Insights

- 첫 패널은 “읽는 dashboard”가 아니라 “한눈 summary”.
- chart는 title, current value, delta, action hint를 같은 카드 안에 둔다.
- recent log는 접힘 기본. 필요한 사람만 펼친다.
- developer-only live/system/security는 owner/member 기본 insights와 시각 위계를 다르게 한다.
- 색상 legend는 chart마다 반복하지 말고 고정 legend 또는 inline label.

### 11.5 측정 방법

정식 eye-tracking 장비가 없어도 대체 지표를 만들 수 있다.

- 5초 테스트: 사용자가 5초 안에 “다음 방송/현재 선택 일정/private 상태”를 말할 수 있는가.
- first-click test: 새 일정 생성/비공개 보기/태그 필터/포스터 export의 첫 클릭 위치가 맞는가.
- visual clutter audit: 한 viewport에서 strong color, shadow, animation, badge 수를 센다.
- screenshot grayscale check: 색 없이도 위계가 보이는가.
- mobile thumb path check: 반복 액션이 화면 하단 60%에 있는가.
- reduced-motion screenshot: animation이 꺼져도 상태 이해가 되는가.

## 12. 내가 먼저 추천하는 추가 개선거리

사용자가 말하지 않아도 추천할 만한 항목:

1. **Visual Load Budget**
   - 화면마다 strong color 3종 이하, active animation 2개 이하, primary CTA 1개 이하 같은 budget을 둔다.

2. **Eye Rest Zones**
   - dense dashboard/studio에는 의도적 빈 공간을 둔다. 빈 공간은 낭비가 아니라 scan reset 지점.

3. **Operator Fatigue Mode**
   - 장시간 운영용 low-motion, low-saturation, high-legibility mode. 방송 전후 작업자는 오래 본다.

4. **Private Layer Anxiety Reduction**
   - private mode는 경고-heavy 유지하되, 계속 붉은 경보처럼 보이면 피로하다. active state는 상단 badge + border 정도로 지속시키고, unlock 순간만 강한 경고.

5. **Insight “So What?” Actions**
   - “방문 많은 시간” -> “다음 공지 시간 후보로 복사”
   - “인기 일정” -> “다음 달 비슷한 태그 추천”
   - “쉬는 날 부족” -> “휴식일 후보 표시”

6. **Calendar Reading Modes**
   - Owner planning mode: 조밀, 편집 우선.
   - Viewer comfort mode: 큼직, agenda 우선.
   - Poster inspection mode: export 품질 우선.

7. **Glare-Safe Theme**
   - 밝은 베이지/파스텔이 오래 보면 눈부실 수 있다. off-white background, lower chroma surfaces, stronger text contrast 조합의 장시간 작업 theme를 추가한다.

## 13. 우선순위 로드맵

### Phase 0: 정책/토큰 정리

- 권한 matrix 문서 갱신: edit vs decorate vs operation 분리.
- breakpoint token, motion token, hit-area token 문서화.
- haptics helper와 setting 확정.
- visual load budget 정의.

### Phase 1: 빠른 체감 개선

- 모바일 event card tap/active feedback.
- button hit area audit.
- private unlock success/error feedback 정리.
- dashboard first summary panel 개선.
- insights empty/action states.
- studio/poster/insights 시선 중심 1개씩 정리.

### Phase 2: layout 안정화

- poster export preset 정의: 16:9 유지 + 4:5 추가 설계.
- studio `zoom` 제거 실험.
- container query 후보 도입.
- visual regression viewport matrix 확장.

### Phase 3: decoration tool 강화

- layer list.
- safe area overlay.
- template presets.
- sticker snap lines.
- export QA checklist 자동화.

### Phase 4: advanced interaction

- desktop FLIP reorder.
- mobile long-press reorder 실험.
- progressive public schedule hydrate.
- `.ics` 구독/export.

## 14. 검증 체크리스트

- public API에 private key 없음.
- viewer route에 private field payload 없음.
- KST date/month 계산 유지.
- owner-only editing server check 유지.
- manager/worker operation 권한 문서와 테스트 일치.
- mobile 320/390/430 widths no horizontal overflow.
- 주요 buttons 44px 이상 hit area.
- reduced-motion에서 animation 과잉 없음.
- Android vibration no error, iOS no-op 안전.
- poster export surface nonblank.
- stickers out-of-bounds 경고.
- insight chart 색상만으로 의미 전달하지 않음.
- 5초 테스트에서 다음 방송/선택 일정/private 상태를 설명할 수 있음.
- 한 화면 active animation 과잉 없음.
- grayscale screenshot에서도 primary/secondary hierarchy가 보임.
- 장시간 작업 theme 또는 낮은 채도 mode 후보 정의.

## 15. 레퍼런스

### HCI / Interaction

- Fitts’s Law overview: https://www.interaction-design.org/literature/topics/fitts-law
- Parhi, Karlson, Bederson, mobile touch target study: https://dl.acm.org/doi/10.1145/1152215.1152260
- Leiva et al., Understanding Visual Saliency in Mobile User Interfaces, MobileHCI 2020: https://research.aalto.fi/en/publications/understanding-visual-saliency-in-mobile-user-interfaces/
- Leiva et al., Mobile UI saliency PDF: https://userinterfaces.aalto.fi/mobile-saliency/resources/mobile-saliency.pdf
- Xu, Sugano, Bulling, Spatio-Temporal Modeling and Prediction of Visual Attention in Graphical User Interfaces, CHI 2016: https://www.collaborative-ai.org/publications/xu16_chi/
- Monge Roffarello, Lukoff, Defining and Identifying Attention Capture Damaging Patterns in Digital Interfaces, CHI 2023: https://albertomonge.com/chi28032023/
- Shneiderman direct manipulation: https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf
- Shneiderman visual information seeking mantra: https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf
- Gonzalez, Does Animation in User Interfaces Improve Decision Making?, CHI 1996: https://www.cmu.edu/dietrich/sds/ddmlab/papers/gonzalez1996.pdf
- Harrison et al., Kineticons: Using Iconographic Motion in Graphical User Interface Design, CHI 2011: https://www.futureinterfaces.com/research/2011/kineticons
- Harrison et al., Kineticons PDF: https://chrisharrison.net/projects/kineticons/kineticons.pdf
- Hudson, Stasko, Animation Support in a User Interface Toolkit, UIST 1993 proceedings: https://uist.acm.org/archive/html/proceedings/1993.html
- Website complexity eye-tracking/cognitive load: https://www.sciencedirect.com/science/article/pii/S0167923614000402
- Dashboard layout order eye-tracking: https://pmc.ncbi.nlm.nih.gov/articles/PMC11435723/
- Information hierarchy and mobile cognitive load: https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003307688
- Light/dark mode visual fatigue tablet study: https://pmc.ncbi.nlm.nih.gov/articles/PMC12027292/

### Calendar / CSCW / Privacy

- Palen, Social, Individual and Technological Issues for Groupware Calendar Systems, CHI 1999: https://dl.acm.org/doi/10.1145/302979.303021
- Google Research, An Exploratory Study of Calendar Use, CHI 2004: https://research.google/pubs/an-exploratory-study-of-calendar-use/
- Lee et al., I love you, let's share calendars: calendar sharing as relationship work, CSCW 2012: https://depts.washington.edu/csclab/wordpress/wp-content/uploads/Thayer-Derthick-Bietz-Lee-2012.pdf
- Schaub et al., PriCal: Dynamic Privacy Adaptation of Collaborative Calendar Displays, UbiComp Adjunct 2013: https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/institut/Papers/Prof_Weber/2013-UbiComp-adjunct-prical.pdf

### Visualization / Insights

- Munzner, A Nested Model for Visualization Design and Validation, IEEE TVCG 2009: https://pubmed.ncbi.nlm.nih.gov/19834155/
- Munzner paper PDF: https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Munzner-ANestedModelForVisualizationDesignAndValidation.pdf
- Lam et al., Seven Guiding Scenarios for Information Visualization Evaluation, IEEE TVCG 2012: https://doi.org/10.1109/TVCG.2011.279
- Bateman et al., Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts, CHI 2010: https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Bateman-UsefulJunk.pdf
- Borkin et al., What Makes a Visualization Memorable?, IEEE TVCG 2013: https://visualthinking.psych.northwestern.edu/publications/Borkin_Memorability_2013.pdf
- Borkin et al., Beyond Memorability: Visualization Recognition and Recall, IEEE TVCG 2015: https://vcg.seas.harvard.edu/publications/beyond-memorability-visualization-recognition-and-recall

### Stickers / Personalization

- Cha et al., Complex and Ambiguous: Understanding Sticker Misinterpretations in Instant Messaging, CSCW 2018: https://pure.kaist.ac.kr/en/publications/complex-and-ambiguous-understanding-sticker-misinterpretations-in/
- Cha et al., sticker misinterpretation PDF: https://uxc.khu.ac.kr/file/paper/cscw2018_sticker.pdf
- Griggio, McGrenere, Mackay, Customizations and Expression Breakdowns in Ecosystems of Communication Apps, CSCW 2019: https://vbn.aau.dk/da/publications/customizations-and-expression-breakdowns-in-ecosystems-of-communi/

### Immersion / Fun / Viewer Connectedness

- Pace, A Grounded Theory of the Flow Experiences of Web Users, IJHCS 2004: https://www.sciencedirect.com/science/article/pii/S1071581903001745
- Chen, Flow in Games, Communications of the ACM 2007: https://dl.acm.org/doi/pdf/10.1145/1232743.1232769
- Ryan, Rigby, Przybylski, The Motivational Pull of Video Games: A Self-Determination Theory Approach, Motivation and Emotion 2006: https://pure.ewha.ac.kr/en/publications/the-motivational-pull-of-video-games-a-self-determination-theory-
- Jin, I Feel Present. Therefore, I Experience Flow, Journal of Broadcasting & Electronic Media 2011: https://www.tandfonline.com/doi/abs/10.1080/08838151.2011.546248
- Baños et al., Immersion and Emotion: Their Impact on the Sense of Presence, CyberPsychology & Behavior 2004: https://journals.sagepub.com/doi/10.1089/cpb.2004.7.734
- Hicks et al., The Effects of Juiciness in an Action RPG, Entertainment Computing 2019: https://www.sciencedirect.com/science/article/pii/S1875952118300879
- Designing Game Feel: A Survey: https://arxiv.org/abs/2011.09201
- McLaughlin, Wohn, Predictors of Parasocial Interaction and Relationships in Live Streaming, Convergence 2021: https://journals.sagepub.com/doi/abs/10.1177/13548565211027807
- Live streaming social presence and support willingness, Humanities and Social Sciences Communications 2023: https://www.nature.com/articles/s41599-023-01892-8
- StoryChat: Designing a Narrative-Based Viewer Participation Tool for Live Streaming Chatrooms, 2023: https://arxiv.org/abs/2304.03852
- Aesthetic interaction as fit between interaction attributes and experiential qualities: https://www.sciencedirect.com/science/article/pii/S0732118X16300575
- On the perceptual aesthetics of interactive objects: https://journals.sagepub.com/doi/10.1177/1747021817749228

### CSCW / Role Awareness / Community Operations

- Erickson, Kellogg, Social Translucence: An Approach to Designing Systems that Support Social Processes: https://www.researchgate.net/publication/220286360_Social_Translucence_An_Approach_to_Designing_Systems_that_Support_Social_Processes
- Gutwin, Greenberg, A Descriptive Framework of Workspace Awareness for Real-Time Groupware, CSCW 2002: https://hcitang.org/uploads/Teaching/2002-DescriptiveFramework.JCSCW.pdf
- Dourish, Bellotti, Awareness and Coordination in Shared Workspaces, CSCW 1992: https://hcitang.org/uploads/Teaching/cscw92-awareness.pdf
- Schmidt, Simone, Coordination mechanisms: Towards a conceptual foundation of CSCW systems design, CSCW Journal 1996: https://link.springer.com/article/10.1007/BF00133655
- Clark, Brennan, Grounding in Communication summary/reference: https://acawiki.org/Grounding_in_communication
- Guzdial et al., Recognizing and Supporting Roles in CSCW, CSCW 2000: https://web.eecs.umich.edu/~mjguz/csl/home.cc.gatech.edu/csl/uploads/6/cscw2000.pdf
- Zhu, Zhou, Role-Based Collaboration and Its Kernel Mechanisms, IEEE SMC 2006: https://www.researchgate.net/publication/3421667_Role-based_collaboration_and_its_kernel_mechanisms
- Live Streaming as Co-Performance: Dynamics between Center and Periphery in Theatrical Engagement, CSCW 2019: https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/3/156417/files/2022/11/Live-streaming-as-co-performance-Dynamics-between-center-and-periphery-in-theatrical-engagement.pdf
- StreamFunnel: Facilitating Communication Between a VR Streamer and Many Spectators, 2023: https://arxiv.org/abs/2311.14930
- Wohn, Volunteer Moderators in Twitch Micro Communities, CHI 2019: https://doi.org/10.1145/3290605.3300390
- Cai, Wohn, After Violation But Before Sanction, CSCW 2021: https://doi.org/10.1145/3479554
- StreamSketch: Exploring Multi-Modal Interactions in Creative Live Streams, CSCW 2021: https://experts.illinois.edu/en/publications/streamsketch-exploring-multi-modal-interactions-in-creative-live-/
- VIBES: Exploring Viewer Spatial Interactions as Direct Input for Livestreamed Content, 2025: https://arxiv.org/abs/2504.09016

### Save Reliability / Error Recovery / Warning Fatigue

- Toward Fault-Tolerant User Interfaces, IFAC 1986: https://www.sciencedirect.com/science/article/pii/B9780080348018500246
- Dependability at the User Interface, FTCS 1995: https://ideaexchange.uakron.edu/libresearch_ideas/23/
- Coping with Human Errors Through System Design, International Journal of Man-Machine Studies 1989: https://www.sciencedirect.com/science/article/pii/002073738990014X
- User Strategies in Recovering from Errors in Man-Machine Systems, Safety Science 1999: https://www.sciencedirect.com/science/article/abs/pii/S0925753599000107
- Your Memory Is Working Against You: Warning Habituation, Decision Support Systems 2016: https://www.sciencedirect.com/science/article/pii/S0167923616301592
- The Fog of Warnings: How Non-essential Notifications Blur with Security Warnings, SOUPS 2019: https://www.usenix.org/conference/soups2019/presentation/vance
- Repetition of Computer Security Warnings Results in Differential Repetition Suppression Effects, 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7751389/
- Material Design dialogs: https://m2.material.io/components/dialogs
- Material Design snackbars: https://m2.material.io/go/design-snackbar
- Material Design confirmation and acknowledgement: https://m2.material.io/design/communication/confirmation-acknowledgement.html
- VA.gov Autosave component: https://design.va.gov/components/form/autosave
- FOLIO unsaved changes modal pattern: https://ux.folio.org/docs/guidelines/ux-patterns/using-the-unsaved-changes-modal/
- Agriculture Design System warn before leaving pattern: https://design-system.agriculture.gov.au/patterns/warn-before-leaving
- Baymard, Form Usability: Validations vs Warnings: https://baymard.com/blog/validations-vs-warnings
- Baymard, Avoid Apply Buttons / saving confirmation nuance: https://baymard.com/blog/checkout-usability-apply-buttons

### Mobile / Design Systems

- Material touch targets: https://m3.material.io/foundations/layout/applying-layout/touch-targets
- Material buttons: https://m3.material.io/components/buttons/guidelines
- Material bottom sheets: https://m3.material.io/components/bottom-sheets/overview
- Material motion: https://m3.material.io/styles/motion/overview
- Apple buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple haptics: https://developer.apple.com/design/human-interface-guidelines/playing-haptics

### Accessibility

- WCAG target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG contrast minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG non-text contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- WCAG animation from interactions: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

### Layout / Web Platform

- MDN CSS container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries
- MDN aspect-ratio: https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
- MDN object-fit: https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit
- MDN responsive images: https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images
- MDN Vibration API: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- Can I Use vibration: https://caniuse.com/mdn-api_navigator_vibrate

### Calendar / Product Benchmarks

- Twitch schedule API: https://dev.twitch.tv/docs/api/schedule
- Luma calendar overview: https://help.luma.com/p/helpart-hJI2JawEcFaH6he/luma-calendar-overview
- Google Calendar appointment schedules: https://support.google.com/calendar/answer/11608416
- Slack incremental boot: https://slack.engineering/getting-to-slack-faster-with-incremental-boot/
- Canva performance/design guidance: https://www.canva.dev/docs/apps/design-guidelines/performance/
