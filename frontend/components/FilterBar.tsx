import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import TagPicker from './TagPicker';
import { CATEGORY_LABELS } from '../types/filters';
import type { Category, Filters } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, borderRadius } from '../theme/tokens';

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
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          style={({ pressed }) => [
            styles.chip,
            hasCategory && styles.chipActive,
            pressed && styles.chipPressed,
          ]}
          onPress={onCategoryPress}
          accessibilityLabel={
            hasCategory ? `Category: ${CATEGORY_LABELS[filters.category!]}` : 'Filter by category'
          }
          accessibilityRole="button"
          accessibilityState={{ selected: hasCategory }}
        >
          <Text style={[styles.chipText, hasCategory && styles.chipTextActive]}>
            {hasCategory ? CATEGORY_LABELS[filters.category!] : 'Category'}
          </Text>
          {hasCategory && (
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
              onPress={onClearCategory}
              hitSlop={8}
              accessibilityLabel="Clear category filter"
              accessibilityRole="button"
            >
              <Text style={styles.clearBtnText}>×</Text>
            </Pressable>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.chip,
            hasPrice && styles.chipActive,
            pressed && styles.chipPressed,
          ]}
          onPress={onPricePress}
          accessibilityLabel={hasPrice ? `Price: ${getPriceLabel()}` : 'Filter by price'}
          accessibilityRole="button"
          accessibilityState={{ selected: hasPrice }}
        >
          <Text style={[styles.chipText, hasPrice && styles.chipTextActive]}>
            {getPriceLabel()}
          </Text>
          {hasPrice && (
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
              onPress={onClearPrice}
              hitSlop={8}
              accessibilityLabel="Clear price filter"
              accessibilityRole="button"
            >
              <Text style={styles.clearBtnText}>×</Text>
            </Pressable>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.chip,
            hasTags && styles.chipActive,
            pressed && styles.chipPressed,
          ]}
          onPress={handleTagFilterPress}
          accessibilityLabel={hasTags ? `Tags: ${selectedTags.length} selected` : 'Filter by tags'}
          accessibilityRole="button"
          accessibilityState={{ selected: hasTags }}
        >
          <Text style={[styles.chipText, hasTags && styles.chipTextActive]}>
            {hasTags ? `Tags (${selectedTags.length})` : 'Tags'}
          </Text>
          {hasTags && (
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
              onPress={onClearTags}
              hitSlop={8}
              accessibilityLabel="Clear tags filter"
              accessibilityRole="button"
            >
              <Text style={styles.clearBtnText}>×</Text>
            </Pressable>
          )}
        </Pressable>

        {hasAnyFilter && (
          <Pressable
            style={({ pressed }) => [styles.clearAll, pressed && styles.chipPressed]}
            onPress={onClearAll}
            accessibilityLabel="Clear all filters"
            accessibilityRole="button"
          >
            <Text style={styles.clearAllText}>Clear</Text>
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
  wrapper: {
    marginBottom: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 44,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.location,
    borderColor: colors.location,
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.textDark,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: colors.textDark,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  clearAll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    minHeight: 44,
    justifyContent: 'center',
  },
  clearAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
