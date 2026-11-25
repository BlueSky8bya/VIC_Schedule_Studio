# 빅타민 로컬 개인화 — 검증 기록

2026-11-26 KST. 기준 `742de77bd02792b2d702047fb71263c1908f76e8`(작업 시작 당시 origin/main). 브랜치 `codex/companion-local-personalization`. 커밋·통합·푸시·배포 전.

사용자 입력 → 기존 ViewerCompanion 교감 완료 → 제한된 개성 수치 → 브라우저 저장소 → 기존 행동 후보의 제한된 보정. 새 서버 학습·업로드·계정 연결·동의창 없음. 설정 version 1, care version 3, 도감·선물 보존.

## 확인한 범위

| 확인 | 결과·근거 |
|---|---|
| 타입·lint | 최종 검사 통과. `.scratch-pw/local-personalization/{typecheck-final,lint-final}.log` |
| 생산 빌드 | fixture 환경의 최종 Next 생산 빌드 완료. `build-final.log` |
| 전체 단위 | 최종 489파일, 7,482건 전부 통과(112.86초). `unit-release-candidate.log`; 앞선 행동 구현 검사는 `unit-bounded.log`의 7,481통과·1건 skip |
| 실제 저장·의사결정 | Chromium 저장소 재접속, 설정·자산 보존, 초기화 세대, 동일 기질·다른 합성 이력의 실제 행동 길이 1719.6/2580.4ms. `browser-local-result.json` |
| 실제 컴포넌트 | 실제 React ViewerCompanion·관련 CSS·원본 자산을 오프라인 합성 화면에 마운트. 실시간 38.406초, 193회 모두 디코드된 그림 표시, 25곳 위치와 8종 상태 관찰, 콘솔/페이지 오류 0. `after-renderer-result.json`, `renderer-trace.json` |
| 직접 상호작용 | Enter 교감 저장(-0.065), 키보드 집기·이동·놓기, OFF 기억 보존, cat/dog 새 학습 제외, 초기화의 기질·도감 보존, 재접속의 세대·기질 유지 확인 |
| 긴 교감 | 기존 QA 고정 위치 옵션으로 실제 마우스를 연속 움직여 hover 입장·긴 교감(+0.065) 저장 확인. 가짜 시계·학습 함수 직접 호출 없음. `pointer-renderer-result.json` |
| 전송 | 자동화 방어 유지. 관측 109개 요청은 로컬 파일 GET만, body 없음. 합성 canary가 URL/body/headers에 없음. 개인화 모듈의 저장 allowlist와 네트워크 호출 부재도 diff 검토. 운영 분석을 켠 환경의 독립 인증을 뜻하지 않음 |
| 방침 화면 | 1440/390 밝은 테마의 전후 실제 생산 SSR 캡처. native details의 포인터·Enter·Space, 공개 시행 정보 접근, 운영 상세 원문 부재 확인. hydration 없음 |
| 역할 경계 | 실제 서버 액션을 합성 actor로 실행한 단위 5건: 익명·owner·viewer·불확실 developer 거부, 실제 developer 허용. 실제 로그인/RLS 검사가 아님 |
| G-22 | 기존 배우기·초기화·성격·무작위 고정 target과 라벨 유지. 새 공개 방침 접기는 `legal-policy-info`로 기존 click 위임에 연결(포인터·Enter·Space 각 native click 1회 확인). timeline·least-used 양쪽은 같은 `describeTarget`/`ACT` 사용. 자율 행동·학습 수치·음식/노래·도감 ID는 추가 기록하지 않음 |

본문에 운영 날짜표를 상시 노출하지 않되, 공개 접힌 영역에 적용일과 주요 변경 전후를 유지했다. 법 제30조의 쉽게 확인 가능한 공개 취지를 기준으로 점검했다. 이 기록은 모든 법적 요건의 포괄 적합성 인증이 아니다. 근거: [현행 개인정보 보호법 제30조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029331779)(2026-09-11 시행).

## harness 실패 분리

`harness:verify` 전체 FAIL 유지. 기준/현재 규칙 ID 목록 SHA-256 모두 `6dbaea5cf6e7506457d7019bbb2a92be5ed0c6f421affb35355cb2c7a413bf67`; 기존 등록표 기대값부터 다르며 표도 기준에 불일치. 이번 문장 보완이 규칙 ID를 바꾸지 않았다.

아트 드리프트 46건·수동 편집 충돌 0. 카탈로그 코드와 추적된 `scripts/art-src/public/docs/ambient` 입력은 기준과 변경 없음, 미추적 입력도 없음. 아트의 기존 실패 분리는 입력 동일성에 따른 판단이며 별도 전체 기준 checkout 실행으로 꾸미지 않았다. 무관한 46개 문서 재생성 없음. `harness-baseline-result.json`에 근거.

## 남은 검증과 한계

- 자동 승인 검토가 이전 두 Next 로컬 listener 시작을 `blocked by policy`로 거절했다. 추가 사유는 제공되지 않았다. 같은 listener 우회 없이, 요청을 로컬 파일로 fulfill한 headless 브라우저만 사용했다.
- 실제 Next hydration·라우터·전체 viewer/studio/preview 화면, 실제 Google 로그인·DB RLS는 미검증. 9성격 전체 장시간·모든 기하·기기 조합의 인증이 아니다.
- G-21 비작성자 독립 역할·경계·UX·QA 검수는 통합 전 남는다. 이 세션의 자체 diff 검토를 독립 검수로 세지 않는다.
- main 사용자 미커밋은 건드리지 않았다. 현재 원격 추적 ref가 다른 작업으로 움직였어도 기준 `742de77b`는 유지. 깨끗하지 않은 worktree 유지.

전후 그림은 [보고서](report.html), 요약 수치는 [verification.json](verification.json). 세부 QA 파일은 worktree 안 `.scratch-pw/local-personalization/`에 두며 `scripts/scratch-retention`의 일반 feature 폴더 정책(마지막 쓰기 후 14일, 용량 우선)을 따른다.
