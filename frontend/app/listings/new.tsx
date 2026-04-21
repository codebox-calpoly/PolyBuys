import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import ImageUploader from '@/components/ImageUploader';
import { useFlash } from '../../contexts/FlashContext';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { KeyboardAwareScreen, ScreenHeader } from '../../components/ui';
import { colors, typography, borderRadius, spacing } from '../../theme/tokens';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;
const MODERATION_ERROR_FRAGMENT = 'violates our community guidelines';
const PROFILE_SETUP_ERROR_FRAGMENT = 'complete your profile setup';

type FieldErrors = {
  title?: string;
  description?: string;
  price?: string;
  images?: string;
};

function showAlert(title: string, message: string, onAck?: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    onAck?.();
  } else {
    Alert.alert(title, message, onAck ? [{ text: 'OK', onPress: onAck }] : undefined);
  }
}

function getListingActionError(error: unknown, fallbackTitle: string) {
  const rawMessage = error instanceof Error ? error.message : 'Unknown error';
  if (rawMessage.includes(MODERATION_ERROR_FRAGMENT)) {
    return {
      title: 'Listing needs edits',
      message:
        'Some listing text was flagged by our safety checks. Try rewording the title or description and submit again.',
    };
  }

  if (rawMessage.toLowerCase().includes(PROFILE_SETUP_ERROR_FRAGMENT)) {
    return {
      title: 'Profile setup required',
      message:
        'Please complete your profile setup before creating a listing. Go to your Profile tab to fill in your details.',
    };
  }

  return {
    title: fallbackTitle,
    message: rawMessage,
  };
}
function RequiredLabel({ text }: { text: string }) {
  return (
    <Text style={styles.label}>
      {text}
      <Text style={styles.requiredAsterisk}> *</Text>
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

export default function NewListingScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { setFlash } = useFlash();
  const createListing = useAction(api.listings.createListing);
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated && !isWeb ? {} : 'skip');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('other');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('used');
  const [images, setImages] = useState<string[]>([]);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isWeb && !isSessionLoading && !isAuthenticated) {
      showAlert('Sign In Required', 'Please sign in to create a listing');
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isSessionLoading, isWeb, router]);

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Create listings in the mobile app"
        body="Posting items is available in the PolyBuys mobile app."
        path="/listings/new"
        buttonLabel="Open Create Listing in App"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/')}
      />
    );
  }

  // Clear field errors as user types
  const handleTitleChange = (text: string) => {
    setTitle(text);
    if (fieldErrors.title) {
      setFieldErrors((prev) => ({ ...prev, title: undefined }));
    }
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (fieldErrors.description) {
      setFieldErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const handlePriceChange = (text: string) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setPrice(filtered);
    if (fieldErrors.price) {
      setFieldErrors((prev) => ({ ...prev, price: undefined }));
    }
  };

  const handleImagesChange = (newImages: string[] | ((prev: string[]) => string[])) => {
    setImages(newImages);
    if (fieldErrors.images) {
      setFieldErrors((prev) => ({ ...prev, images: undefined }));
    }
  };

  function validateFields(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      errors.title = 'Title is required.';
    } else if (trimmedTitle.length < 5) {
      errors.title = 'Title must be at least 5 characters.';
    } else if (trimmedTitle.length > 100) {
      errors.title = 'Title must be 100 characters or less.';
    }

    if (!trimmedDescription) {
      errors.description = 'Description is required.';
    }

    const trimmedPrice = price.trim();
    if (!trimmedPrice) {
      errors.price = 'Price is required.';
    } else {
      const parsedPrice = Number(trimmedPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        errors.price = 'Enter a valid non-negative price.';
      }
    }

    if (images.length < 1) {
      errors.images = 'At least 1 photo is required.';
    } else if (images.length > 8) {
      errors.images = 'Maximum 8 photos allowed.';
    }

    return errors;
  }

  async function onSubmit() {
    if (submittingRef.current) {
      return;
    }

    setHasAttemptedSubmit(true);

    if (profile === undefined) {
      showAlert('Please wait', 'Your profile is still loading. Please try again in a moment.');
      return;
    }

    if (profile === null) {
      showAlert(
        'Profile setup required',
        'Please complete your profile setup before creating a listing. Go to your Profile tab to fill in your details.'
      );
      return;
    }

    if (hasPendingUploads) {
      showAlert('Uploads in progress', 'Please wait for image uploads to finish.');
      return;
    }

    const errors = validateFields();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const parsedPrice = Number(price.trim());

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      await createListing({
        title: trimmedTitle,
        description: trimmedDescription,
        price: parsedPrice,
        category,
        condition,
        images,
      });
      setFlash('Listing created.');
      router.replace('/');
    } catch (error) {
      const actionError = getListingActionError(error, 'Create failed');
      showAlert(actionError.title, actionError.message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Redirecting to login...</Text>
      </View>
    );
  }

  const isCancelDisabled = isSubmitting || hasPendingUploads;

  return (
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.formBlock, entranceStyle]}>
        <ScreenHeader
          title="Add your item"
          subtitle="Make it clear, detailed, and easy for students to trust."
          animate={false}
        />

        <View style={styles.section}>
          <RequiredLabel text="Photos" />
          <Text style={styles.labelHint}>
            Add 1–8 photos. Listings with clear photos sell faster.
          </Text>
          <ImageUploader
            images={images}
            onImagesChange={handleImagesChange}
            onPendingChange={setHasPendingUploads}
          />
          <FieldError message={fieldErrors.images} />
        </View>

        {profile === null && (
          <Pressable
            style={styles.profileBanner}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Go to profile setup"
            accessibilityRole="button"
          >
            <Text style={styles.profileBannerTitle}>⚠️ Profile setup required</Text>
            <Text style={styles.profileBannerText}>
              Complete your profile before creating a listing. Tap here to go to your Profile.
            </Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <RequiredLabel text="Title" />
          <TextInput
            style={[styles.input, fieldErrors.title && styles.inputError]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Enter listing title"
            accessibilityLabel="Listing title (required)"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            maxLength={100}
          />
          <FieldError message={fieldErrors.title} />
        </View>

        <View style={styles.section}>
          <RequiredLabel text="Description" />
          <TextInput
            style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
            value={description}
            onChangeText={handleDescriptionChange}
            placeholder="Describe your item"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            multiline
            numberOfLines={4}
            accessibilityLabel="Description (required)"
          />
          <FieldError message={fieldErrors.description} />
        </View>

        <View style={styles.section}>
          <RequiredLabel text="Price" />
          <View style={[styles.priceInputWrap, fieldErrors.price && styles.priceInputWrapError]}>
            <Text style={styles.pricePrefix}>$</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={price}
              onChangeText={handlePriceChange}
              placeholder="15"
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              keyboardType="decimal-pad"
              accessibilityLabel="Price (required)"
            />
          </View>
          <FieldError message={fieldErrors.price} />
          {!fieldErrors.price && <Text style={styles.helperText}>Enter amount in dollars</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.optionsContainer}>
            {categories.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.option,
                  category === option && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => setCategory(option)}
                accessibilityLabel={`Category: ${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected: category === option }}
              >
                <Text style={[styles.optionText, category === option && styles.optionTextSelected]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Condition</Text>
          <View style={styles.optionsContainer}>
            {conditions.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.option,
                  condition === option && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => setCondition(option)}
                accessibilityLabel={`Condition: ${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected: condition === option }}
              >
                <Text
                  style={[styles.optionText, condition === option && styles.optionTextSelected]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {hasAttemptedSubmit && Object.keys(fieldErrors).length > 0 && (
          <View style={styles.formErrorBanner}>
            <Text style={styles.formErrorText}>Please fix the errors above before submitting.</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              (isSubmitting || hasPendingUploads) && styles.submitButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              void onSubmit();
            }}
            disabled={isSubmitting || hasPendingUploads}
            accessibilityLabel={isSubmitting ? 'Creating listing' : 'Create listing'}
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Creating...' : 'Create Listing'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              isCancelDisabled && styles.cancelButtonDisabled,
              pressed && !isCancelDisabled && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
            disabled={isCancelDisabled}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formBlock: {
    gap: spacing.md,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    marginTop: 2,
    fontSize: 16,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.footnoteMed,
    color: colors.textDark,
    marginBottom: 4,
  },
  requiredAsterisk: {
    color: colors.errorText,
    fontWeight: '700',
  },
  labelHint: {
    ...typography.footnote,
    color: colors.muted,
    marginBottom: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textDark,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.errorText,
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  priceInputWrapError: {
    borderColor: colors.errorText,
  },
  pricePrefix: {
    ...typography.body,
    color: colors.text,
    paddingLeft: spacing.md,
  },
  priceInput: {
    flex: 1,
    borderWidth: 0,
    margin: 0,
  },
  helperText: {
    ...typography.footnote,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  fieldError: {
    ...typography.footnote,
    color: colors.errorText,
    marginTop: spacing.xs,
  },
  formErrorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formErrorText: {
    ...typography.footnote,
    color: colors.errorText,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionText: {
    ...typography.subhead,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 6,
    marginBottom: 8,
    gap: 10,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.muted,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  cancelButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.text,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  profileBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  profileBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.warningText,
  },
  profileBannerText: {
    fontSize: 14,
    color: colors.warningTextMuted,
    lineHeight: 20,
  },
});
