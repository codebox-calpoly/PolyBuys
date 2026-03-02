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
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Animated.View style={[styles.container, entranceStyle]}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Select Tags</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a tag and press Enter"
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6e1',
    padding: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4dfd9',
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    fontSize: 16,
    backgroundColor: '#f9fbfa',
  },
  addButton: {
    backgroundColor: '#1c7f50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  selectedContainer: {
    marginBottom: 20,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#244539',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: '#d6e4ff',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#154734',
    padding: 14,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
