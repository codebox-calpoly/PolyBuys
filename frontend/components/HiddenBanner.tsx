import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';

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
      <TouchableOpacity onPress={onAppealPress}>
        <Text style={styles.link}>Contact support to appeal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff9eb',
    borderColor: '#f0d37a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    color: '#6c4f20',
    marginBottom: 8,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    color: '#8a5a00',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
