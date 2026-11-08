import { useEffect, useRef, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import { ThemeToggle } from "./Theme";

const FOCUSABLE = "button,select,input,textarea,a[href],summary,[tabindex]";
type FocusLike = { matches(sel: string): boolean; closest(sel: string): unknown; getAttribute(n: string): string | null; getClientRects(): { length: number } };
/** Tabbable controls in DOM order: skips disabled (incl. inside disabled fieldsets), hidden, tabindex=-1 and unrendered ones. */
export function isTabbable(el: FocusLike) {
  return !el.matches(":disabled") && !el.closest("[hidden],[inert]") && el.getAttribute("tabindex") !== "-1" && el.getAttribute("type") !== "hidden" && el.getClientRects().length > 0;
}
export function tabbables(root: { querySelectorAll(sel: string): ArrayLike<HTMLElement> }) { return Array.from(root.querySelectorAll(FOCUSABLE)).filter(isTabbable); }
/** Element to force-focus for a Tab press, or null to let the browser move focus normally inside the dialog. */
export function trapTarget<T>(list: T[], active: unknown, shift: boolean): T | null {
  if (!list.length) return null;
  const i = list.indexOf(active as T);
  if (i === -1) return shift ? list[list.length - 1] : list[0];
  if (shift && i === 0) return list[list.length - 1];
  if (!shift && i === list.length - 1) return list[0];
  return null;
}

/** One accessible Settings dialog: closed by default, Escape/backdrop close, focus returns to the opener. */
export function SettingsMenu({ open, setOpen, unit, setUnit, slotRef, children }: {
  open: boolean; setOpen: (o: boolean) => void; unit: "C" | "F"; setUnit: (u: "C" | "F") => void;
  slotRef?: (el: HTMLDivElement | null) => void; children?: ReactNode;
}) {
  const opener = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; (panel.current && tabbables(panel.current)[0])?.focus(); }
    else if (wasOpen.current) { wasOpen.current = false; opener.current?.focus(); }
  }, [open]);
  // Native capture listener: packing settings are portaled in, and React portal events bubble through the
  // React tree (PackingWorkspace), not the dialog's DOM, so a React onKeyDown here never saw their Tab keys.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const list = tabbables(panel.current), target = trapTarget(list, document.activeElement, e.shiftKey);
      if (target) { e.preventDefault(); target.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);
  return <>
    <button ref={opener} type="button" className="ghost settings-open noprint" aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-menu" data-testid="settings-open" onClick={() => setOpen(!open)}><Settings size={16} />Settings</button>
    <div className="settings-backdrop noprint" hidden={!open} onClick={() => setOpen(false)} />
    <div ref={panel} id="settings-menu" className="settings-menu noprint" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden={!open} data-testid="settings-menu">
      <header><h2 id="settings-title">Settings</h2><button type="button" className="ghost" aria-label="Close settings" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <section aria-label="Display"><h3>Display</h3>
        <div className="settings-row"><span>Theme</span><ThemeToggle /></div>
        <div className="settings-row"><span>Temperature</span><div className="seg" role="group" aria-label="Temperature unit">{(["F", "C"] as const).map(u => <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>°{u}</button>)}</div></div>
      </section>
      <div ref={slotRef} className="settings-slot" />
      {children}
    </div>
  </>;
}
