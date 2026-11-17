import { Component, type ReactNode } from "react";
import { STORAGE_KEY } from "../shared/portable";

export function CrashRecovery({ onTryAgain, onStartNew }: { onTryAgain: () => void; onStartNew: () => void }) {
  return (
    <div className="card crash-recovery" data-testid="crash-recovery" role="alert">
      <h1>Something went wrong loading your trip</h1>
      <p>Your saved plan is still here. You can try again, or start a new trip — we'll keep a backup.</p>
      <div className="chips">
        <button type="button" onClick={onTryAgain}>Try again</button>
        <button type="button" className="ghost" onClick={onStartNew}>Start a new trip (keeps a backup)</button>
      </div>
    </div>
  );
}

function stashPlan() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    localStorage.setItem("tripfill:backup:last", raw);
    localStorage.setItem(`tripfill:backup:${new Date().toISOString()}`, raw);
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage may be full or blocked */ }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; gen: number }> {
  state = { error: null as Error | null, gen: 0 };
  static getDerivedStateFromError(error: Error) { return { error }; }
  tryAgain = () => this.setState(s => ({ error: null, gen: s.gen + 1 }));
  startNew = () => { stashPlan(); this.setState(s => ({ error: null, gen: s.gen + 1 })); };
  render() {
    if (this.state.error) return <CrashRecovery onTryAgain={this.tryAgain} onStartNew={this.startNew} />;
    return <div key={this.state.gen}>{this.props.children}</div>;
  }
}
