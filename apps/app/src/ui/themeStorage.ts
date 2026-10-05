import * as SecureStore from 'expo-secure-store';
export const readTheme = () => SecureStore.getItemAsync('topout.theme');
export const writeTheme = (value: string) => SecureStore.setItemAsync('topout.theme', value);
