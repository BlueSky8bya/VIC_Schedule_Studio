# 빅타민 이용기록 — 2026-10-16

Plan: [PLAN-070](../plans/PLAN-20261016-070-companion-activity.md)
Status: Deployed and verified (`7d377dd3`).

## 범위

- 편집실·시청자·미리보기에서 같은 설정/집/빅타민/먹이 구현을 계측한다. 모바일 빅타민 비활성 정책은 유지한다.
- 설정: 전체 ON/OFF, 움직임·장난·교감 토글 9개, 걸음·동물 모드·성격 선택, 설정 내 빅타민/하위 탭.
- 직접 조작: 집 열기/닫기/접기/펴기, 집으로 부르기, 쓰다듬기, 잡아 옮기기, 딱밤, 낮잠 요청, 숨은 일정에서 찾기/밖으로 꺼내기, 음식 생성/운반/버리기/남은 음식 치우기, 장난 보라 하트 지우기.
- 고정 ID와 선택값만 기존 `ui.click` 배치에 담는다. 완성된 제스처가 자기 로그를 소유하며 합성 클릭·취소·자율 걷기/점프/먹기/장난/수면은 사용 횟수에서 제외한다. 호버 쓰다듬기는 기존 보상 간격을 재사용한다.

## 기록과 개인정보 경계

- 사전 누락으로 `sanitizeTarget`에서 대상이 지워지던 문제를 수정했다. 사전 이름은 행동 타임라인·흐름·복사 리포트·적게 쓰인 기능에서 공유한다.
- 내부자 타임라인은 기존 개발자 전용 조회를 유지한다. 시청자·비로그인 행동은 기존 날짜×역할×종류×대상 집계이며 개인 타임라인을 만들지 않는다.
- 일정 제목/내용/ID, 위치·포인터 이동, 음식 인스턴스 ID, 친밀도/허기 전체 상태와 개인 입력은 신규 계측에 넣지 않는다. 공개 DTO/API·역할/언락 권한·DB schema는 변경하지 않았다.
- 보존은 기존 90일 정책. 실제 정리는 `PRIVACY_RETENTION_CLEANUP_ENABLED` 기본 OFF 및 기존 별도 운영 승인/복구 백업 조건을 유지한다. 외부 설정 확인/과거 삭제 완료를 주장하지 않는다.
- 과거 빅타민 사용은 복원하거나 소급 생성하지 않는다. 적게 쓰인 기능은 기존 관측된 행동의 집계 방식이며 배포 이후 새 기록부터 나타난다.

## 검증

- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0.
- 관련 단위검사 `npx vitest run activity viewer-companion public-dto owner-email presence-privacy`: 56파일 565개 PASS.
- 문서/세션 단위검사 `tests/unit/agent-memory.test.ts`: 18개 PASS.
- `harness:verify`: 기존 RULE_MIGRATION inventory 불일치 2건 유지. PASS 아님.
- 독립 리뷰: 수집 경계·취소/중복/자율 행동 제외·사전과 조회 연결에서 actionable 결함 없음. 실물 결과는 아래 갱신한다.
- 운영 DB에 시험 기록을 넣지 않는다. fixture 브라우저는 모든 mutation을 차단/합성 응답하며, `/api/activity` payload는 로컬 증거로만 수집한다.

## 실물 및 배포

- 최종 빌드 `h8rsqay63LCw94kWXDPcM`에서 `companion-activity.spec.ts` 6/6 PASS(29.4초, 재시도·생략·브라우저 오류·미확인 mutation 0).
- 두 화면에서 딱밤/빅타민 운반/음식 생성·이동·Delete·전체 정리와 설정 ON/OFF·걸음·동물·성격 선택의 정확한 횟수 확인. 실제 자율 이동을 관측한 뒤 사용 로그 0 확인.
- 개발자 이용기록 3개 조회는 합성 응답만 사용. 행동 타임라인·적게 쓰인 기능의 한국어 이름/횟수·빅타민 사용 요약을 실제 렌더로 확인. 실제 운영 이용기록이나 계정 기록을 증거로 복사하지 않았다.
- 호버 쓰다듬기·숨바꼭질 발견/추출·보라 하트 지우기·모든 취소 분기의 기록을 전부 native input으로 재현한 것은 아니다. 이 범위는 호출 위치 리뷰와 해당 기존/신규 단위 계약에 한정한다.
- 기본 서버 `127.0.0.1` 바인드에서 검사 완료. 테스트 브라우저의 loopback alias GET만 기본 서버에 재지정하며, WebDriver getter 예외는 테스트 안에만 존재한다. SW 차단·모든 mutation 가로채기로 실제 수집 API/DB 쓰기에 도달하지 않는다. 제품의 analytics guard는 변경하지 않았다.
- 로컬 증거: `.scratch-pw/companion-070-activity-report.json`, `.scratch-pw/companion-070-activity.png`, `.scratch-pw/companion-070-source-proof.json`(제품 9파일 SHA256).
- 제품 커밋 `7d377dd386bb49adc4b4bd7b2c2cbe1120064181`: GitHub/Vercel success, 운영 `/api/soop-live` build SHA 일치. 공개 페이지 HTTP200 및 static script 24개 정상, 새 설정/교감/먹이/하트 ID 4종의 운영 리소스 포함 확인.
- `.scratch-pw/companion-070-production-deploy.json`, `.scratch-pw/companion-070-deployed-resources.json`, `.scratch-pw/companion-070-committed-source-proof.json`: 배포/리소스/검증한 제품 9파일과 커밋 내용 일치 증거. 실제 이용기록 데이터나 개인 식별 자료 없음.
- 운영 계정의 빅타민 조작을 반복해 인위적 이용기록을 만들지 않았다. 운영의 실제 신규 기록 누적은 이후 자연 사용부터이며, 실제 DB에 시험 기록을 넣어 end-to-end 저장을 증명한 것은 아니다.
