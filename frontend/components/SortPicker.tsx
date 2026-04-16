import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LISTING_SORT_OPTIONS } from '../types/filters';
import type { ListingSortBy } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

interface SortPickerProps {
  visible: boolean;
  sortBy: ListingSortBy;
  onSelect: (sort: ListingSortBy) => void;
  onClose: () => void;
}

export function SortPicker({ visible, sortBy, onSelect, onClose }: SortPickerProps) {
  const entranceStyle = useEntranceAnimation(40, 8);

  const handleSelect = (value: ListingSortBy) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.sheet, entranceStyle]}>
          <Pressable style={styles.sheetTapArea} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>Sort by</Text>

            {LISTING_SORT_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.option, sortBy === item.value && styles.optionSelected]}
                onPress={() => handleSelect(item.value)}
              >
                <Text
                  style={[styles.optionText, sortBy === item.value && styles.optionTextSelected]}
                >
                  {item.label}
                </Text>
                {sortBy === item.value ? <Text style={styles.checkmark}>✓</Text> : null}
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
    backgroundColor: 'transparent',
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
