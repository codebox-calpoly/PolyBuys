import { Redirect } from 'expo-router';

/**
 * Sign-in and sign-up are only supported in the native app. Web visitors hitting
 * /auth/login (bookmark, deep link, or in-app navigation) are sent to the landing page.
 */
export default function LoginWebRedirect() {
  return <Redirect href="/" />;
}
