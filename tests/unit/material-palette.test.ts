import {describe,it,expect} from 'vitest';
import {harmonizeMaterial} from '../../components/shared/ambient/world/material-palette';
import type {SeasonKey} from '../../components/shared/ambient/registry';
describe('biome material albedo',()=>{
 it('preserves the approved meadow and alpha for every season',()=>{
  for(const season of ['spring','summer','autumn','winter'] as SeasonKey[]){
   const p=new Uint8ClampedArray([120,190,95,91,255,255,255,0]),original=p.slice();harmonizeMaterial(p,'meadow',season);expect(p).toEqual(original);
   harmonizeMaterial(p,'mountain',season);expect(p[3]).toBe(91);expect(p.slice(4)).toEqual(original.slice(4));
  }
 });
 it('subdues mountain highlights and keeps seasonal color identity',()=>{
  const leaf=new Uint8ClampedArray([145,201,106,255]);harmonizeMaterial(leaf,'mountain','summer');expect(leaf[1]).toBeLessThan(175);expect(leaf[1]).toBeGreaterThan(leaf[0]);
  const petal=new Uint8ClampedArray([228,166,181,255]);harmonizeMaterial(petal,'mountain','spring');expect(petal[0]).toBeGreaterThan(petal[1]);
  const straw=new Uint8ClampedArray([187,166,123,255]);harmonizeMaterial(straw,'forest','winter');expect(straw[0]).toBeGreaterThan(straw[2]);
 });
});
