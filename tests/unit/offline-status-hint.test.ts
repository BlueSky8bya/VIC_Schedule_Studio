import {describe,expect,it} from 'vitest';
import {offlineSnapshotHint} from '@/components/pwa/offline-indicator';

describe('offline status hints describe only known public snapshot age',()=>{
 const now=Date.parse('2026-10-28T11:00:00Z');
 for(const value of[null,0,-1,Number.NaN,Number.POSITIVE_INFINITY])it(`unknown age ${String(value)} requests save/update confirmation`,()=>{
  expect(offlineSnapshotHint(value,now)).toBe('저장·갱신 확인 필요');
 });
 for(const[ms,label]of[[0,'공개 일정 방금 보관'],[59999,'공개 일정 방금 보관'],[60000,'공개 일정 1분 전 보관'],[59*60000,'공개 일정 59분 전 보관'],[60*60000,'공개 일정 1시간 전 보관'],[23*3600000,'공개 일정 23시간 전 보관'],[24*3600000,'공개 일정 1일 전 보관'],[48*3600000,'공개 일정 2일 전 보관']]as const)it(`labels age ${ms} without claiming editor synchronization`,()=>{
  expect(offlineSnapshotHint(now-ms,now)).toBe(label);
 });
 it('does not describe a future clock-skewed timestamp as a fresh successful synchronization',()=>{
  expect(offlineSnapshotHint(now+1000,now)).toBe('공개 일정 보관 시각 확인 필요');
 });
});
