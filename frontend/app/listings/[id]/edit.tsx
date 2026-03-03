import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { Id } from 'convex/_generated/dataModel';
import ImageUploader from '@/components/ImageUploader';
import ListingUnavailable from '../../../components/ListingUnavailable';
import TagInput from '../../../components/TagInput';
import { useEntranceAnimation } from '../../../hooks/useEntranceAnimation';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;
const MODERATION_ERROR_FRAGMENT = 'violates our community guidelines';

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

    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Title and description are required.');
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Invalid price', 'Please enter a valid non-negative price.');
      return;
    }

    if (hasPendingUploads) {
      Alert.alert('Uploads in progress', 'Please wait for image uploads to finish.');
      return;
    }

    if (images.length < 1 || images.length > 8) {
      Alert.alert('Invalid images', 'Please upload between 1 and 8 images.');
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      await updateListing({
        id: listingId as Id<'listings'>,
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        condition,
        images,
        tags,
      });
      Alert.alert('Success', 'Listing updated.');
      router.back();
    } catch (error) {
      const actionError = getListingActionError(error, 'Update failed');
      Alert.alert(actionError.title, actionError.message);
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
        <ActivityIndicator size="small" color="#154734" />
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
        <Text style={styles.eyebrow}>Seller Studio</Text>
        <Text style={styles.title}>Edit listing</Text>
        <Text style={styles.subtitle}>Update your listing details and keep it fresh.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter listing title"
            maxLength={100}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your item"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Price ($) *</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
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
              >
                <Text style={[styles.optionText, category === option && styles.optionTextSelected]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Condition *</Text>
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
          <Text style={styles.label}>Images *</Text>
          <ImageUploader
            images={images}
            onImagesChange={setImages}
            onPendingChange={setHasPendingUploads}
          />
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
    backgroundColor: '#f3f7f5',
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
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#5e7268',
    fontSize: 15,
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 14,
    color: '#5f7268',
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#27463b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dfd9',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fbfa',
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe6e1',
    backgroundColor: '#f8fbf9',
  },
  optionSelected: {
    backgroundColor: '#154734',
    borderColor: '#154734',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionText: {
    fontSize: 14,
    color: '#4f645b',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 6,
    marginBottom: 8,
    gap: 10,
  },
  submitButton: {
    backgroundColor: '#154734',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9eb5ab',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d5e0db',
    backgroundColor: '#f6faf8',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#4f645b',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
