# 데뷔 나무·도토리 순환 — 아카이브(화면에서 잠시 내림, 2026-09-04)

> 📦 **보관 기록.** 소유자(2026-09-04 밤): "지금 나무 한 그루씩 들어가 있는 거 일단은 뺐다가 나중에 다시 넣자. 토리님 첫 방송일(23.05)이랑
> 데뷔일(25.10)에 해당하는 새싹이랑 씨앗 심은 그것도 아카이브에 기록해 두고 일단은 빼 두자." 코드·계산·테스트는 그대로 두고 **화면에서만**
> 내렸다(`components/shared/ambient/world/flags.ts` → `WORLD_FLAGS.treeChain = false`). 바이옴 세계(PLAN-20260904-004) P1에서
> 초원의 구도·축척이 정해지면 다시 켠다.

## 무엇이 있었나

### 데뷔 나무(소유자 서사, 2026-09-04)
- **세계 탄생 2023-05** — 토리님이 처음 나온 달. 그 전 달을 보면 흔적이 하나도 없다.
- **2023-05 씨앗 하나**를 심는다(흙더미로 보인다, 2년 반 잠잠).
- **2025-10-01 스트리머 데뷔일에 싹**이 튼다(백참나무는 실제로 가을에 발아한다 — 서사와 식물학이 맞는다).
- 그 뒤 **실제 참나무 생장 속도**로 자란다: 첫 90일 4 → 14cm, 겨울 정지, **생장기 4~9월에만** 자람 → 1년째 ≈ 45cm(🌿 어린 나무), 2027 ≈ 1.1m
  (작은 수관), 5년째 ≈ 3m, 20년째 ≈ 11m, 상한 20m. 15cm까지 새싹, 80cm까지 어린 나무, 그 뒤 키에 비례하는 수관(반지름 ≈ 키/12, 상한 96px),
  겨울엔 헐벗은 가지. 과거 달을 보면 그때의 키, 미래 달은 예상 키.
- 자리: 정규화 `u .78 v .062`(위 띠, 두 화면 모두 달력 밖). 이제는 3/4 시점의 `toScreen`으로 지평선 바로 아래.

### 도토리 순환(PLAN-20260904-003 연대기)
- 데뷔 뒤 첫 가을(2025)부터: 가을에 다람쥐가 묻은 **저장소 흙더미 4~6개**(결정적 시드) → 2월 15일 해빙에 다시 보임 → 봄에 60%가 **싹** →
  여름 **묘목** → 가을 **나무**(나이 1부터, 상한 6그루, 수명 6주기라 세대가 돈다, 위 띠에 헤지로우처럼).
- 두더지 흙더미(봄 밤마다 하나, 여름 풀 얼룩) · 눈사람(12/20 → 27 완성, 2/15 → 25 녹음) · 연잎(6월 3장 → 8월 12장)은 **나무가 아니라 남겨 둔다**.

## 코드 위치(그대로 있다)
| 무엇 | 어디 |
|---|---|
| 세계 탄생·데뷔·생장 곡선 | `components/shared/ambient/world/chronicle.ts` — `WORLD_BIRTH`, `DEBUT`, `debutHeightCm`, `DEBUT_TREE_POS`, `CHRONICLE_EPOCH`, `TREE_CAP`, `TREE_LIFESPAN` |
| 흔적 조립 | 같은 파일 `chronicle(slug, y, m, d)` — kind `cache · sprout · sapling · tree · debut` |
| 렌더 | `components/shared/ambient/world/traces-draw.ts` — `drawTree`(아트 tree-oak-* 우선, 대체 캐노피/나목), `drawSprout`, `drawSapling`, `debut` 분기 |
| 아트 | `public/ambient/art/tree-oak-{spring,summer,autumn,winter}.png`(픽셀아트 확정판, 겨울 줄기 탈색) — 보드 `/studio/ambient-art` |
| 스위치 | `components/shared/ambient/world/flags.ts` — `WORLD_FLAGS.treeChain`, `visibleTraces()` (엔진 `refreshWorld`가 적용) |
| 테스트 | `tests/unit/ambient-world.test.ts`(데뷔 키·세계 탄생·겨울 정지·상한·연대기 사슬) — 스위치와 무관하게 계속 돈다 |
| 검증 | `.scratch-pw/probe-world.mjs` — `__vicAmbient.world().chronicle`(스위치 전 전체 수)로 확인 |

## 다시 켤 때 정할 것
1. **자리** — 초원 바이옴(★) 어디에 데뷔 나무를 둘지(랜드마크: 지평선 근처 오른쪽? 초원 가운데 뒤?). 다른 나무들은 숲 바이옴으로 갈 수도.
2. **축척** — 성목 수관 128 · 데뷔 상한 192(§2 표)로 이미 맞춰 둠. 거리 축소 .6 적용됨.
3. **아트** — 참나무 4장은 있음. 묘목(3)·새싹(1) 자리는 아직 대체물(Noto 이모지).
4. 켜기 = `WORLD_FLAGS.treeChain = true` 한 줄.
