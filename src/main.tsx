import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import App from "./App";
import "./styles.css";
import { initTheme } from "./Theme";
initTheme();
createRoot(document.getElementById("root")!).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(e => console.warn("SW registration failed", e)));
