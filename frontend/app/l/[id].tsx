import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Redirect, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { colors, typography } from '../../theme/tokens';

const DEFAULT_APP_ORIGIN = 'https://www.polybuys.com';

function getAppOrigin(): string {
  const value = Constants.expoConfig?.extra?.appOrigin;
  if (typeof value !== 'string') return DEFAULT_APP_ORIGIN;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_APP_ORIGIN;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export default function ShortListingRedirect() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const cleanId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return typeof raw === 'string' ? raw.trim() : '';
  }, [id]);

  const target = cleanId.length > 0 ? `/listings/${encodeURIComponent(cleanId)}` : '/home';

  // Web: hard-redirect via window.location.replace. Using <Redirect> alone has
  // been unreliable on cold SPA loads (the route mounts but navigation never
  // fires). location.replace is unambiguous and preserves history correctly.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.location.replace(target);
  }, [target]);

  // Native: keep router-based redirect so deep-linking handlers and in-app
  // navigation behave normally.
  if (Platform.OS !== 'web') {
    return <Redirect href={target} />;
  }

  const appOrigin = getAppOrigin();

  return (
    <>
      <Head>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <title>PolyBuys</title>
        {/* Meta-refresh as a no-JS fallback so the link still works in
            preview crawlers and disabled-JS environments. */}
        <meta httpEquiv="refresh" content={`0;url=${target}`} />
        <link rel="canonical" href={`${appOrigin}${target}`} />
        <meta name="robots" content="noindex,follow" />
      </Head>
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.text}>Opening listing…</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.body,
    color: colors.textDark,
  },
});
