"use client";
import {useMemo} from 'react';
import type {PublicMonth} from './public-month-link';
import type {PublicRecordGroup} from '@/lib/insights/public-record';
export type PublicRecordSnapshot={month:PublicMonth;group:PublicRecordGroup|null;scrollTop:number;focusId:string|null};
export type PublicRecordSession={current:PublicRecordSnapshot|null};
/** Only a temporary detail transition is retained. No DTO/title/browser storage. */
export function usePublicRecordSession(scope:unknown):PublicRecordSession{return useMemo(()=>({current:null,scope}),[scope]);}
