import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Redirect } from 'expo-router';
import { PRIVACY_POLICY_URL } from '../constants/app';

export default function PrivacyRoute() {
  useEffect(() => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  }, []);
  return <Redirect href="/home" />;
}
