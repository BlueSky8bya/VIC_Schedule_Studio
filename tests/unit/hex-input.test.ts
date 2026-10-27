import {describe,expect,it} from 'vitest';
import {parseHexInput} from '@/lib/tags/hex-input';
import {hexToHsv,hsvToHex} from '@/lib/tags/color-tone';
describe('HEX input editing contract',()=>{
  it.each(['8CD4A5','#8cd4a5',' #8Cd4A5 ',' 8cd4a5\n'])('accepts pasted complete RGB %j',text=>{
    expect(parseHexInput(text)).toEqual({state:'complete',hex:'#8cd4a5'});
    const hsv=hexToHsv('#8cd4a5');expect(hsvToHex(hsv.h,hsv.s,hsv.v)).toBe('#8cd4a5');
  });
  it.each(['','#','1',' #aB ','abc','abcd','abcde'])('leaves partial text editable %j',text=>expect(parseHexInput(text)).toEqual({state:'incomplete'}));
  it.each(['GG00ZZ','##aabbcc','#aabbccdd','rgb(1,2,3)','ab cd ef','<script>','#12345g','1234567'])('rejects malformed RGB %j',text=>expect(parseHexInput(text)).toEqual({state:'invalid'}));
});
