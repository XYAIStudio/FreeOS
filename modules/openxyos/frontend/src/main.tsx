import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LocaleProvider } from "./i18n";
import { installOpenxyosEmbedTrap, OPENXYOS_READY } from "./embed/trapWindows";
import "./index.css";

if (typeof window !== "undefined" && window.self !== window.top) {
  document.documentElement.classList.add("ox-embedded");
  installOpenxyosEmbedTrap(window);
  try {
    window.parent.postMessage({ type: OPENXYOS_READY }, "*");
  } catch {
    /* embed host may ignore */
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});

// PWA Service Worker 注册（WebView 环境安全降级）
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
    .then((reg) => console.log("[SW] Registered:", reg.scope))
    .catch((e) => console.warn("[SW] Registration failed:", e.message));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <BrowserRouter
          basename={
            import.meta.env.VITE_FREEOS_ORG_INTEGRATED === "true"
              ? "/organization-app"
              : undefined
          }
        >
          <App />
        </BrowserRouter>
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
