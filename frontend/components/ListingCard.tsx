import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    price: number;
    description: string;
    tags?: string[];
  };
  index?: number;
}

export default function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const router = useRouter();
  const displayTags = listing.tags?.slice(0, 3) || [];
  const hasMoreTags = listing.tags && listing.tags.length > 3;
  const [isHovered, setIsHovered] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const delay = Math.min(index * 45, 240);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [index, opacity, translateY]);

  const animatedStyle = useMemo(
    () => ({
      opacity,
      transform: [{ translateY }],
    }),
    [opacity, translateY]
  );

  return (
    <Animated.View style={[styles.listingCardWrapper, animatedStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.listingCard,
          isHovered && styles.listingCardHover,
          pressed && styles.listingCardPressed,
        ]}
        onPress={() => router.push(`/listings/${listing._id}`)}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
      >
        <View style={styles.headerRow}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <View style={styles.pricePill}>
            <Text style={styles.listingPrice}>${listing.price}</Text>
          </View>
        </View>

        <Text style={styles.listingDescription} numberOfLines={2}>
          {listing.description}
        </Text>

        {(displayTags.length > 0 || hasMoreTags) && (
          <View style={styles.tagsContainer}>
            {displayTags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
            {hasMoreTags && <Text style={styles.tagCount}>+{listing.tags!.length - 3} more</Text>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  listingCardWrapper: {
    marginBottom: 14,
  },
  listingCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e9e6',
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  listingCardHover: {
    borderColor: '#b8d2c7',
    transform: [{ translateY: -2 }],
  },
  listingCardPressed: {
    transform: [{ scale: 0.995 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f2b21',
    flex: 1,
  },
  pricePill: {
    backgroundColor: '#e9f7ef',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a7f4d',
  },
  listingDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#50635b',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d5e4ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: {
    color: '#2f5fbd',
    fontSize: 12,
    fontWeight: '500',
  },
  tagCount: {
    color: '#6a7570',
    fontSize: 12,
    fontWeight: '600',
  },
});
