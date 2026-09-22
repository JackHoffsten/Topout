import { ApiClient, webTransport, type SessionLock } from '@topout/shared';
const baseUrl =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5080' : '');
const lock: SessionLock = (action) => {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('topout.session', action);
  // A persistent web session requires Web Locks to coordinate rotating cookies across tabs.
  return Promise.reject(
    new Error(
      'This browser does not support secure session coordination. Please update your browser.',
    ),
  );
};
export const api = new ApiClient(baseUrl, webTransport(baseUrl, lock));
const tabId = Math.random().toString(36).slice(2);
export function listenForLogout(listener: () => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel('topout.session');
  channel.onmessage = (event) => {
    if (event.data?.type === 'logout' && event.data?.source !== tabId) listener();
  };
  return () => channel.close();
}
export function broadcastLogout() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('topout.session');
  channel.postMessage({ type: 'logout', source: tabId });
  channel.close();
}
