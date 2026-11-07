import { useEffect, useRef, type InputHTMLAttributes } from "react";

/** Printable state is plain ink, independent of native controls/background printing. */
export function ChecklistCheckbox({ checked, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> & { checked: boolean }) {
  return <><input {...props} type="checkbox" className="checklist-input" checked={checked} /><span className="print-check" aria-hidden="true">{checked ? "[x]" : "[ ]"}</span></>;
}

/** Wrapping editable labels on screen; complete plain text in print (no input clipping). */
export function ChecklistText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const resize = () => { if (!el.isConnected || !el.clientWidth) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; };
    resize();
    let width = -1;
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next !== width) { width = next; resize(); } });
    observer.observe(el); void document.fonts?.ready.then(resize);
    return () => observer.disconnect();
  }, [value]);
  return <><textarea ref={ref} className="ed checklist-label" rows={1} aria-label="Checklist item" value={value} onChange={e => onChange(e.target.value)} /><span className="checklist-print-text">{value}</span></>;
}
