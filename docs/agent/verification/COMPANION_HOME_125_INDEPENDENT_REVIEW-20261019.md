# 125 — 독립 역할·경계·UX·소스 검토

2026-10-19 KST. **검토 범위의 미해결 P1/P2:0건.** 아래 소스 검토와 기술적 파일 대조만의 결론이며, 릴리스·실물 물리·전문 미술 PASS가 아니다.

## 독립성과 범위

root와 행동 담당자가 작성한125 변경을 비작성자가 읽었다. 커튼의 pure resolver/공유 환경/renderer 연결,24종 카탈로그·셔플백·그림 크기·입력 프레임·상자 반납 피드백, 음식 폐기 표시 변경, root의 가구 크기/출구/책 표지/창 가로대 변경을 대상으로 했다. 기존124 기반의 전면 재검증이나 이 검토자가 작성한125 메타데이터·global404의 독립 판정을 주장하지 않는다. 기존 취향 저장소 자체도 이번 독립 판정에서 제외하고 새 호출부·종류 확장만 확인했다.

## 역할·개인정보·KST·G-22

- 새 커튼·장난감 경로는 로컬 표현/모델이다. 서버 권한, 공개 DTO, Google/패스코드, 세션 결속이나 private loader를 변경하는 경로는 확인되지 않았다. 이것은 실제 로그인·RLS·전체 서비스 보안 감사가 아니다.
- 커튼은 기존 공유 환경의 viewed season/weather/solar band를 사용한다. `sun.alt`는 실제 도 단위이고 밝기는0–4로 양자화된다. 새 시계·주기·API·저장소·RNG를 만들지 않는다. 실제 집 발판+접지+sleep 허용과 휴식 상태가 있어야 닫히며, 낮은 에너지/성격/밤만으로 수면을 만들지 않는다.
- 자동 커튼·셔플·자율 장난감 경험을 사람의 사용으로 기록하지 않는다. 새 장난감 종류는 로컬 취향·발견 경로에 머물고 기존 G-22 고정 category/inspect/action target을 사용한다. 종류/instance ID를 분석 메타데이터에 추가하는 호출은 확인되지 않았다. 실제 꺼내기/놀이/정리 완료의 경험 연결과 미발견·unread 경계를 보존한다.

## 표현·입력·작업량

- 커튼 reducer는 같은 의미 상태에서 같은 객체를 반환한다. 기존 paint/context 경로에서만 React로 거친 상태를 발행한다. 숨김·차단 시 정지하고 재개 시 상태를 재생하지 않으며 reduced/off/soft에서 이동 transition을 제거한다. 두51% 패널과 불투명 backing은 닫힘 상태에서 유리를 덮고, pointer-free 장식층은 새로운 발판/장애물/컨트롤이 아니다.
- 창 가로대는 weather 위, 커튼 아래에 있다. 책 표지는 기존8×2 atlas의 전체 중립 셀을 정사각 표시하며 원본 표정을 새로 그리지 않는다. 방은 보통200px, 기존≤250 구조 예외226px이다. 커진 가구 공간을 반영한 창은282px 방에서112px, 넓은 방에서 최대152px인 현재 root 의도를 확인했다. 이전138px compact 폭 유지라고 표현하지 않는다.
-24종은 기존8 ID를 보존하고 추가16종을 붙인다. 성공한 spawn만 셔플백을 소비하고24종을 소진하기 전 반복하지 않는다. 한 번의 리필은 유한23회 RNG이며 실패 spawn은 소모하지 않는다. 실제 물체 최대4개, 물리 serial, 첫 swept contact,48px pickup 및 기존 carry/return 경계를 넓히지 않는다.
- 종별18–42px 그림은 기존44px native 버튼의 하단 접점에 표시된다. 물리 버튼의 `transition:none`과 현재 좌표 paint는 유지하며 hover는 자식 그림만 바꾼다. 캡처된 실제 pointer와 최종 반납은 동일한 상자±8px 판정을 쓴다. 입력 측정은 기존 최신-input 프레임에 합쳐지고 pause/취소/종료/키보드 전환에서 잔여 표시를 정리한다.
- 쓰레기통은 기존 `data-food-over`를 공통 hover/quiet brightness에 연결한다. progress bar와 매 프레임 progress style 쓰기만 제거했으며320ms dwell·180ms discard·실제 제거 callback·취소 경계는 유지한다. 상자/음식통/쓰레기통의 root hit와 출구는 자식 hover transform 밖에 있다.
- 새 무한 timer/observer/전체 DOM scan이나 숨김 상태의 작업 증가 경로는 확인되지 않았다. 실제 OBS·CPU·GPU·메모리 측정은 하지 않았다.

## 발견한 P2와 root 수정 확인

초기 최종안의282px/zoom1에서 음식통 hit는x124–180/y64–120, 소파 hit는x5–143.18/y117–195였다. **19.18×3px 중첩**을 보고했다. 음식통 전체를3px 올리면 새 출구의 floor 높이 차가91.875→94.875px가 되어 기존92px 범위를 넘으므로 그 안은 철회했다.

root는 `--vc-feed-hit-lift = max(0px,83px−80px/zoom)`을 도입했다. 버튼은 lift만큼 위로, 그림의 bottom과 slot의 bottom은 같은 양 아래로 보정한다. 이후 소스를 다시 읽어 다음을 확인했다.

| shell zoom | hit lift(CSS px) | 그림·출구 화면 좌표 변화 | floor→출구 높이 차(native px) |
|---|---:|---:|---:|
|0.8|0|0|89.5|
|0.9|0|0|90.6875|
|1|3|0|91.875|

zoom1 음식통 hit bottom은117이 되어 소파 hit top117과 닿고 중첩하지 않는다. `.vc-dispenser-paint`와 slot의 보정이 상쇄되어 실제 그림/출구 좌표는 바뀌지 않는다.≤250 분기도 다른 bottom override를 제거해 같은 식을 쓴다. 이 표는 소스 수식 결과이며 actual DOM 측정이 아니다.

음식통256² 원본의 출구(131,168)는52px contain scale에서x offset0.609375px, button-bottom 기준17.875px 중심과 일치한다. 상자256×134의(128,52)는82/110px 두 그림 폭에 같은 비율과3px baseline을 적용한다. 쓰레기통82×74 그림의 alpha≥32 경계는66×64 hit에 들어가며 낮은 알파의 그림자를 실제 상호작용 면으로 인증하지 않았다. 소파 디자인·실제 좌석 span·전역 body/pick 크기를 바꾸는 수정은 없다.

기존124 native의 equal-alpha-mass 기대를 현재 storage hierarchy와 새 출구 좌표로 교체한 범위도 읽었다.44px, 실제 edge hit, 모든 control pair 비중첩, 그림 alpha/glass, 실제 소파/귀가 검사는 남아 있다. 이 검사들을 실행해 통과했다고 주장하지 않는다.

### 후속 native가 발견한 쓰레기통 P2

root의 후속 native는82×74px 쓰레기통 이미지가64px 버튼의 implicit grid track을74px로 확장해 그림을 아래/옆으로 밀고 바닥에서 자르는 결함을 발견했다. 보존된 `.scratch-pw/companion-125/layout/`의 build `EvOPphFWc5NQdeAbl6tL_` JSON4개를 독립 열람했다. alpha visible bottom이 hit bottom보다 viewer1440/1100에서9.9844px, studio1920에서8.9769px, studio2400에서7.9851px 아래였다. 이전의 alpha 경계 정적 계산은 의도한 그림 등록식만 보았으며 이 실제 grid track 확장을 포착하지 못했다.

root는 해당 이미지 한 selector를 `position:absolute;left:50%;margin-left:-41px;bottom:-9.2px;width:82px;height:74px`로 바꿨다. 비작성자가 현재 CSS를 읽어 이미지가 grid track 기여에서 빠지고 canvas가 버튼 중심에 고정됨을 확인했다. 부모 hit의 위치/크기, 그림 크기·원본, 음식 drop target, 소파·급식/상자 출구, hover/quiet 상태와 JavaScript 경로는 바꾸지 않는다.

원본256×229의 실제 alpha≥32 bbox는 exclusive 좌표 `[57,24,203,199]`다. 기존 contain/bottom 정렬을 함께 적용하면 이 영역의 하단은 hit bottom보다0.4094CSSpx 안쪽이다. alpha1–31의 약한 그림자는 최대0.2313CSSpx 아래일 수 있으나 room bottom보다5.7688CSSpx 위다. 이 수식 검토에서 새 P1/P2는0건이며, 새 build에서 실제 alpha/hit·floor clipping·hover·quiet·contacts를 재확인하는 것은 root의 별도 native 대기 항목이다. 과거 실패 증거를 수정본의 실물 PASS로 대체하지 않는다.

이 추가 보정 후 CSS SHA는 `affa5af62d482896a6f76fac326448fc87db5339dfaa5dca62ae8dd6e089c08f`다. 아래 source 표의 이전 SHA는 앞선 feed-hit 검토 시점의 역사적 식별자로 유지한다.

### 후속 native가 발견한 넓은 상자 P2

root는 다음 build `V17KkqFYrTRTOGKeoN6S2`에서 쓰레기통4 layout의 alpha/hit와 커튼4 cases 통과를 보고했다. 같은 실행의 넓은 상자는 static opening의 source y52가 그림의 y48.37093(studio1920),48.95455(studio2400)에 놓였다. 비작성자가 `.scratch-pw/companion-125/layout-final/` JSON을 읽고 해당 역투영 값과 viewer 두 경우의 y52를 대조했다. 이 역시 grid track 결함이다. 넓은110px 그림의 높이57.578125CSSpx가56px hit(.8에서는56.25px)를 넘지만 static opening은 고정 hit 기준이어서 서로 다른 y를 사용했다.

root는 상자 그림도 absolute로 바꾸고 `left:50%;margin-left:calc(var(--vc-toy-paint-width)/-2);bottom:-3px`로 등록했다. width/height, 버튼 hit, static opening, 모델과 carry JavaScript는 그대로다. 현재 식에서 그림의 source(128,52)와 실제 opening의 중심은 모두 hit bottom 기준 `paintWidth×82/256−3`이다.82px 그림은23.265625CSSpx,110px 그림은32.234375CSSpx로 정확히 같고 shell zoom과 무관하게 같은 변환을 받는다. 보정은 implicit track 기여를 제거할 뿐 새 물리 범위를 만들지 않는다.

집 CSS/TSX의 다른 grid 자식도 좁게 감사했다. 라디오53×40은 hit 폭53이상/높이48이상 안에, 책42²는 hit 폭45이상/높이48이상 안에, 닫기 SVG15²는44이상 hit 안에 있다. unread17px는 absolute다. 소파 SVG·음식통 paint/slot·상자 paint/opening·쓰레기통 paint와 창/커튼 그림은 absolute로 배치돼 같은 in-flow oversized grid 조건에 해당하지 않는다. 이 범위에서 남은 같은 원인의 소스 P1/P2는0건이다. 전역 CSS·다른 feature의 모든 grid를 감사했다는 뜻은 아니며 최종 그림/출구·귀가·실제4개 반납·hover/quiet native는 다음 root build에서 재검증 대기다.

상자 보정 후 CSS SHA는 `8de3fd1926c8b9012e4936002244ca82a89549895e8800fac11349839a0eab8d`다. 두 native 실패 JSON과 앞선 source SHA를 그대로 보존하며 이 소스 검토를 실물 통과로 쓰지 않는다.

## 집 아트 공개 파일 대조

`.scratch-pw/companion-125/home-art-stage-safe.json`의66개 allowlist를 대조했다: 원본21PNG + 정리본/접촉표22PNG + runtime21WebP + 공개 기록2개. 카탈로그 경로 집합과 정확히 일치한다.

- 원본/파생본/runtime/접촉표와 반복 참조를 합한 **104개 SHA 기록 일치**, 이미지 **64개 크기 일치**. 고정입력은40회 참조/고유10파일이며 실제 존재·SHA 일치,66개 stage 집합에는 포함되지 않는다.
- runtime 합계 **372,994bytes**, 공개 기록과 일치. 원본21개의 C2PA `caBX`는 허용된 생성 출처로 보존된다. 정리본/접촉표 PNG에는 추가 metadata chunk가 없고 runtime WebP에는 EXIF/XMP가 없다. 압축 픽셀 바이트의 우연한 문자열을 경로 노출로 분류하지 않고 실제 metadata chunk의 문자열을 구분했다.
- 공개 JSON/MD와 원본 provenance에서 점검한 절대 로컬 경로·사용자 로컬 식별·자격정보·session/thread/conversation 필드의 노출은 발견되지 않았다. 이 제한된 정적 점검이 모든 비밀/개인정보의 부재나 과거 사고 부재를 증명하지 않는다.
- 모든 자산의 `user_visual_approval`은false다. 작성자의 관찰을 전문 미술 승인으로 바꾸지 않는다. 생성/재호출 횟수는 receipt 내용이며 이 lane에서 provider 호출 이력을 독립 재계수하지 않았다.24종 장난감의 별도 아트 manifest는 이66개 검토에 포함되지 않는다.
- 보호 원문 `art-src/최초공개/응원단/제작기록.md` SHA는 `e980005102457e2a02ae318ff7665596e7170d0bfb34a328f64a6ec292c5990b`로 유지됐다.

대조한 home manifest SHA: `db58bd8d698476881516b99239fa5872bacade6c84a657d8d895c951557383a5`. 공개 JSON SHA: `cbab43b25ce2b25238adb37518454f806df4d764bab841d558ea89feadb20afc`.

## 장난감24종 공개 파일 추가 대조

같은 날 별도 회차 `20261019-밝은장난감24종125/제작기록/공개자료/명시적스테이지목록.json`의 최종79개를 읽었다. 정확한 집합은 원본24PNG + 여백정규화2 정리본24PNG + runtime24WebP + 비교표2PNG + 명시된 참고2PNG + 공개 JSON3개다. 중복·누락·상위 경로 탈출·절대 stage 경로가 없고 전부 실제 존재한다. 개별 작업 영수증, raw feedback, 로컬 계약과 정규화 전 파생본은 이 목록 밖에 있다.

- 이미지76개의 SHA가 공개 기록과 일치한다. 자산72개의 기록된 크기·RGBA 모드/alpha와 비교표2개의1320×800 크기도 일치한다. 참고2개는1152×512와256×164이며 생성 명세의 SHA와 일치한다. 원본23,290,239B, 정리본747,940B, runtime540,534B 합계가 납품 명세와 일치한다.
- 현행 카탈로그 SHA `365063bd7574fda3d3ee150ab8bc77d0a57df334cfb05fec8858a9ec7e433215`의24 ID와 납품/생성 명세의24 ID·순서·runtime 경로가 같다. 정정 후24개의 `world_display`는 실제18–42px width/height 안의 `object-fit:contain` 계산과 일치한다. 예전 `suggested_display_long_edge`는 역사적 제안값이며 live 표시 크기로 쓰지 않는다. 정정 스크립트는 비교표와 공개 기록만 바꾸며72개 아트 바이트를 다시 생성하는 경로가 없다. 비교표의 raster는 최종 크기를1px 단위로 반올림한다.
-24개 모두 원본의 alpha≥32 bbox와6% long-edge padding/이미지 경계 clip 식이 기록과 같다. crop 밖 alpha≥32 픽셀은0개이고 alpha1–31은 합계10,164개다. 따라서 전체 원본 alpha가 보존됐다는 뜻은 아니다. 원본→직사각 crop→long-edge192px Lanczos의 순수 재현 결과24개가 정리본 decoded RGBA와 정확히 같고, 정리본↔lossless WebP도24개 전부 RGBA가 정확히 같다. 명세의 `runtime_core_bbox`는 alpha≥250 bbox이며24개 모두 일치한다. 이 기술적 core 보존은 미술적 형태·품질 승인과 다르다.
- 원본24PNG의 C2PA `caBX`만 provenance로 남으며 정리본/비교표/참고28PNG에는 추가 metadata chunk가 없다.24WebP는 `VP8L`이며 EXIF/XMP가 없다. 공개 JSON과 실제 metadata 문자열에서 로컬 절대 경로·사용자 로컬 식별·자격정보·명시적 session/thread/conversation 필드·개인 이메일 후보는 발견되지 않았다. 생성 명세의 generic 제작 지시는 공개 대상이며 사용자 원문 피드백을 이 공개 기록으로 옮긴 증거는 없다. 압축 픽셀 바이트를 개인정보 문자열로 오인하지 않았다.
- `owner_visual_approval:false`, `independent_art_reviews:0`을 유지한다.24회 생성·자동 재시도0은 공개 receipt의 주장으로, 이 검토자가 provider 호출을 재계수하거나 전문 미술 승인을 한 것은 아니다. 보호 원문 SHA도 위의 `e9800051…5990b` 그대로다.

초기 열람 중 납품명세와 stage의 연결 SHA가 서로 다른 순간이 있었지만, 제작 담당자의 시트 정정 완료 후 다시 읽은 최종본에서는 모두 일치했다. 다음 값에 한정해 **새 미해결 P1/P2:0건**이다.

| 최종 기록 | SHA-256 |
|---|---|
|명시적스테이지목록.json|80ab7a7b804838392bb7599afb31c4de5a717bafe82ccb81b9b5b0d296f8bfc7|
|납품명세.json|caf168f5017f86bd8830bbe51af44bc118bc316f9c20f41cb8121af7deb954c0|
|생성명세.json|4ea37cb20803bd0828707f21622d44f5438d906167b076140bc6639b8650632b|
|밝은 배경 비교표|c79c21633bf00d072f590a8dcde941074b971f9134fefd5f01159dc665ed5655|
|어두운 배경 비교표|3c0fd7c6904469bea7dc1bcb98c4479ad2d882faeb6eb22b42e7dad2c8a8d848|

비교표를 전문 미술 검수하거나 실제 world 크기의 DOM/native를 실행하지 않았다. 이 추가 검토는 공개 stage·계보·기술적 crop/RGBA·카탈로그 연결에만 한정한다.

최종 stage 후처리에서 `.gitattributes`의125 home 루트 JSON과125 toy 공개자료 JSON에만 기존 byte-pinned 정책의 `-text whitespace=cr-at-eol` 두 규칙을 추가한 범위를 읽었고,194개 stage 목록 중 해당 JSON4개의 workspace↔index 원시 바이트·SHA가 모두 같음을 독립 대조했다. 이는 CRLF 정규화로 receipt 해시가 바뀌는 것을 막는 보존 처리이며, 전역 정규화나 아트·제품 코드를 바꾸지 않는다.

## 소스 식별과 미검증

해결 확인 시 핵심 소스 SHA-256:

| 파일 | SHA-256 |
|---|---|
|companion-home.css|d5f431acdadd3642fdcd6c3094a1475e8ff04251c3d2998431291fc0742bf495|
|companion-home.tsx|b97fddb97e783eeb9bc3332986159de77730c43f864a1c72aadb31b172ecf9df|
|viewer-companion.tsx|f6ba8526d9da7549f8a2a882e716a3d44c3f0c84f175b8ace7c398524296b3a8|
|home-curtain.ts|c71e6a264f8649b7a4e046af0ae83e00494ebe486770c3f810315bfefdeb0ee9|
|home-environment.ts|89729ff9605919ea279d8b6b69b4c6d0540bafc042d82ee945680d84dcad2140|
|toy-catalog.ts|365063bd7574fda3d3ee150ab8bc77d0a57df334cfb05fec8858a9ec7e433215|
|toys.ts|01b319e678ac3b1898bc1988d070e5a666ecb2d5b495f08039bb8c896e364c8f|
|companion-toys.tsx|a58ea8b76544d597a67fd17082af202aff2efef4ad32362a76ce13f17897334a|
|companion-food.tsx|b93cd56a0430657c7c280f08cd082ed003d1584d2752772d1aa300497dcfd281|

빌드·제품 검사·브라우저/native·운영/API·커밋을 실행하지 않았다. 이 lane의 변경은 이 검토 문서뿐이다. 실제 shared viewer/studio/quiet/가구 hit·귀가·급식·4개 반납과 최종 배포/제공자 사용량 검증은 root의 다음 build/native/운영 확인을 기다린다.≤250은 기존에 실제 접근 경로가 확인되지 않은 source-only 방어 분기이므로 실물 통과로 쓰지 않는다.
