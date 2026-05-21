import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "stream-chat-react/dist/css/v2/index.css";
import "./index.css";
import App from "./App.jsx";

import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Real viewport height fix for mobile Chrome ──────────────
// On mobile, 100vh includes the browser toolbar causing gaps.
// We measure the actual visible height and expose it as --dvh.
const setDvh = () => {
  document.documentElement.style.setProperty(
    "--dvh",
    `${window.innerHeight * 0.01}px`
  );
};
setDvh();
window.addEventListener("resize", setDvh);
window.addEventListener("orientationchange", () => setTimeout(setDvh, 200));

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
