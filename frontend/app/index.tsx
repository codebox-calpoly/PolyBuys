import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import LandingScreen from '../components/LandingScreen';
import { ScreenState } from '../components/ScreenState';
import { useAuth } from '../hooks/useAuth';

export default function IndexRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (Platform.OS !== 'web') {
    return <Redirect href="/home" />;
  }

  if (isLoading) {
    return (
      <ScreenState variant="loading" title="Opening PolyBuys" message="Checking your session." />
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return <LandingScreen />;
}
