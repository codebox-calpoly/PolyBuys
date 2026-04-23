import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { showAlert } from './showAlert';

/**
 * Opens a URL in an in-app browser (SFSafariViewController on iOS, Custom Tabs on Android).
 * We avoid `Linking.openURL` for URLs on our own associated domains — iOS treats them as
 * this app's Universal Links and rejects the call with "Unable to open URL".
 * Falls back to `Linking.openURL` on web and shows an alert on any failure.
 */
export async function openExternalUrl(url: string, errorTitle = 'Unable to open link') {
  try {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    showAlert(errorTitle, 'Please try again later.');
  }
}
