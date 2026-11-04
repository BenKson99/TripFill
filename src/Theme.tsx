import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
export type ThemePref = "system" | "light" | "dark";
const KEY = "tripfill:theme";
const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && mq().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
export function initTheme() { applyTheme((localStorage.getItem(KEY) as ThemePref) || "system"); }
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem(KEY) as ThemePref) || "system");
  useEffect(() => {
    applyTheme(pref); localStorage.setItem(KEY, pref);
    if (pref !== "system") return;
    const m = mq(); const f = () => applyTheme("system"); m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, [pref]);
  const opts: [ThemePref, string, JSX.Element][] = [["light", "Light", <Sun size={15} />], ["system", "Auto", <Monitor size={15} />], ["dark", "Dark", <Moon size={15} />]];
  return <div className="theme-toggle noprint" role="group" aria-label="Colour theme" data-testid="theme">
    {opts.map(([k, l, i]) => <button key={k} className={pref === k ? "on" : ""} aria-pressed={pref === k} title={`${l} theme`} onClick={() => setPref(k)}>{i}<span>{l}</span></button>)}
  </div>;
}
