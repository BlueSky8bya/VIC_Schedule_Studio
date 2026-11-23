# 커튼·전등 조작 도약 비율 · 2026-11-23 KST

상태: 사용자 시각 채택·로컬 반영 완료. 2026-11-23 현재 채팅에서 전후 비교를 본 사용자가 “오 그렇게 하자”로 커튼·전등 도약의 세로1.06/가로1÷1.06 교정을 채택했다. 승인된 비교 이미지 SHA는 `verification.json`의 `visualAcceptance`에 고정한다. 일반 점프 교정은 사용자 반려 후 복구했다. 커밋·통합·push·배포는 수행하지 않았다. 기준은 `origin/main`의 `a1afaec44140844468e1f74e5ef2ef05863f0528`, 브랜치는 `codex/jump-proportions-current`다.

후속 사용자 “배포 해”(2026-11-23)로 이 교정의 commit/main push/Cloudflare 출시를 승인했다. 비작성 독립 검수는 코드·실물 비교·현재 빌드와 native proof SHA·접촉 투영·quiet/역할/경계/KST/G22를 확인해 지적 없음으로 마쳤다. [검수 기록](../../../runs/20261123-cord-proportions/independent-review.md). 실제 배포는 GitHub 연결 Workers Builds만 사용하며 로컬 `.env.local` 기반 deploy는 하지 않는다. 이 문서는 출시 커밋 전 상태이며, 실제 commit/version/운영 응답 확인은 `C:/Projects/context-hub/out/vic/20261123-cord-proportions-release/receipt.json`에 별도 보존한다.

## 재현과 판단

최초 첨부의 웃는 포즈와 실제 커튼·전등 조작 도약을 비교했다. 이 도약은 일반 점프 행3~6 대신 행복 상호작용 행9를 사용한다. 실제 최종 layered canvas, source sprite, expression canvas, pose/inertia/contact/reaction 행렬을 함께 기록했다. 원본 접촉 중 바깥 네 변형은 모두 중립이며 pompom은 기존의 음수 최대6%~0 제한 안이었다. 추가 런타임 가로 압축이라는 근거는 없다. 낮게 기운 귀와 넓게 보이는 행복 원화의 실루엣 차이를 국소 보정하는 후보다. 숫자가 원본 체형 일치를 증명하거나 사용자 시각 승인을 대신하지 않는다.

`viewer-companion.tsx`의 기존 `cordContact` 분기에서만 세로1.06·가로1/1.06을 적용한다. 기존 면적 보존 strain 예산·실측 접촉 projection을 그대로 사용한다. 원화/귀/표정·일반 점프·다른 행9 용도(쓰담·세면 등)·물리 행동 시간은 변경하지 않는다. 새 그림·패킷 생성과 전체 원화 평준화는 없다.

## 실물 증거

[전후 보고서](../../../runs/20261123-cord-proportions/index.html)의 C01=커튼, C02=전등. 같은1494×1100·DPR1·밝은 테마·0시 공개 fixture의 실제 화면이다. `before-C01/C02.png`, `after-C01/C02.png`는 전체 화면이며 `-detail.png`는 실제 방 영역이다. 보고서 확대는 그 옆 이미지의 CSS 확대이며 원본 pixels를 새로 그리지 않는다. 같은 행9의 안정된 공중 구간을 촬영했고 원본과 후보의 현재 pose/변형은 `*-frame.json`에 보존한다. 접촉 판단은 이 촬영용 RAF 정지와 별도로, 정지 없는 native fixture로 검증한다.

TCP listen 없이 production Next handler와 Playwright route를 메모리로 연결했다. 기존 native spec은 임시 esbuild 사본에서 같은 assertions를 실행하며 독립 Node handler를 IPC로 호출한다. `/api`와 쓰기는 기존 fixture 차단/가짜 응답을 따른다. 새 헤더의 `getUnseenReportCountAction`만 정확한 manifest ID로 식별해0건으로 응답한다. 실제 auth·보고서·DB 작업은 호출하지 않는다. 이 stub 누락 때문에 최초 studio/preview7건은 종료 요청 감사에서 실패했고 보존 후 재검사했다.

## 검증과 경계

최종 검사와 파일 SHA는 [verification.json](../../../runs/20261123-cord-proportions/verification.json)을 따른다. 원래 전체 단위검사에는 소스 감사1건의5초 timeout이 있었으며 worker2 재실행 결과와 구분한다. 기존 문서 harness의 baseline 실패도 새 PASS로 표시하지 않는다.

- typecheck/lint/build exit0. 전체 단위486파일·7,434 PASS/1skip. 문서 규칙 단위25 PASS.
- Native11 PASS: 커튼 viewer/studio/preview ×3폭의9건, 전등 viewer/studio의2건. 실제 opaque 접촉·방 경계·상태 변경 후 수면 복귀와 후속 돌봄을 검증했다. studio/preview7건은 정확한 제보함 읽기 stub 추가 후 통과했으며 viewer4건은 같은 빌드의 최초 PASS다.
- soft/OFF/감소 동작3경우는 각각 실제 수면 입력으로 복귀하며 pompom0프레임. soft는 전등 접촉을 관찰했고 OFF/감소는 기존의 조용한 직접 복귀 경로였다.
- harness exit1: 원본에서도 동일한 RULE_MIGRATION 목록 불일치2건. 제품/기타 문서 검사를 전체 PASS로 표시하지 않는다.

공유 viewer/studio/preview 표현 한 분기만 변경했다. 서버·공개DTO·역할·언락·KST·DB·저장 순서는 변경하지 않는다. G-22: 제어/target/label/분석 metadata 변경 없음. 자율 도약은 사람 행동으로 새로 기록하지 않는다. 비작성 독립G-21 검수 완료. 실제 로그인·OBS/기기는 미실행이며 운영 배포 확인은 위 출시 영수증으로 구분한다.
