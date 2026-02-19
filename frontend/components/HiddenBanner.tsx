import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

//Modify to actual support email
const SUPPORT_EMAIL = 'support@polybuys.com';

export default function HiddenBanner() {
  const onAppealPress = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`);

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
