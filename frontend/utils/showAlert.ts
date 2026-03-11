import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert helper.
 * Uses `window.alert()` on web (since RN `Alert.alert` is invisible in Expo web)
 * and native `Alert.alert` on iOS/Android.
 */
export function showAlert(title: string, message: string, onAck?: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    onAck?.();
  } else {
    Alert.alert(title, message, onAck ? [{ text: 'OK', onPress: onAck }] : undefined);
  }
}
