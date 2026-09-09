# 외부 영감 참고

외부 그림은 형태를 설명하는 자료다. 우리 합격 화풍이나 해당 생물 종의 일치, 생성 결과의 미감 합격을 보장하지 않는다. [상위 규칙](../AGENTS.md)과 [ART_RULES](../../docs/ambient/ART_RULES.md)를 따른다.

## 두 보관 위치

| 위치 | 의미 |
|---|---|
| `art-src/<category>/<entity>/레퍼런스/` 직하 | 실제 대상을 확인해 엔티티에 연결한 영감 후보 + 원래 sidecar |
| `art-src/reference/<category>/` | 여러 엔티티 공용, 소속이 모호하거나 아직 미분류인 후보 |

이미지와 `<이미지파일>.json`을 함께 보관한다. 엔티티에 넣었다고 합격 스타일로 승격되지는 않는다. 소나무의 홍보표, 바위의 붕대처럼 대상과 무관한 내용은 그대로 따라 그릴 지시가 아니다. 대상·종을 확정할 수 없는 그림을 이름만 보고 배정하지 않는다.

합격본 없는 엔티티는 [스타일 파일럿](../../docs/ambient/ART_PIPELINE.md)으로 시작한다. [합격 시트](../../docs/ambient/reference/README.md)와 이 서고를 구분한다. 실제 생성기에 전달한 것은 해당 request의 고정 inputs와 전달 기록으로 확인한다. 엔티티/공용 폴더 전체를 자동 첨부했다고 주장하지 않는다.

## 수집·출처 검사

```powershell
# 범주 공용 후보
npm run ref:fetch -- animal --limit 20
# 특정 엔티티 후보: 범주와 entity가 일치해야 한다.
npm run ref:fetch -- tree --entity tree-pine --query "pine tree" --limit 20
# 공용 범주 전체. --all과 --entity는 함께 쓰지 않는다.
npm run ref:fetch -- --all --limit 14
npm run ref:notice
npm run ref:check
```

수집은 새 외부 파일을 추가한다. 현재 작업의 수집 범위가 있을 때 실행한다. 카탈로그는 자료가 생긴 엔티티를 연결하며 `npm run art:catalog`로 다시 생성한다.

NOTICE 정본은 [NOTICE.md](NOTICE.md). 공용 범주 폴더와 manifest에 등록된 엔티티의 레퍼런스 **직하** PNG/GIF·sidecar만 집계한다. `runs/`, 고정 `inputs/`, 생성본, 반려본, 참고 하위폴더는 스캔하지 않는다.

`ref:check`는 읽기 전용이다. 일반 `ref:notice`는 출처 없는 이미지·불량 기록이 있으면 기존 NOTICE를 덮지 않고 실패한다. 정상일 때만 그림이 사라진 고아 sidecar를 정리하고 목록을 재생성한다. 수기 목록 편집 대신 원본 sidecar를 고친다. 이미지 제거는 별도 큐레이션이며 원본·반려 증거 삭제와 혼동하지 않는다.

## 후보 게이트의 한계

수집기는 개별 출처의 CC0 표기, 홍보 파일명, 색 수·반투명·도트 런·논리 해상도를 검사한다. 임계값은 `scripts/ambient-ref-fetch.mjs`가 정본이다. 이 검사는 화풍이나 대상을 판정하지 않는다. 실제 서고에서 곤충 범주의 자동차·병사, 물 범주의 병/컵, 물고기 범주의 먹이 등이 발견됐다. 자동 게이트 통과만으로 엔티티에 배정하거나 좋은 참고라고 부르지 않는다.

실제 그림을 열어 대상·화풍·배너를 확인하고 선택 이유를 기록한다. 베끼거나 트레이스한 결과물은 쓰지 않는다. 직접 넣은 그림도 CC0 출처·작성자·원본 링크를 sidecar에 남기며, 출처 없는 그림은 사용하지 않는다.
