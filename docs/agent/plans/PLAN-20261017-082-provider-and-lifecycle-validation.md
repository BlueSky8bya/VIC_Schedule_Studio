# 운영 제공자·종료 경계·방송 부하 검증

Status: Complete — scoped local/provider verification. Production release identity and genuine-session/broadcaster follow-ups remain separate.

소유자 요청: Supabase 로그인 후 실제 설정/사용량에 근거해 최적화하고, 마지막 행동·복합 입력·실제 클릭·권한·OBS 검사의 실제 수행 범위를 확인한다. 기존080/081 결과는 해당 시점 증거로만 사용한다.

## 범위와 경계

- Supabase dashboard의 실제 플랜/사용량/성능 advisor/복구 설정을 읽고 원인별 조치한다. 유료 전환·권한 확대·추가 삭제는 이번 최적화에 포함하지 않는다. 데이터 변경이 필요한 결론은 정확한 영향/복구안을 별도로 준비한다.
- 실제 Advisor의 `event_hearts_read_own` 행별 인증 함수 평가 경고는0152에서 같은 SELECT/역할/본인 하트 조건을 유지한 단일 InitPlan으로 최적화한다. 격리된 anon/두 사용자/NULL/쓰기 거절·반환 주체·grant·멱등·rollback·드리프트 검증과 독립 리뷰 뒤 적용한다. 테이블/함수/공개 권한 확대·사용자 행 변경은 없다. 공개 가림 뷰는 의도된 owner-context+DB now 경계라 invoker로 바꾸지 않는다.
- 종료 직전 쓰다듬기→새로고침/화면 이동/로그아웃/탭 닫기/지연은 production fixture와 가로챈 기록 API에서 실제 브라우저 입력·전송 순서/중복으로 확인한다. stub 성공을 실제 DB 저장·기기 종료 보장으로 확대하지 않는다.
- 실제 잡기/스크롤/월 이동/팝오버/패널/미리보기와 보라하트 제거·기울기 복구를 여러 순서로 반복한다. 운영 일정·계정 기록에 테스트 데이터를 넣지 않는다.
- 경계 검사는 익명/합성 unauthorized DTO·응답 canary와 실제 로그인 증거를 구분한다. Supabase 관리 로그인은 서비스 owner/developer/viewer 로그인 증거가 아니다. owner_private·Google+패스코드·세션 결합·KST·직렬 쓰기는 유지한다.
- 방송 검증은 공식 배포본의 격리 portable OBS/로컬 fixture/로컬 녹화로 GPU 합성·인코딩과 브라우저를 함께 측정할 수 있는지 확인한다. 실제 방송 PC/SOOP 송출과 구분한다. 기존 OBS 설정·사용자 화면/마이크/송출 키는 사용하지 않는다. 최소30분 측정과 수면/복귀·메모리 관측을 목표로 하되 실제 수행 길이만 보고한다.

## 순서·검증

1. 실제 Supabase 대시보드 읽기 + 세 병렬 검증 lane. 기존 production build/3100 서버 하나를 공유하며 빌드는 root만 조정한다.
2. 발견한 결함은 원 실패를 보존하고 좁게 수정한다. 독립 경계/입력 리뷰 후 제품 변경이 있으면 typecheck/lint/unit/build 및 해당 rendered 검사를 실행한다.
3. OBS 측정은 로컬 테스트 소스만 캡처하고 외부 방송은 하지 않는다. 도구 버전/해상도/fps/인코더/실제 지속시간/누락 프레임·메모리·환경을 남긴다. 가상 부하를 실제 방송 장비 검증으로 부르지 않는다.
4. 실제 수행/미실행/실패/외부 미확인을 나눈 검증 기록·CURRENT_STATE/OPEN_CHECKS 갱신. docs harness 및 필요한 회귀 후 완료 처리한다.

삭제081은 완료된 별도 작업이며 재실행하지 않는다. 사용자 아트/미커밋 작업·로컬 복구 백업은 보존한다. 코드 배포가 필요한 경우 기존 요청 범위와 검증 결과를 확인해 진행한다.

## 수행 결과

- [Provider](../verification/SUPABASE_PROVIDER-20261017.md): 실제 Free/Nano quota·backup 확인, 권한 조건을 보존한0152 적용, Advisor warnings36→35. 추가 삭제/유료 전환 없음.
- [Lifecycle](../verification/ACTIVITY_LIFECYCLE-20261017.md): studio logout 누락과20번째 event의 일반 flush 선점을 수정. 최종 격리 build `RG5zhm6oK09zKo0-1ZaCq`의20/20 PASS; 실제 DB 영구 저장/OS 강제 종료 보장은 아님.
- [복합/실제 클릭](../verification/COMPANION_COMPOSED_INPUT-20261017.md): 중간 build5/5; 최종 build 첫4 PASS/1 FAIL(희귀 장난 트리거 미발생), 소스 변경 없는 viewer 단독 재관측1 PASS. 실패를 합산해 숨기지 않음.
- [경계](../verification/SECURITY_SESSION_BOUNDARY-20261017.md): 최종 unit1,913/1,913·SQL5종·HTTP6/6·typecheck/lint/build PASS. 운영 기존 developer 집계 허용/쿠키 없는401 확인. genuine owner/viewer·실제 logout/revoke는 미완료.
- [OBS](../verification/OBS_LOCAL_RECORDING-20261017.md): 실제1080p60/NVENC 로컬 녹화30분 완료, render/encoding lag 각각2프레임. 토리님 PC/SOOP 송출은 미검증.

동시083/084 제품 변경은 이 검증/배포 범위에서 제외한다. 사용자 아트·로컬 백업·계정은 보존한다. 제품 수정의 운영 SHA는 실제 배포 응답으로 확인하며, 로컬 통과를 배포 성공으로 대신하지 않는다.

최초 전체 unit은 동시 부하 중1,909 PASS/2 FAIL로 기존 CLI/stdin 검사 두 개가 각각5.116/8.769초 제한을 넘었다. 단언/제한을 바꾸지 않고 직접 Vitest CLI의 worker2로 재실행해1,911/1,911 PASS, 이후20건 회귀2개를 더한 격리 최종1,913/1,913 PASS를 확인했다. PowerShell npm wrapper가 처음 worker 인자를 전달하지 않은 실행도 구분한다. 원 도구 출력과 최종 JSON을 보존하며 첫 실패를 없었던 것으로 처리하지 않는다. 마지막 docs harness는 실제 release snapshot의224문서/brief5,734bytes PASS이며, 원 작업트리의 동시 변경까지 포함한228문서 검사는 별도다.
