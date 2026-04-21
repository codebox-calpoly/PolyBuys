import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardUnderlay } from './ui';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { motion } from '../theme/motion';
import { colors } from '../theme/tokens';

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
const SHEET_TOP_MARGIN = 24;

export function PriceRangePicker({
  visible,
  minPrice,
  maxPrice,
  onApply,
  onClose,
}: PriceRangePickerProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const entranceStyle = useEntranceAnimation(40, 8);
  const [min, setMin] = useState<string>(minPrice?.toString() ?? '');
  const [max, setMax] = useState<string>(maxPrice?.toString() ?? '');
  const [error, setError] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [shouldKeepInputsVisible, setShouldKeepInputsVisible] = useState(false);
  const prevVisibleRef = useRef(visible);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const availableSheetHeight = Math.max(windowHeight - insets.top - SHEET_TOP_MARGIN, 0);
  const sheetMaxHeight = Math.max(availableSheetHeight - keyboardHeight, 0);

  // Reset inputs only when modal transitions from closed to open
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setMin(minPrice?.toString() ?? '');
      setMax(maxPrice?.toString() ?? '');
      setError('');
    }
    prevVisibleRef.current = visible;
  }, [visible, minPrice, maxPrice]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setShouldKeepInputsVisible(false);
      keyboardOffset.stopAnimation();
      keyboardOffset.setValue(0);
      return;
    }

    const animateKeyboardOffset = (toValue: number, duration?: number) => {
      keyboardOffset.stopAnimation();
      Animated.timing(keyboardOffset, {
        toValue,
        duration: duration ?? motion.duration,
        easing: motion.easing,
        useNativeDriver: false,
      }).start();
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextKeyboardHeight = Math.max(event.endCoordinates.height, 0);
      setKeyboardHeight(nextKeyboardHeight);
      animateKeyboardOffset(nextKeyboardHeight, event.duration);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      setKeyboardHeight(0);
      animateKeyboardOffset(0, event.duration);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardOffset, visible]);

  useEffect(() => {
    if (!visible || keyboardHeight === 0 || !shouldKeepInputsVisible) {
      return;
    }

    const timeout = setTimeout(
      () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      },
      Platform.OS === 'ios' ? 80 : 0
    );

    return () => clearTimeout(timeout);
  }, [keyboardHeight, shouldKeepInputsVisible, visible]);

  const handleCustomInputFocus = () => {
    setShouldKeepInputsVisible(true);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close price filter"
        />
        <KeyboardUnderlay keyboardHeight={keyboardHeight} backgroundColor={colors.white} />
        <View style={styles.sheetContainer}>
          <Animated.View
            style={[
              styles.sheetLift,
              {
                transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.sheet,
                entranceStyle,
                {
                  maxHeight: sheetMaxHeight,
                },
              ]}
            >
              <View style={styles.sheetTapArea}>
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.scrollView}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={[
                    styles.scrollContent,
                    {
                      paddingBottom: Math.max(insets.bottom, 16),
                    },
                  ]}
                >
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
                        onFocus={handleCustomInputFocus}
                        placeholder="$0"
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                        selectionColor={colors.primary}
                        cursorColor={colors.primary}
                      />
                    </View>
                    <Text style={styles.separator}>–</Text>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Max</Text>
                      <TextInput
                        style={styles.input}
                        value={max}
                        onChangeText={setMax}
                        onFocus={handleCustomInputFocus}
                        placeholder="Any"
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                        selectionColor={colors.primary}
                        cursorColor={colors.primary}
                      />
                    </View>
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheetContainer: {
    justifyContent: 'flex-end',
    width: '100%',
    maxHeight: '100%',
  },
  sheetLift: {
    width: '100%',
    maxHeight: '100%',
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetTapArea: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6e1',
    paddingHorizontal: 20,
    maxHeight: '100%',
    flexShrink: 1,
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
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
