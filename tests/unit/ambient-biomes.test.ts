import { describe, expect, it } from "vitest";
import { BIOME_ROWS, BIOMES, biomeAt, neighbor, screenDelta } from "@/components/shared/ambient/world/biomes";

describe("world/biomes — 열한 화면 지도(PLAN-20260904-004 §3)", () => {
  it("3×3 + 남쪽 바다 두 줄 = 11, 초원이 (0,0), 미니맵 줄은 5", () => {
    expect(Object.keys(BIOMES).length).toBe(11);
    expect(biomeAt(0, 0)).toBe("meadow");
    expect(BIOME_ROWS.flat().length).toBe(11);
  });
  it("오행 방위: 초원에서 위 = 민물, 왼쪽 = 언덕, 오른쪽 = 숲, 아래 = 모래해안", () => {
    expect(neighbor("meadow", "up")).toBe("pond");
    expect(neighbor("meadow", "left")).toBe("hill");
    expect(neighbor("meadow", "right")).toBe("forest");
    expect(neighbor("meadow", "down")).toBe("sandy");
  });
  it("모서리: 계곡·산·갯벌·암석해안. 지도 밖은 null(튕김)", () => {
    expect(neighbor("pond", "left")).toBe("valley");
    expect(neighbor("pond", "right")).toBe("mountain");
    expect(neighbor("hill", "down")).toBe("tidal");
    expect(neighbor("forest", "down")).toBe("rocky");
    expect(neighbor("valley", "up")).toBeNull();
    expect(neighbor("hill", "left")).toBeNull();
  });
  it("바다: 세 해안 어디서 내려가도 먼바다, 한 번 더 깊은 바다, 좌우는 막힘, 위로는 내려온 해안으로", () => {
    expect(neighbor("tidal", "down")).toBe("sea");
    expect(neighbor("sandy", "down")).toBe("sea");
    expect(neighbor("rocky", "down")).toBe("sea");
    expect(neighbor("sea", "down")).toBe("deep");
    expect(neighbor("deep", "down")).toBeNull();
    expect(neighbor("sea", "left")).toBeNull();
    expect(neighbor("deep", "right")).toBeNull();
    expect(neighbor("sea", "up", 1)).toBe("rocky");
    expect(neighbor("sea", "up", -1)).toBe("tidal");
    expect(neighbor("deep", "up")).toBe("sea");
  });
  it("화면 이동량: 초원→숲 (+1,0), 암석해안→먼바다 (0,+1)(x 접힘), 먼바다→해안 복귀는 가로 0", () => {
    expect(screenDelta("meadow", "forest")).toEqual([1, 0]);
    expect(screenDelta("rocky", "sea", 1)).toEqual([0, 1]);
    expect(screenDelta("sea", "rocky", 1)).toEqual([0, -1]);
    expect(screenDelta("meadow", "deep")).toEqual([0, 3]);
  });
});
