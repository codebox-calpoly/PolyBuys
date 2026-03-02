import { useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const entranceStyle = useEntranceAnimation();

  const handleAuthAction = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    try {
      setIsSubmitting(true);
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Sign Out Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusText = isLoading
    ? 'Checking your session...'
    : isAuthenticated
      ? (user?.email ?? 'Signed in')
      : 'You are currently signed out.';

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[styles.heroCard, entranceStyle]}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Manage your PolyBuys profile</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </Animated.View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Session</Text>
        <Text style={styles.sectionBody}>
          {isAuthenticated
            ? 'You are signed in and can post or edit listings.'
            : 'Sign in with your Cal Poly email to post and manage listings.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (isSubmitting || isLoading) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleAuthAction}
          disabled={isSubmitting || isLoading}
        >
          <Text style={styles.buttonText}>
            {isAuthenticated ? (isSubmitting ? 'Signing out...' : 'Sign out') : 'Sign in'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Safety first</Text>
        <Text style={styles.infoText}>
          Never send payments outside trusted channels. Meet in campus-safe public places.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 15,
    color: '#556a60',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#163429',
  },
  sectionBody: {
    fontSize: 14,
    color: '#5e7268',
    lineHeight: 20,
  },
  button: {
    marginTop: 4,
    backgroundColor: '#154734',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e9e5',
    backgroundColor: '#f9fcfa',
    padding: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d3c31',
  },
  infoText: {
    fontSize: 14,
    color: '#62766d',
    lineHeight: 20,
  },
});
