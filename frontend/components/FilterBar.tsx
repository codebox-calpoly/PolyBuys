import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import TagPicker from './TagPicker';
import { CATEGORY_LABELS } from '../types/filters';
import type { Category, Filters } from '../types/filters';

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
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Category Filter Chip */}
        <View style={[styles.chip, hasCategory && styles.chipActive]}>
          <TouchableOpacity style={styles.chipMainButton} onPress={onCategoryPress}>
            <Text style={[styles.chipText, hasCategory && styles.chipTextActive]}>
              {hasCategory ? CATEGORY_LABELS[filters.category!] : 'Category'}
            </Text>
          </TouchableOpacity>
          {hasCategory && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearCategory}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Price Filter Chip */}
        <View style={[styles.chip, hasPrice && styles.chipActive]}>
          <TouchableOpacity style={styles.chipMainButton} onPress={onPricePress}>
            <Text style={[styles.chipText, hasPrice && styles.chipTextActive]}>
              {getPriceLabel()}
            </Text>
          </TouchableOpacity>
          {hasPrice && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearPrice}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tags Filter Chip */}
        <View style={[styles.chip, hasTags && styles.chipActive]}>
          <TouchableOpacity style={styles.chipMainButton} onPress={handleTagFilterPress}>
            <Text style={[styles.chipText, hasTags && styles.chipTextActive]}>
              {hasTags ? `Tags (${selectedTags.length})` : 'Tags'}
            </Text>
          </TouchableOpacity>
          {hasTags && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearTags}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Clear All Button */}
        {hasAnyFilter && (
          <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  chipMainButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    width: 18,
    height: 18,
    borderRadius: 9,
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
    paddingVertical: 8,
  },
  clearAllText: {
    fontSize: 14,
    color: '#154734',
    fontWeight: '600',
  },
});
