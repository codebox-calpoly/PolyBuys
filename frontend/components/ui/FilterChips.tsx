import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

export interface FilterChipOption<T extends string = string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string = string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterChips<T extends string = string>({
  options,
  value,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bar}
    >
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
  chip: {
    height: 38,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  chipPressed: {
    opacity: 0.88,
  },
});

export default FilterChips;
