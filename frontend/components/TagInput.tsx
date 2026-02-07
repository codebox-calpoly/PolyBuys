import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number; // default 5
  maxLength?: number; // default 20
}

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 20;

export default function TagInput({
  tags,
  onChange,
  maxTags = MAX_TAGS,
  maxLength = MAX_TAG_LENGTH,
}: TagInputProps) {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = () => {
    const trimmed = inputText.trim().toLowerCase();

    if (!trimmed) {
      setInputText('');
      return;
    }

    // Validate tag length
    if (trimmed.length > maxLength) {
      setError(`Tags must be ${maxLength} characters or less`);
      return;
    }

    // Check if tag already exists
    if (tags.includes(trimmed)) {
      setError('Tag already added');
      setInputText('');
      return;
    }

    // Check if max tags reached
    if (tags.length >= maxTags) {
      setError(`Maximum ${maxTags} tags allowed`);
      return;
    }

    // Add tag
    onChange([...tags, trimmed]);
    setInputText('');
    setError(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
    setError(null);
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    setError(null);

    // Auto-add on comma
    if (text.includes(',')) {
      const parts = text
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);
      if (parts.length > 0) {
        const tagToAdd = parts[0].toLowerCase();
        if (
          tagToAdd &&
          !tags.includes(tagToAdd) &&
          tagToAdd.length <= maxLength &&
          tags.length < maxTags
        ) {
          onChange([...tags, tagToAdd]);
          setInputText(parts.slice(1).join(',') || '');
        } else if (tags.includes(tagToAdd)) {
          setError('Tag already added');
          setInputText(parts.slice(1).join(',') || '');
        } else if (tagToAdd.length > maxLength) {
          setError(`Tags must be ${maxLength} characters or less`);
        } else if (tags.length >= maxTags) {
          setError(`Maximum ${maxTags} tags allowed`);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="Add tags (e.g. desk, cs101, ikea)"
          value={inputText}
          onChangeText={handleInputChange}
          onSubmitEditing={handleAddTag}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTag}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.helperContainer}>
        <Text style={styles.helperText}>
          Add up to {maxTags} tags (e.g. &apos;desk&apos;, &apos;cs101&apos;, &apos;ikea&apos;)
        </Text>
        <Text style={styles.tagCount}>
          {tags.length}/{maxTags} tags
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => handleRemoveTag(tag)}>
              <Text style={styles.tagText}>#{tag}</Text>
              <Text style={styles.removeText}> ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  inputError: {
    borderColor: '#f44336',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  helperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  tagCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#1976d2',
    fontSize: 14,
  },
  removeText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
