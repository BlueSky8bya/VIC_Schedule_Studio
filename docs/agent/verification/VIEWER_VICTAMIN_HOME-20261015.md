# 빅타민 집·접지감·조작 검증

2026-10-15 KST. [PLAN-044](../plans/PLAN-20261015-044-victamin-home-and-presence.md). 구현 승인과 소유자의 미술/체감 승인은 구별한다.

## 조사와 적용

| 1차 자료 | 확인한 근거와 이번 선택 | 한계 |
|---|---|---|
| [Bandai Tamagotchi Uni 공식 놀이 안내](https://tamagotchi-official.com/us/series/uni/howtoplay/) | 방/돌봄·먹이·행복을 연결하는 직접 제품 레퍼런스. 하나의 집과 같은 캐릭터의 포만감/친밀도·음식 상호작용으로 번역한다. | 디자인 효과를 입증한 연구는 아니다. 상점 경제·벌점·캐릭터/화면 아트를 복제하지 않는다. |
| [Apple HIG Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) | 단순히 설명할 수 있는 익숙한 제스처와 동작 중 피드백. 짧은 탭/꾹 누른 집기의 의도를 분리하고 확인 고리·즉시 반응을 둔다. | 웹의360ms가 공식 최적값이라는 뜻은 아니다. 실제 사용성은 소유자 피드백으로 보완한다. |
| [Chesney·Lawson 2007](https://www.benjamins.com/catalog/is.8.2.09che) | 가상펫의 동반감을 조사. 먹기·쉬기·손길처럼 반복되는 작은 교류를 하나의 생활로 연결한다. | 낮은 응답률의 설문. 실제 반려동물과 같거나 치료효과가 있다는 증거로 쓰지 않는다. |
| [Lin 외 2017, Beyond Cute 저자 기관 원문](https://scholarworks.indianapolis.iu.edu/bitstreams/a717c312-aded-47b8-b698-64acab26e488/download) | 돌봄·협동·탐험 등 동기의 차이, 접촉/행동/성격 선호. 기존 성향 설정은 유지하고 돌봄 행동에 친밀도·표정 반응을 연결한다. | VR 기대·선호 연구. 이 달력 UI의 장기 애착이나 최적 수치를 입증하지 않는다. |
| [Michitop 2025 원문](https://edwardyi.me/pdf/Michitop_Paper.pdf) | 작업 영역 침범·수동으로 치우는 부담에 대한 불만. 집이라는 거점과 쉬기, 글자를 피하는 착지·보행을 채택한다. | Columbia 수업 프로젝트, 3일·최종13명. 심사된 ACM 논문이나 일반적 인과 증거로 소개하지 않는다. |
| [Bakker·Niemantsverdriet 2016](https://ijdesign.org/index.php/IJDesign/article/view/2341/737) | 집중·주변부·암묵적 상호작용의 연속선. 평소에는 주변부 생활, 직접 집을 열 때만 돌봄을 전면에 둔다. | 조명 인터페이스 사례를 가상펫에 적용한 설계 추론이다. |
| [Madison 외 2001](https://link.springer.com/article/10.3758/BF03194461) | 접촉 그림자가 물체와 지지면의 접촉 판단에 기여. 그림자를 지지면으로 투사하고 도약 높이에 따라 작고 옅게 만든다. | 렌더링한 상자 실험. 픽셀 펫의 최적 그림자 수치까지 제시하지 않는다. |
| [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | 드래그 없이 단일 포인터로 같은 기능을 수행할 대안. 빅타민은 집의 옮길 곳 고르기→위치 탭, 음식은 탭→위치 탭을 제공한다. | 키보드 대안만으로 충족되지 않는다. 전체 WCAG 감사를 대신하지 않는다. |
| [W3C Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) | 특정 경로 제스처의 단순 입력 대안. 쓰다듬기는 짧은 탭과 집 버튼/Enter로 같은 반응을 제공한다. | 최적 시간·감도는 별도 실제 사용성 검증이 필요하다. |
| [W3C Pointer Cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) | 놓을 때 확정·취소 가능한 포인터 조작. 짧은 탭과360ms 이후 집기 의도를 분리하고 이동이 쓰다듬기나 밑 일정 클릭으로 이어지지 않게 한다. | 모든 pointerdown 사용을 금지하는 규칙은 아니다. |

## 구현 계약

- 공용 패널의 계절 카드 다음에 집 host만 추가. runtime/brain/food/care는 하나이며 좌우 전환에도 유지한다. 집은 같은 컴포넌트를 패널 또는 compact 카드에 portal한다. 자동 접힘·아젠다에서는 집 열기 진입점, 짧은 가로 화면은 한 스크롤 평면. 패널과 집 등장은 기존 `flipSpring`, 폭/글자는 기존 토큰.
- 동일 월드의 실제 쿠션으로 직접 초대하는 유한 이동과 휴식. 패널 스프링 중 목표가 움직이면 현재 위치에서 다시 연결한다. 쿠션이 보이지 않으면 다른 곳을 쿠션으로 가장하지 않는다. 자동 먹이 탐색은 기존 도달 가능한 발판 경로·배고픔 임계값을 유지한다. 집 밖 낮잠과 음식 이동 가능.
- OS 이모지를 공통 종이 장난감풍 SVG 사과·레몬으로 대체. 동일 그림을 자판기와 월드에서 사용. 기존 raster와 character atlas 바이트 무변경, AI 미술 생성/전문 캐릭터 승인 주장 없음.
- 모든 가시 텍스트의 `Range.getClientRects()`와 전체 조작 영역을 장애물로 측정한다. 날짜·제목·부제 줄 위에 보수적인 몸체 여유를 둔 안전 중심 구간만 발판으로 사용한다. 제목/본문/계정정보를 읽어 뇌에 전달하거나 저장하지 않는다. 가려진 집 뒤 글자는 집 내부 공간을 막지 않으며 집의 실제 레이블은 보호한다. font/scroll/zoom/resize/패널/외부 compact집 변화는120ms 관찰 병합, 최대200발판.
- 좁은 화면의 하단 조작부 위를 바닥 후보로 삼고, 안전 구간이 없으면 가짜 바닥을 만들지 않는다. 사용자 배치와 음식은 남아 있는 실제 안전 발판으로 연결한다. 비행 전체 경로의 글리프 무충돌과 정지·착지·같은 발판 보행의 안전은 구별한다.
- 보라 하트 우상단 별표 제거. 동일 공개ID의 자기 보라 표시를 다시 거둘 수 있으며 인간 빨강이 한 복제본이라도 있으면 우선 차단. 저장 실패/다른 탭 변경도 최신 snapshot과 미저장 delta로 처리한다. count/aria-pressed/native click/서버 투표 불변.
- 짧은 탭은 즉시 표정·하트 반응,360ms 꾹 누른 뒤 이동은 집기. 이른 큰 스와이프는 취소. 손길 one-shot은 재탭마다 다시 시작하고 해제 때 잔여 fill을 취소한다. reduced의400ms 생활 루프와 직접 입력 확인은 분리한다. zzz는3개의 느린 엇갈린 상승·소멸, reduced는 정지 표시.

## 검증 진행

최초 B1 실물: 새 집4검사 중1통과/3실패. 축소 후 launcher를 펫이 가리는 경우와 쿠션이 발판에서 빠지는 경우를 발견했다. 기존27검사 중22통과/5실패: 모바일 바닥 부재 때 옛 support ID를 유지한 실제 결함, 새 안전구간·집 조작에 맞지 않던 테스트 전제들을 구분해 수정했다. B1의 일부 통과를 최종 리비전의 통과로 주장하지 않는다.

최종 B2 제품 실행 코드 기준 결과:

- 관련 단위95/95, 문서·규칙 단위43/43. 전체 typecheck·lint·production fixture build 통과. 원본/공개 atlas 등록 `--check` exit0, 이미지 SHA 불변.
- 렌더42/42: 기존 돌봄8·실제 자율 하트2·중단/복귀4·이동4·기본9, 공유 설정3·독립 하트 어댑터3, 새 집6·실물 접지/가림3. 동일 B2 서버에서 그룹별 실행했다. 각 fixture POST 차단을 유지했으며 계수한 돌봄·이동·집·접지 검사의 POST0을 단언했다. 가짜 시계/실제 DB 쓰기 없음.
- 집6: PC 패널→좌우→좁은 아젠다 전환 시 한 pet·친밀도 유지,844×390 조작부 접근/초점 인계·Escape 배치 취소, reduced의 즉시 손길/375ms 놓기 오인 방지, PC·390 쿠션 귀환·꿈3개·SVG 간식, 짧은 탭/이른 스와이프 취소/420ms 집기 구분.
- 실물 접지3:1920→포스터 배율.91/폰트 reflow→1280, 모바일 normal/small/large, compact 쿠션. 실제 Range 글자77~118개·전체 조작영역13~38개와 몸체 proxy의 정지 충돌0, 접지 오차 최대0.00049px, export offsetWidth1840 유지. 새 glyph/폰트·뷰포트 측정과 표시를 독립 검사했으며 비행 중 무충돌로 확대하지 않는다.
- 256셀 전체 박스 대신 선택 clip 등록의 native80 보호 union(left12.582645/right68.258333/top25/bottom82)에 여유를 둔 .76×size 몸체·입력 영역을 사용한다. 화면 밖 경계는 전체 sprite 크기를 유지한다. 이 차이가 좁은 아젠다의 정상 바닥을 보존한다. 하트 효과는 축소한 입력 영역과 분리된 전체 월드 좌표계를 사용한다.
- 기존 단언의 변경은 새 계약을 직접 검사하도록 했다: 절대 height−18 바닥→실제 하단바 위의 안전 발판, 카드 외곽 top→실제 glyph top−3, 옛 메뉴 정지→설정/숨김의 실제 정지, 짧은 보행 뒤 제자리 행동을 포함하던1.6초 표본→연속 보행 구간. 독립 하트 fixture도 실제 event-main 구조/안전 높이를 가지며 최초 rAF 이전 빈 관측 상태를 초기화한다. 중간 실패를 통과로 합치지 않는다.
- 독립 코드 검토의 초점/잔여 애니메이션 fill/효과 좌표 문제를 수정 후 재검토, 확정 차단 없음. 별도 UI 검토자는 B2 1920·900·390 캡처를 실제 열어 집·자판기 위계/잘림/접지·본문 가림을 확인했다. 실제 터치나 캐릭터 미술 전문 승인으로 확대하지 않는다.

보조 캡처: `.scratch-pw/companion-home-{responsive,cushion-1920,cushion-390}.png`, `companion-presence-{pc1920,pc1280,mobile-normal,mobile-small,mobile-large,mobile-home}.png`, `viewer-companion-eating-{1440,390}.png`. 추적 문서에는 실제 공개 일정 내용이나 계정 식별자를 복사하지 않는다.

실제 `/` local PC1920×1080·mobile390×844(hasTouch/isMobile) 두뷰 완료. 과거2025-09 cookie/표시 연도 확인, 기본OFF atlas0→ON1, 손길/실제 Chromium touch430ms 집기·이동/공통SVG 음식 선택·배치·섭취/쿠션 수면/resize 동일DOM pet와 care/하단 집 조작 native click/설정OFF 제거/export밖 확인. 각뷰 pageerror0·기존 루트POST1차단·송신0. `.scratch-pw/companion-home-root-local.json`과 두뷰 PNG 보존. PC의 긴 기존 태그 필터 아래 집 하단은 첫 화면에 전부 담기지 않지만 전체 페이지 스크롤로 접근됨을 실제 클릭으로 확인했다. 모바일 compact는 한 화면/짧은 가로에서 한 내부 스크롤 평면을 사용한다.

기존 `harness:verify`의 rule inventory2실패 유지. 별도 session-brief 생성은 기존 AGENTS/CURRENT_STATE 크기 예산·완료 행 문제로 실패하며 이 기능 수정의 성공으로 숨기지 않는다.

## 운영 배포

제품 `5e0c04d4ecc9e819d62fea72eb384d0111d1f8c7` push 후 [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/5MikY7nGdVC3R1JP4vBK1XAi5ZX7) 성공과 운영 `/api/soop-live` build SHA 일치를 확인했다.

배포 후 실제 `/` PC1920×1080·mobile390×844 두뷰 smoke exit0. 과거2025-09 확인, 기본OFF atlas0→ON1, 패널/compact집 및 하단 조작 접근, 손길 친밀도·집기(모바일 trusted Chromium touch)·SVG 음식 배치/섭취·쿠션 수면·resize 동일DOM/care·OFF 제거·export밖을 확인했다. 각뷰 pageerror0·기존 루트POST1차단·실제서버송신0. `.scratch-pw/companion-home-root-production.json`과 `companion-home-root-production-{1920,390}.png` 보존·직접 열람했다. 실제 Safari/물리 GPU/장기 사용성 검증으로 확대하지 않는다.

배포 후 변경은 완료 상태·검증 기록 문서뿐이다. 제품 실행 코드와 실제 데이터는 수정하지 않았다.

공개DTO/인증/권한/unlock/KST/1840기하 변경0, 실제 DB 쓰기0을 목표로 fixture·차단한 POST만 검증한다. 실제 Safari·물리 저사양 GPU/배터리·스크린리더와 장기 애착/주관적 재미는 별도 미검증이다.
