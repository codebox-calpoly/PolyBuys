import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Redirect } from 'expo-router';
import { TERMS_OF_SERVICE_URL } from '../constants/app';

export default function TermsRoute() {
  useEffect(() => {
    void Linking.openURL(TERMS_OF_SERVICE_URL);
  }, []);
  return <Redirect href="/home" />;
}
