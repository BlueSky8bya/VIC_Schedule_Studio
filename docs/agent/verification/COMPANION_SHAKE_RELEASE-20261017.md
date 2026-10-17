# 흔들기 반응과087/088 통합 배포 검증

Status: Final local verification complete — authorized commit/push/production verification pending.

소유자는 편집창 닫힘 뒤 표시 복구087, 부른 빅타민의 귀가 완료088, 잡고 마구 흔들 때 어지러운 반응089를 함께 커밋·푸시·운영 배포하도록 명시했다. [계획](../plans/PLAN-20261017-089-companion-shake-release.md). 사용자 아트·임시 미리보기·개인 설정은 제외한다.

## 구현과 경계

공유 renderer의 실제 clamped pointer 좌표와 단조 시각으로 빠른 반복 왕복을 구분한다. 고정16ms 입력 재표본화·최대10회 보간·최근 반전3개 및1.2초 창을 사용한다. 실제 이동40px/속도400px/s/반대 방향3회와450ms 이상을 요구하며, 한 번 휙 옮김·작은 떨림·느린 이동·이벤트 폭주·동일/역행 시각은 발동 근거가 아니다. 입력 공백은 미완성 누적을 끊지만 획득한 반응의 원래1초 만료를 연장하거나 앞당기지 않는다.

잡힌 몸의 row8 물리·귀/몸통 grip·중력 늘어짐·방향·관성은 유지하고 표시만 기존22행의 어지러움으로 바꾼다. 놓으면 기존 첫 실제 발판 낙하가 끝난 뒤22행600ms→23행320ms로 회복한다. 단발 이동/취소/새 입력/blur/pause/감소/OFF를 구분하며 카드 기울임이나 음식 충돌을 부수적으로 실행하지 않는다. 일반 창 뒤 잠든 캐릭터·팝오버 게스트는 기존 정숙한 입력 소유권을 유지한다. 모바일 제외·공개 DTO/역할/언락·KST·1840 기하는 그대로다. 새 아트·의존성·서버 호출·상시 타이머/루프·React 프레임 갱신은 없다.

## 실패를 먼저 확인한 항목

- 독립 검토: 최신 반전3개만으로450ms를 계산하면 더 빠른100ms 반주기의 지속 흔들기를 영원히 거절했다. 단위검사 FAIL을 먼저 확보하고 연속 유효 run 시작시각을 별도로 제한 보존해 해결했다.
- 첫 production fixture 검사: 새8개 중 양성3개 FAIL/음성·취소5개 PASS. 잡힌 동안 어지러움은 보이고 실제 낙하도 정상이나, PNG를 찍는 짧은 정지 뒤 pointerup의 최종 좌표가160ms 공백으로 반응까지 지웠다. 검사 지연/최신 release 좌표 처리 대신 helper의 누적 초기화와 획득한 반응 초기화를 분리했다. 같은/다른 좌표의 공백·1회 소비·원래 만료·미완성 누적 거절을 추가했다. 첫 실패 JSON/PNG/trace/report는 격리 작업트리에 보존했다.

## 최종 검사

최종 격리 production fixture build `RRU_Pl-nH1oGk9yqe00cz`, Windows Chromium. viewer/studio 실제 HTML도 같은 build ID로 확인했다. 새 검사는 실제 pointer와 단조 시각을 사용하며 설정만 seed했다. 제품 상태·좌표·callback·랜덤·시계를 주입하지 않았다. POST/root prefetch는 차단했다.

| 검사 | 결과 | 범위 |
|---|---|---|
| 전체 unit |1,950/1,950 PASS, skip0 |검출14개, finite dizzy/recover, 기존 전체 회귀 |
| 정적 검사 |build/typecheck/전체 lint PASS |최종 helper 포함 빌드 후 typecheck; 테스트 관측 보정 후 대상 lint/tsc도 PASS |
| 흔들기 실제 조작 |8/8 PASS |viewer/studio full·viewer lite 양성, 단발·reduced·off 음성, native lostcapture·touchcancel |
| 기존 실제 조작 |32/32 PASS |088 귀가8·087 닫기6·빠른 놓기/스크롤/최종up10·게스트 추출1·관성5·일반 창 소유권2 |
| 독립 검토 |blocking0 |검출 경계·renderer/착지/reset·087/088 보존·관측 보정 검토; full PNG/JSON 검수 |
| 소스 통합 |23파일 바이트 일치 |검증한 격리 소스를 main에 선택 통합; 사용자 아트/미리보기 보존 |

최종 화면40개는 retry/skip/flaky0이다. 양성3개는 동일 노드/숨김0, 실제 낙하→22행→23행, 착지 뒤 좌표 고정 및 저장 설정 bytes 동일을 확인했다. fresh held 관측은27/28/24개, grip 오차 최대0.00052px, 물리 pivot 최대0.01531px였다. 새8개 모두 POST/pageerror0이다. 이는 관측한 fixture 범위의 결과이며 실제 OBS/OS나 모든 장치의 오차 상한은 아니다. 첫 실제 지지면을 바꾸거나 순간이동해 회복을 꾸미지 않았다.

최종 제품의 첫 검사에서 lite1건은30Hz 표시가 갱신되기 전 rAF 좌표를 새 pointer와 비교해 약50px로 실패했다. 제품 변경 없이 실제 새 world transform과 입력이 안정된 표본만 정밀 grip 단언 대상으로 보정했다. 최소6개 새 표본을 요구하고, 모든 프레임의 동일 노드/숨김 및 모든 displayedHeld의 자세·방향·늘어짐, 전체 착지/회복 단언은 유지했다. 이 보정도 독립 검토 후8개를 새로 실행해 통과했으며, 최초 실패 report/trace/원자료는 별도 보존했다.

원본은 작업트리 `.scratch-pw/089-*`, 전달 증거는 메인 `.scratch-pw/companion-089/`이다. 문서 harness는239개 PASS 후 릴리스 직전에 갱신된 문서로 재검사한다. 기존 화면의 읽기 전용 prefetch까지 DB 요청0이라고 주장하지 않는다. 실제 운영 일정/설정/권한·DB는 수정하지 않았다.

## 배포와 한계

아직 이번 변경을 커밋·푸시·배포하지 않았다. 실제 OS/OBS 장비·모든 기하/장치/네트워크 순열·새 역할/RLS 검사까지 검증했다고 주장하지 않는다. 기존 Vercel Hobby 초과 문제는 이 동작 수정의 배포 성공과 별개다.
