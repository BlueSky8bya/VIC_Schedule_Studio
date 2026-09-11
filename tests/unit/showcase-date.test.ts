import { describe, expect, it } from 'vitest';
import { getDayMark } from '../../lib/calendar/holidays';
import { shiftShowcaseDay } from '../../components/shared/ambient/showcase-date';

describe('showcase civil date steps', () => {
  it.each([
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2027-03-01', -1, '2027-02-28'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
  ])('%s %+i days becomes %s', (date, delta, expected) => {
    expect(shiftShowcaseDay(date as string, delta as number)).toBe(expected);
  });
});

it('uses the official substitute dates, not the Saturday after Chuseok',()=>{
  expect(getDayMark('2026-08-17')?.isHoliday).toBe(true);
  expect(getDayMark('2026-09-26')?.isHoliday).toBe(true);
  expect(getDayMark('2026-09-28')?.isHoliday ?? false).toBe(false);
  expect(getDayMark('2027-05-03')?.isHoliday).toBe(true);
});
