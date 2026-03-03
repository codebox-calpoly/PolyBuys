import { useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { getEmailValidationError } from '@polybuys/shared';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

type Step = 'email' | { email: string };

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { signIn } = useAuthActions();
  const panelEntrance = useEntranceAnimation();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const postAuthRedirect =
    typeof normalizedReturnTo === 'string' &&
    normalizedReturnTo.startsWith('/') &&
    !normalizedReturnTo.startsWith('//')
      ? normalizedReturnTo
      : '/';

  const handleSendCode = async () => {
    // Validate email
    const emailError = getEmailValidationError(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn('resend-otp', { email: email.toLowerCase().trim() });
      setStep({ email: email.toLowerCase().trim() });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send code';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.trim().length !== 8) {
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
      await signIn('resend-otp', { email: step.email, code: code.trim() });
      router.replace(postAuthRedirect);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setError(errorMessage);
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
      await signIn('resend-otp', { email: step.email });
      setCode('');
      setSuccessMessage('A new code has been sent to your email');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend code';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  const isEmailStep = step === 'email';
  const isVerificationStep = !isEmailStep;
  const verificationEmail = typeof step === 'string' ? '' : step.email;

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
            <Text style={styles.eyebrow}>PolyBuys Access</Text>
            <Text style={styles.title}>{isEmailStep ? 'Welcome back' : 'Check your inbox'}</Text>
            <Text style={styles.subtitle}>
              {isEmailStep
                ? 'Sign in with your Cal Poly email to continue.'
                : 'Enter the 8-digit code we sent to your email.'}
            </Text>

            {!isEmailStep && (
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
                  placeholderTextColor="#8a8a8a"
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
                  placeholderTextColor="#999"
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isEmailStep ? 'Send code' : 'Verify code'}</Text>
              )}
            </Pressable>

            {isEmailStep ? (
              <Text style={styles.footerText}>Only @calpoly.edu emails are allowed.</Text>
            ) : (
              <View style={styles.secondaryActions}>
                <Pressable onPress={handleResendCode} disabled={isLoading}>
                  <Text style={styles.linkText}>Resend code</Text>
                </Pressable>

                <Pressable onPress={handleBack} disabled={isLoading}>
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
    backgroundColor: '#eef5f1',
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
    backgroundColor: '#d8ece2',
    top: -80,
    right: -80,
  },
  orbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#d2e9dd',
    bottom: -90,
    left: -80,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8e6df',
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f2b21',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#5e7268',
    marginBottom: 18,
    lineHeight: 22,
  },
  emailChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#edf6f1',
    borderWidth: 1,
    borderColor: '#d4e4dc',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  emailHighlight: {
    color: '#154734',
    fontWeight: '600',
    fontSize: 13,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#244539',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dfd9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#f9fbfa',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 5,
  },
  errorContainer: {
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f6cdcd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#ad2020',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#eef8f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cce8d4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#1e6b37',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#154734',
    borderRadius: 12,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 13,
    color: '#677a71',
    textAlign: 'center',
    marginTop: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  linkText: {
    color: '#154734',
    fontSize: 14,
    fontWeight: '600',
  },
});
