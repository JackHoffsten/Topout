import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers, useSession } from '../src/lib/providers';
import { Loading } from '../src/ui/components';
export const unstable_settings = { initialRouteName: 'index' };
function Routes() {
  const { status } = useSession();
  if (status === 'restoring') return <Loading />;
  return (
    <>
      <StatusBar style="auto" />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={status === 'anonymous'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <Providers>
        <Routes />
      </Providers>
    </SafeAreaProvider>
  );
}
