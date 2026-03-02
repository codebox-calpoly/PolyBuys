import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import ImageUploader from '@/components/ImageUploader';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;

export default function EditListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useQuery(api.listings.getListing, { id: id as Id<'listings'> });
  const updateListing = useAction(api.listings.updateListing);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('other');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('used');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

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
    setHasInitialized(true);
  }, [hasInitialized, listing]);

  async function onSubmit() {
    if (isSubmitting) {
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

    if (images.length < 1 || images.length > 8) {
      Alert.alert('Invalid images', 'Please upload between 1 and 8 images.');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateListing({
        id: id as Id<'listings'>,
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        condition,
        images,
      });
      Alert.alert('Success', 'Listing updated.');
      router.back();
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (listing === undefined) {
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (listing === null) {
    return (
      <View style={styles.centered}>
        <Text>Listing not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.textArea]}
        multiline
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        style={styles.input}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.rowWrap}>
        {categories.map((option) => (
          <Pressable
            key={option}
            style={[styles.choice, category === option && styles.choiceActive]}
            onPress={() => setCategory(option)}
          >
            <Text style={[styles.choiceText, category === option && styles.choiceTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Condition</Text>
      <View style={styles.rowWrap}>
        {conditions.map((option) => (
          <Pressable
            key={option}
            style={[styles.choice, condition === option && styles.choiceActive]}
            onPress={() => setCondition(option)}
          >
            <Text style={[styles.choiceText, condition === option && styles.choiceTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Images</Text>
      <ImageUploader images={images} onImagesChange={setImages} />

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={onSubmit}
      >
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 20,
    backgroundColor: '#fff',
    gap: 8,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: '#90a4ae',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  choiceActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  choiceText: {
    color: '#37474f',
    fontSize: 12,
    fontWeight: '600',
  },
  choiceTextActive: {
    color: '#fff',
  },
  submitButton: {
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: '#1e88e5',
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#90caf9',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
