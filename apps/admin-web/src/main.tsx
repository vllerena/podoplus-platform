import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@podoplus/ui";
import App from "./App";
import { queryClient } from "./lib/query-client";
import "./index.css";

// StrictMode se omite en desarrollo para evitar el doble montaje que duplica
// las requests y dispara el rate limiter del backend (429).
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter
      future={{
        v7_startTransition:   true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
      <Toaster />
    </BrowserRouter>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
