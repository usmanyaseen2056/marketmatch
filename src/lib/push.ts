import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Asks for notification permission and saves this phone's Expo push token.
 * Push needs a development/production build (not Expo Go on Android) and an EAS project id.
 * Fails quietly so the rest of the app keeps working.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Requests and offers',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push disabled: run `npx eas-cli@latest init` to add an EAS project id.');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert({ token, user_id: userId, updated_at: new Date().toISOString() });
    return token;
  } catch (e) {
    console.warn('Push registration failed', e);
    return null;
  }
}

/** Opens the right screen when a notification is tapped. Payload `data.url` is an app route. */
export function listenForNotificationTaps() {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  });
  return () => sub.remove();
}
