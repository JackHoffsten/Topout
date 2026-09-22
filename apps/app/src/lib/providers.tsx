import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, listenForLogout, broadcastLogout } from './session';
import { ApiError } from '@topout/shared';
const SessionContext = createContext({ api, status: api.getStatus(), logout: async () => {} });
export function Providers({ children }: React.PropsWithChildren) {
  const [query] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: (count, error) =>
              count < 1 && !(error instanceof ApiError && error.status < 500),
          },
          mutations: { retry: false },
        },
      }),
  );
  const status = useSyncExternalStore(api.subscribe, api.getStatus, api.getStatus);
  useEffect(() => {
    void api.initialize();
    return listenForLogout(() => {
      query.clear();
      void api.forget();
    });
  }, [query]);
  useEffect(() => {
    if (status !== 'authenticated') query.clear();
  }, [status, query]);
  const logout = async () => {
    await api.logout();
    query.clear();
    broadcastLogout();
  };
  return (
    <QueryClientProvider client={query}>
      <SessionContext.Provider value={{ api, status, logout }}>{children}</SessionContext.Provider>
    </QueryClientProvider>
  );
}
export const useSession = () => useContext(SessionContext);
