import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { TERMS_OF_SERVICE_URL } from '../constants/app';
import { openExternalUrl } from '../utils/openExternalUrl';

export default function TermsRoute() {
  useEffect(() => {
    void openExternalUrl(TERMS_OF_SERVICE_URL, 'Unable to open Terms of Service');
  }, []);
  return <Redirect href="/home" />;
}
