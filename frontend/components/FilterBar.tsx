import React from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORY_LABELS, LISTING_SORT_SHORT } from '../types/filters';
import type { Category, Filters, ListingSortBy } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { formatPrice } from '../lib/formatPrice';
import { colors, borderRadius } from '../theme/tokens';

export type { Category, Filters };

interface FilterBarProps {
  filters: Filters;
  sortBy: ListingSortBy;
  onCategoryPress: () => void;
  onPricePress: () => void;
  onSortPress: () => void;
  onClearCategory: () => void;
  onClearPrice: () => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  sortBy,
  onCategoryPress,
  onPricePress,
  onSortPress,
  onClearCategory,
  onClearPrice,
  onClearAll,
}: FilterBarProps) {
  const entranceStyle = useEntranceAnimation(80, 10);

  const hasCategory = !!filters.category;
  const hasPrice = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  const hasNonDefaultSort = sortBy !== 'newest';
  const hasAnyFilter = hasCategory || hasPrice || hasNonDefaultSort;

  const getPriceLabel = () => {
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      return `${formatPrice(filters.minPrice)} - ${formatPrice(filters.maxPrice)}`;
    }
    if (filters.minPrice !== undefined) {
      return `${formatPrice(filters.minPrice)}+`;
    }
    if (filters.maxPrice !== undefined) {
      return `Under ${formatPrice(filters.maxPrice)}`;
    }
    return 'Price';
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
            hasNonDefaultSort && styles.chipActive,
            pressed && styles.chipPressed,
          ]}
          onPress={onSortPress}
          accessibilityLabel={`Sort: ${LISTING_SORT_SHORT[sortBy]}`}
          accessibilityRole="button"
          accessibilityState={{ selected: hasNonDefaultSort }}
        >
          <Text style={[styles.chipText, hasNonDefaultSort && styles.chipTextActive]}>
            Sort · {LISTING_SORT_SHORT[sortBy]}
          </Text>
        </Pressable>

        {hasAnyFilter && (
          <Pressable
            style={({ pressed }) => [styles.clearAll, pressed && styles.chipPressed]}
            onPress={onClearAll}
            accessibilityLabel="Clear all filters and sort"
            accessibilityRole="button"
          >
            <Text style={styles.clearAllText}>Clear</Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
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
    borderColor: colors.locationDark,
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
    backgroundColor: colors.overlayLight,
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
