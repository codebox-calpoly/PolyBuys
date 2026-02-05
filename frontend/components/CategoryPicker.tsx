import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import type { Category } from './FilterBar';

interface CategoryPickerProps {
  visible: boolean;
  selectedCategory?: Category;
  onSelect: (category: Category | undefined) => void;
  onClose: () => void;
}

const CATEGORIES: { value: Category | undefined; label: string }[] = [
  { value: undefined, label: 'All Categories' },
  { value: 'textbooks', label: 'Textbooks' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'other', label: 'Other' },
];

export function CategoryPicker({
  visible,
  selectedCategory,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const handleSelect = (category: Category | undefined) => {
    onSelect(category);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Category</Text>

          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.option, selectedCategory === item.value && styles.optionSelected]}
              onPress={() => handleSelect(item.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedCategory === item.value && styles.optionTextSelected,
                ]}
              >
                {item.label}
              </Text>
              {selectedCategory === item.value && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: '#e8f5e9',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#154734',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#154734',
    fontWeight: 'bold',
  },
});
