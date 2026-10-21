import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const output=process.env.COMPANION161_OUTPUT??".scratch-pw/expressions161-observations";
test.use({ viewport:{width:1440,height:1100},storageState:{cookies:[],origins:[]},serviceWorkers:"block" });
test("161 all36 actual face rigs preserve source alpha and silhouette at three phases and poses",async({page,context,baseURL})=>{
 const errors:string[]=[],rejected:string[]=[],origin=new URL(baseURL!).origin,proof:unknown[]=[];page.on("pageerror",e=>errors.push(e.message));
 await context.route("**/*",r=>{const q=r.request(),url=new URL(q.url());if(url.origin!==origin||!["GET","HEAD"].includes(q.method())||url.pathname.startsWith("/api/")){rejected.push(q.method()+" "+url.pathname);return r.abort();}return r.continue();});
 await page.goto("/visual-fixture/companion-expressions");const canvas=page.locator('canvas[data-expression]');await expect(canvas).toHaveCount(36);await expect(page.locator('canvas[data-result="ready"]')).toHaveCount(36);
 const fingerprints=new Map<string,string[]>();
 for(const row of ["0","1","9"]){await page.getByRole("combobox",{name:"원화 포즈",exact:true}).selectOption(row);for(const phase of [3,10,16]){
  const slider=page.getByRole("slider",{name:"표정 진행",exact:true});await slider.focus();await slider.press("Home");for(let n=0;n<phase;n++)await slider.press("ArrowRight");await expect(page.locator('canvas[data-result="ready"]')).toHaveCount(36);
  // Wait for actual effects to draw the selected native slider value, without
  // patching animation time, image data or product state.
  await page.waitForTimeout(120);
  const samples=await canvas.evaluateAll(nodes=>nodes.map(n=>{const c=n as HTMLCanvasElement;return{id:c.dataset.expression!,alpha:Number(c.dataset.alphaChanges),changed:Number(c.dataset.changedPixels),painted:c.dataset.painted,source:c.dataset.source,pixels:c.toDataURL()};}));
  for(const sample of samples){expect(sample.alpha).toBe(0);expect(sample.changed).toBeGreaterThan(0);expect(sample.painted).toBe("true");if(row==="0"){const values=fingerprints.get(sample.id)??[];values.push(createHash("sha256").update(sample.pixels).digest("hex"));fingerprints.set(sample.id,values);}}
  proof.push({row,phase:await slider.inputValue(),samples:samples.map(({pixels,...rest})=>({...rest,sha256:createHash("sha256").update(pixels).digest("hex")}))});
  if(phase===10){mkdirSync(output,{recursive:true});await page.screenshot({path:resolve(output,`expressions-row-${row}.png`),fullPage:true});}
 }}
 expect(new Set([...fingerprints.values()].map(v=>v.join(":"))).size).toBe(36);expect(errors).toEqual([]);expect(rejected).toEqual([]);mkdirSync(output,{recursive:true});writeFileSync(resolve(output,"all36-rig-proof.json"),JSON.stringify({proof,distinctSequences:36,errors,rejected,scope:"Actual production-compiled painter, existing source alpha compared pixel-for-pixel in the gated fixture. This is expression-render coverage, not36 natural-life trigger receipts."},null,2));
});
