import { useEffect, useRef, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import { ThemeToggle } from "./Theme";

/** One accessible Settings dialog: closed by default, Escape/backdrop close, focus returns to the opener. */
export function SettingsMenu({ open, setOpen, unit, setUnit, slotRef, children }: {
  open: boolean; setOpen: (o: boolean) => void; unit: "C" | "F"; setUnit: (u: "C" | "F") => void;
  slotRef?: (el: HTMLDivElement | null) => void; children?: ReactNode;
}) {
  const opener = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; panel.current?.querySelector<HTMLElement>("button,select,input")?.focus(); }
    else if (wasOpen.current) { wasOpen.current = false; opener.current?.focus(); }
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return; }
    if (e.key !== "Tab" || !panel.current) return;
    const f = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),select:not([disabled]),input:not([disabled]),summary"));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return <>
    <button ref={opener} type="button" className="ghost settings-open noprint" aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-menu" data-testid="settings-open" onClick={() => setOpen(!open)}><Settings size={16} />Settings</button>
    <div className="settings-backdrop noprint" hidden={!open} onClick={() => setOpen(false)} />
    <div ref={panel} id="settings-menu" className="settings-menu noprint" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden={!open} onKeyDown={onKey} data-testid="settings-menu">
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
