import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import type { Category } from '../types/filters';
import { CATEGORY_LABELS } from '../types/filters';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

const CATEGORY_ITEMS: Array<{ value: Category | undefined; label: string }> = [
  { value: undefined, label: 'All' },
  { value: 'textbooks', label: CATEGORY_LABELS.textbooks },
  { value: 'electronics', label: CATEGORY_LABELS.electronics },
  { value: 'furniture', label: CATEGORY_LABELS.furniture },
  { value: 'tickets', label: CATEGORY_LABELS.tickets },
  { value: 'other', label: CATEGORY_LABELS.other },
];

const landingTextFont =
  Platform.OS === 'web'
    ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
    : undefined;

interface CategoryRailProps {
  selectedCategory: Category | undefined;
  onSelectCategory: (category: Category | undefined) => void;
  /** Called when a category chip is pressed — clears the search input. */
  onClearSearch?: () => void;
  priceLabel: string;
  hasPrice: boolean;
  onPricePress: () => void;
  onClearPrice: () => void;
  sortLabel: string;
  hasNonDefaultSort: boolean;
  onSortPress: () => void;
  hasAnyFilter: boolean;
  onClearAll: () => void;
}

export function CategoryRail({
  selectedCategory,
  onSelectCategory,
  onClearSearch,
  priceLabel,
  hasPrice,
  onPricePress,
  onClearPrice,
  sortLabel,
  hasNonDefaultSort,
  onSortPress,
  hasAnyFilter,
  onClearAll,
}: CategoryRailProps) {
  const entranceStyle = useEntranceAnimation(60, 8);

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <View style={styles.labelRow}>
        <View style={styles.labelDot} />
        <Text style={[styles.sectionLabel, landingTextFont]}>Browse by category</Text>
      </View>

      <View style={styles.railBody}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterScroll}
        >
          {CATEGORY_ITEMS.map((item) => (
            <CategoryChip
              key={item.value ?? '__all__'}
              label={item.label}
              isActive={selectedCategory === item.value}
              onPress={() => {
                onClearSearch?.();
                onSelectCategory(item.value);
              }}
            />
          ))}

          <View style={styles.inlineDivider} />

          <FilterControl
            label={priceLabel}
            iconName="pricetag-outline"
            isActive={hasPrice}
            onPress={onPricePress}
            onClear={hasPrice ? onClearPrice : undefined}
            accessibilityLabel={hasPrice ? `Price: ${priceLabel}` : 'Filter by price'}
          />
          <FilterControl
            label={`Sort: ${sortLabel}`}
            iconName="swap-vertical-outline"
            isActive={hasNonDefaultSort}
            onPress={onSortPress}
            accessibilityLabel={`Sort: ${sortLabel}`}
          />
          {hasAnyFilter ? <ClearAllButton onPress={onClearAll} /> : null}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function CategoryChip({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  // Web-only hover style — bypasses StyleSheet validation
  const webHoverStyle =
    isWeb && hovered && !isActive
      ? ({
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: 'rgba(21,71,52,0.22)',
          transform: 'translateY(-1px)',
          boxShadow: '0 3px 10px rgba(21,71,52,0.10)',
        } as never)
      : isWeb && hovered && isActive
        ? ({ transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(21,71,52,0.28)' } as never)
        : undefined;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label === 'All' ? 'Show all categories' : `Filter by ${label}`}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.categoryChip,
        isActive && styles.categoryChipActive,
        pressed && styles.pressed,
        webHoverStyle,
        isWeb &&
          ({
            transition:
              'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease',
          } as never),
      ]}
    >
      <Text style={[styles.categoryText, landingTextFont, isActive && styles.categoryTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterControl({
  label,
  iconName,
  isActive,
  onPress,
  onClear,
  accessibilityLabel,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  onClear?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.filterControl,
        isActive && styles.filterControlActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={iconName} size={14} color={isActive ? colors.primary : colors.text} />
      <Text
        style={[
          styles.filterControlText,
          landingTextFont,
          isActive && styles.filterControlTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onClear ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            onClear();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear price filter"
          style={styles.clearButton}
        >
          <Ionicons name="close" size={12} color={colors.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function ClearAllButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Clear all filters"
      style={({ pressed }) => [styles.clearAll, pressed && styles.pressed]}
    >
      <Text style={[styles.clearAllText, landingTextFont]}>Clear</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  labelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  sectionLabel: {
    ...typography.footnote,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  railBody: {
    minWidth: 0,
  },
  filterScroll: {
    minWidth: 0,
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 1,
    paddingBottom: 1,
    paddingRight: spacing.md,
  },
  inlineDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(21, 71, 52, 0.10)',
    marginLeft: 2,
    marginRight: 2,
  },
  categoryChip: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    ...typography.footnote,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
  },
  categoryTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  filterControl: {
    height: 34,
    maxWidth: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
  },
  filterControlActive: {
    backgroundColor: 'rgba(21, 71, 52, 0.07)',
    borderColor: 'rgba(21, 71, 52, 0.22)',
  },
  filterControlText: {
    ...typography.footnote,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    flexShrink: 1,
  },
  filterControlTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  clearButton: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 71, 52, 0.10)',
  },
  clearAll: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.14)',
    justifyContent: 'center',
  },
  clearAllText: {
    ...typography.footnote,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
