import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import TagPicker from './TagPicker';

interface FilterBarProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function FilterBar({ selectedTags, onTagsChange }: FilterBarProps) {
  const [tagPickerVisible, setTagPickerVisible] = useState(false);

  const handleTagFilterPress = () => {
    setTagPickerVisible(true);
  };

  const handleClearTags = () => {
    onTagsChange([]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.filterChip, selectedTags.length > 0 && styles.filterChipActive]}
        onPress={handleTagFilterPress}
      >
        <Text
          style={[styles.filterChipText, selectedTags.length > 0 && styles.filterChipTextActive]}
        >
          {selectedTags.length > 0 ? `Tags (${selectedTags.length})` : 'Tags'}
        </Text>
      </TouchableOpacity>

      {selectedTags.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearTags}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      )}

      <TagPicker
        visible={tagPickerVisible}
        selectedTags={selectedTags}
        onSelectTags={onTagsChange}
        onClose={() => setTagPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  clearButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
