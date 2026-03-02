import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAction } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import ImageUploader from '@/components/ImageUploader';

const categories = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as const;
const conditions = ['new', 'used', 'refurbished'] as const;

export default function NewListingScreen() {
  const router = useRouter();
  const createListing = useAction(api.listings.createListing);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('other');
  const [condition, setCondition] = useState<(typeof conditions)[number]>('used');
  const [images, setImages] = useState<string[]>([]);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function onSubmit() {
    if (submittingRef.current) {
      return;
    }

    const normalizedEmail = sellerEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!title.trim() || !description.trim() || !normalizedEmail) {
      Alert.alert('Missing fields', 'Title, description, and email are required.');
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!normalizedEmail.endsWith('@calpoly.edu')) {
      Alert.alert('Invalid email', 'Please use your @calpoly.edu email address.');
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
      await createListing({
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        condition,
        images,
      });
      Alert.alert('Success', 'Listing created.');
      router.replace('/');
    } catch (error) {
      Alert.alert('Create failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="Listing title"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.textArea]}
        placeholder="Describe your item"
        multiline
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        style={styles.input}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Seller Email</Text>
      <TextInput
        value={sellerEmail}
        onChangeText={setSellerEmail}
        style={styles.input}
        placeholder="you@calpoly.edu"
        keyboardType="email-address"
        autoCapitalize="none"
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
      <ImageUploader
        images={images}
        onImagesChange={setImages}
        onPendingChange={setHasPendingUploads}
      />

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={onSubmit}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Creating...' : 'Create Listing'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
