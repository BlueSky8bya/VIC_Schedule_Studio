export type ActivityObservation = {
  source: boolean; manual: boolean; epoch: number; jumpAllowed: boolean;
  width: number; height: number; anchor: {x:number;y:number;width:number;height:number}|null;
  action: string; context: string;
};
export type ActivityFrame = {at:number;x:number;y:number;pose?:number;state:string;visible:boolean;decoded:boolean;enabled?:boolean;roam?:boolean;blocked?:boolean;owned?:boolean;eligible?:boolean;activity?:ActivityObservation};
export function activityProgressTimes(frames: readonly ActivityFrame[]): Set<number>;

export function stationaryActivityRepetitions(frames: readonly ActivityFrame[], options?: {progressTimes?: ReadonlySet<number>}): {rule:string;at:number;severity:"candidate";detail:string}[];
