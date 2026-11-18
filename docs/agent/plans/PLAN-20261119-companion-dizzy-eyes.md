# 헤롱헤롱 눈 교정 — 2026-11-19

직접 사용자 원문: “빅타민 헤롱헤롱 모습 이상해. 눈 모습 수정해줘 다시”. 눈만 교정하고 승인된 쓰담(.76), 일반 눈·입·귀·모자·몸과 폼폼 동작은 보존한다. 최신 사용자 원문 “좋아, 이대로 커밋하고 푸시해서 배포까지 해줘.”로 실제 전후 시안 및 commit/main 정상 push/Cloudflare 출시가 승인됐다. 이전 피드백 대기 문장은 이 승인으로 대체한다.

현재판과 immutable 원본 physical336/344를 실제 열어 대조했다. 현재 procedural spiral은1.3회전의 열린 C형이고,336의 오른눈 landmark는 원래 바깥 고리가 아닌 작은 안쪽 고리만 포함한다.344의 기존 입 제거 corridor도 오른눈 일부와 겹친다. 외곽 원화의 동그란 빙글눈을 보존하는 편이 원래 설계와 일치한다.

기존 공통 native bake에서 spiral16셀의 양눈 영역을 같은 원본·같은 포즈 RGBA로 복원한다. 원본은 읽기 전용이고 새 AI 그림을 생성하지 않는다. 측정된 외곽 고리+AA2px의 두 좁은 영역만 사용하며 mouth 제거 뒤 적용해 눈이 잘리지 않게 한다. 기존 canonical 입은 눈 영역 밖에서 그대로 유지한다. 기존 pipeline의 prepare/bake/pack 한 번으로 배포 파생만 만들고 다른504셀과 눈 밖 RGB/전체alpha를 비교한다.

서버/DTO/권한/RLS/KST/DB/의존성 변경 없음. G22는 기존 자율 표정의 그림 교정이며 사람 target·이름·활동기록/최소사용집계와 수집 의미 불변. viewer/studio/preview/옷장/초원은 같은 packet/renderer를 소비한다. 감소동작·타이밍·입력·decoder3/inflight2는 불변이다.

검증: source SHA/동일포즈/눈만 변경 단위와 실제 bake 전후, 타입/lint/단위/build/harness, production fixture의 실제 옷장 dizzy 재생·쓰담 회귀. 같은 화면/크기/테마 origin/main f88f6d3d와 변경 후의 before/after PNG를 `.scratch-pw/dizzy-eyes/runs/20261119-dizzy-eyes/`에 짝으로 둔다. 실제 전후 시안은 사용자 승인을 받았다. 실제 기기/로그인RLS/자연생활36은 주장하지 않는다.

## 구현·기술 확인

공통 painter의 native spiral 분기에서 재작도 대신 원본 양눈 영역을 입 복구 뒤 보존한다. `spiral-eyes.ts`의 좁은 source 창은 원본의 실제 바깥 고리를 확인해336..343/344..351에 각각 적용했다. pipeline `build --scope=eyes` 한 번으로515 native 얼굴을 기존 방식으로 도출하고33패킷을 재검증했다. 내용이 달라진 것은21번 패킷1개뿐이다. 원본33개 SHA와 모든 frame metadata/geometry 유지, 다른504프레임 유지,16셀의 눈 밖 RGB/전체alpha 변경0. 두 눈은 같은 native Canvas RGBA와 완전히 같다. 디스크의 WebP RGB 자체는 alpha253의 Canvas premultiply/unpremultiply 때문에1단계 반올림이 있을 수 있어 이를 무손실 원본 byte 인증으로 표현하지 않는다.

추가 unit2건 포함 전체7,265PASS/1SKIP/실패0(`unit-verified.json`), 타입/lint exit0. 첫 npm 실행은 Windows 인수 전달이 적용되지 않아 제한 없는 worker 경합에서 기존 검사3건이5초 timeout이었다. 소스/기존 기준을 바꾸지 않고 직접 Vitest `--maxWorkers=2 --testTimeout=30000`으로 재실행했다. 최초 로그도 보존한다. 첫 raw Pillow 대조의10,503 RGB 차이는 위 Canvas 경계 반올림이었고, 같은 Canvas 경계로 확인한 RGBA 차이는0이다. 참고 Canvas 추출 첫 시도는 로컬 source.test의 CORS 선언 누락으로 실패했고, 정확한 합성 source 응답에만 선언을 추가했다. 제품 네트워크/guard 변경은 없다.

실제 shared renderer로 before/after 각각16프레임×맨몸/왕관×양방향64조합을 확인했다. `runs/20261119-dizzy-eyes/`의 `before-DIZZY.png`/`after-DIZZY.png`는 같은1000×740 화면·CSS·포즈이며 before asset/module은 기준 fullSHA를 고정했다. 기울어진/정면·맨몸/왕관4그림을 직접 확인했다. 제어된 모자 준비 검사이며 production React 입력/실제 decoder 준비는 별도 실물 증거로 남긴다. 사용자 시각 승인을 대신하지 않는다.

## 로컬 시안 결과

`build.log` production build/내장 타입·lint exit0. `live.json`은9PASS/실패0/재시도0: 실제 시청자·편집실·미리보기 옷장의 맨몸/왕관 헤롱 재생6, 기존 Enter쓰담melt3. 실제 응답의 수정21번 패킷 SHA 일치와 준비된 실제 그림·왕관 합성을 확인했다. 합성 초기 로컬 설정/care·실제 React 입력이며 모든 쓰기/live API는 차단했다. 네트워크 exact GET CSS/법적 문서 RSC 허용은 기존 QA 격리를 유지한다. pageerror/미확인 요청/쓰기/live API0. 서버·권한 검증을 수행한 것으로 확대하지 않는다.

문서 harness 최초는 새 시작 행 때문에 brief8301/8192, 축약 후8214/8192로 실패했다. 기존 다른 작업의 행을 건드리지 않고 이번 새 행만 짧게 만들어 최종8188bytes/452문서 PASS. 관련 memory18PASS. 실패 로그도 보존한다. 같은 주제 결과를 시작 문서에 길게 중복하지 않는다. 이 단락까지는 승인 전 로컬 검사 결과이며 임시 서버는 종료했다. 이후 최신 사용자 출시 승인으로 다음 단계를 진행한다.

## 승인·독립 통합 검수·출시 기록

2026-11-19 KST, 사용자 전후 시안 승인과 출시 요청을 확인했다. 새 수행 컨텍스트가 실제 diff/새 helper/test·기존 material 변환·원본 복원 순서와 전후 그림을 독립 검수했다. 역할/공개·비공개 경계/KST/UX/QA/G22 지적0. 서버·권한·날짜·입력·활동 수집은 변경하지 않았다. `final-proof.json`의9파일 SHA를 실제 다시 계산해 모두 일치했다. 제품 파일 해시 불변이므로 위 전체 검사·실물9건을 같은 소스에 한정해 승계한다. 승인 후 문서 변경은 harness와 관련 memory 검사로 확인한다.

로컬 출시 증거는 원프로젝트 ignored `.scratch-pw/companion-dizzy-eyes-release-20261119/dizzy-eyes/release/`에 보존한다. `authorization.json`/`independent-review.json`/`release-result.json`은 각각 승인·독립 검수·실제 SHA/배포 결과를 구분한다. GitHub 연결 Workers Builds만 사용하며 로컬 cf:deploy는 금지한다. 새 커밋의 빌드/100%버전/운영 JS fullSHA/21번 패킷 SHA와 실제 익명 옷장·쓰담을 확인한 뒤 출시 결과를 남긴다. 이 문서 작성 시점에는 배포 성공을 선행 주장하지 않는다. 실제 기기/로그인RLS/자연생활36은 여전히 미검증이다. QA는 기존14일·용량 보존 정책을 적용하고 no-follow 전후 inventory 확인 후 clean worktree만 정리한다.
