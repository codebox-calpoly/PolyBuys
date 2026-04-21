import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewProps, ViewProps } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

export interface FilterChipOption<T extends string = string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string = string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  wrap?: boolean;
}

export function FilterChips<T extends string = string>({
  options,
  value,
  onChange,
  wrap = false,
}: FilterChipsProps<T>) {
  if (wrap) {
    const viewProps: ViewProps = {
      style: styles.wrapBar,
    };

    return (
      <View {...viewProps}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const scrollProps: ScrollViewProps = {
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    contentContainerStyle: styles.row,
    style: styles.bar,
  };

  return (
    <ScrollView {...scrollProps}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  wrapBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 44,
    borderRadius: borderRadius.full,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.location,
    borderColor: colors.locationDark,
  },
  chipText: {
    ...typography.footnoteMed,
    color: colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textDark,
  },
  chipPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
});

export default FilterChips;
