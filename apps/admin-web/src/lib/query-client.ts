import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 2,  // 2 min
      retry:                0,   // sin reintentos — evita duplicar requests en dev
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
