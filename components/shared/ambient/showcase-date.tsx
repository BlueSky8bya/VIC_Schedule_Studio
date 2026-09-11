"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getDayMark } from "@/lib/calendar/holidays";

/** Civil-date arithmetic only: UTC avoids applying the host machine's timezone. */
export function shiftShowcaseDay(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function DateNumberList({kind,value,onPick,onClose}:{kind:'year'|'month';value:number;onPick:(value:number)=>void;onClose:()=>void}) {
  const values=kind==='year'?Array.from({length:201},(_,i)=>1900+i):Array.from({length:12},(_,i)=>i+1);
  const [active,setActive]=useState(value);
  const listRef=useRef<HTMLDivElement>(null);
  const typed=useRef({text:'',at:0});
  useEffect(()=>{
    const button=listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${active}"]`);
    button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest'});
  },[active]);
  return <div className="sc-date-picker" ref={listRef} role="listbox" aria-label={kind==='year'?'연도 목록':'월 목록'} onKeyDown={e=>{
    let next=active;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();return;}
    const delta=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3,PageUp:-12,PageDown:12} as Record<string,number>)[e.key];
    if(delta)next=Math.max(values[0],Math.min(values.at(-1)!,active+delta));
    else if(e.key==='Home')next=values[0];
    else if(e.key==='End')next=values.at(-1)!;
    else if(/^\d$/.test(e.key)){
      const now=Date.now();typed.current={text:(now-typed.current.at<1000?typed.current.text:'')+e.key,at:now};
      next=values.find(v=>String(v).startsWith(typed.current.text))??active;
    }else return;
    e.preventDefault();e.stopPropagation();setActive(next);
  }}>
    {values.map(v=><button key={v} type="button" role="option" data-value={v} aria-selected={v===value} tabIndex={v===active?0:-1} onClick={()=>onPick(v)}>{v}{kind==='year'?'년':'월'}</button>)}
  </div>;
}

export function ShowcaseDate({ value, onChange, onClose }: { value: string; onChange: (value: string) => void; onClose: () => void }) {
  const [y, m] = value.split("-").map(Number);
  const [year, setYear] = useState(y);
  const [month, setMonth] = useState(m);
  const [picker,setPicker]=useState<'year'|'month'|null>(null);
  const yearRef=useRef<HTMLButtonElement>(null),monthRef=useRef<HTMLButtonElement>(null);
  const closePicker=()=>{(picker==='year'?yearRef:monthRef).current?.focus();setPicker(null);};
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayValue = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const turn = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setPicker(null);setYear(next.getUTCFullYear()); setMonth(next.getUTCMonth() + 1);
  };
  return <section className="sc-date-calendar" aria-label="날짜 선택" onKeyDown={e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if(picker)closePicker();else onClose(); }
  }}>
    <div className="sc-date-month">
      <button type="button" aria-label="이전 달" disabled={year === 1900 && month === 1} onClick={() => turn(-1)}>‹</button>
      <button className="sc-date-select" ref={yearRef} type="button" aria-label="연도" aria-haspopup="listbox" aria-expanded={picker==='year'} onClick={()=>setPicker(p=>p==='year'?null:'year')}>{year}년<ChevronDown size={13} aria-hidden="true"/></button>
      <button className="sc-date-select" ref={monthRef} type="button" aria-label="월" aria-haspopup="listbox" aria-expanded={picker==='month'} onClick={()=>setPicker(p=>p==='month'?null:'month')}>{month}월<ChevronDown size={13} aria-hidden="true"/></button>
      <button type="button" aria-label="다음 달" disabled={year === 2100 && month === 12} onClick={() => turn(1)}>›</button>
    </div>
    {picker?<DateNumberList key={picker} kind={picker} value={picker==='year'?year:month} onClose={closePicker} onPick={v=>{if(picker==='year')setYear(v);else setMonth(v);closePicker();}}/>:<div className="sc-date-days">
      {['일','월','화','수','목','금','토'].map((d,i)=><span key={d} className="sc-date-weekday" data-day-tone={i===0?'red':i===6?'blue':undefined}>{d}</span>)}
      {Array.from({length:offset},(_,i)=><span key={`empty-${i}`} />)}
      {Array.from({length:count},(_,i)=>{
        const date=dayValue(i+1),mark=getDayMark(date),weekday=(offset+i)%7;
        const tone=mark?.isHoliday||weekday===0?'red':weekday===6?'blue':undefined;
        return <button key={date} type="button" aria-label={`${date}${mark?.isHoliday?` ${mark.name}`:''}`} data-day-tone={tone} aria-pressed={date===value} onClick={()=>onChange(date)}>{i+1}</button>;
      })}
    </div>}
    {(year<2023||year>2027)?<p className="sc-date-coverage">이 연도는 공휴일 정보가 일부만 제공됩니다.</p>:null}
  </section>;
}
