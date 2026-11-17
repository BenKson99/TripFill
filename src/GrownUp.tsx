import { useState } from "react";
import { GROWN_UP_LABEL, isGrownUpPackingItem, isGrownUpTask, tripHasKids } from "../shared/family";

const KEY = "tripfill:grownup-note";

export function isGrownUpMarked(name: string, flagged?: boolean) {
  if (flagged === false) return false;
  return flagged === true || isGrownUpPackingItem(name) || isGrownUpTask(name);
}

export function GrownUpBadge({ name, flagged }: { name?: string; flagged?: boolean }) {
  if (!isGrownUpMarked(name || "", flagged)) return null;
  return <span className="grownup-badge" data-testid="grownup-badge" title="A grown-up should handle this">{GROWN_UP_LABEL}</span>;
}

export function GrownUpNote({ show }: { show: boolean }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  if (!show || hidden) return null;
  return (
    <p className="grownup-note noprint" data-testid="grownup-note" role="status">
      Planning for the family? Show this plan to a grown-up before booking anything.
      <button type="button" className="ghost small" aria-label="Dismiss grown-up reminder" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setHidden(true); }}>Got it</button>
    </p>
  );
}

export function showGrownUpNote(form?: any, plan?: any) {
  return tripHasKids(form || plan?.input, plan?.packing?.settings?.members || form?.members);
}
