import * as ExpoLinking from 'expo-linking';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { getUserFlowErrorMessage } from '../lib/user-flow-errors';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

import { APP_SCHEME, APP_STORE_URL } from '../constants/app';

type OpenInAppPromptProps = {
  title: string;
  body: string;
  path: string;
  buttonLabel: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'page' | 'card';
  pageStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
};

export default function OpenInAppPrompt({
  title,
  body,
  path,
  buttonLabel,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'page',
  pageStyle,
  cardStyle,
}: OpenInAppPromptProps) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const deepLink = `${APP_SCHEME}://${normalizedPath}`;

  const handleOpenInApp = async () => {
    try {
      await ExpoLinking.openURL(deepLink);
    } catch (error) {
      Alert.alert('Open in App Failed', getUserFlowErrorMessage(error, 'open-in-app'));
    }
  };

  const card = (
    <View style={[styles.card, cardStyle]}>
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
        onPress={async () => {
          try {
            await ExpoLinking.openURL(APP_STORE_URL);
          } catch (error) {
            Alert.alert('Download Failed', getUserFlowErrorMessage(error, 'download-app'));
          }
        }}
        accessibilityRole="link"
        accessibilityLabel="Download the PolyBuys app"
      >
        <Text style={styles.downloadHint}>Don&apos;t have the app? Download it here.</Text>
      </Pressable>
    </View>
  );

  if (variant === 'card') {
    return card;
  }

  return <View style={[styles.page, pageStyle]}>{card}</View>;
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
