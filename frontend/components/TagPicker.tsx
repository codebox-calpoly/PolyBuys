import {
  Animated,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, borderRadius, spacing } from '../theme/tokens';

interface TagPickerProps {
  visible: boolean;
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
  onClose: () => void;
}

export default function TagPicker({
  visible,
  selectedTags,
  onSelectTags,
  onClose,
}: TagPickerProps) {
  const entranceStyle = useEntranceAnimation(40, 8);
  const [searchText, setSearchText] = useState('');
  const [inputTags, setInputTags] = useState<string[]>(selectedTags);

  // Sync inputTags when modal opens or selectedTags changes
  useEffect(() => {
    if (visible) {
      setInputTags(selectedTags);
    }
  }, [visible, selectedTags]);

  const handleAddTag = () => {
    const normalized = searchText.trim().toLowerCase();
    if (normalized && !inputTags.includes(normalized)) {
      setInputTags([...inputTags, normalized]);
      setSearchText('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setInputTags(inputTags.filter((t) => t !== tag));
  };

  const handleApply = () => {
    onSelectTags(inputTags);
    onClose();
  };

  const handleCancel = () => {
    setInputTags(selectedTags);
    setSearchText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Animated.View style={[styles.container, entranceStyle]}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Select Tags</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a tag and press Enter"
                placeholderTextColor={colors.muted}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleAddTag}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddTag}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {inputTags.length > 0 && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedTitle}>Selected Tags:</Text>
                <View style={styles.tagsContainer}>
                  {inputTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagChip}
                      onPress={() => handleRemoveTag(tag)}
                    >
                      <Text style={styles.tagText}>#{tag}</Text>
                      <Text style={styles.removeText}> ×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing.xl,
    color: colors.textDark,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textDark,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  selectedContainer: {
    marginBottom: spacing.xl,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.textDark,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.grayLight,
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});
