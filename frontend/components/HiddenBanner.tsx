import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/tokens';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@polybuys.com';

export default function HiddenBanner() {
  const onAppealPress = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert('Unable to open email app', `Please contact support at ${SUPPORT_EMAIL}.`);
    });
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>This listing has been hidden due to reports.</Text>
      <TouchableOpacity
        onPress={onAppealPress}
        accessibilityLabel="Contact support to appeal"
        accessibilityRole="button"
      >
        <Text style={styles.link}>Contact support to appeal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 14,
    color: colors.warningText,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    color: colors.warningLink,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
