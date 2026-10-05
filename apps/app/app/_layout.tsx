import { Stack, usePathname } from 'expo-router';
import { useFonts, FontDisplay } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers, useSession } from '../src/lib/providers';
import { Loading } from '../src/ui/components/Loading';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, useAppColorScheme } from '../src/ui/ThemeProvider';

export const unstable_settings = { initialRouteName: 'index' };

function Routes() {
  const scheme = useAppColorScheme();
  const { status } = useSession();
  const path = usePathname();
  if (status === 'restoring' && path !== '/privacy' && path !== '/support') return <Loading />;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === 'dark' ? '#121314' : '#FFFFFF' } }}>
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
        <ThemeProvider><Providers>
          <Routes />
        </Providers></ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
