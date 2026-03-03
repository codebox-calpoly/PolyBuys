import { Redirect, useLocalSearchParams } from 'expo-router';
import { normalizeConvexId } from '../../utils/convexId';

export default function ShortListingRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const normalizedId = normalizeConvexId(id);

  if (!normalizedId) {
    return <Redirect href="/" />;
  }

  return <Redirect href={`/listings/${encodeURIComponent(normalizedId)}`} />;
}
