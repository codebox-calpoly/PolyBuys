import { Redirect } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import LandingScreen from '../components/LandingScreen';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/tokens';

export default function IndexRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <LandingScreen />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
