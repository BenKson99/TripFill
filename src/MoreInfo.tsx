import type { ReactNode } from "react";

/** One-line warning with the longer explanation hidden until opened. */
export function MoreInfo({ children, label = "More info" }: { children: ReactNode; label?: string }) {
  return <details className="more-info noprint" data-testid="more-info"><summary>{label}</summary><div className="more-info-body">{children}</div></details>;
}
