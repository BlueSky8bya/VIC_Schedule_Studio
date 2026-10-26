# 다시보기 선택기 디자인 정정 검증

상태: 구현·로컬 선택 검증 완료. 원 작업30cd0a4a의 검수는 이번 사용자 미관 판정이나 새 목록 검증으로 대체하지 않는다. 최종 비작성 검수·실제 배포는 아래 run의 independent-review.json/release-confirmation.json과 primary daily state에서 확인하며, 문서만으로 선주장하지 않는다.

사용자 원 이미지: 브라우저 기본 파란 선택행·긴 제목/시간 한 줄 붙이기. 이번 범위는 native 목록 제거,1영상 전체 선택기 생략, 공용 테마 목록의 실제 열림·키보드·주변 동작 확인이다.

원영수증·원실패·PNG/영상·비작성 검수·실제 배포 결과는 local pipeline run `C:/Users/im917/.codex/vic-pipeline/runs/20261026-vod-picker-polish`에 기록한다. 등록/계획/이전PASS만으로 새 디자인 검증을 주장하지 않는다. 합성12영상·긴 제목·권한/합방 조합은 레이아웃 스트레스이며 실제 이용 통계가 아니다.

type/lint/unit98/build 통과. 고유UI19건 유효: 마지막 실행4 fresh+동일불변 빌드15검증 재사용, 실패/미실행0. BUILD_ID `DMNryjdQpYf7-BuTCt5u_`. 원영수증 `.scratch-pw/site-daily/native/2026-10-26-1793019115868-9e38331f/result.json`, SHA256 `c11a5a161d01310baef752c97ced3e0b3a4bab8cf2158254240525017bb3b996`.

7개 실제 열린 목록 PNG를 포함한24PNG와 원영상/관측JSON을 보존했다. PC1440/1920·390·밝음/어두움·모달zoom0.9, 단일/12영상·업로드/구독+·합방·목록 내부 스크롤/폭 경계를 확인했다. 선택 전 위/아래 이동은 재생을 바꾸지 않고 Enter/Space만 확정하며, Esc는 목록만 닫고 트리거 복귀, Tab은 기존 제목으로, 바깥 클릭은 목록 닫기, 기존 Shift 영상 이동과 구독 시각 주소/타임라인·도움말 회귀도 통과했다.

첫 실행17PASS/2실패는 구독+ 공용 배지의 그래픽+를 textContent 문자로 찾던 검사 오류였다. 실제 aria-label=구독+ 단언을 추가해 의미를 유지했고 원 report/trace/영상을 덮지 않았다. 제품 변경 없이 검사만 보강한 뒤 검증된 빌드와 무관한15PASS를 재사용했다. G22는 열기/취소/현재 항목 제외·고정 선택 target1회·두 developer 표시를 검증했으며 ID/제목/부 수는 기록하지 않는다.

외부 재생·계정 저장·실로그인/RLS·물리 기기는 별도이며 full200/생활AI 관측으로 세지 않는다.
