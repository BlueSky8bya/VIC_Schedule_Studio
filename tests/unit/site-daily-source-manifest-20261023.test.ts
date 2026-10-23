import {describe,it,expect} from 'vitest';
const file='../../scripts/site-daily/scoped-native.mjs';
const {validateSourceManifest,options}=await import(file) as {validateSourceManifest:(rows:unknown)=>string[];options:(args:string[])=>{sourceManifest?:string}};
describe('explicit isolated snapshot source additions',()=>{
  it('includes declared local dependencies without staging user files',()=>{expect(validateSourceManifest(['lib/ui/viewer-companion/catalog-display.ts','components/poster/viewer-companion/companion-memory-portrait.tsx'])).toHaveLength(2);expect(options(['--plan','local.json','--source-manifest','approved.json']).sourceManifest).toBe('approved.json');});
  it.each(['.env.local','art-src/private/original.png','../private.ts','C:/private.ts','app/../../.env','docs/feedback_sources/user.txt','lib/.git/config','lib/.env','components\\unsafe.ts'])('rejects private or escaping entry %s',value=>expect(()=>validateSourceManifest([value])).toThrow('invalid-explicit-source-manifest'));
  it('rejects malformed and duplicated entries and bounded cardinality overflow',()=>{for(const input of [null,'app/page.tsx',[null],['app/page.tsx','app/page.tsx'],Array(10001).fill('app/page.tsx')])expect(()=>validateSourceManifest(input)).toThrow();});
});
