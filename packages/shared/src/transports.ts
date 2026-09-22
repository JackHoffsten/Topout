import {
  accessSessionSchema,
  nativeSessionSchema,
  csrfSchema,
  type LoginInput,
  type RegisterInput,
} from './contracts';
import { ApiError, readResponse, type Fetcher, type SessionTransport } from './client';

export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
export function nativeTransport(
  baseUrl: string,
  store: TokenStore,
  fetcher: Fetcher = fetch,
): SessionTransport {
  async function post(path: string, body: unknown) {
    return readResponse(
      await fetcher(baseUrl + '/api/auth/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }
  async function save(path: string, body: unknown) {
    const session = nativeSessionSchema.parse(await post(path, body));
    await store.set(session.refreshToken);
    return accessSessionSchema.parse(session);
  }
  return {
    login: (input: LoginInput) => save('login', input),
    register: (input: RegisterInput) => save('register', input),
    refresh: async () => {
      const refreshToken = await store.get();
      return refreshToken ? save('refresh', { refreshToken }) : null;
    },
    revoke: async () => {
      const refreshToken = await store.get();
      if (refreshToken) await post('revoke', { refreshToken });
      await store.clear();
    },
    clear: () => store.clear(),
  };
}
export type SessionLock = <T>(action: () => Promise<T>) => Promise<T>;
export function webTransport(
  baseUrl: string,
  lock: SessionLock,
  fetcher: Fetcher = fetch,
): SessionTransport {
  async function post(path: string, body?: unknown) {
    // Fetch the CSRF token under the same cross-tab lock as cookie rotation.
    const csrf = csrfSchema.parse(
      await readResponse(await fetcher(baseUrl + '/api/auth/web/csrf', { credentials: 'include' })),
    );
    return readResponse(
      await fetcher(baseUrl + '/api/auth/web/' + path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }
  return {
    login: (input) => lock(async () => accessSessionSchema.parse(await post('login', input))),
    register: (input) => lock(async () => accessSessionSchema.parse(await post('register', input))),
    refresh: () =>
      lock(async () => {
        try {
          return accessSessionSchema.parse(await post('refresh'));
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) return null;
          throw error;
        }
      }),
    revoke: () =>
      lock(async () => {
        await post('revoke');
      }),
    clear: async () => {},
  };
}
