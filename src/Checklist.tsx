import { useEffect, useRef, type InputHTMLAttributes } from "react";

/** Printable state is plain ink, independent of native controls/background printing. */
export function ChecklistCheckbox({ checked, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> & { checked: boolean }) {
  return <><input {...props} type="checkbox" className="checklist-input" checked={checked} /><span className="print-check" aria-hidden="true">{checked ? "[x]" : "[ ]"}</span></>;
}

/** One rAF, two layout passes (all writes, then all reads, then all writes) so N labels cost O(1) reflows, not O(n). */
const pending = new Set<HTMLTextAreaElement>();
const lastWidth = new WeakMap<HTMLTextAreaElement, number>();
let frame = 0;

function visible(el: HTMLTextAreaElement) {
  return el.isConnected && !!el.clientWidth;
}

export function flushChecklistResize() {
  const els = [...pending];
  pending.clear();
  const shown: HTMLTextAreaElement[] = [];
  for (const el of els) if (visible(el)) shown.push(el);
  for (const el of shown) el.style.height = "auto";
  const heights = shown.map(el => el.scrollHeight + 2);
  shown.forEach((el, i) => { el.style.height = `${heights[i]}px`; });
}

export function scheduleChecklistResize(el: HTMLTextAreaElement) {
  pending.add(el);
  if (frame) return;
  const kick = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
  frame = kick(() => { frame = 0; flushChecklistResize(); });
}

let sharedObserver: ResizeObserver | null = null;
function observer() {
  if (sharedObserver) return sharedObserver;
  if (typeof ResizeObserver !== "function") return null;
  sharedObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const el = entry.target as HTMLTextAreaElement;
      const width = entry.contentRect.width;
      if (lastWidth.get(el) === width) continue;
      lastWidth.set(el, width);
      scheduleChecklistResize(el);
    }
  });
  return sharedObserver;
}

/** Wrapping editable labels on screen; complete plain text in print (no input clipping). */
export function ChecklistText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    scheduleChecklistResize(el);
    const ro = observer();
    ro?.observe(el);
    const onFont = () => { if (el.isConnected) scheduleChecklistResize(el); };
    void document.fonts?.ready.then(onFont);
    return () => { ro?.unobserve(el); pending.delete(el); };
  }, [value]);
  return <><textarea ref={ref} className="ed checklist-label" rows={1} aria-label="Checklist item" value={value} onChange={e => onChange(e.target.value)} /><span className="checklist-print-text">{value}</span></>;
}
