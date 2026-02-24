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
    backgroundColor: '#FFF8E1',
    borderColor: '#F1C40F',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    color: '#5D4037',
    marginBottom: 6,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    color: '#154734',
    fontWeight: '600',
  },
});
