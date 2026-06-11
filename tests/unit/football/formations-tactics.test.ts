import { describe, expect, it } from "vitest";
import { FORMATIONS } from "@/lib/football/tactics/formations";
import { STYLES } from "@/lib/football/tactics/profiles";
import type { FormationId } from "@/lib/football/core/types";

describe("포메이션", () => {
  it("모든 포메이션은 필드 10명(키퍼 제외) 슬롯", () => {
    Object.entries(FORMATIONS).forEach(([id, slots]) => {
      expect(slots.length, id).toBe(10);
    });
  });
  it("슬롯 좌표는 0..1 정규화", () => {
    Object.values(FORMATIONS).forEach((slots) => {
      slots.forEach((s) => {
        expect(s.bx).toBeGreaterThanOrEqual(0);
        expect(s.bx).toBeLessThanOrEqual(1);
        expect(s.by).toBeGreaterThanOrEqual(0);
        expect(s.by).toBeLessThanOrEqual(1);
      });
    });
  });
  it("이름과 슬롯 합이 대략 일치(예: 4-3-3 → 수비3+ 등)", () => {
    // 4-6-0은 제로톱(FW 0), 4-3-3은 FW/WG 3.
    expect(FORMATIONS["4-6-0"].filter((s) => s.role === "FW").length).toBe(0);
    expect(FORMATIONS["4-3-3"].filter((s) => s.role === "FW" || s.role === "WG").length).toBe(3);
  });
});

describe("전술 스타일", () => {
  it("모든 전술의 선호 포메이션이 FORMATIONS에 존재(빠지면 makeMatchup서 undefined)", () => {
    STYLES.forEach((st) => {
      st.forms.forEach((f) => {
        expect(FORMATIONS[f as FormationId], `${st.name} → ${f}`).toBeDefined();
      });
    });
  });
  it("수치 범위 정상", () => {
    STYLES.forEach((st) => {
      expect(st.press).toBeGreaterThanOrEqual(0.4);
      expect(st.press).toBeLessThanOrEqual(1);
      expect(st.possession).toBeGreaterThanOrEqual(0);
      expect(st.possession).toBeLessThanOrEqual(1);
      expect(st.tempo).toBeGreaterThan(0.8);
      expect(st.tempo).toBeLessThan(1.3);
    });
  });
  it("추가 8종 포함(총 20)", () => {
    expect(STYLES.length).toBe(20);
    expect(STYLES.map((s) => s.name)).toContain("포지셔널 플레이");
    expect(STYLES.map((s) => s.name)).toContain("실리 축구");
  });
  it("ASCII id가 모두 유일(RL task/log 키)", () => {
    const ids = STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(STYLES.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9_]+$/));
  });
  it("모든 전술은 reward anchor를 1개 이상 가진다", () => {
    STYLES.forEach((st) => {
      expect(st.rewardAnchors.length, st.name).toBeGreaterThan(0);
      expect(new Set(st.rewardAnchors).size, `${st.name} 중복 anchor`).toBe(st.rewardAnchors.length);
    });
  });
});
