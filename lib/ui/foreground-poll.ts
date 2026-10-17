"use client";

export function foregroundOnline(): boolean {
  return (typeof document === "undefined" || !document.hidden) &&
    (typeof navigator === "undefined" || navigator.onLine !== false);
}

// One request chain per subscriber, including rapid hide/show and offline/online.
// Abort the old chain before resuming; its finally must not schedule a second timer.
export function startForegroundPoll(options: {
  run: (signal: AbortSignal) => Promise<void>;
  delay: () => number;
  initialDelay?: number;
}): { wake: () => void; stop: () => void } {
  let stopped = false;
  let pending = false;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    clearTimeout(timer);
    if (stopped || !foregroundOnline()) return;
    if (controller) { pending = true; return; }
    const request = new AbortController();
    controller = request;
    try { await options.run(request.signal); }
    catch { /* The caller retains its last valid value and owns retry policy. */ }
    finally {
      controller = null;
      if (!stopped && foregroundOnline()) {
        const delay = pending ? 0 : options.delay();
        pending = false;
        timer = setTimeout(() => void tick(), delay);
      }
    }
  };
  const wake = () => {
    clearTimeout(timer);
    if (!foregroundOnline()) { pending = false; controller?.abort(); return; }
    void tick();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
  window.addEventListener("offline", wake);
  window.addEventListener("pageshow", wake);
  if (options.initialDelay && foregroundOnline()) timer = setTimeout(() => void tick(), options.initialDelay);
  else void tick();
  return {
    wake,
    stop: () => {
      stopped = true; controller?.abort(); clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", wake);
      window.removeEventListener("pageshow", wake);
    },
  };
}
