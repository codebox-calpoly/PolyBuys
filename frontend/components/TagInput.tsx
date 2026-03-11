import { Animated, View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, borderRadius, spacing } from '../theme/tokens';

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
  const entranceStyle = useEntranceAnimation(70, 10);

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
        // Clear input for any processed tag (even if invalid)
        const remainingText = parts.slice(1).join(',') || '';

        if (!tagToAdd) {
          // Empty tag after processing - just clear it
          setInputText(remainingText);
        } else if (tags.includes(tagToAdd)) {
          setError('Tag already added');
          setInputText(remainingText);
        } else if (tagToAdd.length > maxLength) {
          setError(`Tags must be ${maxLength} characters or less`);
          setInputText(remainingText);
        } else if (tags.length >= maxTags) {
          setError(`Maximum ${maxTags} tags allowed`);
          setInputText(remainingText);
        } else {
          // Valid tag - add it
          onChange([...tags, tagToAdd]);
          setInputText(remainingText);
        }
      }
    }
  };

  return (
    <Animated.View style={[styles.container, entranceStyle]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="Add tags (e.g. desk, cs101, ikea)"
          placeholderTextColor={colors.muted}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
    color: colors.textDark,
  },
  inputError: {
    borderColor: colors.errorText,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  helperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  helperText: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  tagCount: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: colors.errorText,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    flexDirection: 'row',
    backgroundColor: colors.location,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    color: colors.primary,
    fontSize: 14,
  },
  removeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
