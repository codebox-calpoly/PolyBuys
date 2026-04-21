import { useCallback, useEffect, useRef, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  ActivityIndicator,
  Animated,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { getEmailValidationError, PROFILE_BOUNDS } from '@polybuys/shared';
import { MajorPicker } from '../../components/MajorPicker';
import { formatMajorLabel, isCalPolyMajor } from '../../constants/calPolyMajors';
import {
  GRADUATION_YEAR_DEFAULT,
  GRADUATION_YEAR_MAX,
  GRADUATION_YEAR_MIN,
  GRADUATION_YEAR_OPTIONS,
} from '../../constants/graduationYears';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuth } from '../../hooks/useAuth';
import { requestPermissionAndSyncToken } from '../../hooks/usePushNotifications';
import { getLoginEntryAction, type LoginStep } from './loginRedirect';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const APP_REVIEW_EMAIL = (process.env.EXPO_PUBLIC_APP_REVIEW_EMAIL ?? '').toLowerCase().trim();

type LoginErrorContext = 'send-code' | 'verify-code' | 'resend-code' | 'create-profile';

function providerForEmail(emailAddress: string): 'resend-otp' | 'ios-review-otp' {
  const normalized = emailAddress.toLowerCase().trim();
  return APP_REVIEW_EMAIL.length > 0 && normalized === APP_REVIEW_EMAIL
    ? 'ios-review-otp'
    : 'resend-otp';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.trim() : '';
}

function isExistingProfileError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes('profile already exists');
}

function getLoginErrorMessage(error: unknown, context: LoginErrorContext): string {
  const rawMessage = getErrorMessage(error);
  const normalizedMessage = rawMessage.toLowerCase();

  if (context === 'send-code' || context === 'resend-code') {
    if (
      normalizedMessage.includes('too many') ||
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('rate-limit')
    ) {
      return 'Too many attempts. Wait a minute, then request a new code.';
    }

    return context === 'resend-code'
      ? 'We could not resend your code right now. Please try again in a minute.'
      : 'We could not send your code right now. Please try again in a minute.';
  }

  if (context === 'verify-code') {
    if (
      normalizedMessage.includes('could not verify code') ||
      normalizedMessage.includes('invalid code') ||
      normalizedMessage.includes('expired')
    ) {
      return 'That code is invalid or expired. Request a new one and try again.';
    }

    if (
      normalizedMessage.includes('matching `email`') ||
      normalizedMessage.includes('requires an `email`')
    ) {
      return 'That code no longer matches this email. Request a new one and try again.';
    }

    return 'We could not verify that code. Request a new one and try again.';
  }

  if (normalizedMessage.includes('email is required')) {
    return 'We could not finish setting up your profile. Please sign in again.';
  }

  if (normalizedMessage.includes('name must be')) {
    return `Display name must be ${PROFILE_BOUNDS.NAME_MIN}-${PROFILE_BOUNDS.NAME_MAX} characters.`;
  }

  if (normalizedMessage.includes('major must be')) {
    return 'Choose your major from the official Cal Poly majors list.';
  }

  if (normalizedMessage.includes('bio must be')) {
    return 'Your bio is too long. Shorten it and try again.';
  }

  return 'We could not complete your profile right now. Please try again.';
}

export default function LoginScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { signIn } = useAuthActions();
  const { isAuthenticated, isSessionLoading } = useAuth();
  const panelEntrance = useEntranceAnimation();
  const createProfile = useMutation(api.profiles.createProfile);
  const recordPushToken = useMutation(api.pushNotifications.recordPushToken);
  const updateMessageNotificationsEnabled = useMutation(
    api.users.updateMessageNotificationsEnabled
  );

  const currentProfile = useQuery(
    api.profiles.getCurrentProfile,
    isAuthenticated && !isWeb ? {} : 'skip'
  );

  const [step, setStep] = useState<LoginStep>('welcome');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState<string>(GRADUATION_YEAR_DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isMajorPickerVisible, setIsMajorPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checkingTimedOut, setCheckingTimedOut] = useState(false);
  const verifiedEmailRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const postAuthRedirect: Href =
    typeof normalizedReturnTo === 'string' &&
    normalizedReturnTo.startsWith('/') &&
    !normalizedReturnTo.startsWith('//')
      ? (normalizedReturnTo as Href)
      : '/home';
  const [successRedirect, setSuccessRedirect] = useState<Href>(postAuthRedirect);

  useEffect(() => {
    setSuccessRedirect(postAuthRedirect);
  }, [postAuthRedirect]);

  useEffect(() => {
    if (isWeb) {
      router.replace(postAuthRedirect);
    }
  }, [isWeb, postAuthRedirect, router]);

  useEffect(() => {
    const entryAction = getLoginEntryAction({
      isSessionLoading,
      isAuthenticated,
      currentProfile,
      step,
    });

    if (entryAction === 'post-auth-redirect') {
      router.replace(postAuthRedirect);
      return;
    }

    if (entryAction === 'profile') {
      setStep('profile');
    }
  }, [isSessionLoading, isAuthenticated, currentProfile, step, postAuthRedirect, router]);

  useEffect(() => {
    if (step !== 'checking') {
      setCheckingTimedOut(false);
      return;
    }
    if (currentProfile !== undefined) {
      setCheckingTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setCheckingTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, [step, currentProfile]);

  useEffect(() => {
    if (step !== 'checking' || currentProfile === undefined) {
      return;
    }

    if (currentProfile) {
      setSuccessRedirect(postAuthRedirect);
      setStep('success');
      return;
    }

    if (isSessionLoading || !isAuthenticated) {
      return;
    }

    setStep('profile');
  }, [step, currentProfile, isSessionLoading, isAuthenticated, postAuthRedirect]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }
    const t = setTimeout(() => {
      router.replace(successRedirect);
    }, 1500);
    return () => clearTimeout(t);
  }, [step, successRedirect, router]);

  const handleCheckingRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
    }
    setCheckingTimedOut(false);
    setStep('email');
    retryTimerRef.current = setTimeout(() => setStep('checking'), 100);
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const handleGetStarted = () => {
    setStep('email');
    setError(null);
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.toLowerCase().trim();
    const emailError = getEmailValidationError(normalizedEmail, {
      allowedEmails: APP_REVIEW_EMAIL.length > 0 ? [APP_REVIEW_EMAIL] : undefined,
    });
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn(providerForEmail(normalizedEmail), { email: normalizedEmail });
      setStep({ email: normalizedEmail });
    } catch (err) {
      setError(getLoginErrorMessage(err, 'send-code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (!/^\d{8}$/.test(trimmedCode)) {
      setError('Please enter the 8-digit code');
      return;
    }

    if (typeof step === 'string') {
      setError('Please enter your email first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn(providerForEmail(step.email), { email: step.email, code: trimmedCode });
      verifiedEmailRef.current = step.email;
      setStep('checking');
    } catch (err) {
      setError(getLoginErrorMessage(err, 'verify-code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (typeof step === 'string') return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await signIn(providerForEmail(step.email), { email: step.email });
      setCode('');
      setSuccessMessage('A new code has been sent to your email');
    } catch (err) {
      setError(getLoginErrorMessage(err, 'resend-code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleCompleteProfile = async () => {
    const trimmedName = name.trim();
    const trimmedMajor = major.trim();

    if (
      trimmedName.length < PROFILE_BOUNDS.NAME_MIN ||
      trimmedName.length > PROFILE_BOUNDS.NAME_MAX
    ) {
      Alert.alert(
        'Invalid name',
        `Name must be ${PROFILE_BOUNDS.NAME_MIN}-${PROFILE_BOUNDS.NAME_MAX} characters.`
      );
      return;
    }
    if (!trimmedMajor) {
      Alert.alert('Select major', 'Choose your Cal Poly major from the official majors list.');
      return;
    }
    if (!isCalPolyMajor(trimmedMajor)) {
      Alert.alert('Invalid major', 'Choose a major from the official Cal Poly majors list.');
      return;
    }
    if (
      trimmedMajor.length < PROFILE_BOUNDS.MAJOR_MIN ||
      trimmedMajor.length > PROFILE_BOUNDS.MAJOR_MAX
    ) {
      Alert.alert(
        'Invalid major',
        `Major must be ${PROFILE_BOUNDS.MAJOR_MIN}-${PROFILE_BOUNDS.MAJOR_MAX} characters.`
      );
      return;
    }

    const parsedYear = Number(year);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < GRADUATION_YEAR_MIN ||
      parsedYear > GRADUATION_YEAR_MAX
    ) {
      Alert.alert(
        'Invalid year',
        `Graduation year must be between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createProfile({
        name: trimmedName,
        email: verifiedEmailRef.current ?? undefined,
        major: trimmedMajor,
        year: parsedYear,
      });
      setStep('push');
    } catch (err) {
      if (isExistingProfileError(err)) {
        setStep('checking');
        return;
      }

      setError(getLoginErrorMessage(err, 'create-profile'));
    } finally {
      setIsLoading(false);
    }
  };

  const isWelcomeStep = step === 'welcome';
  const isEmailStep = step === 'email';
  const isVerificationStep = typeof step === 'object' && 'email' in step;
  const isCheckingStep = step === 'checking';
  const isProfileStep = step === 'profile';
  const isPushStep = step === 'push';
  const isSuccessStep = step === 'success';
  const verificationEmail = typeof step === 'object' && 'email' in step ? step.email : '';

  if (isWeb) {
    return null;
  }

  const selectedMajorLabel = major ? formatMajorLabel(major) : '';

  if (isWelcomeStep) {
    return (
      <View style={styles.container}>
        <View style={styles.background}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
          <View style={styles.scrollContent}>
            <Animated.View style={[styles.content, panelEntrance]}>
              <Text style={styles.eyebrow}>PolyBuys</Text>
              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>
                Buy and sell with fellow Cal Poly students. Sign in with your @calpoly.edu email to
                get started.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleGetStarted}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    );
  }

  if (isCheckingStep) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, styles.centeredContent]}>
          {checkingTimedOut ? (
            <>
              <Text style={styles.stateText}>Taking longer than expected…</Text>
              <Text style={styles.checkingHelpText}>
                We couldn&apos;t load your profile. Please try again.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.checkingRetryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCheckingRetry}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>Signing you in...</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  const finishAndRedirect = () => {
    setSuccessRedirect(postAuthRedirect);
    setStep('success');
  };

  const persistMessageNotificationsPreference = async (enabled: boolean) => {
    await updateMessageNotificationsEnabled({ enabled });
  };

  const handlePushEnable = async () => {
    try {
      await requestPermissionAndSyncToken(recordPushToken);
    } catch {
      void 0;
    }

    const messageNotificationsEnabled = true;
    try {
      await persistMessageNotificationsPreference(messageNotificationsEnabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save notification preference.';
      Alert.alert('Notification preference not saved', message);
      return;
    }

    finishAndRedirect();
  };

  const handlePushSkip = async () => {
    const messageNotificationsEnabled = false;
    try {
      await persistMessageNotificationsPreference(messageNotificationsEnabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save notification preference.';
      Alert.alert('Notification preference not saved', message);
      return;
    }

    finishAndRedirect();
  };

  if (isPushStep) {
    return (
      <View style={styles.container}>
        <View style={styles.background}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
          <View style={styles.scrollContent}>
            <Animated.View style={[styles.content, panelEntrance]}>
              <Text style={styles.eyebrow}>Stay in the loop</Text>
              <Text style={styles.title}>Enable notifications</Text>
              <Text style={styles.subtitle}>
                Get notified when someone messages you about a listing.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={() => void handlePushEnable()}
              >
                <Text style={styles.buttonText}>Enable notifications</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.skipButton, pressed && styles.buttonPressed]}
                onPress={() => void handlePushSkip()}
              >
                <Text style={styles.skipButtonText}>Not now</Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    );
  }

  if (isSuccessStep) {
    return (
      <View style={styles.container}>
        <View style={styles.background}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
          <View style={styles.scrollContent}>
            <Animated.View style={[styles.content, panelEntrance]}>
              <Text style={styles.eyebrow}>PolyBuys</Text>
              <Text style={styles.title}>You&apos;re all set!</Text>
              <Text style={styles.subtitle}>Your account is ready. Taking you to the app...</Text>
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.successSpinner}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    );
  }

  if (isProfileStep) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.background}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.content, panelEntrance]}>
              <Text style={styles.eyebrow}>Complete your profile</Text>
              <Text style={styles.title}>Almost there</Text>
              <Text style={styles.subtitle}>
                Add a few details so other students can find you on the marketplace.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Major</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.input,
                    styles.selectionInput,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={() => setIsMajorPickerVisible(true)}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedMajorLabel ? `Selected major ${selectedMajorLabel}` : 'Select major'
                  }
                >
                  <Text
                    style={[styles.selectionInputText, !major && styles.selectionInputPlaceholder]}
                    numberOfLines={1}
                  >
                    {selectedMajorLabel || 'Search and select your major'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Graduation year</Text>
                <View style={[styles.yearPickerFrame, isLoading && styles.yearPickerDisabled]}>
                  <Picker
                    selectedValue={year}
                    onValueChange={(nextValue) => setYear(String(nextValue))}
                    enabled={!isLoading}
                    itemStyle={styles.yearPickerItem}
                    style={styles.yearPicker}
                  >
                    {GRADUATION_YEAR_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option}
                        label={option}
                        value={option}
                        color={colors.textDark}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={() => void handleCompleteProfile()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
        <MajorPicker
          visible={isMajorPickerVisible}
          selectedMajor={major || undefined}
          onSelect={setMajor}
          onClose={() => setIsMajorPickerVisible(false)}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.background}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, panelEntrance]}>
            <Text style={styles.eyebrow}>PolyBuys</Text>
            <Text style={styles.title}>{isEmailStep ? 'Sign in' : 'Check your inbox'}</Text>
            <Text style={styles.subtitle}>
              {isEmailStep
                ? 'Enter your Cal Poly email to continue.'
                : 'Enter the 8-digit code we sent to your email.'}
            </Text>

            {isVerificationStep && (
              <View style={styles.emailChip}>
                <Text style={styles.emailHighlight}>{verificationEmail}</Text>
              </View>
            )}

            {isEmailStep ? (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Cal Poly email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@calpoly.edu"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="12345678"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoComplete="one-time-code"
                  editable={!isLoading}
                />
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isVerificationStep && successMessage && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={isEmailStep ? handleSendCode : handleVerifyCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>{isEmailStep ? 'Send code' : 'Verify code'}</Text>
              )}
            </Pressable>

            {isEmailStep ? (
              <Text style={styles.footerText}>Only @calpoly.edu emails are allowed.</Text>
            ) : (
              <View style={styles.secondaryActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleResendCode}
                  disabled={isLoading}
                >
                  <Text style={styles.linkText}>Resend code</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleBack}
                  disabled={isLoading}
                >
                  <Text style={styles.linkText}>Use different email</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    flex: 1,
    position: 'relative',
  },
  orbTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.border,
    top: -80,
    right: -80,
  },
  orbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.location,
    bottom: -90,
    left: -80,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    boxShadow: '0 24px 48px rgba(21, 71, 52, 0.10)',
  },
  centeredContent: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  stateText: {
    ...typography.subhead,
    color: colors.text,
  },
  checkingHelpText: {
    ...typography.subhead,
    color: colors.text,
    marginTop: 4,
  },
  checkingRetryButton: {
    marginTop: spacing.md,
  },
  eyebrow: {
    ...typography.footnote,
    color: colors.primary,
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    color: colors.textDark,
    marginBottom: 6,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.text,
    marginBottom: 18,
    lineHeight: 22,
  },
  emailChip: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    backgroundColor: colors.location,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginBottom: 14,
  },
  emailHighlight: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...typography.body,
    backgroundColor: colors.background,
  },
  selectionInput: {
    minHeight: 52,
    justifyContent: 'center',
  },
  selectionInputText: {
    ...typography.body,
    color: colors.textDark,
  },
  selectionInputPlaceholder: {
    color: colors.muted,
  },
  yearPickerFrame: {
    height: Platform.OS === 'ios' ? 168 : 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  yearPickerDisabled: {
    opacity: 0.75,
  },
  yearPicker: {
    flex: 1,
    color: colors.textDark,
  },
  yearPickerItem: {
    color: colors.textDark,
    fontSize: 20,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 5,
    lineHeight: 32,
    paddingVertical: 14,
  },
  errorContainer: {
    backgroundColor: colors.errorBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.errorText,
    ...typography.footnote,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: colors.location,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.primary,
    ...typography.footnote,
    textAlign: 'center',
  },
  successSpinner: {
    marginTop: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    ...typography.body,
    fontWeight: '600',
  },
  footerText: {
    ...typography.footnote,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: spacing.md,
  },
  linkText: {
    color: colors.primary,
    ...typography.footnote,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.18)',
    backgroundColor: 'rgba(21, 71, 52, 0.06)',
  },
  skipButtonText: {
    color: colors.primary,
    ...typography.subhead,
    fontWeight: '600',
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.16)',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    boxShadow: '0 6px 16px rgba(21, 71, 52, 0.06)',
  },
});
