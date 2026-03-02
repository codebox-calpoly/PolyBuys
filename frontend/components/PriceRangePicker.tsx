import React, { useState, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

interface PriceRangePickerProps {
  visible: boolean;
  minPrice?: number;
  maxPrice?: number;
  onApply: (minPrice?: number, maxPrice?: number) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Under $25', min: undefined, max: 25 },
  { label: 'Under $50', min: undefined, max: 50 },
  { label: 'Under $100', min: undefined, max: 100 },
  { label: 'Any Price', min: undefined, max: undefined },
];

export function PriceRangePicker({
  visible,
  minPrice,
  maxPrice,
  onApply,
  onClose,
}: PriceRangePickerProps) {
  const entranceStyle = useEntranceAnimation(40, 8);
  const [min, setMin] = useState<string>(minPrice?.toString() ?? '');
  const [max, setMax] = useState<string>(maxPrice?.toString() ?? '');
  const [error, setError] = useState<string>('');
  const prevVisibleRef = React.useRef(visible);

  // Reset inputs only when modal transitions from closed to open
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setMin(minPrice?.toString() ?? '');
      setMax(maxPrice?.toString() ?? '');
      setError('');
    }
    prevVisibleRef.current = visible;
  }, [visible, minPrice, maxPrice]);

  const handleApply = () => {
    // Trim and treat empty/whitespace-only as undefined
    const minTrimmed = min.trim();
    const maxTrimmed = max.trim();

    // Parse values - empty strings become undefined
    const minVal = minTrimmed ? parseFloat(minTrimmed) : undefined;
    const maxVal = maxTrimmed ? parseFloat(maxTrimmed) : undefined;

    // Validate that parsed values are finite numbers (not NaN or Infinity)
    if (minVal !== undefined && !Number.isFinite(minVal)) {
      setError('Please enter a valid minimum price');
      return;
    }
    if (maxVal !== undefined && !Number.isFinite(maxVal)) {
      setError('Please enter a valid maximum price');
      return;
    }

    // Validate non-negative values
    if (minVal !== undefined && minVal < 0) {
      setError('Minimum price cannot be negative');
      return;
    }
    if (maxVal !== undefined && maxVal < 0) {
      setError('Maximum price cannot be negative');
      return;
    }

    // Validate max >= min
    if (maxVal !== undefined && minVal !== undefined && maxVal < minVal) {
      setError('Maximum must be greater than minimum');
      return;
    }

    setError('');
    onApply(minVal, maxVal);
    onClose();
  };

  const handlePreset = (preset: { min?: number; max?: number }) => {
    onApply(preset.min, preset.max);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.sheet, entranceStyle]}>
          <Pressable style={styles.sheetTapArea} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>Price Range</Text>

            {/* Quick Presets */}
            <View style={styles.presetsContainer}>
              {PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetButton}
                  onPress={() => handlePreset(preset)}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Range Inputs */}
            <Text style={styles.sectionTitle}>Custom Range</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Min</Text>
                <TextInput
                  style={styles.input}
                  value={min}
                  onChangeText={setMin}
                  placeholder="$0"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
              <Text style={styles.separator}>–</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Max</Text>
                <TextInput
                  style={styles.input}
                  value={max}
                  onChangeText={setMax}
                  placeholder="Any"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetTapArea: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6e1',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
    color: '#153428',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f4f8f6',
    borderWidth: 1,
    borderColor: '#dbe6e1',
    borderRadius: 20,
  },
  presetText: {
    fontSize: 14,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dfd9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9fbfa',
  },
  separator: {
    fontSize: 18,
    color: '#999',
    marginHorizontal: 12,
    marginTop: 16,
  },
  error: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 12,
  },
  applyButton: {
    backgroundColor: '#154734',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
