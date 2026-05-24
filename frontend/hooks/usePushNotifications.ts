import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from 'convex/_generated/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getExpoProjectId() {
  const easProjectIdFromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const easProjectIdFromConfig = Constants.easConfig?.projectId;
  const easProjectIdFromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return easProjectIdFromExtra ?? easProjectIdFromConfig ?? easProjectIdFromEnv ?? null;
}

async function getTokenIfPermissionGranted(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#154734',
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    throw new Error('Expo project ID not found for push notifications.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function requestPermissionAndSyncToken(
  recordPushToken: (args: { token: string }) => Promise<unknown>
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#154734',
    });
  }

  if (!Device.isDevice) {
    return false;
  }

  const { granted: existingGranted } = await Notifications.getPermissionsAsync();
  let finalGranted = existingGranted;

  if (!existingGranted) {
    const { granted } = await Notifications.requestPermissionsAsync();
    finalGranted = granted;
  }

  if (!finalGranted) {
    return false;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    throw new Error('Expo project ID not found for push notifications.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await recordPushToken({ token: token.data });
  return true;
}

export function usePushNotifications(isAuthenticated: boolean, isAuthLoading: boolean) {
  const router = useRouter();
  const recordPushToken = useMutation(api.pushNotifications.recordPushToken);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (isAuthLoading || !isAuthenticated) {
      return;
    }

    let isMounted = true;

    const syncExistingToken = async () => {
      try {
        const token = await getTokenIfPermissionGranted();
        if (!isMounted || !token) {
          return;
        }
        await recordPushToken({ token });
      } catch (error) {
        console.error('Failed to sync push token', error);
      }
    };

    void syncExistingToken();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthLoading, recordPushToken]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { conversationId?: string; type?: string }
        | undefined;
      const conversationId = data?.conversationId;
      if (!conversationId) {
        return;
      }

      try {
        router.push({
          pathname: '/conversations/[id]',
          params: { id: conversationId },
        });
      } catch (error) {
        console.error('Failed to navigate from push notification', error);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, [router]);

  return { recordPushToken };
}
