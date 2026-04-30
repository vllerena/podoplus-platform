/// <reference types="vite/client" />

export const env = {
  API_URL:      import.meta.env.VITE_API_URL      ?? "http://localhost:3000",
  WS_URL:       import.meta.env.VITE_WS_URL       ?? "http://localhost:3000",
  APP_NAME:     import.meta.env.VITE_APP_NAME      ?? "Podoplus Admin",
  ENVIRONMENT:  import.meta.env.MODE               ?? "development",
  IS_DEV:       import.meta.env.DEV,
  IS_PROD:      import.meta.env.PROD,
} as const;
