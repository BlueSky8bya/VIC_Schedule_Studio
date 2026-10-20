import type { QaFrame } from "./trace-checks.mjs";
export const LIVING_NEGATIVES: readonly string[];
export const LIVING_POSITIVES: readonly string[];
export function traceLivingContextComplete(frames: QaFrame[]): boolean;
export function inspectLivingContext(frames: QaFrame[]): { findings: {rule:string;at:number;severity:string;detail:string}[]; positiveWitnesses:{rule:string;firstAt:number;samples:number}[];negativeCriteria:readonly string[];positiveCriteria:readonly string[];limitation:string };

/** A context distinction only, never progress, reward or recipe completion. */
export function measuredPersonalToyPlay(frames: QaFrame[]): {at:number;toyId:string;phase:"carried"|"released-tail"}[];
