import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    price: number;
    description: string;
    images?: string[];
    tags?: string[];
  };
}

export default function ListingCard({ listing }: ListingCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width > 1024;
  const displayTags = listing.tags?.slice(0, 2) || [];
  const uniqueTags = Array.from(new Set(displayTags));
  const hasMoreTags = listing.tags && listing.tags.length > 2;
  const firstImage = listing.images?.[0];

  return (
    <TouchableOpacity
      style={[
        styles.listingCard,
        isWeb && !isDesktop && styles.webListingCard,
        isDesktop && styles.desktopListingCard,
      ]}
      onPress={() => router.push(`/listings/${listing._id}`)}
    >
      {firstImage && (
        <Image source={{ uri: firstImage }} style={styles.listingImage} resizeMode="cover" />
      )}
      <Text style={styles.listingTitle}>{listing.title}</Text>
      <Text style={styles.listingPrice}>${listing.price}</Text>
      <Text style={styles.listingDescription} numberOfLines={2}>
        {listing.description}
      </Text>

      {(uniqueTags.length > 0 || hasMoreTags) && (
        <View style={styles.tagsContainer}>
          {uniqueTags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
          {hasMoreTags && <Text style={styles.tagCount}>+{listing.tags!.length - 2} more</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listingCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  webListingCard: {
    marginHorizontal: 0,
  },
  desktopListingCard: {
    flex: 1,
    minWidth: 0,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  listingImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#e0e0e0',
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: '#1976d2',
    fontSize: 12,
  },
  tagCount: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
