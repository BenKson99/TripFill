import type { TravelMode } from "../shared/travel";

/** Shared Flying / Driving choice for the questionnaire, snapshot and packing settings. */
export function TravelModeField({ value, onChange, disabled, hint }: { value: TravelMode; onChange?: (m: TravelMode) => void; disabled?: boolean; hint?: string }) {
  const pick = (m: TravelMode) => { if (!disabled) onChange?.(m); };
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick("driving"); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick("flying"); }
  };
  return (
    <fieldset className="wide travel-mode" data-testid="travel-mode">
      <legend>How are you getting there?</legend>
      <div className="seg" role="radiogroup" aria-label="How are you getting there?" aria-disabled={disabled || undefined} onKeyDown={onKey}>
        {([["flying", "Flying"], ["driving", "Driving"]] as const).map(([k, l]) =>
          <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "on" : ""} disabled={disabled} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {hint && <p className="muted small">{hint}</p>}
    </fieldset>
  );
}
