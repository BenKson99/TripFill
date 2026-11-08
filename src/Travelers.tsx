import { useEffect, useState } from "react";
import { PROFILES, PROFILE_LABELS, packingMembers, type PackingMember, type Profile } from "../shared/packing";

/** Visible rows for a count. Uses the same normaliser as the packing list (ids traveler-1…N, names, types). */
export const travelerRows = (members: PackingMember[] | undefined, count: unknown) => packingMembers({ members: members || [] }, Math.max(1, Math.min(20, Math.round(Number(count) || 1))));
/** Apply one row edit while keeping rows beyond the current count, so shrinking then growing restores them. */
export function editTraveler(all: PackingMember[] | undefined, count: unknown, id: string, patch: { name?: string; type?: string }): PackingMember[] {
  const rows = travelerRows(all, count), extra = (all || []).filter(m => !rows.some(r => r.id === m.id));
  const apply = (x: PackingMember): PackingMember => {
    if (x.id !== id) return x;
    let next: PackingMember = { ...x };
    if (patch.name !== undefined) next.name = patch.name.slice(0, 80);
    if (patch.type !== undefined) {
      const v = patch.type; next = { id: x.id, name: next.name };
      if (v === "child") next.child = true;
      else if ((PROFILES as readonly string[]).includes(v)) { next.profile = v as Profile; if (v === "girl" || v === "boy" || v === "infant") next.child = true; }
    }
    return next;
  };
  return [...rows.map(apply), ...extra];
}
export const typeValue = (m: PackingMember) => m.profile || (m.child ? "child" : "");

/** One traveler editor used by both the Plan questionnaire and ⚙ Settings → Packing. */
export function TravelerFields({ members, onEdit, disabled, idPrefix }: { members: PackingMember[]; onEdit: (id: string, patch: { name?: string; type?: string }) => void; disabled?: boolean; idPrefix: string }) {
  return <div className="packing-members traveler-fields">{members.map((m, i) => { const val = typeValue(m); return <div key={m.id} className="packing-member" data-testid={`${idPrefix}-${m.id}`}>
    <label>Traveler {i + 1} name<NameInput index={i} name={m.name} disabled={disabled} onCommit={name => onEdit(m.id, { name })} /></label>
    <label>Traveler type<select aria-label={`Traveler type for traveler ${i + 1}`} value={val} disabled={disabled} onChange={e => onEdit(m.id, { type: e.target.value })}>
      <option value="">Not set (general)</option>{PROFILES.map(k => <option key={k} value={k}>{PROFILE_LABELS[k]}</option>)}{val === "child" && <option value="child">Child (unspecified)</option>}</select></label>
  </div>; })}</div>;
}

type Any = any;
/** Prefill questionnaire travelers from the plan's packing settings (single source of truth once a plan exists). */
export function withMembers(form: Any, plan: Any, preferPlan = false) {
  const fromPlan = plan?.packing?.settings?.members;
  if (Array.isArray(fromPlan) && (preferPlan || !Array.isArray(form?.members) || !form.members.length)) return { ...form, members: structuredClone(fromPlan) };
  return { ...form, members: Array.isArray(form?.members) ? form.members : [] };
}
export function syncFormMembers(form: Any, members: Any[]) {
  const extra = (form.members || []).filter((x: Any) => !members.some((y: Any) => y.id === x.id));
  return { ...form, members: [...structuredClone(members), ...extra] };
}

/** Name typed so far → value to save. Blank drafts are not saved while typing (null); on blur/submit they become "Traveler N". */
export function commitName(draft: string, index: number, final: boolean): string | null {
  const v = draft.slice(0, 80);
  if (v.trim()) return v;
  return final ? `Traveler ${index + 1}` : null;
}
/** Text box with a local draft so a name can be cleared and retyped naturally; saved data never holds a blank name. */
function NameInput({ index, name, disabled, onCommit }: { index: number; name: string; disabled?: boolean; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(d => d.trim() ? name : d); }, [name]);
  const finish = () => { const v = commitName(draft, index, true)!; if (v !== draft) setDraft(v); if (v !== name) onCommit(v); };
  return <input aria-label={`Name for traveler ${index + 1}`} maxLength={80} value={draft} disabled={disabled}
    onChange={e => { setDraft(e.target.value); const v = commitName(e.target.value, index, false); if (v !== null) onCommit(v); }}
    onBlur={finish} onKeyDown={e => { if (e.key === "Enter") finish(); }} />;
}
