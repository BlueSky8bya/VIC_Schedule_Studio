import { expect, type Page } from "@playwright/test";
import { safeCompanionSurfaces, type CompanionSurface, type CompanionTextRect } from "@/lib/ui/viewer-companion/geometry";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { openCompanionHome } from "./companion-home";
import { settlePanelLayout } from "./panel-layout";

export type NumberedFloor157Admission = {
  room: { x: number; y: number; width: number; height: number };
  floor: CompanionSurface; size: number; obstacles: CompanionTextRect[];
  spans: CompanionSurface[]; chosen: CompanionSurface; platform: string;
  requested: { x: number; y: number }; settled: { x: number; y: number };
  settling: { at: number; x: number; y: number; floorY: number; platform: string; state: string; sameActor: boolean; eligible: boolean }[];
  secondaryAvailable: boolean; admission: "actual-secondary" | "actual-canonical-only";
};

/** Derive candidates from actual painted room/control rectangles, then admit
 * only the support reached through public P placement. No runtime graph or
 * geometry replacement is supplied. A physically absent secondary span is
 * recorded as such; canonical activity never counts as numeric evidence. */
export async function placeCompanionOnMeasuredFloor157(page: Page): Promise<NumberedFloor157Admission> {
  const fold = page.getByRole("button", { name: "패널 접기", exact: true });
  if (await fold.isVisible()) await fold.click();
  else {
    const toggles = page.locator('[data-act="panel-toggle"][aria-pressed="true"]:visible');
    if (await toggles.count() === 1) await toggles.click();
  }
  await settlePanelLayout(page);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  const measured = await home.evaluate((house, inset) => {
    const visible = (node: Element) => {
      const r = node.getBoundingClientRect(), css = getComputedStyle(node);
      return r.width > 0 && r.height > 0 && css.visibility !== "hidden" && css.display !== "none" && !node.closest('[hidden],[inert],[aria-hidden="true"]');
    };
    const rect = (node: Element) => { const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
    const room=house.querySelector(".vc-home-room")!.getBoundingClientRect();
    const floor=house.querySelector(".vc-home-floor")!.getBoundingClientRect();
    const pet=document.querySelector(".vc-companion")!.getBoundingClientRect();
    const obstacles=[...house.querySelectorAll("button,a[href],input,select,textarea,[role='button']")]
      .filter(node=>visible(node)&&!node.closest(".vc-companion,.vc-cushion-button,.vc-toys,.vc-toy,[data-home-decoration-control]"))
      .map(rect);
    // Visible text has its own actual ink box, even on an exempt sofa button.
    const walker=document.createTreeWalker(house,NodeFilter.SHOW_TEXT);
    let text:Node|null;
    while((text=walker.nextNode())) {
      if(!text.textContent?.trim()||!text.parentElement||!visible(text.parentElement))continue;
      const range=document.createRange();range.selectNodeContents(text);
      for(const r of range.getClientRects())if(r.width>0&&r.height>0)obstacles.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      range.detach();
    }
    return {room:{x:room.x,y:room.y,width:room.width,height:room.height},
      floor:{x:floor.left,y:floor.bottom-inset,width:floor.width},size:pet.width,obstacles,
      viewport:{width:innerWidth,height:innerHeight}};
  }, COMPANION_HOME_FLOOR_INSET);
  expect(measured.room.width,"Real launcher must open the wide floating room").toBeGreaterThan(400);
  const spans=safeCompanionSurfaces(measured.floor,measured.obstacles,measured.size,measured.viewport,
    {width:measured.size*.76,height:measured.size*.76});
  const secondary=spans.slice(1).filter(span=>span.width>=64).sort((a,b)=>b.width-a.width)[0];
  const chosen=secondary??spans.find(span=>span.width>=64);
  expect(chosen,"Admission requires an actual >=64px safe floor interval").toBeTruthy();
  if(!chosen)throw Error("No measured room floor interval can admit an actual24px walk");
  const requested={x:chosen.x+chosen.width/2,y:chosen.y-8};
  const pet=page.locator(".vc-companion"),actor=pet.getByRole("button",{name:"빅타민 · 쓰다듬고 옮기기",exact:true});
  const identity=(await pet.elementHandle())!;
  await actor.focus();await actor.press("p");await expect(pet).toHaveAttribute("data-placing","");
  await page.mouse.click(requested.x,requested.y);await page.mouse.move(2,2);
  await expect(pet).not.toHaveAttribute("data-placing");await expect(pet).not.toHaveAttribute("data-state","jump");
  await expect(pet).toHaveAttribute("data-platform",secondary?/^companion-home-floor-[1-9]\d*$/:/^companion-home-floor$/);
  const settling: NumberedFloor157Admission["settling"] = [];
  // Public P release has a real transient offset. Admit only two distinct,
  // stable measurements of the current body on its current real floor;
  // elapsed time or a support label alone never proves painted arrival.
  await expect.poll(async () => {
    const sample = await identity.evaluate((node, { inset, secondary, chosen }) => {
      const actor=node as HTMLElement, body=actor.getBoundingClientRect();
      const floor=document.querySelector(".vc-home-floor")?.getBoundingClientRect();
      const platform=actor.dataset.platform??"",state=actor.dataset.state??"";
      const x=body.x+body.width/2,y=body.bottom,floorY=floor?floor.bottom-inset:NaN;
      const sameActor=node.isConnected&&node===document.querySelector(".vc-companion");
      const eligible=sameActor&&body.width>0&&body.height>0&&Number.isFinite(floorY)
        &&!actor.hasAttribute("data-placing")&&!["jump","held"].includes(state)
        &&(secondary?/^companion-home-floor-[1-9]\d*$/.test(platform):platform==="companion-home-floor")
        &&platform!=="companion-home-floor-400"&&Math.abs(y-floorY)<2&&x>=chosen.x&&x<=chosen.x+chosen.width;
      return {at:performance.now(),x,y,floorY,platform,state,sameActor,eligible};
    }, { inset: COMPANION_HOME_FLOOR_INSET, secondary: Boolean(secondary), chosen });
    settling.push(sample);
    const previous=settling.at(-2);
    return Boolean(previous?.eligible&&sample.eligible&&sample.at-previous.at>=35&&sample.at-previous.at<=180
      &&sample.platform===previous.platform&&Math.hypot(sample.x-previous.x,sample.y-previous.y)<.5
      &&Math.abs(sample.floorY-previous.floorY)<.5);
  }, { timeout: 5000, intervals: [40] }).toBe(true);
  const last=settling.at(-1)!,platform=last.platform,settled={x:last.x,y:last.y};
  expect(Math.abs(settled.y-last.floorY)).toBeLessThan(2);
  expect(settled.x).toBeGreaterThanOrEqual(chosen.x);expect(settled.x).toBeLessThanOrEqual(chosen.x+chosen.width);
  expect(await identity.evaluate(node=>node.isConnected&&node===document.querySelector(".vc-companion"))).toBe(true);
  return {...measured,spans,chosen,requested,settled,settling,platform,secondaryAvailable:Boolean(secondary),
    admission:secondary?"actual-secondary":"actual-canonical-only"};
}
