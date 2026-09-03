// 업 도움/기간 안내 띠 그룹 호버 — DOM 클래스 토글(2026-09-03 성능).
// 띠는 칸마다 별도 조각이라 CSS :hover만으로는 한 조각만 밝아져 마디가 보인다. 예전엔 React 상태
// (hoverSupportId)로 같은 id의 조각을 함께 밝혔는데, 그 상태 하나가 포스터/편집실 컴포넌트
// 전체(수천 줄·수백 노드)를 리렌더해 띠 위를 지날 때마다 ≈180ms(CPU 4배 스로틀) 롱태스크가
// 났다 — 약한 PC에서 "프레임이 툭툭 끊기는" 원인. 이제 같은 id의 조각을 직접 찾아 클래스만
// 얹고 뗀다: 리렌더 0, 결과는 동일(.is-hover).
// React가 그 사이 className을 다시 쓰면(다른 상태 변화) 얹은 클래스가 사라질 수 있다 —
// 다음 mouseenter에서 다시 얹히므로 무해.
export function setBandHover(root: ParentNode | null, id: string, on: boolean): void {
  if (!root || typeof CSS === "undefined") return;
  const nodes = root.querySelectorAll<HTMLElement>(`.support-bar[data-supportid="${CSS.escape(id)}"]`);
  for (const el of nodes) el.classList.toggle("is-hover", on);
}
