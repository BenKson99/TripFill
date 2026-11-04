import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, CloudSun, EyeOff, GripVertical, ListChecks, Map as MapIcon, MapPin, Luggage, UtensilsCrossed, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DndContext, closestCorners, pointerWithin, type CollisionDetection, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface Layout { order: string[]; collapsed: string[]; hidden: string[]; printCollapsed: boolean }
// Per-device layout preference — stored separately from trip data.
export const LAYOUT_KEY = "tripfill:layout:v1";
const fresh = (ids: string[]): Layout => ({ order: [...ids], collapsed: [], hidden: [], printCollapsed: false });

export function useLayout(ids: string[]): [Layout, (f: (l: Layout) => Layout) => void] {
  const [layout, set] = useState<Layout>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null") as Layout | null;
      if (!s) return fresh(ids);
      const order = [...s.order.filter(id => ids.includes(id)), ...ids.filter(id => !s.order.includes(id))];
      return { order, collapsed: (s.collapsed || []).filter(id => ids.includes(id)), hidden: (s.hidden || []).filter(id => ids.includes(id)), printCollapsed: !!s.printCollapsed };
    } catch { return fresh(ids); }
  });
  useEffect(() => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); }, [layout]);
  return [layout, (f) => set(l => f(l))];
}
const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

export function LayoutBar({ layout, setLayout, titles }: { layout: Layout; setLayout: (f: (l: Layout) => Layout) => void; titles: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const visible = layout.order.filter(id => !layout.hidden.includes(id));
  return (
    <div className="layoutbar noprint">
      <button className="ghost" onClick={() => setLayout(l => ({ ...l, collapsed: [...visible] }))}>Collapse all</button>
      <button className="ghost" onClick={() => setLayout(l => ({ ...l, collapsed: [] }))}>Expand all</button>
      <div className="menu">
        <button className="ghost" aria-expanded={open} disabled={!layout.hidden.length} onClick={() => setOpen(o => !o)}>Hidden sections ({layout.hidden.length}) ▾</button>
        {open && layout.hidden.length > 0 && <div className="menu-pop" role="menu">
          {layout.hidden.map(id => <button role="menuitem" key={id} onClick={() => { setLayout(l => ({ ...l, hidden: l.hidden.filter(x => x !== id) })); setOpen(false); }}>Show {titles[id]}</button>)}
          <button role="menuitem" onClick={() => { setLayout(l => ({ ...l, hidden: [] })); setOpen(false); }}>Show all</button>
        </div>}
      </div>
      <label className="chk"><input type="checkbox" checked={layout.printCollapsed} onChange={e => setLayout(l => ({ ...l, printCollapsed: e.target.checked }))} /> Print collapsed sections as one-line summaries</label>
      <button className="ghost" onClick={() => setLayout(() => fresh(Object.keys(titles)))}>Reset layout</button>
    </div>
  );
}

const ICONS: Record<string, JSX.Element> = { weather: <CloudSun size={20} />, highlights: <MapPin size={20} />, map: <MapIcon size={20} />, food: <UtensilsCrossed size={20} />, packing: <Luggage size={20} />, itinerary: <CalendarDays size={20} />, timeline: <ListChecks size={20} />, budget: <Wallet size={20} /> };

function Section({ id, title, summary, collapsed, idx, count, onToggle, onMove, onHide, children }: { id: string; title: string; summary: string; collapsed: boolean; idx: number; count: number; onToggle: () => void; onMove: (d: -1 | 1) => void; onHide: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.85 : 1 };
  const bodyId = `sec-body-${id}`;
  return (
    <section ref={setNodeRef} style={style} className={"card sec" + (collapsed ? " collapsed" : "") + (isDragging ? " dragging" : "")} data-section={id}>
      <div className="sec-head">
        <button ref={setActivatorNodeRef} className="handle noprint" aria-label={`Drag to reorder ${title}`} {...attributes} {...listeners}><GripVertical size={18} /></button>
        <button className="sec-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
          <span className="chev" aria-hidden><ChevronRight size={18} /></span>{ICONS[id] && <span className="sec-icon" aria-hidden>{ICONS[id]}</span>}
          <h2>{title}</h2>
          {collapsed && <span className="sec-sum">{summary}</span>}
        </button>
        <div className="sec-tools noprint">
          <button aria-label={`Move ${title} up`} disabled={idx === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>
          <button aria-label={`Move ${title} down`} disabled={idx === count - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>
          <button aria-label={`Hide ${title}`} title="Hide section" onClick={onHide}><EyeOff size={16} /></button>
        </div>
      </div>
      <div className="sec-body" id={bodyId} aria-hidden={collapsed}><div className="sec-inner">{children}</div></div>
    </section>
  );
}

// Sections vary a lot in height, so use the pointer position when there is one (mouse/touch)
// and fall back to corner distance for keyboard dragging.
const collide: CollisionDetection = args => {
  const hits = pointerWithin(args);
  if (hits.length) return hits;
  // Keyboard: match by top edge (the keyboard coordinate getter aligns the dragged item's top with its target's top)
  const top = args.collisionRect.top;
  const scored = args.droppableContainers.map(c => { const r = args.droppableRects.get(c.id); return r ? { id: c.id, data: { droppableContainer: c, value: Math.abs(r.top - top) } } : null; }).filter(Boolean) as { id: string | number; data: { droppableContainer: any; value: number } }[];
  scored.sort((a, b) => a.data.value - b.data.value);
  return scored.length ? scored : closestCorners(args);
};

export function SectionList({ layout, setLayout, titles, summaries, bodies }: { layout: Layout; setLayout: (f: (l: Layout) => Layout) => void; titles: Record<string, string>; summaries: Record<string, string>; bodies: Record<string, JSX.Element> }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = layout.order.filter(id => !layout.hidden.includes(id) && bodies[id]);
  const live = useRef<HTMLDivElement>(null);
  const announce = (m: string) => { if (live.current) live.current.textContent = m; };
  const move = (id: string, d: -1 | 1) => setLayout(l => {
    const vis = l.order.filter(x => !l.hidden.includes(x)); const i = vis.indexOf(id); const j = i + d;
    if (j < 0 || j >= vis.length) return l;
    const a = l.order.indexOf(id), b = l.order.indexOf(vis[j]);
    announce(`${titles[id]} moved ${d < 0 ? "up" : "down"}`);
    return { ...l, order: arrayMove(l.order, a, b) };
  });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setLayout(l => ({ ...l, order: arrayMove(l.order, l.order.indexOf(String(e.active.id)), l.order.indexOf(String(e.over!.id))) }));
  };
  return (
    <div className={layout.printCollapsed ? "print-as-shown" : "print-expanded"}>
      <div ref={live} className="sr-only" aria-live="polite" />
      <DndContext sensors={sensors} collisionDetection={collide} onDragEnd={onDragEnd}>
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          {visible.map((id, i) => (
            <Section key={id} id={id} title={titles[id]} summary={summaries[id] || ""} idx={i} count={visible.length}
              collapsed={layout.collapsed.includes(id)}
              onToggle={() => setLayout(l => ({ ...l, collapsed: toggle(l.collapsed, id) }))}
              onMove={d => move(id, d)}
              onHide={() => { setLayout(l => ({ ...l, hidden: [...l.hidden, id] })); announce(`${titles[id]} hidden`); }}>
              {bodies[id]}
            </Section>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
