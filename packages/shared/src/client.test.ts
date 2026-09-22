import { describe, it, expect, vi } from 'vitest';
import { ApiClient, ApiError, type SessionTransport } from './client';
import { nativeTransport, webTransport } from './transports';
import { loginSchema, registerSchema } from './contracts';
const session = { accessToken: 'old', accessTokenExpiresAt: '2026-09-21T18:00:00Z' };
const nativeSession = {
  ...session,
  refreshToken: 'secret',
  refreshTokenExpiresAt: '2026-10-21T18:00:00Z',
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function transport(): SessionTransport {
  return {
    login: vi.fn().mockResolvedValue(session),
    register: vi.fn().mockResolvedValue(session),
    refresh: vi.fn().mockResolvedValue(session),
    revoke: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}
describe('sessions', () => {
  it('calls browser fetch without an incompatible receiver', async () => {
    const fetcher: typeof fetch = async function (this: unknown) {
      expect(this).toBeUndefined();
      return response([]);
    };
    const api = new ApiClient('', transport(), fetcher);
    await api.initialize();
    expect(await api.listExercises()).toEqual([]);
  });
  it('restores once and shares one renewal between concurrent unauthorized requests', async () => {
    const auth = transport();
    let renew!: (value: typeof session) => void;
    vi.mocked(auth.refresh)
      .mockResolvedValueOnce(session)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            renew = resolve;
          }),
      );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_, options) =>
        (options?.headers as Record<string, string>).Authorization === 'Bearer old'
          ? response({}, 401)
          : response([]),
      );
    const api = new ApiClient('', auth, fetcher);
    await Promise.all([api.initialize(), api.initialize()]);
    const first = api.listExercises();
    const second = api.listExercises();
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledTimes(2));
    renew({ ...session, accessToken: 'new' });
    await Promise.all([first, second]);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(api.getStatus()).toBe('authenticated');
  });
  it('replays once then clears a session if the retry is unauthorized', async () => {
    const auth = transport();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    const api = new ApiClient('', auth, fetcher);
    await api.initialize();
    await expect(api.listExercises()).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(api.getStatus()).toBe('anonymous');
    expect(auth.clear).toHaveBeenCalled();
  });
  it('clears failed renewal and revokes on logout', async () => {
    const auth = transport();
    const api = new ApiClient('', auth);
    vi.mocked(auth.refresh).mockRejectedValueOnce(new Error('offline'));
    await api.initialize();
    expect(api.getStatus()).toBe('anonymous');
    expect(auth.clear).toHaveBeenCalled();
    await api.login({ email: 'a@example.com', password: 'Password1' });
    await api.logout();
    expect(auth.revoke).toHaveBeenCalledOnce();
    expect(api.getStatus()).toBe('anonymous');
  });
  it('native transport restores and rotates SecureStore data without exposing the refresh token', async () => {
    const store = { get: vi.fn().mockResolvedValue('previous'), set: vi.fn(), clear: vi.fn() };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(nativeSession));
    const auth = nativeTransport('https://api', store, fetcher);
    expect(await auth.refresh()).toEqual(session);
    expect(store.set).toHaveBeenCalledWith('secret');
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      refreshToken: 'previous',
    });
  });
  it('web transport uses cookies and a CSRF header, without storing a refresh token', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ csrfToken: 'csrf' }))
      .mockResolvedValueOnce(response(session));
    const auth = webTransport('', (action) => action(), fetcher);
    expect(await auth.refresh()).toEqual(session);
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'csrf' },
    });
    expect(fetcher.mock.calls[1][1]?.body).toBeUndefined();
  });
  it('forms enforce registration rules without applying them to existing login passwords', () => {
    expect(
      registerSchema.safeParse({ email: 'bad', password: 'short', displayName: ' ' }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: 'a@example.com', password: 'Password1', displayName: 'A' })
        .success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'existing' }).success).toBe(
      true,
    );
  });
  it('failed native restoration removes the rejected persisted refresh token', async () => {
    const store = { get: vi.fn().mockResolvedValue('expired'), set: vi.fn(), clear: vi.fn() };
    const api = new ApiClient(
      '',
      nativeTransport('', store, vi.fn<typeof fetch>().mockResolvedValue(response({}, 401))),
    );
    await api.initialize();
    expect(store.clear).toHaveBeenCalledOnce();
    expect(api.getStatus()).toBe('anonymous');
  });
  it('web restoration without a cookie ends anonymously', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ csrfToken: 'csrf' }))
      .mockResolvedValueOnce(response({}, 401));
    const api = new ApiClient(
      '',
      webTransport('', (action) => action(), fetcher),
    );
    await api.initialize();
    expect(api.getStatus()).toBe('anonymous');
  });
  it('logout waits for renewal before revoking and does not resurrect a session', async () => {
    const auth = transport();
    let complete!: (value: typeof session) => void;
    vi.mocked(auth.refresh).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const api = new ApiClient('', auth);
    const restoration = api.initialize();
    const logout = api.logout();
    expect(auth.revoke).not.toHaveBeenCalled();
    complete(session);
    await Promise.all([restoration, logout]);
    expect(auth.revoke).toHaveBeenCalledOnce();
    expect(api.getStatus()).toBe('anonymous');
  });
  it('clears in-memory state even when secure storage cleanup fails', async () => {
    const auth = transport();
    vi.mocked(auth.refresh).mockRejectedValue(new Error('expired'));
    vi.mocked(auth.clear).mockRejectedValue(new Error('storage unavailable'));
    const api = new ApiClient('', auth);
    await api.initialize();
    expect(api.getStatus()).toBe('anonymous');
  });
});
