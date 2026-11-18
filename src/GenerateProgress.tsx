import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export const GENERATE_STEPS = [
  "Checking the weather",
  "Finding fun places",
  "Packing your bags",
] as const;

export const GENERATE_STEP_MS = 2800;

/** Let the browser paint before the next synchronous chunk of work. */
export function yieldToPaint(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function generateStepAt(elapsedMs: number, stepMs = GENERATE_STEP_MS): string {
  const i = Math.min(GENERATE_STEPS.length - 1, Math.max(0, Math.floor(Math.max(0, elapsedMs) / stepMs)));
  return GENERATE_STEPS[i];
}

type TimerId = ReturnType<typeof setInterval>;

/** Drive generate-step labels with injectable timers so tests can prove each label paints. */
export function startGenerateStepTimer(
  onPaint: (step: string) => void,
  opts: {
    stepMs?: number;
    now?: () => number;
    interval?: (fn: () => void, ms: number) => TimerId;
    clear?: (id: TimerId) => void;
    flush?: (fn: () => void) => void;
  } = {},
): () => void {
  const stepMs = opts.stepMs ?? GENERATE_STEP_MS;
  const now = opts.now ?? Date.now;
  const every = opts.interval ?? ((fn, ms) => setInterval(fn, ms));
  const stop = opts.clear ?? (id => clearInterval(id));
  const flush = opts.flush ?? (fn => fn());
  const started = now();
  flush(() => onPaint(GENERATE_STEPS[0]));
  const id = every(() => {
    flush(() => onPaint(generateStepAt(now() - started, stepMs)));
  }, stepMs);
  return () => stop(id);
}

/** Timed stages while /api/generate runs as a single request. Each tick flushes so the label can paint. */
export function useGenerateProgress(loading: boolean): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!loading) { setI(0); return; }
    flushSync(() => setI(0));
    const stop = startGenerateStepTimer(step => {
      const next = Math.max(0, GENERATE_STEPS.indexOf(step as typeof GENERATE_STEPS[number]));
      flushSync(() => setI(next));
    });
    return stop;
  }, [loading]);
  return GENERATE_STEPS[i];
}

export function GenerateProgress({ loading }: { loading: boolean }) {
  const step = useGenerateProgress(loading);
  if (!loading) return null;
  return <p className="generate-progress muted" data-testid="generate-progress" aria-live="polite">{step}…</p>;
}
