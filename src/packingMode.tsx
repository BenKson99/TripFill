import { useSyncExternalStore, type ReactNode } from "react";
import { SectionList, type Layout } from "./Sections";

/** Browser-local view preference only ("simple" | "detailed"); never part of the trip or shared links. */
export const PACK_MODE_KEY = "tripfill:packingMode";
type Store = Pick<Storage, "getItem" | "setItem"> | undefined;
export function readPackMode(store: Store) { try { return store?.getItem(PACK_MODE_KEY) === "simple"; } catch { return false; } }
export function writePackMode(store: Store, simple: boolean) { try { store?.setItem(PACK_MODE_KEY, simple ? "simple" : "detailed"); } catch { /* storage unavailable */ } }

let simple = false;
const listeners = new Set<() => void>();
try { simple = readPackMode(globalThis.localStorage); } catch { /* no store */ }

export function getSimplePacking() { return simple; }
export function setSimplePacking(on: boolean, store?: Store) {
  simple = on;
  writePackMode(store ?? (typeof localStorage !== "undefined" ? localStorage : undefined), on);
  listeners.forEach(fn => fn());
}
export function subscribeSimplePacking(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
/** Isolated subscription so toggling Simple does not re-render the whole App (itinerary, map, budget, …). */
export function useSimplePacking() {
  return useSyncExternalStore(subscribeSimplePacking, getSimplePacking, getSimplePacking);
}

/** Packing & Prep tab: only this subtree re-renders when Simple mode flips. */
export function PackTab({ layout, setLayout, titles, summaries, packing, prep, timeline }: {
  layout: Layout;
  setLayout: (f: (l: Layout) => Layout) => void;
  titles: Record<string, string>;
  summaries: Record<string, string>;
  packing: ReactNode;
  prep?: ReactNode;
  timeline?: ReactNode;
}) {
  const isSimple = useSimplePacking();
  const bodies: Record<string, ReactNode> = { packing };
  if (prep) bodies.prep = isSimple
    ? <details className="simple-prep" data-testid="simple-prep"><summary>Before you leave checklist</summary>{prep}</details>
    : prep;
  if (timeline && !isSimple) bodies.timeline = timeline;
  return <SectionList layout={layout} setLayout={setLayout} titles={titles} summaries={summaries} bodies={bodies as Record<string, JSX.Element>} />;
}
