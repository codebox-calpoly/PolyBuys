import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIES } from '../types/filters';
import type { Category } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

interface CategoryPickerProps {
  visible: boolean;
  selectedCategory?: Category;
  onSelect: (category: Category | undefined) => void;
  onClose: () => void;
}

export function CategoryPicker({
  visible,
  selectedCategory,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const entranceStyle = useEntranceAnimation(40, 8);

  const handleSelect = (category: Category | undefined) => {
    onSelect(category);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.sheet, entranceStyle]}>
          <Pressable style={styles.sheetTapArea} onPress={(e) => e.stopPropagation()}>
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
        </Animated.View>
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
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  sheetTapArea: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6e1',
    paddingHorizontal: 20,
    paddingBottom: 38,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d6ded9',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
    color: '#153428',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e9e5',
    backgroundColor: '#fafcfb',
  },
  optionSelected: {
    backgroundColor: '#e9f5ef',
    borderColor: '#bfdece',
  },
  optionText: {
    fontSize: 16,
    color: '#2f453c',
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
