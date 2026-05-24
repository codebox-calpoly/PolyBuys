import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { SUPPORT_REPORT_DESCRIPTION_MAX, type SupportReportCategory } from '@polybuys/shared';
import { useAuth } from '../hooks/useAuth';
import OpenInAppPrompt from '../components/OpenInAppPrompt';
import { ScreenState } from '../components/ScreenState';
import { FilterChips, ScreenScrollView, type FilterChipOption } from '../components/ui';
import { getSignedOutFallback } from '../lib/navigation/guestAccess';
import { getUserFlowErrorMessage } from '../lib/user-flow-errors';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

const CATEGORY_OPTIONS: FilterChipOption<SupportReportCategory>[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'account_login', label: 'Account/Login' },
  { value: 'listing', label: 'Listing' },
  { value: 'messages', label: 'Messages' },
  { value: 'payments_offers', label: 'Payments/Offers' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

type ReportProblemParams = {
  source?: string | string[];
  listingId?: string | string[];
  conversationId?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReportProblemScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isLoading } = useAuth();
  const params = useLocalSearchParams<ReportProblemParams>();
  const submitSupportReport = useMutation(api.supportReports.submitSupportReport);

  const [category, setCategory] = useState<SupportReportCategory>('bug');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const sourceRoute = firstParam(params.source);
  const listingId = firstParam(params.listingId);
  const conversationId = firstParam(params.conversationId);

  const reportContext = useMemo(
    () => ({
      platform: process.env.EXPO_OS ?? Platform.OS,
      appVersion: Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      route: sourceRoute ?? '/report-problem',
      listingId,
      conversationId,
    }),
    [conversationId, listingId, sourceRoute]
  );

  useEffect(() => {
    if (!isWeb && !isLoading && !isAuthenticated) {
      router.replace((getSignedOutFallback('/report-problem') ?? '/home') as never);
    }
  }, [isAuthenticated, isLoading, isWeb, router]);

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setErrorMessage('Describe what happened before sending.');
      return;
    }

    if (trimmedDescription.length > SUPPORT_REPORT_DESCRIPTION_MAX) {
      setErrorMessage('That description is too long. Shorten it and try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitSupportReport({
        category,
        description: trimmedDescription,
        context: reportContext,
      });
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(getUserFlowErrorMessage(error, 'submit-support-report'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Open support in the mobile app"
        body="Report a Problem is available after signing in to the PolyBuys mobile app."
        path="/report-problem"
        buttonLabel="Open in app"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/home')}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.loadingState}>
        <ScreenState variant="loading" title="Redirecting to login..." />
      </View>
    );
  }

  if (isSubmitted) {
    return (
      <ScreenScrollView contentContainerStyle={styles.centeredContent}>
        <View style={styles.successCard}>
          <Text style={styles.title}>Report sent</Text>
          <Text style={styles.bodyText}>
            Thanks for letting us know. The PolyBuys team will review it with your account and app
            context.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.submitButtonText}>Done</Text>
          </Pressable>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Report a Problem</Text>
        <Text style={styles.bodyText}>
          Tell us about app bugs, broken flows, account issues, or anything that needs support.
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Category</Text>
        <FilterChips options={CATEGORY_OPTIONS} value={category} onChange={setCategory} wrap />
      </View>

      <View style={styles.formSection}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.counter}>
            {description.length}/{SUPPORT_REPORT_DESCRIPTION_MAX}
          </Text>
        </View>
        <TextInput
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            if (errorMessage) setErrorMessage(null);
          }}
          style={[styles.descriptionInput, errorMessage && styles.inputError]}
          multiline
          textAlignVertical="top"
          maxLength={SUPPORT_REPORT_DESCRIPTION_MAX}
          placeholder="What happened? Include what you expected and what you saw."
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          editable={!isSubmitting}
          accessibilityLabel="Problem description"
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>

      <View style={styles.contextBox}>
        <Text style={styles.contextText}>
          We include your signed-in user, platform, app version, and current screen so the team can
          debug faster.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          pressed && !isSubmitting && styles.buttonPressed,
          isSubmitting && styles.buttonDisabled,
        ]}
        onPress={() => void handleSubmit()}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit support report"
      >
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : null}
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Sending...' : 'Submit report'}</Text>
      </Pressable>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  centeredContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title1,
    color: colors.textDark,
  },
  bodyText: {
    ...typography.subhead,
    color: colors.text,
  },
  formSection: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '700',
  },
  counter: {
    ...typography.footnote,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  descriptionInput: {
    ...typography.body,
    color: colors.textDark,
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  errorText: {
    ...typography.footnote,
    color: colors.destructive,
  },
  contextBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
  },
  contextText: {
    ...typography.footnote,
    color: colors.text,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    boxShadow: '0 12px 24px rgba(21, 71, 52, 0.20)',
  },
  submitButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  successCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
});
