import { useState, useMemo, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { TravelerFields, editTraveler, setAllTypes } from "./Travelers";
import { TravelModeField } from "./TravelMode";
import { resolveTravelMode, type TravelMode } from "../shared/travel";
import { resolveActivities, type ActivityId } from "../shared/activities";
import { ActivityPicker } from "./Activities";

import { Settings } from "lucide-react";
import { ChecklistCheckbox, ChecklistText } from "./Checklist";
import { ACTIVITY_KITS, SHARED, TEMPLATE_KEY, addPackingItem, applyEssentials, filterPacking, inferActivityKits, makeEssentials, mergeSuggestions, movePackingItem, ownerLabel, packingItems, simpleLists, groupSimpleRows, simpleGroupLabel, updatePackingItems, bagLabel, bagsFor, type SimpleRow, type SimpleGroup, packingProgress, parseEssentials, quantity, removePackingItem, suggestPacking, tripDays, undoPackingRemoval, updatePackingItem, type ActivityKit, type PackingItem, type PackingList, type Stage } from "../shared/packing";

const KIT_LABELS: Record<ActivityKit, string> = {
  beach: "Beach & swim", hiking: "Hiking", ski: "Ski", business: "Business",
  celebration: "Celebration", kids: "Family / kids", roadtrip: "Road trip", photography: "Photography",
};
const stageLabel = (i: PackingItem) => i.skipped ? "Not needed" : i.checked || i.stage === "packed" ? "Packed" : i.stage === "need-to-buy" ? "Need to buy" : "Ready";


function LazySelect({ label, value, options, "aria-label": aria, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; "aria-label": string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value)?.label || value;
  if (!open) return <label className="lazy-select">{label}<button type="button" className="ghost lazy-select-btn" aria-label={aria} disabled={disabled} onClick={() => setOpen(true)}>{current}</button></label>;
  return <label className="lazy-select">{label}<select autoFocus aria-label={aria} value={value} disabled={disabled} onChange={e => { onChange(e.target.value); setOpen(false); }} onBlur={() => setOpen(false)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

export function PackingWorkspace({ plan, readOnly, onChange, T, settingsSlot = null, openSettings, simple = false, onSimpleChange, onTravelMode, onActivities, onRefreshPlan }: { plan: any; readOnly: boolean; onTravelMode?: (m: TravelMode) => void; onActivities?: (ids: ActivityId[]) => void; onRefreshPlan?: () => void; simple?: boolean; onSimpleChange?: (on: boolean) => void; settingsSlot?: HTMLElement | null; openSettings?: () => void; onChange: (list: PackingList) => void; T: (s: string) => string }) {
  const p: PackingList = plan.packing;
  const members = p.settings.members?.length ? p.settings.members : [{ id: "traveler-1", name: "Traveler 1" }];
  const travelMode: TravelMode = resolveTravelMode(plan.input, plan.trip?.distanceKm);
  const [message, setMessage] = useState("");
  const [mountedSimple, setMountedSimple] = useState(simple);
  const [mountedDetailed, setMountedDetailed] = useState(!simple);
  if (simple && !mountedSimple) setMountedSimple(true);
  if (!simple && !mountedDetailed) setMountedDetailed(true);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const TRef = useRef(T); TRef.current = T;
  const edit = useCallback((id: string, patch: Partial<PackingItem>) => { if (!readOnly) onChangeRef.current(updatePackingItem(p, id, patch)); }, [readOnly, p]);
  const change = useCallback((next: PackingList) => { if (!readOnly) onChangeRef.current(next); }, [readOnly]);
  const checkMany = useCallback((ids: string[], checked: boolean) => { if (!readOnly) onChangeRef.current(updatePackingItems(p, ids, { checked })); }, [readOnly, p]);
  const onCheckItem = useCallback((id: string, checked: boolean) => edit(id, { checked }), [edit]);
  const tFn = useCallback((s: string) => TRef.current(s), []);
  const toggle = <div className="packing-mode noprint"><button type="button" role="switch" aria-checked={simple} data-testid="simple-toggle" className={simple ? "on" : "ghost"} onClick={() => onSimpleChange?.(!simple)}><span className="switch-dot" aria-hidden />Simple mode</button><span className="muted small">{simple ? "Just the lists. Switch off for categories, bags, status and filters." : "Show just an Adults list (and Kids, if any)."}</span></div>
  return <div className={`packing-workspace${simple ? " packing-simple" : ""}`} data-testid="packing-workspace">
    {toggle}
    {settingsSlot && createPortal(<PackingSettingsPanel plan={plan} p={p} readOnly={readOnly} change={change} setMessage={setMessage} travelMode={travelMode} onTravelMode={onTravelMode} onActivities={onActivities} onRefreshPlan={onRefreshPlan} />, settingsSlot)}
    {mountedSimple && <div hidden={!simple} className={simple ? undefined : "noprint"} data-testid="packing-simple-pane"><SimpleLists p={p} readOnly={readOnly} onCheckMany={checkMany} onCheck={onCheckItem} /></div>}
    {mountedDetailed && <div hidden={simple} className={simple ? "noprint" : undefined} data-testid="packing-detailed-pane">
      <DetailedPane plan={plan} p={p} readOnly={readOnly} travelMode={travelMode} members={members} T={tFn} openSettings={openSettings} message={message} setMessage={setMessage} change={change} edit={edit} />
    </div>}
  </div>;
}

const DetailedPane = memo(function DetailedPane({ plan, p, readOnly, travelMode, members, T, openSettings, message, setMessage, change, edit }: { plan: any; p: PackingList; readOnly: boolean; travelMode: TravelMode; members: { id: string; name: string }[]; T: (s: string) => string; openSettings?: () => void; message: string; setMessage: (m: string) => void; change: (next: PackingList) => void; edit: (id: string, patch: Partial<PackingItem>) => void }) {
  const [search, setSearch] = useState(""), [category, setCategory] = useState("all"), [status, setStatus] = useState("all"), [bag, setBag] = useState("all");
  const [owner, setOwner] = useState("all");
  const [name, setName] = useState(""), [newGroup, setNewGroup] = useState("Clothing"), [newQty, setNewQty] = useState(1), [newOwner, setNewOwner] = useState(SHARED);
  const all = packingItems(p), progress = packingProgress(all), pending = all.filter(i => i.essential && !i.checked && !i.skipped).length;
  const toBuy = all.filter(i => !i.skipped && i.stage === "need-to-buy").length;
  const readyN = all.filter(i => !i.skipped && (i.stage || "ready") === "ready" && !i.checked).length;
  const departure = all.filter(i => !i.skipped && i.lastMinute && !i.checked).length;
  const reset = () => { setSearch(""); setStatus("all"); setCategory("all"); setBag("all"); setOwner("all"); };
  const scoped = (items: PackingItem[]) => owner === "all" ? items : items.filter(i => (i.owner || SHARED) === owner);
  const visible = p.groups.filter(g => category === "all" || g.group === category).map(g => ({ ...g, items: filterPacking(g.items, search, status, bag, owner) })).filter(g => g.items.length);
  const owners = [{ id: "all", name: "Everyone" }, { id: SHARED, name: "Shared" }, ...members];
  const renderGroups = (groups: typeof p.groups, printing = false) => groups.map(g => { const gp = packingProgress(scoped(p.groups.find(x => x.group === g.group)?.items || g.items)); return <section key={g.group} className="packing-category" aria-label={g.group}>
    <header><h3>{g.group}</h3><span className="muted small">{gp.packed}/{gp.total} packed</span></header>
    {g.items.map(i => <article key={i.id} className={`packing-item${i.checked ? " packed" : ""}${i.skipped ? " skipped" : ""}`} data-testid={printing ? undefined : "packing-item"} data-item-id={i.id}>
      {printing ? <><span>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span><div><b>{i.quantity} × {i.item}</b><div className="small">{bagLabel(i.bag, travelMode)} · {stageLabel(i)}{i.essential ? " · Essential" : " · Optional"}{i.lastMinute ? " · Departure day" : ""} · {ownerLabel(p, i.owner || SHARED)}</div><small>{T(i.reason)}</small></div></> : <>
        <div className="packing-check"><ChecklistCheckbox aria-label={`Pack ${i.item}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => edit(i.id, { checked: e.target.checked })} /></div>
        <div className="packing-content">
          <fieldset disabled={readOnly} className="packing-edit"><ChecklistText value={i.item} onChange={item => edit(i.id, { item: item.slice(0, 300) })} />
            <div className="packing-meta"><label>Qty<input aria-label={`Quantity for ${i.item}`} type="number" min={1} max={99} value={i.quantity} onChange={e => edit(i.id, { quantity: quantity(Number(e.target.value)) })} /></label>
              <LazySelect label="Bag" aria-label={`Bag for ${i.item}`} value={i.bag} options={bagsFor(travelMode, i.bag).map(b => ({ value: b, label: bagLabel(b, travelMode) }))} onChange={v => edit(i.id, { bag: v as PackingItem["bag"] })} />
              <LazySelect label="List" aria-label={`List for ${i.item}`} value={i.owner || SHARED} options={[{ value: SHARED, label: "Shared" }, ...members.map(m => ({ value: m.id, label: m.name }))]} onChange={v => edit(i.id, { owner: v })} />
              <LazySelect label="Status" aria-label={`Status for ${i.item}`} value={i.checked ? "packed" : (i.stage || "ready")} options={[{ value: "need-to-buy", label: "Need to buy" }, { value: "ready", label: "Ready" }, { value: "packed", label: "Packed" }]} onChange={v => edit(i.id, { stage: v as Stage })} />
              <LazySelect label="Category" aria-label={`Category for ${i.item}`} value={g.group} options={[...new Set(["Clothing", "Documents & Money", "Toiletries & Health", "Electronics", "Comfort & Extras", "Activities", ...p.groups.map(x => x.group)])].map(x => ({ value: x, label: x }))} onChange={v => change(movePackingItem(p, i.id, v))} />
              <label className="packing-flag"><input type="checkbox" checked={i.essential} onChange={e => edit(i.id, { essential: e.target.checked })} />Essential</label>
              <label className="packing-flag"><input type="checkbox" checked={i.lastMinute} onChange={e => edit(i.id, { lastMinute: e.target.checked })} />Departure day</label>
              <label className="packing-flag"><input type="checkbox" checked={i.skipped} onChange={e => edit(i.id, { skipped: e.target.checked })} />Not needed</label>
            </div>
          </fieldset>
          {i.reason && <p className="packing-reason">{T(i.reason)}</p>}
          <div className="packing-item-foot"><span>{i.skipped ? "Not needed · excluded from progress" : `${stageLabel(i)} · ${ownerLabel(p, i.owner || SHARED)}`}{i.essential ? " · Essential" : " · Optional"}{i.lastMinute ? " · Departure day" : ""}{i.edited ? " · Your edits protected" : ""}</span>{!readOnly && <button className="ghost small" aria-label={`Remove ${i.item}`} onClick={() => { change(removePackingItem(p, i.id)); setMessage(`Removed “${i.item}”. Undo is available below.`); }}>Remove</button>}</div>
        </div>
      </>}
    </article>)}
  </section>; });
    return <>

    <div className="packing-overview">
      <div><span className="eyebrow">A little less to remember</span><h2>Your bags, in order.</h2><p>{tripDays(plan.input)} days · personal items are listed for each of {plan.input.travelers || members.length} traveler(s), with a separate shared list. Clothing quantities are for that traveler and include what they wear in transit.</p></div>
      <div className="packing-score"><b>{progress.percent}%</b><span>{progress.packed} of {progress.total} active items packed</span><progress aria-label="Packing progress" value={progress.packed} max={Math.max(1, progress.total)} /></div>
    </div>
    <div className="packing-readiness" aria-live="polite">{!progress.total ? "Your list is empty or all items are not needed. Add an item or restore a skipped one." : progress.packed === progress.total ? "✓ Everything on your active list is packed. Check Before you leave separately." : `${progress.total - progress.packed} items to go · ${toBuy} to buy · ${readyN} ready · ${departure} for departure day · ${pending} unpacked essentials.`}</div>
    <p className="muted small">Suggestions use available weather only ({plan.weather.source === "forecast" ? "forecast, not guaranteed" : plan.weather.source === "typical" ? "seasonal estimates, not a forecast" : "mixed / unknown basis"}). Weather-dependent items are marked Essential only when the forecast clearly supports them; otherwise they stay Optional because the weather is uncertain. Check the latest forecast for every stop. {plan.capped || tripDays(plan.input) > (plan.weather.days?.length || 0) ? "Weather may cover only part of this trip; quantities still use the full date range. Later legs may have no weather data." : ""}</p>
    <div className="packing-people noprint" role="tablist" aria-label="Packing lists">{owners.map(o => { const tabItems = o.id === "all" ? all : all.filter(i => (i.owner || SHARED) === o.id); const tab = packingProgress(tabItems); return <button key={o.id} type="button" role="tab" aria-selected={owner === o.id} className={owner === o.id ? "" : "ghost"} onClick={() => { setOwner(o.id); if (o.id !== "all") setNewOwner(o.id); }}>{o.name}<span className="muted"> {tab.packed}/{tab.total}</span></button>; })}</div>
    {openSettings && <div className="packing-settings-link noprint"><button type="button" className="ghost" data-testid="packing-settings-open" onClick={openSettings}><Settings size={16} />Packing settings: laundry, rewear, travelers & activities</button></div>}
    <div className="packing-filters noprint" role="search" aria-label="Filter packing list">
      <label>Find an item<input type="search" placeholder="Search items or reasons…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{p.groups.map(g => <option key={g.group}>{g.group}</option>)}</select></label>
      <label>Show<select value={status} onChange={e => setStatus(e.target.value)}>{[["all", "All items"], ["unpacked", "Still to pack"], ["need-to-buy", "Need to buy"], ["ready", "Ready"], ["packed", "Packed"], ["essential", "Essentials"], ["departure-day", "Departure day"], ["skipped", "Not needed"]].map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label>
      <label>Bag<select value={bag} onChange={e => setBag(e.target.value)}><option value="all">All bags</option>{bagsFor(travelMode).map(b => <option key={b} value={b}>{bagLabel(b, travelMode)}</option>)}</select></label>
      {members.length > 1 && <label>Show only<select aria-label="Show only" data-testid="packing-show-only" value={owner} onChange={e => { setOwner(e.target.value); if (e.target.value !== "all") setNewOwner(e.target.value); }}><option value="all">Everyone</option><option value={members[0].id}>My list · {members[0].name}</option><option value="shared">Shared</option>{members.slice(1).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
    </div>
    {message && <p className="packing-message noprint" role="status">{message}</p>}
    {!readOnly && p.lastRemoved && <div className="packing-undo noprint"><span>Last removed: {p.lastRemoved.item.item}</span><button className="ghost" onClick={() => { change(undoPackingRemoval(p)); setMessage("Item restored with its quantity, bag and packed status."); }}>Undo removal</button></div>}
    {!readOnly && <form className="packing-add noprint" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; change(addPackingItem(p, newGroup, { id: crypto.randomUUID(), item: name.trim(), quantity: newQty, reason: "Added by you", bag: "unassigned", checked: false, essential: false, lastMinute: false, skipped: false, edited: true, owner: newOwner, stage: "ready" })); setName(""); setNewQty(1); reset(); setMessage("Custom item added. You can mark it Essential to reuse it on future trips."); }}>
      <label>Custom item<input required maxLength={300} placeholder="What else do you need?" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Qty<input type="number" min={1} max={99} value={newQty} onChange={e => setNewQty(quantity(Number(e.target.value)))} /></label>
      <label>Category<select value={newGroup} onChange={e => setNewGroup(e.target.value)}>{[...new Set(["Clothing", "Documents & Money", "Toiletries & Health", "Electronics", "Comfort & Extras", "Activities", ...p.groups.map(g => g.group)])].map(g => <option key={g}>{g}</option>)}</select></label>
      <label>List<select value={newOwner} onChange={e => setNewOwner(e.target.value)}><option value={SHARED}>Shared</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button>Add item</button>
    </form>}
    <div className="packing-screen noprint">
      {visible.length ? renderGroups(visible) : <div className="packing-empty"><h3>{all.length ? "No items match these filters." : "Room for your essentials."}</h3><p>{all.length ? "Your list is still here. Try another view." : "Add a custom item or refresh suggestions to start packing."}</p><button className="ghost" onClick={reset}>Show all items</button></div>}
    </div>
    <div className="packing-print">{renderGroups(p.groups, true)}</div>
    {!!p.leaveAtHome.length && <details><summary>Notes from your older list · leave at home</summary><ul>{p.leaveAtHome.map(i => <li key={i.id}>{i.item} — {T(i.reason || "")}</li>)}</ul><p className="small muted">These older suggestions are not requirements. Review them against your own needs and current rules.</p></details>}
    </>;
});
export function PackingSettingsPanel({ plan, p, readOnly, change, setMessage, travelMode = "flying", onTravelMode, onActivities, onRefreshPlan }: { plan: any; p: PackingList; readOnly: boolean; change: (next: PackingList) => void; setMessage: (m: string) => void; travelMode?: TravelMode; onTravelMode?: (m: TravelMode) => void; onActivities?: (ids: ActivityId[]) => void; onRefreshPlan?: () => void }) {
  const members = p.settings.members?.length ? p.settings.members : [{ id: "traveler-1", name: "Traveler 1" }];
  const kits = p.settings.activityKits ?? inferActivityKits(plan);
  const changeSettings = (patch: Partial<PackingList["settings"]>) => change({ ...p, settings: { ...p.settings, ...patch } });
  return <section className="packing-settings" aria-labelledby="packing-settings-title" data-testid="packing-settings"><h3 id="packing-settings-title">Packing list settings & personal essentials</h3>
    {readOnly && <p className="muted small">Shared plan: settings are view-only.</p>}
      <fieldset disabled={readOnly} className="packing-edit">
        <div className="packing-settings-grid"><label>Laundry plan<select value={p.settings.laundryEvery ?? "none"} onChange={e => changeSettings({ laundryEvery: e.target.value === "none" ? null : Number(e.target.value) })}><option value="none">No laundry arranged</option>{Array.from({ length: 30 }, (_, n) => n + 1).map(n => <option key={n} value={n}>Wash every {n} day{n > 1 ? "s" : ""}</option>)}</select></label>
        <TravelModeField value={travelMode} onChange={onTravelMode} disabled={readOnly} hint="Changing this updates travel labels and packing suggestions. Your edits, checks and removals stay." />
        <label>Luggage preference<select value={p.settings.luggage} onChange={e => changeSettings({ luggage: e.target.value as "all" | "carry-on" })}><option value="all">Any luggage · assign bags myself</option><option value="carry-on">{travelMode === "driving" ? "Day bags only · keep bags with you" : "Carry-on only · cabin bags"}</option></select></label>
        <label>Rewear tops<select value={p.settings.rewearTopsEvery ?? 1} onChange={e => changeSettings({ rewearTopsEvery: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n === 1 ? "Change daily" : `About every ${n} days`}</option>)}</select></label>
        <label>Rewear bottoms<select value={p.settings.rewearBottomsEvery ?? 3} onChange={e => changeSettings({ rewearBottomsEvery: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n === 1 ? "Change daily" : `About every ${n} days`}</option>)}</select></label></div>
        <label className="packing-flag"><input type="checkbox" checked={p.settings.includeSpares !== false} onChange={e => changeSettings({ includeSpares: e.target.checked })} />Add a spare pair of underwear and socks</label>
        <TravelerFields idPrefix="settings-traveler" members={members} disabled={readOnly} onEdit={(id, patch) => { changeSettings({ members: editTraveler(members, members.length, id, patch) }); if (patch.type !== undefined) setMessage("Traveler type saved. Press Refresh suggestions to add items for it; existing items, checks and edits are kept — remove any that no longer apply."); }} onEditAll={type => { changeSettings({ members: setAllTypes(members, members.length, type) }); setMessage("Traveler type saved. Press Refresh suggestions to add items for it; existing items, checks and edits are kept — remove any that no longer apply."); }} />
        <p className="muted small">Traveler type picks sensible defaults (Girl, Boy and Infant appear under Kids in Simple mode). Type changes apply when you press Refresh suggestions.</p>
        <ActivityPicker idPrefix="settings-activity" value={resolveActivities(plan.input)} disabled={readOnly} onChange={(ids: ActivityId[]) => { onActivities?.(ids); setMessage("Activities saved. Press Refresh suggestions to add packing and prep; existing items, checks and edits are kept — remove any that no longer apply."); }} />
        <fieldset className="packing-kits"><legend>Also pack for</legend><p className="muted small">Business and celebration outfits aren’t in the activity list (they come from Purpose). Other kits stay for older trips. Existing items stay unless you remove them.</p><div className="chips">{ACTIVITY_KITS.filter(k => k === "business" || k === "celebration" || kits.includes(k)).map(k => <label key={k} className="packing-flag"><input type="checkbox" checked={kits.includes(k)} onChange={e => changeSettings({ activityKits: e.target.checked ? [...kits, k] : kits.filter(x => x !== k) })} />{KIT_LABELS[k]}</label>)}</div></fieldset>
        <p className="muted small">Settings are saved with this trip. Nothing changes automatically: refresh suggestions when ready. Refresh updates only untouched suggestions and adds missing ones; it keeps your edits, checks, not-needed items and removals, and never deletes old items. Review any older suggestions yourself. Changing activities does not refetch weather.</p>
        <button onClick={() => { if (onRefreshPlan) onRefreshPlan(); else change(mergeSuggestions(p, suggestPacking(plan, p.settings))); setMessage("Suggestions refreshed. Your edits, packed status and removals were kept. Review older items; nothing was deleted."); }}>Refresh suggestions</button>
        {tripDays(plan.input) > 14 && <p className="warn small">Long trip: tops are capped at 14, underwear/socks at 31 and bottoms at 7. With no laundry arranged you must plan rewear, washing, resupply or edit these quantities. We do not assume facilities.</p>}
        <p className="muted small">{travelMode === "driving" ? "Bag labels are organization only, not size or weight checks. Check your vehicle's load, local driving, parking and toll rules, and battery or liquid rules if you take a ferry or cross a border. Check plug/voltage and entry requirements with official sources." : "Bag labels are organization only, not size/weight checks or approval to fly. Verify current airline, airport security, battery/liquid and destination rules yourself, including connecting flights. Check plug/voltage and entry requirements with official sources."}</p>
        {!readOnly && <div className="packing-personal"><h3>Your personal essentials</h3><p className="muted small">Mark items Essential, then save that selection as a reusable template on this browser only. Saving replaces the previous template; checks, trip reasons and removed items are not saved. Avoid sensitive or medical details. The template is not shared; applied items become part of the trip snapshot.</p>
          <div className="chips"><button className="ghost" onClick={() => { try { const template = makeEssentials(p); if (!template.items.length) throw new Error("Mark at least one active item Essential first."); if (localStorage.getItem(TEMPLATE_KEY) && !confirm("Replace your browser's personal essentials template with this trip's Essential items?")) return; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(parseEssentials(JSON.stringify(template)))); setMessage(`Saved ${template.items.length} personal essentials in this browser.`); } catch (e: any) { setMessage(e.message || "Could not save personal essentials."); } }}>Save essentials</button>
          <button className="ghost" onClick={() => { try { const text = localStorage.getItem(TEMPLATE_KEY); if (!text) throw new Error("No essentials template yet. Mark items Essential and save one first."); change(applyEssentials(p, parseEssentials(text))); setMessage("Personal essentials applied. Matching items were kept without duplicates or reset checks; missing items were added unpacked."); } catch (e: any) { setMessage(e.message); } }}>Apply essentials</button>
          <button className="ghost" onClick={() => { try { if (confirm("Forget the personal essentials template in this browser? Applied trip items will stay.")) { localStorage.removeItem(TEMPLATE_KEY); setMessage("Personal essentials template forgotten; trip items unchanged."); } } catch { setMessage("Browser storage unavailable."); } }}>Forget template</button></div></div>}
      </fieldset>
  </section>;
}

/** Simple mode: whole active lists (ignores detailed search/filters), same item ids, checks only. */
export const SimpleLists = memo(function SimpleLists({ p, readOnly, onCheck, onCheckMany }: { p: PackingList; readOnly: boolean; onCheck: (id: string, checked: boolean) => void; onCheckMany?: (ids: string[], checked: boolean) => void }) {
  const checkMany = onCheckMany || ((ids: string[], checked: boolean) => ids.forEach(id => onCheck(id, checked)));
  const lists = useMemo(() => simpleLists(p), [p]);
  const adultEntries = useMemo(() => groupSimpleRows(lists.adults), [lists.adults]);
  const kidEntries = useMemo(() => lists.kids ? groupSimpleRows(lists.kids) : null, [lists.kids]);
  const multi = (p.settings.members?.length || 1) > 1;
  const list = (title: string, grouped: ReturnType<typeof groupSimpleRows>, rows: SimpleRow[], print: boolean) => {
    const active = rows.filter(r => !r.item.skipped), done = active.filter(r => r.item.checked).length;
    return <section className="simple-list" aria-label={`${title} packing list`} data-testid={print ? undefined : `simple-${title.toLowerCase()}`}>
      <header><h3>{title}</h3><span className="muted small">{done}/{active.length} packed</span></header>
      {rows.length ? <ul>{grouped.entries.map(e => e.kind === "shared"
        ? <SimpleSharedRow key={e.row.item.id} row={e.row} readOnly={readOnly} print={print} onCheck={onCheck} />
        : <SimpleGroupRow key={e.group.key} g={e.group} multi={multi} title={title} readOnly={readOnly} print={print} onCheck={onCheck} onCheckMany={checkMany} />)}</ul>
        : <p className="muted small">No items yet.</p>}
    </section>;
  };
  return <>
    <div className="simple-screen noprint">{list("Adults", adultEntries, lists.adults, false)}{kidEntries && list("Kids", kidEntries, lists.kids!, false)}</div>
    <div className="packing-print simple-print">{list("Adults", adultEntries, lists.adults, true)}{kidEntries && list("Kids", kidEntries, lists.kids!, true)}</div>
  </>;
});

const SimpleSharedRow = memo(function SimpleSharedRow({ row, readOnly, print, onCheck }: { row: SimpleRow; readOnly: boolean; print: boolean; onCheck: (id: string, checked: boolean) => void }) {
  const i = row.item, label = `${i.quantity} × ${i.item} (Shared)${i.skipped ? " — not needed" : ""}`;
  return <li className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={print ? undefined : i.id} data-shared="true">
    {print ? <span aria-hidden>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span>
      : <input type="checkbox" aria-label={`Pack ${label}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />}
    <span className="simple-qty">{i.quantity} ×</span><span className="simple-name">{i.item}</span>
    <small className="simple-owner">Shared</small>{i.skipped && <small className="simple-owner">Not needed</small>}
  </li>;
});

const SimpleGroupRow = memo(function SimpleGroupRow({ g, multi, title, readOnly, print, onCheck, onCheckMany }: { g: SimpleGroup; multi: boolean; title: string; readOnly: boolean; print: boolean; onCheck: (id: string, checked: boolean) => void; onCheckMany: (ids: string[], checked: boolean) => void }) {
  const [open, setOpen] = useState(false);
  if (g.rows.length === 1) {
    const { item: i, ownerName } = g.rows[0];
    const tag = multi || title === "Kids" ? ownerName : "";
    const label = `${i.quantity} × ${i.item}${tag ? ` (${tag})` : ""}${i.skipped ? " — not needed" : ""}`;
    return <li className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={print ? undefined : i.id}>
      {print ? <span aria-hidden>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span>
        : <input type="checkbox" aria-label={`Pack ${label}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />}
      <span className="simple-qty">{i.quantity} ×</span><span className="simple-name">{i.item}</span>
      {tag && <small className="simple-owner">{tag}</small>}{i.skipped && <small className="simple-owner">Not needed</small>}
    </li>;
  }
  const label = simpleGroupLabel(g), allPacked = g.total > 0 && g.packed === g.total, some = g.packed > 0 && !allPacked;
  const ids = g.rows.filter(r => !r.item.skipped).map(r => r.item.id);
  return <li className={`simple-group${allPacked ? " packed" : ""}`} data-group-key={print ? undefined : g.key}>
    {print ? <span aria-hidden>{allPacked ? "[x]" : some ? "[/]" : "[ ]"}</span>
      : <input type="checkbox" aria-label={`Pack ${label} for everyone`} checked={allPacked} ref={el => { if (el) el.indeterminate = some; }} disabled={readOnly || !g.total} onChange={() => onCheckMany(ids, !allPacked)} />}
    <span className="simple-name">{label}</span>
    <small className="simple-progress">{g.packed}/{g.total} packed</small>
    {!print && !readOnly && g.total > 0 && <button type="button" className="ghost simple-mark-all" onClick={() => onCheckMany(ids, !allPacked)}>{allPacked ? "Unpack all" : "Mark all packed"}</button>}
    {!print && <button type="button" className="ghost simple-expand" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide people" : "Show people"}</button>}
    {print && <small className="simple-owner">{g.rows.map(r => r.ownerName).join(", ")}</small>}
    {open && !print && <ul className="simple-people">{g.rows.map(({ item: i, ownerName }) => <li key={i.id} className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={i.id}>
      <input type="checkbox" aria-label={`Pack ${i.item} for ${ownerName}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />
      <span className="simple-name">{ownerName}</span>
      {i.skipped && <small className="simple-owner">Not needed</small>}
    </li>)}</ul>}
  </li>;
});

/** Browser-local view preference only ("simple" | "detailed"); never part of the trip or shared links. */
export const PACK_MODE_KEY = "tripfill:packingMode";
type Store = Pick<Storage, "getItem" | "setItem"> | undefined;
export function readPackMode(store: Store) { try { return store?.getItem(PACK_MODE_KEY) === "simple"; } catch { return false; } }
export function writePackMode(store: Store, simple: boolean) { try { store?.setItem(PACK_MODE_KEY, simple ? "simple" : "detailed"); } catch { /* storage unavailable */ } }
