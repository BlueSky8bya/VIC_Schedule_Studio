# 쓰다듬기 손·커서와 집 바닥 음식

2026-10-15 KST. 기준판 `0de4f7c9`. [PLAN-055](../plans/PLAN-20261015-055-companion-hover-and-home-floor.md). 구현·검증·운영 배포 완료. 제품 커밋 `528192dfcdf9f0c9c561e6805ce2d4524cc04770`.

손 표시가 접촉 압력550ms와 행복 포즈650ms의 종료마다 제거되고, 작은 배우 버튼 밖의 넓은 센서 영역에서는 기본 커서가 되살아나는 두 경로를 수정했다. 유효 hover의 ready 상태가 손·커서만 유지한다. 실제 위치 아래 한 요소에만 임시 cursor 속성을 부여하고 이탈·다른 조작·pause/blur/창·세계 이동·숨김/정리에서 해제한다. 드래그 버튼 크기와 왕복 인식/4초 보상은 유지한다. 압력과 행복 표정은 별도로 끝나며 단순 hover로 보상을 얻거나 뇌를 계속 멈추지 않는다. 손은 opacity/visibility로 짧게 연결하고 감소동작/gfx OFF에서는 전환을 생략한다.

집 바닥은 실제 `.vc-home-floor`의 끝에서6px 안쪽인 별도 평면이다. 음식은 방석/출구와 구별한 DOM 상대 부착을 갖는다. 집 접기·좌우·스크롤·compact 재마운트를 따라가며 좁아질 때 같은 바닥의 안전한 위치로만 보정하고 원래 offset을 보존한다.44px 음식 hitbox로 자판기/휴지통을 덮지 않는다. 실제92px 안전 지원이 있는 경우만 manualOnly 먹기 목표로 제공하며 음식 렌더 위치를 방석으로 바꾸지 않는다. 집이 가려지거나 없어지면 펫의 집 거주 ID를 보존해 달력으로 재배치하지 않고, 식사는 보상 없이 중단한다. 직접 드래그/명시 키보드 이동만 허용한다.

공유 viewer/anonymous/preview·기본OFF·92px HD·1840 포스터·공개 DTO/역할/언락·KST·서버/DB 변경0. 자산/생산 의존성·새 독립 타이머/rAF·상시 DOM 측정0. 기존 이벤트가 소유한 finite follow와 측정 캐시만 사용한다. 시험은 production fixture 또는 과거2025-09 읽기, POST 전부 차단. 사용자 미술 기록26행·보류 자산 보존.

| 검증 | 결과 |
|---|---|
| 관련 단위·문서 계약 | 28파일327/327 PASS(companion·panel·public DTO·rule migration). 새 바닥 기하/먹기·수신/축소 복귀 검사 포함 |
| typecheck·전체 lint·production fixture build | 실제 child exit0 PASS. build 후 typecheck 실행 |
| 기존 공유 상호작용 회귀 | 6파일37/37 PASS, 실제 child exit0. HD/몸통·여백/모달 수면/잡힘/상단 비행/방석·카드 음식/휴지통·식사·취소/스크롤 포함 |
| 손·커서 연속성 | 새 full/reduced4/4 PASS, child exit0. 약6.2초씩373~374rAF, native .5px 이동96회·900ms 정지·actor↔여백·6px 이탈 여유에서 hand/cursor 손실0·capture0·배우 기하 변화0. 친밀도 보상1회(.08) 이후 추가0. 주변 native 버튼 실제 클릭·문서 밖·마우스를 둔 채 키보드로 창 열기 정리도 PASS. PNG2개 직접 열람 |
| 집 바닥 실물 | 새4/4 PASS, child exit0. PC1920/native390의 바닥 드래그·재집기·탭/키보드·접기·좌우·wide↔compact·스크롤, 원점 오차2px 미만/44px 조작 버튼 겹침0, native 자판기/휴지통 도달 검증. 실제 바닥 점프/식사·집 접기3초 중단 무보상·같은 집 바닥 거주 보존·재개 후 섭취/hunger<.5 확인. POST/페이지 오류0, PNG4개 직접 열람 |
| 실제 익명 `/` 로컬 | PC1920/DPR2·native390 모두 PASS. PC 정지 hover58rAF 손·커서 유지, 기존 교감/잡힘, 양쪽 실제 바닥·방석 직접 드래그·접기/재열기·위치 유지/예기치 않은 낙하0·동일 DOM. 모바일 compact 닫기/재열기도 유지. 각 POST1차단/실제 전달0·페이지 오류0. 로컬 설정/cookie만 seed하며 focus/random/세계/시계 주입0 |
| 운영 | Vercel success·실제 build528192df 일치. 운영 `/` PC1920/DPR2와 native390 모두 PASS/child exit0. PC 정지 hover58rAF 손·커서 유지, 양쪽 실제 바닥/방석 드래그·동일 집 위치·접기/재열기·모바일 compact 닫기/재열기·동일 펫 DOM·예기치 않은 낙하0. 각 POST1차단/전달0·페이지 오류0. 운영 PNG2개 직접 열람 |

새 검사의 localStorage 보상 즉시 조회는 기존 저장 throttle 때문에 실제 UI meter로 수정했다. 모달 opener의 focus 유지도 기존 동작을 보존하며 펫이 초점을 훔치지 않는지 검사한다. 제품 시간·좌표를 주입하거나 임계값을 완화하지 않았다.

모바일의 즉시 CDP 드래그 후 첫 탭은 초기 실행에서 trusted pointerdown/up만 발생하고 window capture 단계의 click 자체가 없었다. 앱 없는 plain HTML과 pointer capture만 있는 HTML에서도 재현되어 제품의 click guard 결함으로 바꾸지 않았다. 드래그 끝점에서 실제4rAF의 같은 좌표 touchMove 표본을 보내 손가락이 멈춘 뒤 놓도록 하자 plain/실앱 모두 첫 native 탭이1회 정상 전달됐다. 이 입력 보정만 새 검사에 적용했으며, 추가 탭·DOM click·임의 사후 대기·제품 지연은 넣지 않았다. 내부 fling 상태를 직접 계측하지 않아 정확한 브라우저 원인은 단정하지 않는다. 증거는 `companion-055-native-click-{matrix,gesture,tail}.json`이다.

미검증 범위: 실제 OBS/물리 기기 성능, 진짜 로그인/RLS. 이전 전체 단위9·harness inventory2·구형 확장 검사15 미해결은 [이전 기록](VIEWER_VICTAMIN_DRAG_JUMP-20261015.md)에 분리되어 있다. 이번 관련 검사의 통과로 덮어쓰지 않는다.

재현 로그(ignored): `.scratch-pw/companion-055-{build,typecheck-final,lint-final,unit,core,hover-final2,floor-final,harness-final}.log`, `companion-055-core.json`, `.scratch-pw/.scratch-pw/companion-055-{hover-report,floor}.json`, `companion-055-public-{local,production}.json`/`companion-055-public-{local-final,production}.log`, `companion-055-production-deploy.json`, 같은 prefix PNG/동영상·rAF 기록. 빌드 뒤 제품6파일의 SHA256 불변도 확인했다. 이번 브라우저/로컬 서버/배포 감시 작업 종료.
