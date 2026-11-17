import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { setSimplePacking, useSimplePacking } from "./packingMode";
import { createPortal } from "react-dom";
import { TravelerFields, editTraveler, setAllTypes } from "./Travelers";
import { TravelModeField } from "./TravelMode";
import { resolveTravelMode, type TravelMode } from "../shared/travel";
import { resolveActivities, type ActivityId } from "../shared/activities";
import { ActivityPicker } from "./Activities";

import { Settings } from "lucide-react";
import { ChecklistCheckbox, ChecklistText } from "./Checklist";
import { ACTIVITY_KITS, SHARED, TEMPLATE_KEY, addPackingItem, applyEssentials, filterPacking, inferActivityKits, makeEssentials, mergeSuggestions, movePackingItem, ownerLabel, packingItems, simpleLists, groupSimpleRows, simpleGroupLabel, updatePackingItems, bagLabel, bagsFor, type SimpleRow, type SimpleGroup, packingProgress, packingEncouragement, startHereItems, simpleMustPackGroups, SIMPLE_MUST_PACK_LIMIT, laundryChoice, laundryEveryFromChoice, midTripLaundryDay, shouldConfirmMarkAll, parseEssentials, quantity, removePackingItem, suggestPacking, tripDays, undoPackingRemoval, updatePackingItem, type ActivityKit, type PackingItem, type PackingList, type Stage, type LaundryChoice } from "../shared/packing";
import { GrownUpBadge } from "./GrownUp";

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

export function PackingWorkspace({ plan, readOnly, onChange, T, settingsSlot = null, openSettings, simple, onSimpleChange, onTravelMode, onActivities, onRefreshPlan }: { plan: any; readOnly: boolean; onTravelMode?: (m: TravelMode) => void; onActivities?: (ids: ActivityId[]) => void; onRefreshPlan?: () => void; simple?: boolean; onSimpleChange?: (on: boolean) => void; settingsSlot?: HTMLElement | null; openSettings?: () => void; onChange: (list: PackingList) => void; T: (s: string) => string }) {
  const p: PackingList = plan.packing;
  const members = p.settings.members?.length ? p.settings.members : [{ id: "traveler-1", name: "Traveler 1" }];
  const travelMode: TravelMode = resolveTravelMode(plan.input, plan.trip?.distanceKm);
  const storedSimple = useSimplePacking();
  const isSimple = simple ?? storedSimple;
  const [message, setMessage] = useState("");
  const [mountedSimple, setMountedSimple] = useState(isSimple);
  const [mountedDetailed, setMountedDetailed] = useState(!isSimple);
  // While the detailed list is on screen, pre-mount (and pre-layout) SimpleLists during idle
  // so the first toggle only flips visibility instead of grouping and creating hundreds of rows.
  useEffect(() => {
    if (isSimple && !mountedSimple) {
      const id = requestAnimationFrame(() => setMountedSimple(true));
      return () => cancelAnimationFrame(id);
    }
    if (!isSimple && !mountedDetailed) {
      const id = requestAnimationFrame(() => setMountedDetailed(true));
      return () => cancelAnimationFrame(id);
    }
    if (!isSimple && !mountedSimple) {
      const ric = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: IdleRequestCallback) => window.setTimeout(cb, 50) as unknown as number;
      const cic = typeof cancelIdleCallback === "function" ? cancelIdleCallback : (id: number) => clearTimeout(id);
      const id = ric(() => setMountedSimple(true));
      return () => cic(id);
    }
  }, [isSimple, mountedSimple, mountedDetailed]);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const TRef = useRef(T); TRef.current = T;
  const edit = useCallback((id: string, patch: Partial<PackingItem>) => { if (!readOnly) onChangeRef.current(updatePackingItem(p, id, patch)); }, [readOnly, p]);
  const change = useCallback((next: PackingList) => { if (!readOnly) onChangeRef.current(next); }, [readOnly]);
  const checkMany = useCallback((ids: string[], checked: boolean) => { if (!readOnly) onChangeRef.current(updatePackingItems(p, ids, { checked })); }, [readOnly, p]);
  const onCheckItem = useCallback((id: string, checked: boolean) => edit(id, { checked }), [edit]);
  const tFn = useCallback((s: string) => TRef.current(s), []);
  const toggle = <div className="packing-mode noprint"><button type="button" role="switch" aria-checked={isSimple} data-testid="simple-toggle" className={isSimple ? "on" : "ghost"} onClick={() => { const next = !isSimple; if (simple === undefined) setSimplePacking(next); onSimpleChange?.(next); }}><span className="switch-dot" aria-hidden />Simple mode</button><span className="muted small">{isSimple ? "My stuff, grouped by category, with the must-pack items first. Open More options for whose bag and other lists." : "Simple mode shows My stuff with big checkboxes, grouped by category."}</span></div>
  return <div className={`packing-workspace${isSimple ? " packing-simple" : ""}`} data-testid="packing-workspace">
    {toggle}
    <StartHere p={p} readOnly={readOnly} onCheck={onCheckItem} T={tFn} />
    {settingsSlot && createPortal(<PackingSettingsPanel plan={plan} p={p} readOnly={readOnly} change={change} setMessage={setMessage} travelMode={travelMode} onTravelMode={onTravelMode} onActivities={onActivities} onRefreshPlan={onRefreshPlan} />, settingsSlot)}
    {mountedSimple && <div hidden={isSimple ? false : undefined} className={isSimple ? undefined : "noprint packing-simple-preload"} aria-hidden={!isSimple} data-testid="packing-simple-pane"><SimpleLists p={p} readOnly={readOnly} onCheckMany={checkMany} onCheck={onCheckItem} T={tFn} /></div>}
    {mountedDetailed && <div hidden={isSimple} className={isSimple ? "noprint" : undefined} data-testid="packing-detailed-pane">
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
      {printing ? <><span>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span><div><b>{i.quantity} × {T(i.item)}</b> <GrownUpBadge name={i.item} flagged={i.grownUp} /><div className="small">{bagLabel(i.bag, travelMode)} · {stageLabel(i)}{i.essential ? " · Essential" : " · Optional"}{i.lastMinute ? " · Departure day" : ""} · {ownerLabel(p, i.owner || SHARED)}</div><small>{T(i.reason)}</small></div></> : <>
        <div className="packing-check"><ChecklistCheckbox aria-label={`Pack ${T(i.item)}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => edit(i.id, { checked: e.target.checked })} /></div>
        <div className="packing-content">
          <fieldset disabled={readOnly} className="packing-edit"><ChecklistText value={T(i.item)} onChange={item => edit(i.id, { item: item.slice(0, 300) })} /><GrownUpBadge name={i.item} flagged={i.grownUp} />
            <div className="packing-meta"><label>Qty<input aria-label={`Quantity for ${T(i.item)}`} type="number" min={1} max={999} value={i.quantity} onChange={e => edit(i.id, { quantity: quantity(Number(e.target.value)) })} /></label>
              <LazySelect label="Bag" aria-label={`Bag for ${T(i.item)}`} value={i.bag} options={bagsFor(travelMode, i.bag).map(b => ({ value: b, label: bagLabel(b, travelMode) }))} onChange={v => edit(i.id, { bag: v as PackingItem["bag"] })} />
              <LazySelect label="List" aria-label={`List for ${T(i.item)}`} value={i.owner || SHARED} options={[{ value: SHARED, label: "Shared" }, ...members.map(m => ({ value: m.id, label: m.name }))]} onChange={v => edit(i.id, { owner: v })} />
              <LazySelect label="Status" aria-label={`Status for ${T(i.item)}`} value={i.checked ? "packed" : (i.stage || "ready")} options={[{ value: "need-to-buy", label: "Need to buy" }, { value: "ready", label: "Ready" }, { value: "packed", label: "Packed" }]} onChange={v => edit(i.id, { stage: v as Stage })} />
              <LazySelect label="Category" aria-label={`Category for ${T(i.item)}`} value={g.group} options={[...new Set(["Clothing", "Documents & Money", "Toiletries & Health", "Electronics", "Comfort & Extras", "Activities", ...p.groups.map(x => x.group)])].map(x => ({ value: x, label: x }))} onChange={v => change(movePackingItem(p, i.id, v))} />
              <label className="packing-flag"><input type="checkbox" checked={i.essential} onChange={e => edit(i.id, { essential: e.target.checked })} />Essential</label>
              <label className="packing-flag"><input type="checkbox" checked={i.lastMinute} onChange={e => edit(i.id, { lastMinute: e.target.checked })} />Departure day</label>
              <label className="packing-flag"><input type="checkbox" checked={i.skipped} onChange={e => edit(i.id, { skipped: e.target.checked })} />Not needed</label>
            </div>
          </fieldset>
          {i.reason && <p className="packing-reason">{T(i.reason)}</p>}
          <div className="packing-item-foot"><span>{i.skipped ? "Not needed · excluded from progress" : `${stageLabel(i)} · ${ownerLabel(p, i.owner || SHARED)}`}{i.essential ? " · Essential" : " · Optional"}{i.lastMinute ? " · Departure day" : ""}{i.edited ? " · Your edits protected" : ""}</span>{!readOnly && <button className="ghost small" aria-label={`Remove ${T(i.item)}`} onClick={() => { change(removePackingItem(p, i.id)); setMessage(`Removed “${T(i.item)}”. Undo is available below.`); }}>Remove</button>}</div>
        </div>
      </>}
    </article>)}
  </section>; });
    return <>

    <div className="packing-overview">
      <div><span className="eyebrow">A little less to remember</span><h2>Your bags, in order.</h2><p>{tripDays(plan.input)} days · personal items are listed for each of {plan.input.travelers || members.length} traveler(s), with a separate shared list. Clothing quantities are for that traveler and include what they wear in transit.</p></div>
      <div className="packing-score"><b>{progress.percent}%</b><span>{progress.packed} of {progress.total} packed</span><progress aria-label="Packing progress" value={progress.packed} max={Math.max(1, progress.total)} /></div>
    </div>
    <div className="packing-readiness" aria-live="polite" data-testid="packing-readiness">{packingEncouragement(p)}{progress.total && progress.packed !== progress.total ? <span className="muted"> {toBuy ? `${toBuy} to buy. ` : ""}{pending ? `${pending} essential items still open.` : ""}</span> : null}</div>
    <p className="muted small">Suggestions use available weather only ({plan.weather.source === "forecast" ? "forecast, not guaranteed" : plan.weather.source === "typical" ? "seasonal estimates, not a forecast" : "mixed / unknown basis"}). Weather-dependent items are marked Essential only when the forecast clearly supports them; otherwise they stay Optional because the weather is uncertain. Check the latest forecast for every stop. {plan.capped || tripDays(plan.input) > (plan.weather.days?.length || 0) ? "Weather may cover only part of this trip; quantities still use the full date range. Later legs may have no weather data." : ""}</p>
    <div className="packing-people noprint" role="tablist" aria-label="Packing lists">{owners.map(o => { const tabItems = o.id === "all" ? all : all.filter(i => (i.owner || SHARED) === o.id); const tab = packingProgress(tabItems); return <button key={o.id} type="button" role="tab" aria-selected={owner === o.id} className={owner === o.id ? "" : "ghost"} onClick={() => { setOwner(o.id); if (o.id !== "all") setNewOwner(o.id); }}>{o.name}<span className="muted"> {tab.packed}/{tab.total}</span></button>; })}</div>
    {openSettings && <div className="packing-settings-link noprint"><button type="button" className="ghost" data-testid="packing-settings-open" onClick={openSettings}><Settings size={16} />Packing settings</button></div>}
    <div className="packing-filters noprint" role="search" aria-label="Filter packing list">
      <label>Find an item<input type="search" placeholder="Search items or reasons…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{p.groups.map(g => <option key={g.group}>{g.group}</option>)}</select></label>
      <label>Show<select value={status} onChange={e => setStatus(e.target.value)}>{[["all", "All items"], ["unpacked", "Still to pack"], ["need-to-buy", "Need to buy"], ["ready", "Ready"], ["packed", "Packed"], ["essential", "Essentials"], ["departure-day", "Departure day"], ["skipped", "Not needed"]].map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label>
      <label>Bag<select value={bag} onChange={e => setBag(e.target.value)}><option value="all">All bags</option>{bagsFor(travelMode).map(b => <option key={b} value={b}>{bagLabel(b, travelMode)}</option>)}</select></label>
      {members.length > 1 && <label>My stuff<select aria-label="My stuff" data-testid="packing-show-only" value={owner} onChange={e => { setOwner(e.target.value); if (e.target.value !== "all") setNewOwner(e.target.value); }}><option value="all">Everyone</option><option value={members[0].id}>My stuff · {members[0].name}</option><option value="shared">Shared</option>{members.slice(1).map(m => <option key={m.id} value={m.id}>My stuff · {m.name}</option>)}</select></label>}
    </div>
    {message && <p className="packing-message noprint" role="status">{message}</p>}
    {!readOnly && p.lastRemoved && <div className="packing-undo noprint"><span>Last removed: {T(p.lastRemoved.item.item)}</span><button className="ghost" onClick={() => { change(undoPackingRemoval(p)); setMessage("Item restored with its quantity, bag and packed status."); }}>Undo removal</button></div>}
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
    {!!p.leaveAtHome.length && <details><summary>Notes from your older list · leave at home</summary><ul>{p.leaveAtHome.map(i => <li key={i.id}>{T(i.item)} — {T(i.reason || "")}</li>)}</ul><p className="small muted">These older suggestions are not requirements. Review them against your own needs and current rules.</p></details>}
    </>;
});
export function PackingSettingsPanel({ plan, p, readOnly, change, setMessage, travelMode = "flying", onTravelMode, onActivities, onRefreshPlan }: { plan: any; p: PackingList; readOnly: boolean; change: (next: PackingList) => void; setMessage: (m: string) => void; travelMode?: TravelMode; onTravelMode?: (m: TravelMode) => void; onActivities?: (ids: ActivityId[]) => void; onRefreshPlan?: () => void }) {
  const members = p.settings.members?.length ? p.settings.members : [{ id: "traveler-1", name: "Traveler 1" }];
  const kits = p.settings.activityKits ?? inferActivityKits(plan);
  const days = tripDays(plan.input);
  const mid = midTripLaundryDay(days);
  const choice = laundryChoice(days, p.settings.laundryEvery);
  const changeSettings = (patch: Partial<PackingList["settings"]>) => change({ ...p, settings: { ...p.settings, ...patch } });
  const setLaundry = (c: LaundryChoice, custom?: number | null) => changeSettings({ laundryEvery: laundryEveryFromChoice(c, days, custom ?? p.settings.laundryEvery) });
  const refresh = () => { if (onRefreshPlan) onRefreshPlan(); else change(mergeSuggestions(p, suggestPacking(plan, p.settings))); setMessage("Adds new suggestions and keeps everything you changed."); };
  return <section className="packing-settings" aria-labelledby="packing-settings-title" data-testid="packing-settings">
    {readOnly && <p className="muted small">Shared plan: settings are view-only.</p>}
    <fieldset disabled={readOnly} className="packing-edit">
      <div className="settings-block" data-testid="settings-travelers">
        <h3 id="packing-settings-title">Travelers</h3>
        <TravelerFields idPrefix="settings-traveler" members={members} disabled={readOnly} onEdit={(id, patch) => { changeSettings({ members: editTraveler(members, members.length, id, patch) }); if (patch.type !== undefined) setMessage("Type saved. Press Refresh to add items for it — your ticks and edits stay."); }} onEditAll={type => { changeSettings({ members: setAllTypes(members, members.length, type) }); setMessage("Type saved. Press Refresh to add items for it — your ticks and edits stay."); }} />
        <p className="muted small">Girl, Boy and Infant lists show up under Kids in Simple mode.</p>
      </div>
      <div className="settings-block" data-testid="settings-packing">
        <h3>Packing details</h3>
        <fieldset className="laundry-choices" data-testid="laundry-choices"><legend>Laundry</legend>
          {([["none", "No laundry"], ["mid", `Once mid-trip${days ? ` (day ${mid})` : ""}`], ["few", "Every few days"], ["custom", "Custom"]] as const).map(([v, label]) =>
            <label key={v} className="packing-flag"><input type="radio" name="laundry-choice" checked={choice === v} onChange={() => setLaundry(v)} />{label}</label>)}
          {choice === "custom" && <label>Wash every <select aria-label="Wash every how many days" value={p.settings.laundryEvery ?? 7} onChange={e => setLaundry("custom", Number(e.target.value))}>{Array.from({ length: 30 }, (_, n) => n + 1).map(n => <option key={n} value={n}>{n} day{n > 1 ? "s" : ""}</option>)}</select></label>}
        </fieldset>
        <button type="button" onClick={refresh}>Refresh suggestions</button>
        <p className="muted small">Adds new suggestions and keeps everything you changed.</p>
      </div>
      <details className="settings-advanced" data-testid="settings-advanced">
        <summary>Advanced (for grown-ups)</summary>
        <div className="packing-settings-grid">
          <TravelModeField value={travelMode} onChange={onTravelMode} disabled={readOnly} hint="Updates travel labels and packing ideas. Your ticks and edits stay." />
          <label>Luggage preference<select value={p.settings.luggage} onChange={e => changeSettings({ luggage: e.target.value as "all" | "carry-on" })}><option value="all">Any luggage · assign bags myself</option><option value="carry-on">{travelMode === "driving" ? "Day bags only · keep bags with you" : "Carry-on only · cabin bags"}</option></select></label>
          <label>Rewear tops<select value={p.settings.rewearTopsEvery ?? 1} onChange={e => changeSettings({ rewearTopsEvery: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n === 1 ? "Change daily" : `About every ${n} days`}</option>)}</select></label>
          <label>Rewear bottoms<select value={p.settings.rewearBottomsEvery ?? 3} onChange={e => changeSettings({ rewearBottomsEvery: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n === 1 ? "Change daily" : `About every ${n} days`}</option>)}</select></label>
        </div>
        <label className="packing-flag"><input type="checkbox" checked={p.settings.includeSpares !== false} onChange={e => changeSettings({ includeSpares: e.target.checked })} />Add a spare pair of underwear and socks</label>
        <ActivityPicker idPrefix="settings-activity" value={resolveActivities(plan.input)} interests={plan.input?.interests} destination={plan.input?.destination || plan.place?.name} disabled={readOnly} onChange={(ids: ActivityId[]) => { onActivities?.(ids); setMessage("Activities saved. Press Refresh to add packing items; your ticks and edits stay."); }} />
        <fieldset className="packing-kits"><legend>Also pack for</legend><p className="muted small">Business and celebration outfits come from Purpose. Other kits stay for older trips.</p><div className="chips">{ACTIVITY_KITS.filter(k => k === "business" || k === "celebration" || kits.includes(k)).map(k => <label key={k} className="packing-flag"><input type="checkbox" checked={kits.includes(k)} onChange={e => changeSettings({ activityKits: e.target.checked ? [...kits, k] : kits.filter(x => x !== k) })} />{KIT_LABELS[k]}</label>)}</div></fieldset>
        {tripDays(plan.input) > 14 && <p className="warn small">Long trip: clothing quantities are capped. Plan a wash, rewear or a top-up if you have no laundry.</p>}
        <p className="muted small">{travelMode === "driving" ? "Bag labels are just for organising. Check your vehicle, parking, tolls and any official rules yourself." : "Bag labels are just for organising, not airline approval to fly. Check official size, battery and entry rules yourself."}</p>
        {!readOnly && <div className="packing-personal"><h3>Your personal essentials</h3><p className="muted small">Mark items Essential, then save that list on this browser only. Avoid sensitive details. The template is not shared.</p>
          <div className="chips"><button className="ghost" onClick={() => { try { const template = makeEssentials(p); if (!template.items.length) throw new Error("Mark at least one active item Essential first."); if (localStorage.getItem(TEMPLATE_KEY) && !confirm("Replace your browser's personal essentials template with this trip's Essential items?")) return; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(parseEssentials(JSON.stringify(template)))); setMessage(`Saved ${template.items.length} personal essentials in this browser.`); } catch (e: any) { setMessage(e.message || "Could not save personal essentials."); } }}>Save essentials</button>
          <button className="ghost" onClick={() => { try { const text = localStorage.getItem(TEMPLATE_KEY); if (!text) throw new Error("No essentials template yet. Mark items Essential and save one first."); change(applyEssentials(p, parseEssentials(text))); setMessage("Personal essentials applied. Matching items were kept; missing ones were added unpacked."); } catch (e: any) { setMessage(e.message); } }}>Apply essentials</button>
          <button className="ghost" onClick={() => { try { if (confirm("Forget the personal essentials template in this browser? Applied trip items will stay.")) { localStorage.removeItem(TEMPLATE_KEY); setMessage("Personal essentials template forgotten; trip items unchanged."); } } catch { setMessage("Browser storage unavailable."); } }}>Forget template</button></div></div>}
      </details>
    </fieldset>
  </section>;
}



function shortItemName(name: string) { return name.replace(/\s*\(~[^)]*\)\s*$/, "").trim(); }

const StartHere = memo(function StartHere({ p, readOnly, onCheck, T = (s: string) => s }: { p: PackingList; readOnly: boolean; onCheck: (id: string, checked: boolean) => void; T?: (s: string) => string }) {
  const items = useMemo(() => startHereItems(p), [p]);
  if (!items.length) return <p className="packing-encouragement noprint" data-testid="packing-encouragement">{T(packingEncouragement(p, items))}</p>;
  return <section className="start-here noprint" data-testid="start-here">
    <header><h3>Start here</h3><p className="packing-encouragement" data-testid="packing-encouragement">{T(packingEncouragement(p, items))}</p></header>
    <ul>{items.map(i => <li key={i.id} className={i.checked ? "packed" : ""}>
      <input type="checkbox" aria-label={`Pack ${T(shortItemName(i.item))}`} checked={!!i.checked} disabled={readOnly} onChange={e => onCheck(i.id, e.target.checked)} />
      <span className="simple-name">{T(shortItemName(i.item))}</span>
      {i.quantity > 1 && <span className="simple-qty">{i.quantity} ×</span>}
      <GrownUpBadge name={i.item} flagged={i.grownUp} />
    </li>)}</ul>
  </section>;
});

/** Simple mode: whole active lists (ignores detailed search/filters), same item ids, checks only. */
export const SimpleLists = memo(function SimpleLists({ p, readOnly, onCheck, onCheckMany, T = (s: string) => s }: { p: PackingList; readOnly: boolean; onCheck: (id: string, checked: boolean) => void; onCheckMany?: (ids: string[], checked: boolean) => void; T?: (s: string) => string }) {
  const checkMany = onCheckMany || ((ids: string[], checked: boolean) => ids.forEach(id => onCheck(id, checked)));
  const lists = useMemo(() => simpleLists(p), [p]);
  const members = p.settings.members?.length ? p.settings.members : [];
  const [stuffOf, setStuffOf] = useState("all");
  const mine = useMemo(() => {
    if (stuffOf === "all") return null;
    const rows = [...lists.adults, ...(lists.kids || [])].filter(r => (r.item.owner || SHARED) === stuffOf);
    return { rows, grouped: groupSimpleRows(rows) };
  }, [lists, stuffOf]);
  const adultEntries = useMemo(() => groupSimpleRows(lists.adults), [lists.adults]);
  const kidEntries = useMemo(() => lists.kids ? groupSimpleRows(lists.kids) : null, [lists.kids]);
  const mustGroups = useMemo(() => simpleMustPackGroups(p), [p]);
  const mustTotal = useMemo(() => packingProgress(packingItems(p)).total, [p]);
  const [showAllMust, setShowAllMust] = useState(false);
  const multi = (p.settings.members?.length || 1) > 1;
  // SSR keeps the print copy for tests and print; in the browser wait until idle / beforeprint so the first paint is only the on-screen list.
  const [forPrint, setForPrint] = useState(() => typeof window === "undefined");
  useEffect(() => {
    const add = () => setForPrint(true);
    const ric = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: IdleRequestCallback) => window.setTimeout(cb, 200) as unknown as number;
    const cic = typeof cancelIdleCallback === "function" ? cancelIdleCallback : (id: number) => clearTimeout(id);
    const id = ric(add);
    window.addEventListener("beforeprint", add);
    return () => { cic(id); window.removeEventListener("beforeprint", add); };
  }, []);
  const list = (title: string, grouped: ReturnType<typeof groupSimpleRows>, rows: SimpleRow[], print: boolean) => {
    const active = rows.filter(r => !r.item.skipped), done = active.filter(r => r.item.checked).length;
    return <section className="simple-list" aria-label={`${title} packing list`} data-testid={print ? undefined : `simple-${title.toLowerCase()}`}>
      <header><h3>{title}</h3><span className="muted small">{done}/{active.length} packed</span></header>
      {rows.length ? <ul>{grouped.entries.map(e => e.kind === "shared"
        ? <SimpleSharedRow key={e.row.item.id} row={e.row} readOnly={readOnly} print={print} onCheck={onCheck} T={T} />
        : <SimpleGroupRow key={e.group.key} g={e.group} multi={multi} title={title} readOnly={readOnly} print={print} onCheck={onCheck} onCheckMany={checkMany} T={T} />)}</ul>
        : <p className="muted small">No items yet.</p>}
    </section>;
  };
  const picker = members.length > 1 && <div className="my-stuff-picker noprint" data-testid="my-stuff">
    <span>Whose bag?</span>
    <div className="chips" role="tablist" aria-label="My stuff">
      <button type="button" role="tab" aria-selected={stuffOf === "all"} className={stuffOf === "all" ? "on" : "ghost"} onClick={() => setStuffOf("all")}>Everyone</button>
      {members.map(m => <button key={m.id} type="button" role="tab" aria-selected={stuffOf === m.id} className={stuffOf === m.id ? "on" : "ghost"} onClick={() => setStuffOf(m.id)}>My stuff · {m.name}</button>)}
      <button type="button" role="tab" aria-selected={stuffOf === SHARED} className={stuffOf === SHARED ? "on" : "ghost"} onClick={() => setStuffOf(SHARED)}>Shared</button>
    </div>
  </div>;
  const mustEntries = mustGroups.flatMap(g => g.entries.map(e => ({ cat: g.group, e })));
  const visibleMust = showAllMust ? mustEntries : mustEntries.slice(0, SIMPLE_MUST_PACK_LIMIT);
  const mustByCat = visibleMust.reduce((acc, row) => {
    const last = acc[acc.length - 1];
    if (last && last.group === row.cat) last.entries.push(row.e);
    else acc.push({ group: row.cat, entries: [row.e] });
    return acc;
  }, [] as { group: string; entries: ReturnType<typeof groupSimpleRows>["entries"] }[]);
  return <>
    <div className="simple-screen noprint">
      <section className="simple-list my-stuff" aria-label="My stuff" data-testid="my-stuff-list">
        <header><h3>My stuff</h3>
          <span className="muted small">{mustTotal ? packingProgress(packingItems(p)).packed : 0}/{mustTotal} packed</span></header>
        <p className="muted small">Tick each thing as you put it in the bag. Essentials are first.</p>
        {mustEntries.length ? mustByCat.map(g => <div key={g.group} className="simple-cat" data-testid={`simple-cat-${g.group}`}>
          <h4 className="simple-cat-title">{g.group}</h4>
          <ul>{g.entries.map(e => e.kind === "shared"
            ? <SimpleSharedRow key={e.row.item.id} row={{ ...e.row, item: { ...e.row.item, item: shortItemName(e.row.item.item) } }} readOnly={readOnly} print={false} onCheck={onCheck} T={T} />
            : <SimpleGroupRow key={e.group.key} g={e.group} multi={false} title="My stuff" readOnly={readOnly} print={false} onCheck={onCheck} onCheckMany={checkMany} T={T} showPeople={false} />)}</ul>
        </div>) : <p className="muted small">No items on this list yet.</p>}
        {mustEntries.length > SIMPLE_MUST_PACK_LIMIT && <button type="button" className="ghost simple-show-all" data-testid="simple-show-all" onClick={() => setShowAllMust(v => !v)}>{showAllMust ? "Show the must-pack items first" : `Show everything (${mustTotal})`}</button>}
      </section>
      <details className="simple-more" data-testid="simple-more">
        <summary>More options</summary>
        {picker}
        {mine
          ? <section className="simple-list my-stuff-extra" aria-label="My stuff by person">
              <header><h3>My stuff{stuffOf !== SHARED && members.find(m => m.id === stuffOf) ? ` · ${members.find(m => m.id === stuffOf)!.name}` : stuffOf === SHARED ? " · Shared" : ""}</h3>
                <span className="muted small">{mine.rows.filter(r => !r.item.skipped && r.item.checked).length}/{mine.rows.filter(r => !r.item.skipped).length} packed</span></header>
              {mine.rows.length ? <ul>{mine.grouped.entries.map(e => e.kind === "shared"
                ? <SimpleSharedRow key={e.row.item.id} row={{ ...e.row, item: { ...e.row.item, item: shortItemName(e.row.item.item) } }} readOnly={readOnly} print={false} onCheck={onCheck} T={T} />
                : <SimpleGroupRow key={e.group.key} g={e.group} multi={false} title="My stuff" readOnly={readOnly} print={false} onCheck={onCheck} onCheckMany={checkMany} T={T} />)}</ul>
                : <p className="muted small">No items on this list yet.</p>}
            </section>
          : <>{list("Adults", adultEntries, lists.adults, false)}{kidEntries && list("Kids", kidEntries, lists.kids!, false)}</>}
      </details>
    </div>
    {forPrint && <div className="packing-print simple-print">{list("Adults", adultEntries, lists.adults, true)}{kidEntries && list("Kids", kidEntries, lists.kids!, true)}</div>}
  </>;
});

const SimpleSharedRow = memo(function SimpleSharedRow({ row, readOnly, print, onCheck, T = (s: string) => s }: { row: SimpleRow; readOnly: boolean; print: boolean; onCheck: (id: string, checked: boolean) => void; T?: (s: string) => string }) {
  const i = row.item, name = T(i.item), label = `${i.quantity} × ${name} (Shared)${i.skipped ? " — not needed" : ""}`;
  return <li className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={print ? undefined : i.id} data-shared="true">
    {print ? <span aria-hidden>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span>
      : <input type="checkbox" aria-label={`Pack ${label}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />}
    <span className="simple-qty">{i.quantity} ×</span><span className="simple-name">{name}</span> <GrownUpBadge name={i.item} flagged={i.grownUp} />
    <small className="simple-owner">Shared</small>{i.skipped && <small className="simple-owner">Not needed</small>}
  </li>;
});

const SimpleGroupRow = memo(function SimpleGroupRow({ g, multi, title, readOnly, print, onCheck, onCheckMany, T = (s: string) => s, showPeople = true }: { g: SimpleGroup; multi: boolean; title: string; readOnly: boolean; print: boolean; onCheck: (id: string, checked: boolean) => void; onCheckMany: (ids: string[], checked: boolean) => void; T?: (s: string) => string; showPeople?: boolean }) {
  const [open, setOpen] = useState(false);
  if (g.rows.length === 1) {
    const { item: i, ownerName } = g.rows[0];
    const tag = multi || title === "Kids" ? ownerName : "";
    const name = T(i.item);
    const label = `${i.quantity} × ${name}${tag ? ` (${tag})` : ""}${i.skipped ? " — not needed" : ""}`;
    return <li className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={print ? undefined : i.id}>
      {print ? <span aria-hidden>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span>
        : <input type="checkbox" aria-label={`Pack ${label}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />}
      <span className="simple-qty">{i.quantity} ×</span><span className="simple-name">{name}</span> <GrownUpBadge name={i.item} flagged={i.grownUp} />
      {tag && <small className="simple-owner">{tag}</small>}{i.skipped && <small className="simple-owner">Not needed</small>}
    </li>;
  }
  const label = T(simpleGroupLabel(g)), allPacked = g.total > 0 && g.packed === g.total, some = g.packed > 0 && !allPacked;
  const ids = g.rows.filter(r => !r.item.skipped).map(r => r.item.id);
  return <li className={`simple-group${allPacked ? " packed" : ""}`} data-group-key={print ? undefined : g.key}>
    {print ? <span aria-hidden>{allPacked ? "[x]" : some ? "[/]" : "[ ]"}</span>
      : <input type="checkbox" aria-label={`Pack ${label} for everyone`} checked={allPacked} ref={el => { if (el) el.indeterminate = some; }} disabled={readOnly || !g.total} onChange={() => onCheckMany(ids, !allPacked)} />}
    <span className="simple-name">{label}</span>
    <small className="simple-progress">{g.packed}/{g.total} packed</small>
    {!print && !readOnly && g.total > 0 && <button type="button" className="ghost simple-mark-all" onClick={() => { if (!allPacked && shouldConfirmMarkAll(g) && typeof confirm === "function" && !confirm(`Mark packed for ${g.rows.map(r => r.ownerName).join(", ")}?`)) return; onCheckMany(ids, !allPacked); }}>{allPacked ? "Unpack all" : "Mark all packed"}</button>}
    {!print && showPeople && <button type="button" className="ghost simple-expand" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide people" : "Show people"}</button>}
    {print && <small className="simple-owner">{g.rows.map(r => r.ownerName).join(", ")}</small>}
    {open && !print && <ul className="simple-people">{g.rows.map(({ item: i, ownerName }) => <li key={i.id} className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={i.id}>
      <input type="checkbox" aria-label={`Pack ${T(i.item)} for ${ownerName}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />
      <span className="simple-name">{ownerName}</span>
      {i.skipped && <small className="simple-owner">Not needed</small>}
    </li>)}</ul>}
  </li>;
});

export { PACK_MODE_KEY, readPackMode, writePackMode } from "./packingMode";
