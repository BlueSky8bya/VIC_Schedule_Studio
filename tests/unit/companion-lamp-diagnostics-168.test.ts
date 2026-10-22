import {describe,it,expect} from 'vitest';
import {createLampDiagnosticBuffer,safeLampFacts} from '@/lib/ui/viewer-companion/lamp-diagnostics';
describe('168 purpose-limited local lamp evidence',()=>{
  it('keeps only finite numeric gates, known options and booleans',()=>{
    expect(safeLampFacts({stage:'paint',serial:2,x:1.234567,personality:'balanced',speed:'lively',prepared:false,pull:NaN,y:Infinity})).toEqual({stage:'paint',serial:2,x:1.2346,personality:'balanced',speed:'lively',prepared:false});
  });
  it('excludes identity, credentials, content, learned/collection values and unknown strings even under allowed field names',()=>{
    expect(safeLampFacts({cookie:'secret',token:'secret',email:'private',title:'private',foodId:'private',habits:{private:true},kind:'private title',personality:'private',font:'https://private.invalid',stage:'https://private.invalid',x:'private',lit:'private',__proto__:{token:'secret'}})).toEqual({});
  });
  it('bounds retained facts and exports a fresh list without exposing internal state',()=>{
    const buffer=createLampDiagnosticBuffer(()=>({font:'maple',textPx:18,account:'private'}),'a'.repeat(40));
    for(let at=0;at<1000;at++)buffer.record({at,stage:'paint',token:'private'});
    const snapshot=buffer.snapshot();expect(snapshot.frames).toHaveLength(720);expect(snapshot.frames[0]).toEqual({at:280,stage:'paint'});expect(snapshot.context).toEqual({font:'maple',textPx:18});
    snapshot.frames[0].at=-1;snapshot.frames.pop();expect(buffer.snapshot().frames).toHaveLength(720);expect(buffer.snapshot().frames[0].at).toBe(280);expect(JSON.stringify(snapshot)).not.toContain('private');
  });
  it('isolates optional observation failures from the actor',()=>{
    const buffer=createLampDiagnosticBuffer(()=>{throw new Error('unavailable');},'a'.repeat(40));
    expect(()=>buffer.record(new Proxy({},{ownKeys(){throw new Error('unavailable');}}))).not.toThrow();
    expect(buffer.snapshot().context).toEqual({});
  });
  it('does not include arbitrary revision text',()=>{expect(createLampDiagnosticBuffer(()=>({}),'private').snapshot().revision).toBe('dev');});
});
