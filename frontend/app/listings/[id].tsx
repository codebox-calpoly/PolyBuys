import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';
import ListingUnavailable from '../../components/ListingUnavailable';
import HiddenBanner from '../../components/HiddenBanner';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const listing = useQuery(api.listings.getListing, {
    id: id as Id<'listings'>,
  });
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );

  const navigateToFeedWithTag = (tag: string) => {
    router.push({
      pathname: '/',
      params: { tags: tag },
    });
  };

  useEffect(() => {
    if (Platform.OS === 'web' && listing && typeof document !== 'undefined') {
      document.title = `${listing.title} - PolyBuys`;
    }
  }, [listing]);

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
      {isHiddenOwnerView && <HiddenBanner />}

      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.price}>${listing.price}</Text>
      <Text style={styles.description}>{listing.description}</Text>

      {listing.tags && listing.tags.length > 0 && (
        <View style={styles.tagContainer}>
          {listing.tags.map((tag) => (
            <TouchableOpacity key={tag} style={styles.tag} onPress={() => navigateToFeedWithTag(tag)}>
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
          <TouchableOpacity style={styles.messageButton} onPress={() => {}}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
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
});
