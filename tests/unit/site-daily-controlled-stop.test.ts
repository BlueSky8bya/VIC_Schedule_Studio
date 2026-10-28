import {describe,it,expect} from 'vitest';
// @ts-expect-error Offline QA tool, excluded from the application runtime.
import {controlledMaxFailureStop} from '../../scripts/site-daily/receipts.mjs';

const config=(maxFailures=3,retries=0)=>"import {defineConfig} from '@playwright/test';export default defineConfig("+JSON.stringify({maxFailures,retries})+');';
function fixture(){
 const row=(title:string,status:string)=>({title,tests:[{projectName:'',expectedStatus:'passed',status:status==='passed'?'expected':'unexpected',annotations:[] as {type:string}[],results:[{status,retry:0,duration:500,errors:status==='failed'?[{message:'actual assertion'}]:[]}]}]});
 return {reporter:{errors:[{message:'\u001b[31mTesting stopped early after 3 maximum allowed failures.\u001b[39m'}],suites:[{file:'tests/visual/example.spec.ts',specs:[row('completed','passed'),row('failed1','failed'),row('failed2','failed'),row('failed3','failed'),row('interrupted','interrupted')]}]},result:{failure:'selected-native-failed-or-budget',listOnly:false,stages:[{name:'registration',code:0},{name:'native',code:1}]}};
}
describe('controlled maxFailures stop preserves per-case proof without changing failures',()=>{
 it('recognizes the exact bound stop and leaves passed/failed/interrupted originals byte-identical',()=>{
  const f=fixture(),before=JSON.stringify(f);expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(true);expect(JSON.stringify(f)).toBe(before);
 });
 it('does not trust maxFailures text when the actual failure count or bound config disagrees',()=>{
  const f=fixture();expect(controlledMaxFailureStop(f.reporter,f.result,config(4))).toBe(false);f.reporter.suites[0].specs.splice(2,1);expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(false);
 });
 it('rejects unknown/extra global errors and malformed configuration without executing source',()=>{
  const f=fixture();expect(controlledMaxFailureStop(f.reporter,f.result,'throw new Error("never execute")')).toBe(false);f.reporter.errors.push({message:'Worker crashed'});expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(false);
 });
 it('does not count interruptions, expected failures, retries or skips as the triggering assertions',()=>{
  for(const change of ['interrupted','expected-failure','retried','skipped']){
   const f=fixture(),spec=f.reporter.suites[0].specs[1],r=spec.tests[0];
   if(change==='interrupted')r.results[0].status='interrupted';
   if(change==='expected-failure')r.expectedStatus='failed';
   if(change==='retried')r.results[0].retry=1;
   if(change==='skipped')r.annotations.push({type:'skip'});
   expect(controlledMaxFailureStop(f.reporter,f.result,config()),change).toBe(false);
  }
 });
 it('requires registration success, native exit1, no retries and the exact failed-run marker',()=>{
  const f=fixture();expect(controlledMaxFailureStop(f.reporter,f.result,config(3,1))).toBe(false);f.result.stages[1].code=0;expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(false);f.result.stages[1].code=1;f.result.stages[0].code=1;expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(false);f.result.stages[0].code=0;f.result.listOnly=true;expect(controlledMaxFailureStop(f.reporter,f.result,config())).toBe(false);
 });
});
