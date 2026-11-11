import { useMemo, useState } from "react";
import { ACTIVITIES, POPULAR_IDS, detectActivities, type ActivityId } from "../shared/activities";

/** Compact multi-select used on the Plan form and in Packing settings. */
export function ActivityPicker({ value, onChange, interests, onInterests, disabled, idPrefix = "activity" }: {
  value: ActivityId[];
  onChange: (ids: ActivityId[]) => void;
  interests?: string;
  onInterests?: (text: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const selected = value;
  const extra = selected.filter(id => !POPULAR_IDS.includes(id));
  const [all, setAll] = useState(extra.length > 0);
  const visible = all ? ACTIVITIES : ACTIVITIES.filter(a => a.popular || selected.includes(a.id));
  const toggle = (id: ActivityId, on: boolean) => onChange(on ? [...selected, id] : selected.filter(x => x !== id));
  const interestDetect = (text: string) => {
    onInterests?.(text);
    const found = detectActivities(text);
    if (found.length) onChange([...selected, ...found.filter(id => !selected.includes(id))]);
  };
  const hint = useMemo(() => selected.map(id => ACTIVITIES.find(a => a.id === id)?.label).filter(Boolean).join(", "), [selected]);
  return <fieldset className="wide activity-picker" data-testid={`${idPrefix}-picker`}>
    <legend>What do you want to do? <small className="muted">(pick any)</small></legend>
    <p className="muted small">We’ll pack, add prep tasks and shape days around these. Interests below can tick obvious matches, like “beginner ski lessons” or “wine”.</p>
    <div className="chips activity-chips" role="group" aria-label="Activities">
      {visible.map(a => <label key={a.id} className={"chip" + (selected.includes(a.id) ? " on" : "")}>
        <input type="checkbox" data-activity={a.id} data-preset={a.legacyPresets?.[0]} checked={selected.includes(a.id)} disabled={disabled} onChange={e => toggle(a.id, e.target.checked)} />
        <span aria-hidden>{a.emoji}</span> {a.label}
      </label>)}
    </div>
    <button type="button" className="ghost small activity-more" data-testid={`${idPrefix}-show-all`} disabled={disabled} onClick={() => setAll(v => !v)} aria-expanded={all}>
      {all ? "Show fewer" : "Show all 25"}
    </button>
    {hint && <p className="muted small" data-testid={`${idPrefix}-selected`}>{selected.length} selected · {hint}</p>}
    {onInterests && <label className="wide">Interests<input placeholder="food, museums, hiking, photography…" value={interests || ""} disabled={disabled} onChange={e => interestDetect(e.target.value)} /></label>}
  </fieldset>;
}

export function formatActivities(ids: ActivityId[]) {
  return ids.map(id => {
    const a = ACTIVITIES.find(x => x.id === id);
    return a ? `${a.emoji} ${a.label}` : id;
  }).join(" · ");
}
