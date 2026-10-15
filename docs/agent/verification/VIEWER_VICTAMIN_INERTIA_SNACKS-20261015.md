# 빅타민 잡힘 관성·음식8개·자두 형태

2026-10-15 KST. [PLAN-056](../plans/PLAN-20261015-056-companion-inertia-and-snacks.md). 기준 `6694d45f`, 구현 검증 중.

잡은 포인터의 실제 clamp 후 이동량만 감쇠 스프링 입력으로 사용한다. 잡은 점을 중심으로 몸이 늦게 따라가고 반대로 튕긴 뒤1500ms 안에 정확히 중립이 된다. 기존 HD 발버둥과 입력 반응은 별도다. 관성 레이어는 facing 바깥에 있으며 잡힘 중 얼굴 방향은 고정한다. 숫자로 계산한4corner 경계가 화면 가장자리의 반응만 줄인다. 세계/착지/스크롤 기하와 포인터 소유권은 변경하지 않는다. 새 루프·측정·의존성은 없다.

독립 검토2명이 해제 직후 재집기의 pivot 변경 문제를 지적했다. 새 grip 전에 이전 꼬리를 초기화했다. 별도 검토의 중립 transform 문자열 불일치도 고쳐 감소동작/gfx OFF/수면 창에서 같은 transform을 반복해서 쓰지 않게 했다. 취소/lost capture/blur/숨김/모달/정리 시 초기화, 정상 해제 시 기존 착지와 짧은 꼬리 연결을 유지한다.

첫 실물 관성 검사에서는6개 중 수면1개만 통과하고5개가 실패했다. 단언을 유지하고 두 원인을 수정했다. 기존6px threshold는 최초 잡힘에만 적용하도록 바꿔 왕복 도중 처음 위치를 지날 때 멈추던 약11px 이탈을 없앴다. 전역 버튼 active scale(.95)은92px 캐릭터 평면을87.4px로 축소하고 해제 후에도 복귀 스프링이 남겼다. 포인터 기하를 소유한 `.vc-actor`만 전역 press transform/transition의 예외로 두고 전용 pose가 피드백을 담당하도록 했다. 최종 빌드를 새로 만들고 아래 렌더 검사를 다시 실행한다.

음식 상한을 독립 `food-capacity.ts`의8개로 통일했다. 생성·안내·접근성 후보·뇌 후보가 같은 상수를 사용하며 모듈 순환을 추가하지 않는다.4~8번째도 먹기/이동/휴지통에 참여하고9번째는 기존8개를 보존한다. 자두는 약간 비대칭인84×102 몸통(이전107×101)의 세로 타원이다.36px/256px 렌더를 직접 확인했다. 원본 계보·라이선스·재현 도구를 보존하며 다른12개 SVG 바이트는 그대로다.

공유 viewer/anonymous/preview, 기본OFF·92px HD·1840 포스터 유지. 공개 DTO/역할/언락·KST·서버/DB/생산 의존성 변경0. fixture 또는 과거2025-09 읽기만 사용하고 모든 POST를 차단한다. 사용자 미술 기록26행·보류 자산은 변경/커밋 대상에서 제외한다.

| 검증 | 결과 |
|---|---|
| 관련 단위·문서 계약 | 29파일335/335 PASS. 관성의 지연/overshoot/유한 종료·60/120Hz·동일 시각·역행 시계·반전/중단·경계, held facing,8번째 식사·후반 후보, public DTO/rule migration 포함 |
| 최종 typecheck·전체 lint·production fixture build | 실제 child exit0 PASS. typecheck는 최종 build 후 재실행 |
| 자산 재현 | `prepare-companion-plum.mjs --check` 및 자산 단위4/4 PASS, 다른12개 hash 유지. 자두 SHA256 `20f95f69573988fdc3dbb5a4b664ca9cbc16d389534367d3d5dbe63a09772851` |
| 잡힘 관성 실물 | 최종6/6 PASS, child exit0·재시도0. PC/native390 실제 반전 입력·정지·해제, 잡은 점 오차<.007px/CSS pivot<.017px·방향 고정. 정지 후 양방향 overshoot(PC 약−3.23→+.845°/터치−3.006→+.786°),1500ms 뒤 정확한 중립10/11rAF.4면 경계174rAF·reduced/OFF 중립·수면 창0mutation 확인. PNG2 직접 열람 |
| 음식8개 실물 | 최종 PC1920/native3902/2 PASS, child exit0·재시도0. 실제8IDs와9번째 거절 시 보존,8번째 바닥 음식 접근·식사 후7개→재급식8개, 후반 음식의 방석/접기·재열기/휴지통·전체 정리 확인. POST 전송0. PNG2 직접 열람 |
| 기존 공유 상호작용 | 최종6파일37/37 PASS, child exit0·재시도0. HD/몸통·여백 교감·모달 수면·잡힘·상단 비행·방석/카드 음식·휴지통/식사/취소·스크롤 포함. 새 관성6+음식2와 합쳐 최종 관련 실물45/45 |
| 실제 익명 `/` 로컬 | PC1920/DPR2·native390 모두 PASS, child exit0. 실제 흔들림 왕복·종료0/정지 세계 좌표 변화0,8개/9번째 보존, 기존 교감·안정 hover58rAF·방석/집 바닥·접기/compact 재열기·동일 DOM·예기치 않은 낙하0. 각 POST1차단/전달0·페이지 오류0. 로컬 설정/cookie 외 세계/시계/focus/random 주입0. PNG2 직접 열람 |
| 운영 배포 | 미실행 |

기존 harness inventory2 실패는 이번에도 같은 문구로 재현됐다. 이전 전체 단위9·구형 확장 검사15는 이번 관련 검사로 덮어쓰지 않는다. 실제 OBS/물리 기기 성능과 진짜 로그인/RLS는 미검증이다.

재현 로그(ignored): `.scratch-pw/companion-056-{build-final2,typecheck-final2,lint-final2,unit,harness-final,core-final2}.log`, `companion-056-product-hashes.json`, `plum-056/{before,after}.png`. 실제 렌더/운영 결과는 검증 후 이 기록에 갱신한다.
