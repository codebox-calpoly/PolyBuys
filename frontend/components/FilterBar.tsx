import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export type Category = 'textbooks' | 'electronics' | 'furniture' | 'tickets' | 'other';

export interface Filters {
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
}

interface FilterBarProps {
  filters: Filters;
  onCategoryPress: () => void;
  onPricePress: () => void;
  onClearCategory: () => void;
  onClearPrice: () => void;
  onClearAll: () => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  textbooks: 'Textbooks',
  electronics: 'Electronics',
  furniture: 'Furniture',
  tickets: 'Tickets',
  other: 'Other',
};

export function FilterBar({
  filters,
  onCategoryPress,
  onPricePress,
  onClearCategory,
  onClearPrice,
  onClearAll,
}: FilterBarProps) {
  const hasCategory = !!filters.category;
  const hasPrice = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  const hasAnyFilter = hasCategory || hasPrice;

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

        {/* Clear All Button */}
        {hasAnyFilter && (
          <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 0, // Reset padding as inner elements handle spacing
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
