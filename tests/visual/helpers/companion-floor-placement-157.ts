export type CompanionFloorPlacementSample157 = {
  at: number; sameActor: boolean; placingReleased: boolean; platform: string; floorPlatform: boolean;
  state: string; notJump: boolean; feet: number; floorFeet: number; feetError: number;
};

/** All conditions refer to one actual browser observation. A later sofa idle
 * cannot lend its not-jump condition to an earlier floor-platform sample. */
export function companionFloorPlacementSamplePasses157(sample: CompanionFloorPlacementSample157) {
  return sample.sameActor && sample.placingReleased && sample.floorPlatform && sample.notJump
    && /^companion-home-floor(?:-\d+)?$/.test(sample.platform) && sample.state !== "jump"
    && [sample.at,sample.feet,sample.floorFeet,sample.feetError].every(Number.isFinite)
    && Math.abs(sample.feetError-Math.abs(sample.feet-sample.floorFeet)) < .000001 && sample.feetError < 2;
}
