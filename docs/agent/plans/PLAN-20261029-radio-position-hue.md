# 2026-10-29 채택: 라디오 상태·팝오버 위치·색조 키보드

사용자 직접 채택 P-20261029-01/02/03. 원제안/실측6건은 local pipeline `runs/20261029-daily-review/proposals-final.json`과 원 native receipt에 보존. primary `docs/agent/handoffs/boss-decisions.md`가 향후 비서 채택의 최초 읽기 경로다.

1. 기존 라디오 상태 문구로 전체 소리 OFF/음량0, 빅타민 OFF/소리 OFF/음량0, 라디오 OFF/음량0, 빈 목록 구분. 새 행/자동 음소거 해제/오디오 정책 변경 없음.
2. PC 상세·편집 팝오버의 기존 손잡이 더블클릭 또는 포커스 후 Enter/Space로 현재 창만 자동 앵커 복귀. 평소 드래그 위치 기억, 다른 일정의 위치·초안, 모바일 닫기 유지. 공용 제스처 훅과 기존 배치 계산 재사용. 드래그 직후 클릭을 복귀로 오인하지 않는다.
3. 기존 1D 색조 막대만 slider 의미·Tab·화살표1°·Home/End 지원. 채도/명도·HEX·테마 미리보기·실행취소·완료/취소·포인터 유지. 2D SV를 slider로 위장하지 않는다.

검증: viewer/studio/preview credential-free 실제 fixture 상호작용, PC 폭/zoom·밝음/어두움·모바일 회귀. type/lint/관련 unit/harness/불변 build/native/비작성 독립 검수 후 관련 범위만 commit/push. CI/Vercel/공개 fullSHA 대조. 원실패·영상·trace 보존, fullCertification=false.

G22: 라디오 상태는 표시만 변경. 색조와 위치 복귀는 고정 의미 target만 사용하고 색값·일정ID·학습정보는 기록하지 않는다. 기존 이력 label과 자동화 guard를 보존한다. 생활AI/서버 DTO/권한/KST 저장 변경 없음. 실제 보조기술·실기기·전체 생활36 검증으로 확장 주장하지 않는다.

## 구현·검증 기록

기존 상태 줄·손잡이·색조 막대 안에서 구현했다. 색 피커의 명시 편집을 동기 통지해 360° 끝점과 늦은 부모 echo의 경합을 없앴다. 초기 열기/외부 값 수신은 새 색 저장으로 취급하지 않는다. 포털 Tab 순환과 실제 트리거 복귀를 함께 확인한다.

관련 단위75건 통과. 선택29건은 viewer/owner/developer/preview, 1440/1920/2400px 및 좁은390px, 실제 재생 실패·재시도·양수 음량 알림, 0/360°·한 단계·실행취소·다른 스와치·그림판 색상 취소/완료, 드래그·Enter/Space·초안과 다른 일정 위치 보존, 모바일 닫기와 G22 캡처/두 개발자 표시를 다룬다. 정상속도 생활AI/실계정/실기기 전체 검증이 아니다.

원시도들은 local pipeline `runs/20261029-adopted-radio-position-hue/`에 보존한다. 탭 이탈/HEX 대소문자/본문 선택자 검사 오류와 구현 중 색조 경합을 구분했고 원실패·trace·영상은 덮지 않았다. 관련 입력이 달라진 빌드는 새로 만들고, 마지막 후속은 동일 불변 빌드와 검증된 동일 사례만 재사용했다. 실제 검증/독립 검수/배포 fullSHA와 공개 결과는 primary daily state의 `latestAcceptedRadioPositionHueRelease` 및 해당 run의 release 기록에서 확인한다.

완료 보고서·대표 화면 경로: `C:/Users/im917/.codex/vic-pipeline/runs/20261029-adopted-radio-position-hue/`. `report-1440.png`와 `after-P-20261029-01.png`, `after-P-20261029-02.png`, `after-P-20261029-03.png`를 보존한다. 이 그림은 기존 검증 산출물의 무손실 사본이며 새 실제 관측으로 세지 않는다.

## 사장 확인 체크리스트

- P-20261029-01: 전체/빅타민/라디오의 소리 꺼짐 또는 음량0에서 기존 상태 줄에 원인이 보이고, 소리를 켜도 자동 재생되지 않는지 확인.
- P-20261029-02: 옮긴 상세·편집 창의 손잡이를 두 번 누르거나 포커스 후 Enter/Space를 눌렀을 때 날짜 옆으로 돌아오고, 초안·다른 일정의 창 위치가 유지되는지 확인.
- P-20261029-03: 기존 색조 막대를 Tab으로 선택하고 화살표/Home/End로 조절했을 때 HEX·미리보기가 맞으며 취소/완료가 유지되는지 확인.

위 목록은 사장이 화면에서 확인할 사항이며 답을 기록한 것이 아니다. 실제 확인/나중에/고침은 primary `docs/agent/handoffs/boss-decisions.md`의 완전한 비서 기록만 따른다.
