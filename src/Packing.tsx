import { useState } from "react";
import { createPortal } from "react-dom";
import { TravelerFields, editTraveler } from "./Travelers";
import { TravelModeField } from "./TravelMode";
import { resolveTravelMode, type TravelMode } from "../shared/travel";

import { Settings } from "lucide-react";
import { ChecklistCheckbox, ChecklistText } from "./Checklist";
import { ACTIVITY_KITS, SHARED, TEMPLATE_KEY, addPackingItem, applyEssentials, filterPacking, inferActivityKits, makeEssentials, mergeSuggestions, movePackingItem, ownerLabel, packingItems, simpleLists, bagLabel, bagsFor, type SimpleRow, packingProgress, parseEssentials, quantity, removePackingItem, suggestPacking, tripDays, undoPackingRemoval, updatePackingItem, type ActivityKit, type PackingItem, type PackingList, type Stage } from "../shared/packing";

const KIT_LABELS: Record<ActivityKit, string> = {
  beach: "Beach & swim", hiking: "Hiking", ski: "Ski", business: "Business",
  celebration: "Celebration", kids: "Family / kids", roadtrip: "Road trip", photography: "Photography",
};
const stageLabel = (i: PackingItem) => i.skipped ? "Not needed" : i.checked || i.stage === "packed" ? "Packed" : i.stage === "need-to-buy" ? "Need to buy" : "Ready";

export function PackingWorkspace({ plan, readOnly, onChange, T, settingsSlot = null, openSettings, simple = false, onSimpleChange, onTravelMode }: { plan: any; readOnly: boolean; onTravelMode?: (m: TravelMode) => void; simple?: boolean; onSimpleChange?: (on: boolean) => void; settingsSlot?: HTMLElement | null; openSettings?: () => void; onChange: (list: PackingList) => void; T: (s: string) => string }) {
  const p: PackingList = plan.packing;
  const members = p.settings.members?.length ? p.settings.members : [{ id: "traveler-1", name: "Traveler 1" }];
  const travelMode: TravelMode = resolveTravelMode(plan.input, plan.trip?.distanceKm);
  const setTravelMode = (m: TravelMode) => { if (!readOnly) onTravelMode?.(m); };
  const [search, setSearch] = useState(""), [category, setCategory] = useState("all"), [status, setStatus] = useState("all"), [bag, setBag] = useState("all");
  const [owner, setOwner] = useState("all");
  const [name, setName] = useState(""), [newGroup, setNewGroup] = useState("Clothing"), [newQty, setNewQty] = useState(1), [newOwner, setNewOwner] = useState(SHARED);
  const [message, setMessage] = useState("");
  const all = packingItems(p), progress = packingProgress(all), pending = all.filter(i => i.essential && !i.checked && !i.skipped).length;
  const toBuy = all.filter(i => !i.skipped && i.stage === "need-to-buy").length;
  const readyN = all.filter(i => !i.skipped && (i.stage || "ready") === "ready" && !i.checked).length;
  const departure = all.filter(i => !i.skipped && i.lastMinute && !i.checked).length;
  const kits = p.settings.activityKits ?? inferActivityKits(plan);
  const edit = (id: string, patch: Partial<PackingItem>) => { if (!readOnly) onChange(updatePackingItem(p, id, patch)); };
  const change = (next: PackingList) => { if (!readOnly) onChange(next); };
  const changeSettings = (patch: Partial<PackingList["settings"]>) => change({ ...p, settings: { ...p.settings, ...patch } });
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
              <label>Bag<select aria-label={`Bag for ${i.item}`} value={i.bag} onChange={e => edit(i.id, { bag: e.target.value as PackingItem["bag"] })}>{bagsFor(travelMode, i.bag).map(b => <option key={b} value={b}>{bagLabel(b, travelMode)}</option>)}</select></label>
              <label>List<select aria-label={`List for ${i.item}`} value={i.owner || SHARED} onChange={e => edit(i.id, { owner: e.target.value })}><option value={SHARED}>Shared</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              <label>Status<select aria-label={`Status for ${i.item}`} value={i.checked ? "packed" : (i.stage || "ready")} onChange={e => edit(i.id, { stage: e.target.value as Stage })}><option value="need-to-buy">Need to buy</option><option value="ready">Ready</option><option value="packed">Packed</option></select></label>
              <label>Category<select aria-label={`Category for ${i.item}`} value={g.group} onChange={e => change(movePackingItem(p, i.id, e.target.value))}>{[...new Set(["Clothing", "Documents & Money", "Toiletries & Health", "Electronics", "Comfort & Extras", "Activities", ...p.groups.map(x => x.group)])].map(x => <option key={x}>{x}</option>)}</select></label>
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
  const toggle = <div className="packing-mode noprint"><button type="button" role="switch" aria-checked={simple} data-testid="simple-toggle" className={simple ? "on" : "ghost"} onClick={() => onSimpleChange?.(!simple)}><span className="switch-dot" aria-hidden />Simple mode</button><span className="muted small">{simple ? "Just the lists. Switch off for categories, bags, status and filters." : "Show just an Adults list (and Kids, if any)."}</span></div>
  if (simple) return <div className="packing-workspace packing-simple" data-testid="packing-workspace">
    {toggle}
    {settingsSlot && createPortal(<PackingSettingsPanel plan={plan} p={p} readOnly={readOnly} change={change} setMessage={setMessage} travelMode={travelMode} onTravelMode={onTravelMode} />, settingsSlot)}
    <SimpleLists p={p} readOnly={readOnly} onCheck={(id, checked) => edit(id, { checked })} />
  </div>;
  return <div className="packing-workspace" data-testid="packing-workspace">
    {toggle}
    <div className="packing-overview">
      <div><span className="eyebrow">A little less to remember</span><h2>Your bags, in order.</h2><p>{tripDays(plan.input)} days · personal items are listed for each of {plan.input.travelers || members.length} traveler(s), with a separate shared list. Clothing quantities are for that traveler and include what they wear in transit.</p></div>
      <div className="packing-score"><b>{progress.percent}%</b><span>{progress.packed} of {progress.total} active items packed</span><progress aria-label="Packing progress" value={progress.packed} max={Math.max(1, progress.total)} /></div>
    </div>
    <div className="packing-readiness" aria-live="polite">{!progress.total ? "Your list is empty or all items are not needed. Add an item or restore a skipped one." : progress.packed === progress.total ? "✓ Everything on your active list is packed. Check Before you leave separately." : `${progress.total - progress.packed} items to go · ${toBuy} to buy · ${readyN} ready · ${departure} for departure day · ${pending} unpacked essentials.`}</div>
    <p className="muted small">Suggestions use available weather only ({plan.weather.source === "forecast" ? "forecast, not guaranteed" : plan.weather.source === "typical" ? "seasonal estimates, not a forecast" : "mixed / unknown basis"}). Weather-dependent items are marked Essential only when the forecast clearly supports them; otherwise they stay Optional because the weather is uncertain. Check the latest forecast for every stop. {plan.capped || tripDays(plan.input) > (plan.weather.days?.length || 0) ? "Weather may cover only part of this trip; quantities still use the full date range. Later legs may have no weather data." : ""}</p>
    <div className="packing-people noprint" role="tablist" aria-label="Packing lists">{owners.map(o => { const tabItems = o.id === "all" ? all : all.filter(i => (i.owner || SHARED) === o.id); const tab = packingProgress(tabItems); return <button key={o.id} type="button" role="tab" aria-selected={owner === o.id} className={owner === o.id ? "" : "ghost"} onClick={() => { setOwner(o.id); if (o.id !== "all") setNewOwner(o.id); }}>{o.name}<span className="muted"> {tab.packed}/{tab.total}</span></button>; })}</div>
    {settingsSlot && createPortal(<PackingSettingsPanel plan={plan} p={p} readOnly={readOnly} change={change} setMessage={setMessage} travelMode={travelMode} onTravelMode={onTravelMode} />, settingsSlot)}
    {openSettings && <div className="packing-settings-link noprint"><button type="button" className="ghost" data-testid="packing-settings-open" onClick={openSettings}><Settings size={16} />Packing settings: laundry, rewear, travelers & kits</button></div>}
    <div className="packing-filters noprint" role="search" aria-label="Filter packing list">
      <label>Find an item<input type="search" placeholder="Search items or reasons…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{p.groups.map(g => <option key={g.group}>{g.group}</option>)}</select></label>
      <label>Show<select value={status} onChange={e => setStatus(e.target.value)}>{[["all", "All items"], ["unpacked", "Still to pack"], ["need-to-buy", "Need to buy"], ["ready", "Ready"], ["packed", "Packed"], ["essential", "Essentials"], ["departure-day", "Departure day"], ["skipped", "Not needed"]].map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label>
      <label>Bag<select value={bag} onChange={e => setBag(e.target.value)}><option value="all">All bags</option>{bagsFor(travelMode).map(b => <option key={b} value={b}>{bagLabel(b, travelMode)}</option>)}</select></label>
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
  </div>;
}
export function PackingSettingsPanel({ plan, p, readOnly, change, setMessage, travelMode = "flying", onTravelMode }: { plan: any; p: PackingList; readOnly: boolean; change: (next: PackingList) => void; setMessage: (m: string) => void; travelMode?: TravelMode; onTravelMode?: (m: TravelMode) => void }) {
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
        <TravelerFields idPrefix="settings-traveler" members={members} disabled={readOnly} onEdit={(id, patch) => { changeSettings({ members: editTraveler(members, members.length, id, patch) }); if (patch.type !== undefined) setMessage("Traveler type saved. Press Refresh suggestions to add items for it; existing items, checks and edits are kept — remove any that no longer apply."); }} />
        <p className="muted small">Traveler type picks sensible defaults (Girl, Boy and Infant appear under Kids in Simple mode). Type changes apply when you press Refresh suggestions.</p>
        <fieldset className="packing-kits"><legend>Optional activity kits</legend><p className="muted small">Kits start from this trip’s purpose and interests. Turn one off to keep it out of the next refresh; existing items stay unless you remove them.</p><div className="chips">{ACTIVITY_KITS.map(k => <label key={k} className="packing-flag"><input type="checkbox" checked={kits.includes(k)} onChange={e => changeSettings({ activityKits: e.target.checked ? [...kits, k] : kits.filter(x => x !== k) })} />{KIT_LABELS[k]}</label>)}</div></fieldset>
        <p className="muted small">Settings are saved with this trip. Nothing changes automatically: refresh suggestions when ready. Refresh updates only untouched suggestions and adds missing ones; it keeps your edits, checks, not-needed items and removals, and never deletes old items. Review any older suggestions yourself.</p>
        <button onClick={() => { change(mergeSuggestions(p, suggestPacking(plan, p.settings))); setMessage("Suggestions refreshed. Your edits, packed status and removals were kept. Review older items; nothing was deleted."); }}>Refresh suggestions</button>
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
export function SimpleLists({ p, readOnly, onCheck }: { p: PackingList; readOnly: boolean; onCheck: (id: string, checked: boolean) => void }) {
  const { adults, kids } = simpleLists(p);
  const multi = (p.settings.members?.length || 1) > 1;
  const list = (title: string, rows: SimpleRow[], print: boolean) => {
    const active = rows.filter(r => !r.item.skipped), done = active.filter(r => r.item.checked).length;
    return <section className="simple-list" aria-label={`${title} packing list`} data-testid={print ? undefined : `simple-${title.toLowerCase()}`}>
      <header><h3>{title}</h3><span className="muted small">{done}/{active.length} packed</span></header>
      {rows.length ? <ul>{rows.map(({ item: i, ownerName, shared }) => {
        const tag = shared ? "Shared" : multi || title === "Kids" ? ownerName : "";
        const label = `${i.quantity} × ${i.item}${tag ? ` (${tag})` : ""}${i.skipped ? " — not needed" : ""}`;
        return <li key={i.id} className={`${i.checked ? "packed" : ""}${i.skipped ? " skipped" : ""}`} data-item-id={print ? undefined : i.id}>
          {print ? <span aria-hidden>{i.skipped ? "[–]" : i.checked ? "[x]" : "[ ]"}</span>
            : <input type="checkbox" aria-label={`Pack ${label}`} checked={i.checked} disabled={readOnly || i.skipped} onChange={e => onCheck(i.id, e.target.checked)} />}
          <span className="simple-qty">{i.quantity} ×</span><span className="simple-name">{i.item}</span>
          {tag && <small className="simple-owner">{tag}</small>}{i.skipped && <small className="simple-owner">Not needed</small>}
        </li>; })}</ul> : <p className="muted small">No items yet.</p>}
    </section>;
  };
  return <>
    <div className="simple-screen noprint">{list("Adults", adults, false)}{kids && list("Kids", kids, false)}</div>
    <div className="packing-print simple-print">{list("Adults", adults, true)}{kids && list("Kids", kids, true)}</div>
  </>;
}

/** Browser-local view preference only ("simple" | "detailed"); never part of the trip or shared links. */
export const PACK_MODE_KEY = "tripfill:packingMode";
type Store = Pick<Storage, "getItem" | "setItem"> | undefined;
export function readPackMode(store: Store) { try { return store?.getItem(PACK_MODE_KEY) === "simple"; } catch { return false; } }
export function writePackMode(store: Store, simple: boolean) { try { store?.setItem(PACK_MODE_KEY, simple ? "simple" : "detailed"); } catch { /* storage unavailable */ } }
