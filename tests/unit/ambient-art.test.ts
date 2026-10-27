import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ART_SLOTS,batchPrompt,codexMasterPrompt,dotBlock,dotGrid,pilotFiles,pilotPrompt,pilotSlots,slotFiles,slotPrompt,isFiller,recommendedVariants,SOURCE_EDGE,targetEdge,viewKoOf,viewTagOf} from '@/components/shared/ambient/art/manifest';
import {monthTraces} from '@/components/shared/ambient/world/traces';
describe('current sky art and retained generic render contracts',()=>{
it("id는 유일하고 파일 이름으로 안전하다", () => {
    const ids = ART_SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
it("저장 목표 변과 도트 격자는 1024를 정수로 나눈다", () => {
    for (const s of ART_SLOTS) {
      const edge = targetEdge(s.px);
      const grid = dotGrid(s.px, s.grid);
      expect(SOURCE_EDGE % edge, `${s.id} 목표 변 ${edge}`).toBe(0);
      expect(SOURCE_EDGE % grid, `${s.id} 격자 ${grid}`).toBe(0);
      expect(dotBlock(s.px, s.grid), `${s.id} 블록`).toBe(SOURCE_EDGE / grid);
      // 저장본은 자리 상자를 DPR 2로 그릴 만큼은 커야 한다(화면 px의 2배 이상).
      expect(edge, `${s.id} 저장 변이 화면보다 작다`).toBeGreaterThanOrEqual(Math.min(512, Math.max(s.px[0], s.px[1]) * 2));
    }
  });
it("도트 격자는 자리 크기를 따라간다 — 고정값이면 작은 자리의 도트가 화면에서 사라진다", () => {
    // 화면 도트 = 자리 긴 변 × DPR 2 ÷ 격자. 1.5~8 장치px 안에 들어야 "굵은 점"으로 읽힌다.
    for (const s of ART_SLOTS.filter((x) => x.phase === 1)) {
      const dot = (Math.max(s.px[0], s.px[1]) * 2) / dotGrid(s.px, s.grid);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeGreaterThanOrEqual(1.5);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeLessThanOrEqual(8);
    }
  });
it("권장 수식은 반복 한도와 상·하한을 지킨다", () => {
    expect(recommendedVariants(12)).toBe(6); // 한 화면 12 → 한 변형이 2회
    expect(recommendedVariants(16)).toBe(8);
    expect(recommendedVariants(40)).toBe(8); // 상한 8 — 그 위는 생성 비용이 이득을 넘는다
    expect(recommendedVariants(2)).toBe(2); // 하한은 화면 개수를 넘지 않는다 — 둘뿐이면 둘이면 된다
    expect(recommendedVariants(8)).toBe(4);
    expect(recommendedVariants(34, true)).toBe(6); // 잔 소품 상한 6
    expect(recommendedVariants(2, true)).toBe(2);
  });
it("목록 카드 소스에 브리프·규격 칩이 없다", () => {
    const src = fs.readFileSync("components/studio/ambient-art-board.tsx", "utf8");
    const card = src.slice(src.indexOf("const Card = memo("), src.indexOf("export function AmbientArtBoard"));
    expect(card).not.toContain("slot.brief");
    expect(card).not.toContain("art-brief");
    expect(card).not.toContain("VIEW_SHORT");
    // 대신 진행을 칸으로 그린다.
    expect(card).toContain("art-pips");
  });
it("자리 상세는 그 셋을 전부 맡는다", () => {
    const src = fs.readFileSync("components/studio/ambient-art-slot.tsx", "utf8");
    expect(src).toContain("slot.brief");
    expect(src).toContain("artslot-spec");
    expect(src).toContain("dotsAcross");
  });
it("8월 말 연잎 12장은 서로 겹치지 않게 떨어져 있다(가로 .045·세로 .06 밖)", () => {
    const pads = monthTraces("vic", 2026, 8).filter((t) => t.kind === "lilypad");
    expect(pads.length).toBe(12);
    let close = 0;
    for (let i = 0; i < pads.length; i++)
      for (let j = i + 1; j < pads.length; j++)
        if (Math.abs(pads[i].u - pads[j].u) <= 0.045 && Math.abs(pads[i].v - pads[j].v) <= 0.06) close++;
    expect(close).toBeLessThanOrEqual(1);
  });
it('uses exact current sky variant filenames and no retired species slots',()=>{expect(slotFiles(ART_SLOTS.find(s=>s.id==='sun-disc')!)).toEqual(['sun-disc-1.png','sun-disc-2.png']);expect(slotFiles(ART_SLOTS.find(s=>s.id==='moon-phase')!)).toHaveLength(8);expect(ART_SLOTS.every(s=>s.category==='sky')).toBe(true);});
it('copies only current sky files and refuses the retired ecology phase',()=>{const prompt=codexMasterPrompt();for(const s of ART_SLOTS)expect(prompt).toContain('| '+s.id+' |');expect(()=>codexMasterPrompt(2)).toThrow(/retired/);expect(codexMasterPrompt(1)).toBe(prompt);expect(prompt).not.toMatch(/tree-pine|fish-palechub|bug-firefly/);});
it('pilot copy is limited to the two current cloud-wisp files',()=>{expect(pilotSlots().map(s=>s.id)).toEqual(['cloud-wisp']);expect(pilotSlots().flatMap(pilotFiles)).toEqual(['cloud-wisp-1.png','cloud-wisp-2.png']);const p=pilotPrompt();expect(p).toContain('cloud-wisp-1.png');expect(p).not.toContain('cloud-wisp-3.png');});
it('keeps front-facing sky cameras in individual and batch prompts',()=>{for(const s of ART_SLOTS){expect(viewTagOf(s)).toBe('sky(정면)');expect(viewKoOf(s)).toContain('정면');expect(slotPrompt(s)).toContain(s.brief);expect(batchPrompt([s],'sky')).toContain('sky(정면)');}});
it('keeps sky repetition budgets and exact table columns',()=>{const fillers=ART_SLOTS.filter(s=>s.perScreen);expect(fillers).toHaveLength(5);for(const s of fillers){expect(s.variants).toBeGreaterThanOrEqual(recommendedVariants(s.perScreen!,isFiller(s)));expect(isFiller(s)).toBe(false);}const lines=batchPrompt(ART_SLOTS,'sky').split('\n').filter(l=>l.startsWith('|'));expect(lines.length).toBe(ART_SLOTS.length+2);expect(new Set(lines.map(l=>l.split('|').length)).size).toBe(1);});
});
