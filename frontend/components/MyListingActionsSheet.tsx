import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Doc } from 'convex/_generated/dataModel';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

export type MyListingAction = 'edit' | 'markSold' | 'markInactive' | 'markActive' | 'delete';

export type MyListingActionTarget = Pick<Doc<'listings'>, '_id' | 'title' | 'status' | 'isHidden'>;

type MyListingActionsSheetProps = {
  visible: boolean;
  listing: MyListingActionTarget | null;
  onClose: () => void;
  onAction: (action: MyListingAction, listing: MyListingActionTarget) => void;
};

type SheetActionItem = {
  key: MyListingAction;
  label: string;
  description: string;
  destructive?: boolean;
};

function getActions(status: Doc<'listings'>['status']): SheetActionItem[] {
  const baseActions: SheetActionItem[] = [
    {
      key: 'edit',
      label: 'Edit listing',
      description: 'Update title, description, photos, and price.',
    },
  ];

  if (status === 'active') {
    baseActions.push(
      {
        key: 'markInactive',
        label: 'Mark inactive',
        description: 'Hide from active browsing until you relist it.',
      },
      {
        key: 'markSold',
        label: 'Mark sold',
        description: 'Show buyers this item is no longer available.',
      }
    );
  }

  if (status === 'inactive') {
    baseActions.push({
      key: 'markActive',
      label: 'Relist as active',
      description: 'Make this listing discoverable again.',
    });
  }

  baseActions.push({
    key: 'delete',
    label: 'Delete listing',
    description: 'Permanently remove this listing from your profile.',
    destructive: true,
  });

  return baseActions;
}

export default function MyListingActionsSheet({
  visible,
  listing,
  onClose,
  onAction,
}: MyListingActionsSheetProps) {
  const insets = useSafeAreaInsets();

  if (!listing) {
    return null;
  }

  const actions = getActions(listing.status);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) },
          ]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          {listing.isHidden === true ? (
            <Text style={styles.sheetHint}>This listing is currently hidden from discovery.</Text>
          ) : null}

          <View style={styles.actionsList}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                onPress={() => onAction(action.key, listing)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text
                  style={[styles.actionLabel, action.destructive && styles.actionLabelDestructive]}
                >
                  {action.label}
                </Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.actionRowPressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  sheetTitle: {
    ...typography.heading,
    color: colors.textDark,
    marginTop: spacing.xs,
  },
  sheetHint: {
    ...typography.footnote,
    color: colors.warningTextMuted,
  },
  actionsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionRow: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 56,
    justifyContent: 'center',
  },
  actionRowPressed: {
    opacity: 0.88,
  },
  actionLabel: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '600',
  },
  actionLabelDestructive: {
    color: colors.destructive,
  },
  actionDescription: {
    ...typography.footnote,
    color: colors.text,
    marginTop: 2,
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '600',
  },
});
