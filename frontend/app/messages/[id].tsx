import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyMessagesRouteRedirect() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = typeof id === 'string' && id.trim().length > 0 ? id : null;

  if (!conversationId) {
    return <Redirect href="/inbox" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/conversations/[id]',
        params: { id: conversationId },
      }}
    />
  );
}
