import * as ExpoLinking from 'expo-linking';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

const APP_SCHEME = 'polybuys';

// TODO: Replace with actual App Store / Play Store URLs once published
const APP_STORE_URL = 'https://polybuys.com/download';

type OpenInAppPromptProps = {
  title: string;
  body: string;
  path: string;
  buttonLabel: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export default function OpenInAppPrompt({
  title,
  body,
  path,
  buttonLabel,
  secondaryActionLabel,
  onSecondaryAction,
}: OpenInAppPromptProps) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const deepLink = `${APP_SCHEME}://${normalizedPath}`;

  const handleOpenInApp = async () => {
    try {
      await ExpoLinking.openURL(deepLink);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open the PolyBuys app link.';
      Alert.alert('Open in app failed', message);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Mobile app</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={() => void handleOpenInApp()}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
        </Pressable>
        <Text selectable style={styles.deepLinkText}>
          {deepLink}
        </Text>
        {secondaryActionLabel && onSecondaryAction ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={onSecondaryAction}
            accessibilityRole="button"
            accessibilityLabel={secondaryActionLabel}
          >
            <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void ExpoLinking.openURL(APP_STORE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Download from App Store"
        >
          <Text style={styles.downloadHint}>Don&apos;t have the app? Download it here.</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
    boxShadow: '0 24px 48px rgba(21, 71, 52, 0.10)',
  },
  eyebrow: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    ...typography.title1,
    color: colors.textDark,
    textAlign: 'center',
  },
  body: {
    ...typography.subhead,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 420,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: 48,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '600',
  },
  deepLinkText: {
    ...typography.footnote,
    color: colors.muted,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  downloadHint: {
    ...typography.footnote,
    color: colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
