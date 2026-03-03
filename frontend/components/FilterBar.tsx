import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import TagPicker from './TagPicker';
import { CATEGORY_LABELS } from '../types/filters';
import type { Category, Filters } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

// Re-export for backward compatibility
export type { Category, Filters };

interface FilterBarProps {
  filters: Filters;
  selectedTags: string[];
  onCategoryPress: () => void;
  onPricePress: () => void;
  onTagsChange: (tags: string[]) => void;
  onClearCategory: () => void;
  onClearPrice: () => void;
  onClearTags: () => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  selectedTags,
  onCategoryPress,
  onPricePress,
  onTagsChange,
  onClearCategory,
  onClearPrice,
  onClearTags,
  onClearAll,
}: FilterBarProps) {
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const entranceStyle = useEntranceAnimation(80, 10);

  const hasCategory = !!filters.category;
  const hasPrice = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  const hasTags = selectedTags.length > 0;
  const hasAnyFilter = hasCategory || hasPrice || hasTags;

  const getPriceLabel = () => {
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      return `$${filters.minPrice} - $${filters.maxPrice}`;
    }
    if (filters.minPrice !== undefined) {
      return `$${filters.minPrice}+`;
    }
    if (filters.maxPrice !== undefined) {
      return `Under $${filters.maxPrice}`;
    }
    return 'Price';
  };

  const handleTagFilterPress = () => {
    setTagPickerVisible(true);
  };

  return (
    <Animated.View style={[styles.container, entranceStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Category Filter Chip */}
        <View style={[styles.chip, hasCategory && styles.chipActive]}>
          <Pressable style={styles.chipMainButton} onPress={onCategoryPress}>
            <Text style={[styles.chipText, hasCategory && styles.chipTextActive]}>
              {hasCategory ? CATEGORY_LABELS[filters.category!] : 'Category'}
            </Text>
          </Pressable>
          {hasCategory && (
            <Pressable
              style={styles.clearButton}
              onPress={onClearCategory}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </Pressable>
          )}
        </View>

        {/* Price Filter Chip */}
        <View style={[styles.chip, hasPrice && styles.chipActive]}>
          <Pressable style={styles.chipMainButton} onPress={onPricePress}>
            <Text style={[styles.chipText, hasPrice && styles.chipTextActive]}>
              {getPriceLabel()}
            </Text>
          </Pressable>
          {hasPrice && (
            <Pressable
              style={styles.clearButton}
              onPress={onClearPrice}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </Pressable>
          )}
        </View>

        {/* Tags Filter Chip */}
        <View style={[styles.chip, hasTags && styles.chipActive]}>
          <Pressable style={styles.chipMainButton} onPress={handleTagFilterPress}>
            <Text style={[styles.chipText, hasTags && styles.chipTextActive]}>
              {hasTags ? `Tags (${selectedTags.length})` : 'Tags'}
            </Text>
          </Pressable>
          {hasTags && (
            <Pressable
              style={styles.clearButton}
              onPress={onClearTags}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </Pressable>
          )}
        </View>

        {/* Clear All Button */}
        {hasAnyFilter && (
          <Pressable style={styles.clearAllButton} onPress={onClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </ScrollView>

      <TagPicker
        visible={tagPickerVisible}
        selectedTags={selectedTags}
        onSelectTags={onTagsChange}
        onClose={() => setTagPickerVisible(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e9e6',
    backgroundColor: '#f9fbfa',
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 10,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#f2f4f3',
    borderWidth: 1,
    borderColor: '#dee6e1',
    overflow: 'hidden',
  },
  chipMainButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#154734',
    borderColor: '#154734',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextActive: {
    color: '#fff',
  },
  clearButton: {
    marginRight: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  clearAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#edf5f1',
    borderWidth: 1,
    borderColor: '#d3e7dc',
  },
  clearAllText: {
    fontSize: 14,
    color: '#16553f',
    fontWeight: '600',
  },
});
