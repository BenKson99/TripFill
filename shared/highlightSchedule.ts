/** Which itinerary day mentions a highlight, if any. */
export function scheduledHighlightDay(
  name: string,
  itinerary: { label?: string; morning?: string; afternoon?: string; evening?: string }[] = [],
): { index: number; label: string; dayN: string } | undefined {
  const stem = (name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!stem) return undefined;
  for (let i = 0; i < itinerary.length; i++) {
    const d = itinerary[i];
    const blob = `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`;
    if (blob.includes(name) || (stem.length >= 5 && blob.includes(stem))) {
      const num = (d.label || "").match(/Day\s+(\d+)/i)?.[1] || String(i + 1);
      return { index: i, label: d.label || `Day ${num}`, dayN: `Day ${num}` };
    }
  }
  return undefined;
}
