import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import ImageUploader from '@/components/ImageUploader';
import ListingUnavailable from '../../../components/ListingUnavailable';
import TagInput from '../../../components/TagInput';
import { useFlash } from '../../../contexts/FlashContext';
import { useEntranceAnimation } from '../../../hooks/useEntranceAnimation';
import { borderRadius, colors, spacing, typography } from '../../../theme/tokens';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;
const MODERATION_ERROR_FRAGMENT = 'violates our community guidelines';

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

  return {
    title: fallbackTitle,
    message: rawMessage,
  };
}

export default function EditListingScreen() {
  const router = useRouter();
  const { setFlash } = useFlash();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = typeof id === 'string' && id.trim().length > 0 ? id : null;
  const listing = useQuery(
    api.listings.getListing,
    listingId ? { id: listingId as Id<'listings'> } : 'skip'
  );
  const updateListing = useAction(api.listings.updateListing);
  const entranceStyle = useEntranceAnimation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('other');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('used');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!listing || hasInitialized) {
      return;
    }

    setTitle(listing.title);
    setDescription(listing.description);
    setPrice(String(listing.price));
    setCategory(listing.category);
    setCondition(listing.condition);
    setImages(listing.images);
    setTags(listing.tags ?? []);
    setHasInitialized(true);
  }, [hasInitialized, listing]);

  async function onSubmit() {
    if (submittingRef.current || !listingId) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      showAlert('Missing title', 'Title is required.');
      return;
    }

    if (trimmedTitle.length < 5) {
      showAlert('Invalid title', 'Title must be at least 5 characters.');
      return;
    }

    if (!trimmedDescription) {
      showAlert('Missing description', 'Description is required.');
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
      const result = await updateListing({
        id: listingId as Id<'listings'>,
        title: trimmedTitle,
        description: trimmedDescription,
        price: parsedPrice,
        category,
        condition,
        images,
        tags,
      });
      if (!result.ok) {
        showAlert(
          'Listing needs edits',
          'Some listing text was flagged by our safety checks. Try rewording the title or description and submit again.'
        );
        return;
      }
      setFlash('Listing updated.');
      router.back();
    } catch (error) {
      const actionError = getListingActionError(error, 'Update failed');
      showAlert(actionError.title, actionError.message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (!listingId) {
    return <ListingUnavailable />;
  }

  if (listing === undefined) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading listing...</Text>
      </View>
    );
  }

  if (listing === null) {
    return <ListingUnavailable />;
  }

  const isCancelDisabled = isSubmitting || hasPendingUploads;

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[styles.formCard, entranceStyle]}>
        <Text style={styles.eyebrow}>Edit Listing</Text>
        <Text style={styles.title}>Update your item</Text>
        <Text style={styles.subtitle}>Keep your listing accurate so buyers can decide faster.</Text>

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
          <Text style={styles.helperText}>
            Enter amount in dollars. Decimals optional (e.g. 15 or 15.50)
          </Text>
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
            accessibilityLabel={isSubmitting ? 'Saving listing' : 'Save listing changes'}
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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
});
