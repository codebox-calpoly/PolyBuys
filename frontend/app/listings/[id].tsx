import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useFlash } from '../../contexts/FlashContext';
import { getConvexErrorDisplay } from '../../lib/convexError';
import { useAuth } from '../../hooks/useAuth';
import HiddenBanner from '../../components/HiddenBanner';
import ListingUnavailable from '../../components/ListingUnavailable';
import { ReportModal } from '../../components/ReportModal';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';

type FeedTabHref = '/' | '/search' | '/settings';
const DEFAULT_APP_ORIGIN = 'https://polybuys.com';

function getAppOrigin() {
  const configuredOrigin = process.env.EXPO_PUBLIC_APP_ORIGIN?.trim();
  if (!configuredOrigin) {
    return DEFAULT_APP_ORIGIN;
  }

  return configuredOrigin.endsWith('/') ? configuredOrigin.slice(0, -1) : configuredOrigin;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = typeof id === 'string' && id.trim().length > 0 ? id : null;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const appOrigin = getAppOrigin();

  const listing = useQuery(
    api.listings.getListing,
    listingId ? { id: listingId as Id<'listings'> } : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );
  const getOrCreateConversation = useMutation(api.messages.getOrCreateConversation);
  const [reportOpen, setReportOpen] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const { setFlash } = useFlash();
  const { mappedUrls } = useResolvedImageUrls(listing?.images ?? []);

  const navigateToFeedWithTag = (tag: string) => {
    router.push({
      pathname: '/' as FeedTabHref,
      params: { tags: tag },
    });
  };

  const onMessageSellerPress = async () => {
    if (!listing) {
      return;
    }

    if (!isAuthenticated) {
      const redirectTo = `/listings/${listing._id}`;
      router.push(`/auth/login?returnTo=${encodeURIComponent(redirectTo)}` as never);
      return;
    }

    if (isStartingConversation) {
      return;
    }

    try {
      setConversationError(null);
      setIsStartingConversation(true);
      const convo = await getOrCreateConversation({ listingId: listing._id });
      router.push({
        pathname: '/conversations/[id]',
        params: { id: String(convo.conversationId) },
      });
    } catch (error) {
      const { message } = getConvexErrorDisplay(error, 'Couldn’t start conversation');
      setConversationError(message);
    } finally {
      setIsStartingConversation(false);
    }
  };

  const shareListing = async () => {
    if (!listing) {
      return;
    }
    setShareError(null);
    const shareUrl = `${appOrigin}/l/${listing._id}`;
    try {
      await Share.share({
        message: `${listing.title} - $${listing.price}\n${shareUrl}`,
        url: shareUrl,
        title: listing.title,
      });
    } catch {
      setShareError('Unable to share right now. Try again.');
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && listing && typeof document !== 'undefined') {
      document.title = `${listing.title} - PolyBuys`;
    }
  }, [listing]);

  if (!listingId) {
    return <ListingUnavailable />;
  }

  if (listing === undefined || (isAuthenticated && currentUserSubject === undefined)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.loadingText}>Loading listing...</Text>
      </View>
    );
  }

  if (listing === null) {
    return <ListingUnavailable />;
  }

  const isOwner = currentUserSubject === listing.sellerId;
  const isHidden = listing.isHidden === true;
  const isHiddenOwnerView = isOwner && isHidden;

  if (isHidden && !isOwner) {
    return <ListingUnavailable />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Head>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <title>{`${listing.title} - PolyBuys`}</title>
        <meta property="og:title" content={`${listing.title} - PolyBuys`} />
        <meta
          property="og:description"
          content={`$${listing.price} - ${listing.description.substring(0, 100)}${listing.description.length > 100 ? '...' : ''}`}
        />
        <meta property="og:url" content={`${appOrigin}/listings/${listing._id}`} />
      </Head>

      {Platform.OS === 'web' && (
        <View style={styles.webBannerContainer}>
          <Text style={styles.webBannerText}>Experience PolyBuys on mobile!</Text>
          <Pressable
            style={({ pressed }) => [styles.webBannerButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void Linking.openURL(`polybuys://listings/${listing._id}`);
            }}
          >
            <Text style={styles.webBannerButtonText}>Open in App</Text>
          </Pressable>
        </View>
      )}

      <Animated.View style={[styles.card, entranceStyle]}>
        {isHiddenOwnerView && <HiddenBanner />}

        {listing.images.length > 0 && mappedUrls[0] ? (
          <Image source={{ uri: mappedUrls[0] }} style={styles.heroImage} resizeMode="cover" />
        ) : listing.images.length > 0 ? (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>Loading image...</Text>
          </View>
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No image provided</Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.price}>${listing.price}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void shareListing();
            }}
          >
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>
        </View>
        {shareError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{shareError}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{listing.category}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaLabel}>Condition</Text>
            <Text style={styles.metaValue}>{listing.condition}</Text>
          </View>
        </View>

        <Text style={styles.description}>{listing.description}</Text>

        {listing.tags && listing.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {listing.tags.map((tag) => (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.tag, pressed && styles.tagPressed]}
                onPress={() => navigateToFeedWithTag(tag)}
              >
                <Text style={styles.tagText}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isOwner && !isHidden && (
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
              onPress={() => router.push(`/listings/${listing._id}/edit`)}
            >
              <Text style={styles.editButtonText}>Edit Listing</Text>
            </Pressable>
          </View>
        )}

        {!isOwner && (
          <>
            {conversationError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{conversationError}</Text>
              </View>
            ) : null}
            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.messageButton,
                  isStartingConversation && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  void onMessageSellerPress();
                }}
                disabled={isStartingConversation}
              >
                <Text style={styles.messageButtonText}>Message Seller</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.reportButton, pressed && styles.buttonPressed]}
                onPress={() => setReportOpen(true)}
              >
                <Text style={styles.reportButtonText}>Report listing</Text>
              </Pressable>
            </View>
          </>
        )}

        <ReportModal
          isVisible={reportOpen}
          onClose={() => setReportOpen(false)}
          onSuccess={setFlash}
          targetId={String(listing._id)}
          targetType="listing"
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f7f5',
    gap: 8,
  },
  loadingText: {
    color: '#5f7268',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 28,
  },
  webBannerContainer: {
    marginBottom: 12,
    backgroundColor: '#e8f4ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cae3ff',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  webBannerText: {
    color: '#1f4e80',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  webBannerButton: {
    backgroundColor: '#1f6fb2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  webBannerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  heroImage: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#e8ece9',
  },
  placeholderImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#edf2ef',
    borderWidth: 1,
    borderColor: '#dce6e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#7a8a83',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
    color: '#0f2b21',
  },
  shareButton: {
    backgroundColor: '#edf4ff',
    borderWidth: 1,
    borderColor: '#d2dff8',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  shareButtonText: {
    color: '#2d5ab5',
    fontWeight: '600',
    fontSize: 14,
  },
  price: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1a7f4d',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metaChip: {
    backgroundColor: '#f7faf8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e5df',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6f8178',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 15,
    color: '#1f3c30',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#41594f',
    marginBottom: 18,
    lineHeight: 24,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  tag: {
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d5e4ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  tagText: {
    color: '#2f5fbd',
    fontSize: 14,
    fontWeight: '500',
  },
  errorBanner: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  buttonContainer: {
    marginTop: 8,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#154734',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#154734',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    borderWidth: 1,
    borderColor: '#c62828',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#c62828',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  tagPressed: {
    opacity: 0.85,
  },
});
