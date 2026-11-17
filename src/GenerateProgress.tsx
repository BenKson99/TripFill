import { useEffect, useState } from "react";

export const GENERATE_STEPS = [
  "Checking the weather",
  "Finding fun places",
  "Packing your bags",
] as const;

const STEP_MS = 2800;

/** Timed stages while /api/generate runs as a single request. */
export function useGenerateProgress(loading: boolean): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!loading) { setI(0); return; }
    setI(0);
    const id = setInterval(() => setI(n => Math.min(n + 1, GENERATE_STEPS.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [loading]);
  return GENERATE_STEPS[i];
}

export function GenerateProgress({ loading }: { loading: boolean }) {
  const step = useGenerateProgress(loading);
  if (!loading) return null;
  return <p className="generate-progress muted" data-testid="generate-progress" aria-live="polite">{step}…</p>;
}
