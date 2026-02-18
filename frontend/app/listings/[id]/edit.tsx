import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useAction } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import TagInput from '../../../components/TagInput';

type Category = 'textbooks' | 'electronics' | 'furniture' | 'tickets' | 'other';
type Condition = 'new' | 'used' | 'refurbished';

export default function EditListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const listing = useQuery(api.listings.getListing, {
    id: id as Id<'listings'>,
  });
  const updateListing = useAction(api.listings.updateListing);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [condition, setCondition] = useState<Condition>('used');
  const [images, setImages] = useState<string[]>(['']);
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formPopulated, setFormPopulated] = useState(false);
  const [lastListingId, setLastListingId] = useState<string | null>(null);

  // Populate form when listing loads (only once per listing)
  useEffect(() => {
    if (listing) {
      // Reset form if listing ID changed
      if (lastListingId !== listing._id) {
        setFormPopulated(false);
        setLastListingId(listing._id);
      }

      // Populate only if not already populated for this listing
      if (!formPopulated) {
        setTitle(listing.title || '');
        setDescription(listing.description || '');
        setPrice(listing.price?.toString() || '');
        setCategory(listing.category || 'other');
        setCondition(listing.condition || 'used');
        setImages(listing.images && listing.images.length > 0 ? listing.images : ['']);
        setTags(listing.tags || []);
        setFormPopulated(true);
      }
    }
  }, [listing, formPopulated, lastListingId]);

  const handleAddImage = () => {
    setImages([...images, '']);
  };

  const handleImageChange = (index: number, value: string) => {
    const newImages = [...images];
    newImages[index] = value;
    setImages(newImages);
  };

  const handleRemoveImage = (index: number) => {
    if (images.length > 1) {
      setImages(images.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!listing) return;

    // Validation
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 5) {
      Alert.alert('Error', 'Title must be at least 5 characters');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Description is required');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    const validImages = images.filter((img) => img.trim().length > 0);
    if (validImages.length === 0) {
      Alert.alert('Error', 'At least one image URL is required');
      return;
    }
    if (validImages.length > 8) {
      Alert.alert('Error', 'Maximum 8 images allowed');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateListing({
        id: listing._id,
        title: trimmedTitle,
        description: description.trim(),
        price: priceNum,
        category,
        condition,
        images: validImages,
        tags,
      });
      router.replace(`/listings/${listing._id}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof ConvexError
          ? (error.data as string)
          : error instanceof Error
            ? error.message
            : 'Failed to update listing';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (listing === undefined) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (listing === null) {
    return (
      <View style={styles.container}>
        <Text>Listing not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edit Listing</Text>

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
          {(['textbooks', 'electronics', 'furniture', 'tickets', 'other'] as Category[]).map(
            (cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.option, category === cat && styles.optionSelected]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.optionText, category === cat && styles.optionTextSelected]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Condition *</Text>
        <View style={styles.optionsContainer}>
          {(['new', 'used', 'refurbished'] as Condition[]).map((cond) => (
            <TouchableOpacity
              key={cond}
              style={[styles.option, condition === cond && styles.optionSelected]}
              onPress={() => setCondition(cond)}
            >
              <Text style={[styles.optionText, condition === cond && styles.optionTextSelected]}>
                {cond.charAt(0).toUpperCase() + cond.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Images (URLs) *</Text>
        {images.map((image, index) => (
          <View key={index} style={styles.imageInputContainer}>
            <TextInput
              style={[styles.input, styles.imageInput]}
              value={image}
              onChangeText={(value) => handleImageChange(index, value)}
              placeholder={`Image URL ${index + 1}`}
              autoCapitalize="none"
            />
            {images.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {images.length < 8 && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddImage}>
            <Text style={styles.addButtonText}>+ Add Image</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tags</Text>
        <TagInput tags={tags} onChange={setTags} />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  optionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  imageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageInput: {
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  addButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
