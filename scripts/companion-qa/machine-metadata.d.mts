export type MachineMetadata = { readonly path: string; readonly bytes: number; readonly sha256: string };
export const AUDITED_MACHINE_METADATA: readonly MachineMetadata[];
export const AUDITED_MACHINE_METADATA_BYTES: number;
export function validateAuditedMachineMetadata(relative: string, bytes: Uint8Array, proof: { tracked: boolean; headUnchanged: boolean }): MachineMetadata;
