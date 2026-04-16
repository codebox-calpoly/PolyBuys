import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import ImageUploader from '@/components/ImageUploader';
import TagInput from '../../components/TagInput';
import { useFlash } from '../../contexts/FlashContext';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors, typography, borderRadius, spacing } from '../../theme/tokens';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;
const MODERATION_ERROR_FRAGMENT = 'violates our community guidelines';
const PROFILE_SETUP_ERROR_FRAGMENT = 'complete your profile setup';

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

export default function NewListingScreen() {
  const router = useRouter();
  const { setFlash } = useFlash();
  const createListing = useAction(api.listings.createListing);
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated ? {} : 'skip');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('other');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('used');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      showAlert('Sign In Required', 'Please sign in to create a listing');
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isSessionLoading, router]);

  async function onSubmit() {
    if (submittingRef.current) {
      return;
    }

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

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || trimmedTitle.length < 5) {
      showAlert('Missing fields', 'Title must be at least 5 characters.');
      return;
    }

    if (!trimmedDescription) {
      showAlert('Missing fields', 'Description is required.');
      return;
    }

    const trimmed = price.trim();
    const parsedPrice = trimmed === '' ? NaN : Number(trimmed);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      showAlert('Invalid price', 'Please enter a valid non-negative price in dollars.');
      return;
    }

    if (hasPendingUploads) {
      showAlert('Uploads in progress', 'Please wait for image uploads to finish.');
      return;
    }

    if (images.length < 1 || images.length > 8) {
      showAlert('Invalid images', 'Please upload between 1 and 8 images.');
      return;
    }

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
        tags,
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.formCard, entranceStyle]}>
          <Text style={styles.eyebrow}>Create Listing</Text>
          <Text style={styles.title}>Add your item</Text>
          <Text style={styles.subtitle}>
            Make it clear, detailed, and easy for students to trust.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.labelHint}>
              Add 1–8 photos. Listings with clear photos sell faster.
            </Text>
            <ImageUploader
              images={images}
              onImagesChange={setImages}
              onPendingChange={setHasPendingUploads}
            />
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
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter listing title"
              accessibilityLabel="Listing title"
              placeholderTextColor={colors.muted}
              maxLength={100}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your item"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={(text) => {
                  const filtered = text.replace(/[^0-9.]/g, '');
                  const parts = filtered.split('.');
                  if (parts.length > 2) return;
                  if (parts[1]?.length > 2) return;
                  setPrice(filtered);
                }}
                placeholder="15"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.helperText}>Enter amount in dollars</Text>
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
                  <Text
                    style={[styles.optionText, category === option && styles.optionTextSelected]}
                  >
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

          <View style={styles.section}>
            <Text style={styles.label}>Tags</Text>
            <TagInput tags={tags} onChange={setTags} />
          </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.muted,
    padding: spacing.lg,
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
  eyebrow: {
    ...typography.footnoteMed,
    color: colors.textDark,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    ...typography.title1,
    marginBottom: 6,
    color: colors.textDark,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.text,
    marginBottom: 16,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.footnoteMed,
    color: colors.textDark,
    marginBottom: 4,
  },
  labelHint: {
    ...typography.footnote,
    color: colors.muted,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    ...typography.body,
    color: colors.textDark,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
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
    padding: 15,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minHeight: 45,
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
    padding: 14,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
