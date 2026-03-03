import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ShortListingRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Invalid or missing ID - redirect to home
  if (typeof id !== 'string' || id.trim().length === 0) {
    return <Redirect href="/" />;
  }

  return <Redirect href={`/listings/${encodeURIComponent(id.trim())}`} />;
}
