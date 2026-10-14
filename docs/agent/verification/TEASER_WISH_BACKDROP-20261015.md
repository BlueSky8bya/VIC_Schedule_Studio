# 최초공개 기대 배경 / 시각 안내 접힘

Scope: PLAN-039. 2026-10-15 KST. Production deployment pending.

## 변경

- PLAN-038의 표정 사진/깜빡임 컴포넌트 제거. 소유자 지정 원본 전체 비율 유지, 1536×864 WebP54,142bytes. 원본/출력 SHA와 재현 스크립트 보존.
- 기대 중인 공개 전 일정이 있으면 사진 최대18%로1.4초 페이드, 모두 취소하면0. 이미지 로드 전/실패에는 숨김. 현재 선택을 직접 사용해 취소 뒤 늦은 로딩이 예전 반응을 재생하지 않음.
- 사진 자체 네 가장자리에 정적 mask. pointer-events/접근성 트리 밖. 기존 마지막10초 퇴장값, 동작 줄이기/낮은 그래픽 정책 재사용.
- 하단 얼굴 자리 제거, 관객을 전체 폭에 재배치. 중앙 모임/마지막8초 정지 유지.
- 공용 남은 초 값으로 상세 공개 시각 행을 약185→180초에 접음. opacity와 grid 행 높이가 함께 줄어 기대 버튼이 공간을 채움. 미룸에는 복원, 최종 링에서는 시각을 재삽입하지 않음.
- 공개 DTO/DB/권한/KST 포맷/포스터1840기하 변경 없음.

## 검증

- typecheck, full lint, 최종 CSS 포함 fixture production build 통과. 이후 테스트 수정은 scoped ESLint 통과.
- 관련 unit78/78: teaser-premiere26, company5, focus2, publicDTO2, agent-memory18, rule-migration25.
- 첫 탐색 렌더11개:8통과/3실패. 테스트 하네스의 한글 stdin 인코딩, 상세 입장scale 완료 전 높이 측정, 모바일 토폴로지 전환 중 detached card 조작. 각각 수정, 제품 실패로 숨기지 않음. 최종 실행 결과 아래 추가.
- 최종 production fixture 렌더58/58 통과(6분): company13, fluid20, kairos9, reading-layout5, reference8, notice3. 기존 pending 화면4개와 신규 배경3개 기준선 갱신, 이전 표정 crop 기준선6개 제거. 읽기 화면 기준선은 그대로.
- 실제 `/` 로컬 smoke1100×780 /390×844 /844×390(touch): 모두 통과. 기대ON/OFF, 숫자1개, 관객 모임/정지, 공개 후 수동닫기, focus/inert 복구, pageerror0. 각 context POST3차단(가짜 기대2응답), 실제 서버 쓰기0. 합성 과거 일정은 브라우저 응답에만 주입.
- 실물 확인: `.scratch-pw/wish-local-happy-{1100,390,844}.png`, 같은 prefix의contempt(해제)/seated. PC·모바일 숫자와 희미한 원본 배경, 하단 관객 확인. 초안에서 발견한 모바일 사진 직사각 경계를 intrinsic image mask로 수정 후 다시 캡처.
- G21 독립 코드 리뷰: lite selector가 합쳐진 결함 수정, 최종 확인에서 확정 차단 없음. SHA/재현/비율/메타 제거 확인. 전문 미술 승인 아님.
- harness:verify의 기존 rule inventory/mapping2실패 재현. 이번 범위와 무관한 이전 full-unit8실패는 재실행/해결 주장 없음.

## 제한

실제 로그인/RLS·실기기Safari·주관적 미술 승인·실음향 품질 검사 아님. 원본 사용 방식 승인과 최종 디자인 승인은 구분한다. 운영 데이터 생성/수정 없음.
