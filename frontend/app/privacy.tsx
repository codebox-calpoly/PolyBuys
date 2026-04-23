import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { PRIVACY_POLICY_URL } from '../constants/app';
import { openExternalUrl } from '../utils/openExternalUrl';

export default function PrivacyRoute() {
  useEffect(() => {
    void openExternalUrl(PRIVACY_POLICY_URL, 'Unable to open Privacy Policy');
  }, []);
  return <Redirect href="/home" />;
}
