import { Stack, usePathname } from 'expo-router';
import { useFonts, FontDisplay } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers, useSession } from '../src/lib/providers';
import { Loading } from '../src/ui/components/Loading';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export const unstable_settings = { initialRouteName: 'index' };

function Routes() {
  const { status } = useSession();
  const path = usePathname();
  if (status === 'restoring' && path !== '/privacy' && path !== '/support') return <Loading />;
  return (
    <>
      <StatusBar style="auto" />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="support" />
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
  const [fontsLoaded, fontError] = useFonts({
    CascadiaMono: {
      uri: require('../assets/fonts/CascadiaMono-Regular.ttf'),
      display: FontDisplay.SWAP,
    },
  });
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <Providers>
          <Routes />
        </Providers>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
