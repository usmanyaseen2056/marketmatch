import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { listenForNotificationTaps, registerForPush } from '@/lib/push';
import { Loading } from '@/components/ui';
import { colors } from '@/lib/theme';

function PushSetup() {
  const { session } = useAuth();
  useEffect(() => {
    if (session?.user.id) registerForPush(session.user.id);
  }, [session?.user.id]);
  useEffect(() => listenForNotificationTaps(), []);
  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  if (!loaded) return <Loading />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushSetup />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
