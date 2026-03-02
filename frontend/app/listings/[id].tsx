import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';
import ListingUnavailable from '../../components/ListingUnavailable';
import HiddenBanner from '../../components/HiddenBanner';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const listingId = typeof id === 'string' && id.trim().length > 0 ? id : null;
  const listing = useQuery(
    api.listings.getListing,
    listingId ? { id: listingId as Id<'listings'> } : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );
  const getOrCreateConversation = useMutation(api.messages.getOrCreateConversation);

  const navigateToFeedWithTag = (tag: string) => {
    router.push({
      pathname: '/',
      params: { tags: tag },
    });
  };

  const openConversation = async () => {
    if (!listing) return;
    try {
      const convo = await getOrCreateConversation({ listingId: listing._id });
      router.push({
        pathname: '/messages/[id]',
        params: { id: String(convo.conversationId) },
      });
    } catch {
      Alert.alert('Unable to start conversation right now.');
    }
  };

  const shareListing = async () => {
    if (!listing) return;

    // Use current origin for web, fallback to polybuys.com for native
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://polybuys.com';
    const shareUrl = `${origin}/l/${listing._id}`;

    try {
      if (Platform.OS === 'web') {
        // On web, copy the URL to clipboard
        await navigator.clipboard.writeText(shareUrl);
        Alert.alert('Link Copied', 'Share link copied to clipboard!');
      } else {
        // On native, share just the URL
        await Share.share({
          url: shareUrl,
          message: shareUrl,
        });
      }
    } catch {
      Alert.alert('Unable to share listing right now.');
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
      <View style={styles.container}>
        <Text>Loading...</Text>
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
    <ScrollView style={styles.container}>
      <Head>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <title>{`${listing.title} - PolyBuys`}</title>
        <meta property="og:title" content={`${listing.title} - PolyBuys`} />
        <meta
          property="og:description"
          content={`$${listing.price} - ${listing.description.substring(0, 100)}${listing.description.length > 100 ? '...' : ''}`}
        />
        <meta property="og:url" content={`https://polybuys.com/listings/${listing._id}`} />
      </Head>

      {Platform.OS === 'web' && (
        <View style={styles.webBannerContainer}>
          <Text style={styles.webBannerText}>Experience PolyBuys on mobile!</Text>
          <TouchableOpacity
            style={styles.webBannerButton}
            onPress={() => Linking.openURL(`polybuys://listings/${listing._id}`)}
          >
            <Text style={styles.webBannerButtonText}>Open in App</Text>
          </TouchableOpacity>
        </View>
      )}

      {isHiddenOwnerView && <HiddenBanner />}

      {listing.images && listing.images.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageCarousel}
        >
          {listing.images.map((imageUrl, index) => (
            <Image
              key={index}
              source={{ uri: imageUrl }}
              style={styles.carouselImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.title}>{listing.title}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={shareListing}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.price}>${listing.price}</Text>
      <Text style={styles.description}>{listing.description}</Text>

      {listing.tags && listing.tags.length > 0 && (
        <View style={styles.tagContainer}>
          {listing.tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.tag}
              onPress={() => navigateToFeedWithTag(tag)}
            >
              <Text style={styles.tagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isOwner && !isHidden && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/listings/${listing._id}/edit`)}
          >
            <Text style={styles.editButtonText}>Edit Listing</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAuthenticated ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => {
              const redirectTo = `/listings/${listing._id}`;
              router.push(`/auth/login?returnTo=${encodeURIComponent(redirectTo)}` as never);
            }}
          >
            <Text style={styles.messageButtonText}>Sign in to message seller</Text>
          </TouchableOpacity>
        </View>
      ) : currentUserSubject && currentUserSubject !== listing.sellerId ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.messageButton} onPress={openConversation}>
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  imageCarousel: {
    marginHorizontal: -20,
    marginBottom: 20,
  },
  carouselImage: {
    width: Platform.OS === 'web' ? 600 : 375,
    height: 300,
    backgroundColor: '#e0e0e0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    lineHeight: 24,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  webBannerContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  webBannerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  webBannerButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  webBannerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
