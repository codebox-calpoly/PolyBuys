import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/tokens';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import {
  REPORT_SUBMITTED_ALERT_BODY,
  REPORT_SUBMITTED_ALERT_TITLE,
} from '../constants/feedbackMessages';
import { getUserFlowErrorMessage } from '../lib/user-flow-errors';

type ReportReason = 'scam' | 'inappropriate' | 'spam' | 'other';

type ReportModalProps = {
  isVisible: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'listing' | 'profile' | 'conversation' | 'message';
  /** When set, success uses this instead of a blocking alert (e.g. in-app flash banner). */
  onReportSuccess?: () => void;
};

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'scam', label: 'Scam', desc: 'Fraudulent listing or deceptive behavior' },
  { value: 'inappropriate', label: 'Inappropriate', desc: 'Offensive or policy-violating content' },
  { value: 'spam', label: 'Spam', desc: 'Low-quality, duplicate, or irrelevant posting' },
  { value: 'other', label: 'Other', desc: 'Something else not covered above' },
];

const MAX_NOTES = 500;

export function ReportModal({
  isVisible,
  onClose,
  targetId,
  targetType,
  onReportSuccess,
}: ReportModalProps) {
  const createReport = useMutation(api.reports.createReport);
  const reportConversation = useMutation(api.messages.reportConversation);
  const reportMessage = useMutation(api.messages.reportMessage);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setNotes('');
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    if (reason === 'other' && !notes.trim()) {
      Alert.alert('Notes required', 'Please provide details when selecting "Other" as the reason.');
      return;
    }
    setSubmitting(true);
    try {
      const trimmedNotes = notes.trim() ? notes.trim() : undefined;
      const reportPayload = {
        reason,
        notes: trimmedNotes,
      };
      if (targetType === 'conversation') {
        await reportConversation({
          conversationId: targetId as Id<'conversations'>,
          ...reportPayload,
        });
      } else if (targetType === 'message') {
        await reportMessage({
          messageId: targetId as Id<'messages'>,
          ...reportPayload,
        });
      } else {
        await createReport({
          targetId,
          targetType,
          ...reportPayload,
        });
      }
      if (onReportSuccess) {
        onReportSuccess();
      } else {
        Alert.alert(REPORT_SUBMITTED_ALERT_TITLE, REPORT_SUBMITTED_ALERT_BODY);
      }
      handleClose();
    } catch (err) {
      Alert.alert('Could Not Submit Report', getUserFlowErrorMessage(err, 'submit-report'));
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>
            {targetType === 'profile'
              ? 'Report profile'
              : targetType === 'message'
                ? 'Report message'
                : targetType === 'conversation'
                  ? 'Report conversation'
                  : 'Report listing'}
          </Text>
          <Text style={styles.subtitle}>Select a reason (required)</Text>

          {REASONS.map((r) => (
            <Pressable
              key={r.value}
              style={[styles.reasonRow, reason === r.value && styles.reasonRowActive]}
              onPress={() => setReason(r.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === r.value }}
            >
              <Text style={styles.reasonLabel}>{r.label}</Text>
              <Text style={styles.reasonDesc}>{r.desc}</Text>
            </Pressable>
          ))}

          <Text style={styles.subtitle}>
            {reason === 'other' ? 'Notes (required)' : 'Notes (optional)'}
          </Text>
          <TextInput
            style={styles.notesInput}
            multiline
            maxLength={MAX_NOTES}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add details that help moderators review this report"
            selectionColor={colors.primary}
            cursorColor={colors.primary}
          />
          <Text style={styles.counter}>
            {notes.length}/{MAX_NOTES}
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, (!reason || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!reason || submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit report'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
    marginTop: 8,
  },
  reasonRow: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  reasonRowActive: {
    borderColor: '#1976d2',
    backgroundColor: '#eef5ff',
  },
  reasonLabel: {
    fontWeight: '600',
    marginBottom: 2,
  },
  reasonDesc: {
    color: '#555',
    fontSize: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 10,
    minHeight: 80,
    padding: 10,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#c62828',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
});
