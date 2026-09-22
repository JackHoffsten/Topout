import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiClient, nativeTransport } from '@topout/shared';
const baseUrl =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:5080' : 'http://localhost:5080');
export const api = new ApiClient(
  baseUrl,
  nativeTransport(baseUrl, {
    get: () => SecureStore.getItemAsync('topout.refresh'),
    set: (token) => SecureStore.setItemAsync('topout.refresh', token),
    clear: () => SecureStore.deleteItemAsync('topout.refresh'),
  }),
);
export const listenForLogout = (_listener: () => void) => () => {};
export const broadcastLogout = () => {};
