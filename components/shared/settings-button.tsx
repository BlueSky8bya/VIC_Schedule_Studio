"use client";

import { Settings } from "lucide-react";

/** Both routes preload the existing viewer-settings-open skin. One 44px
 * control opens their shared settings window; the host owns its history. */
export function SettingsButton({ onClick, open, dataAct = "open-settings" }: { onClick: () => void; open?: boolean; dataAct?: string }) {
  return (
    <button
      aria-label="설정"
      aria-haspopup="dialog"
      aria-expanded={open}
      className="viewer-settings-open"
      data-act={dataAct}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        onClick();
      }}
      type="button"
    >
      <Settings aria-hidden="true" size={17} strokeWidth={2.2} />
    </button>
  );
}
