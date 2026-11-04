import { useEffect, useState } from "react";
type Any = any;
export function useOnline() {
  const [on, set] = useState(navigator.onLine);
  useEffect(() => { const a = () => set(true), b = () => set(false); addEventListener("online", a); addEventListener("offline", b); return () => { removeEventListener("online", a); removeEventListener("offline", b); }; }, []);
  return on;
}
export function InstallButton() {
  const [evt, setEvt] = useState<Any>(null);
  useEffect(() => { const h = (e: Any) => { e.preventDefault(); setEvt(e); }; addEventListener("beforeinstallprompt", h); return () => removeEventListener("beforeinstallprompt", h); }, []);
  if (!evt) return null;
  return <button onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>📲 Install app</button>;
}
