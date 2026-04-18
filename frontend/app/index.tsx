import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import LandingScreen from '../components/LandingScreen';

export default function IndexRoute() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/home" />;
  }

  return <LandingScreen />;
}
