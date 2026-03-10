import { useEffect, useRef } from 'react';
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

async function registerForPushNotificationsAsync() {
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

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    throw new Error('Expo project ID not found for push notifications.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export function usePushNotifications(isAuthenticated: boolean, isAuthLoading: boolean) {
  const router = useRouter();
  const recordPushToken = useMutation(api.pushNotifications.recordPushToken);
  const previousIsAuthenticated = useRef<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (isAuthLoading) {
      return;
    }

    let isMounted = true;

    const syncPushToken = async () => {
      if (!isAuthenticated) {
        previousIsAuthenticated.current = false;
        return;
      }

      try {
        const token = await registerForPushNotificationsAsync();
        if (!isMounted || !token) {
          return;
        }
        await recordPushToken({ token });
        previousIsAuthenticated.current = true;
      } catch (error) {
        console.error('Failed to register push notifications', error);
      }
    };

    void syncPushToken();

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
          pathname: '/messages/[id]',
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
}
