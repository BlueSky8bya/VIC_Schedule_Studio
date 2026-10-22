"use client";

import {useEffect} from "react";
import {mountLampDiagnosticsUI} from "@/lib/ui/viewer-companion/lamp-diagnostics";

/** No actor, account or preference dependency. Exact opt-in only. */
export function LampDiagnosticEntry() {
  useEffect(()=>mountLampDiagnosticsUI(),[]);
  return null;
}
