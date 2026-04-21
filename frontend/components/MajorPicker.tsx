import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAL_POLY_MAJORS, formatMajorLabel, majorMatchesQuery } from '../constants/calPolyMajors';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

type MajorPickerProps = {
  visible: boolean;
  selectedMajor?: string;
  onSelect: (major: string) => void;
  onClose: () => void;
};

export function MajorPicker({ visible, selectedMajor, onSelect, onClose }: MajorPickerProps) {
  const entranceStyle = useEntranceAnimation(40, 8);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filteredMajors = useMemo(
    () => CAL_POLY_MAJORS.filter((major) => majorMatchesQuery(major, query)),
    [query]
  );

  const handleSelect = (major: string) => {
    onSelect(major);
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            style={[styles.sheet, entranceStyle, { marginTop: insets.top + spacing.sm }]}
          >
            <Pressable
              style={[
                styles.sheetTapArea,
                { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) },
              ]}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.handle} />
              <Text style={styles.title}>Select your major</Text>
              <Text style={styles.subtitle}>
                Search the official Cal Poly majors list and choose the best match.
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search majors"
                placeholderTextColor={colors.muted}
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="words"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              <FlatList
                data={filteredMajors}
                keyExtractor={(item) => item}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isSelected = item === selectedMajor;
                  return (
                    <TouchableOpacity
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => handleSelect(item)}
                    >
                      <Text
                        style={[styles.optionText, isSelected && styles.optionTextSelected]}
                        numberOfLines={2}
                      >
                        {formatMajorLabel(item)}
                      </Text>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>No majors found</Text>
                    <Text style={styles.emptyStateText}>Try a broader search term.</Text>
                  </View>
                }
              />
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetTapArea: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  title: {
    ...typography.title2,
    color: colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.footnote,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.subhead,
    color: colors.textDark,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    backgroundColor: colors.background,
    borderColor: colors.locationDark,
  },
  optionText: {
    flex: 1,
    ...typography.subhead,
    color: colors.textDark,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyStateTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  emptyStateText: {
    ...typography.footnote,
    color: colors.text,
  },
});
