import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { getConvexErrorDisplay } from '../lib/convexError';

type ReportReason = 'scam' | 'inappropriate' | 'spam';

type ReportModalProps = {
  isVisible: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'listing' | 'profile';
};

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'scam', label: 'Scam', desc: 'Fraudulent listing or deceptive behavior' },
  { value: 'inappropriate', label: 'Inappropriate', desc: 'Offensive or policy-violating content' },
  { value: 'spam', label: 'Spam', desc: 'Low-quality, duplicate, or irrelevant posting' },
];

const MAX_NOTES = 500;

export function ReportModal({ isVisible, onClose, targetId, targetType }: ReportModalProps) {
  const createReport = useMutation(api.reports.createReport);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const reset = () => {
    setReason(null);
    setNotes('');
    setSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await createReport({
        targetId,
        targetType,
        reason,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      setSubmitSuccess(true);
      setTimeout(handleClose, 1200);
    } catch (err) {
      const { message } = getConvexErrorDisplay(err, 'Could not submit report');
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Report listing</Text>
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

          <Text style={styles.subtitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            maxLength={MAX_NOTES}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add details that help moderators review this report"
          />
          <Text style={styles.counter}>
            {notes.length}/{MAX_NOTES}
          </Text>

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}
          {submitSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>Thanks for helping keep PolyBuys safe.</Text>
            </View>
          ) : null}

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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  errorBanner: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  successBanner: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successText: {
    fontSize: 14,
    color: '#166534',
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
