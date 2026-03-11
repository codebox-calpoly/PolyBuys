import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { motion } from '../theme/motion';
import { colors, typography, borderRadius, spacing } from '../theme/tokens';
import { useResolvedImageUrls } from '../hooks/useResolvedImageUrls';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** IDs of listings that have already played entrance animation (avoids re-animation on list recycle).
 * Uses LRU eviction to prevent unbounded growth during long sessions. */
const MAX_ANIMATED_CACHE = 200;
const animatedListingIds = new Map<string, void>();

function markAsAnimated(id: string): void {
  if (animatedListingIds.size >= MAX_ANIMATED_CACHE) {
    const first = animatedListingIds.keys().next().value;
    if (first !== undefined) animatedListingIds.delete(first);
  }
  animatedListingIds.set(id, undefined);
}

export type ListingCardBadge = 'sold' | 'unavailable';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    price: number;
    description: string;
    tags?: string[];
    images?: string[];
  };
  index?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** @deprecated Use badge instead. When true and badge is unset, shows "Unavailable". */
  showUnavailableBadge?: boolean;
  /** Explicit badge: "Sold" or "Unavailable" with distinct styling */
  badge?: ListingCardBadge;
  /** When provided, called instead of default navigation (e.g. for search to add recent) */
  onPress?: (listing: ListingCardProps['listing']) => void;
  /** Optional footer below the price (e.g. status chip + Edit for My Listings) */
  footer?: ReactNode;
}

export default function ListingCard({
  listing,
  index = 0,
  isSaved = false,
  onToggleSave,
  showUnavailableBadge = false,
  badge,
  onPress: onPressProp,
  footer,
}: ListingCardProps) {
  const badgeToShow = badge ?? (showUnavailableBadge ? 'unavailable' : undefined);
  const router = useRouter();
  const { mappedUrls } = useResolvedImageUrls(listing.images ?? []);
  const imageUrl = mappedUrls[0];
  const [isHovered, setIsHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  const alreadyAnimated = animatedListingIds.has(listing._id);
  const shouldAnimate = !alreadyAnimated && !reduceMotion;

  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(shouldAnimate ? motion.distance : 0)).current;

  useEffect(() => {
    if (!shouldAnimate) return;

    const delay = Math.min(index * motion.delayPerItem, motion.maxStaggerDelay);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration,
        delay,
        easing: motion.easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.duration,
        delay,
        easing: motion.easing,
        useNativeDriver: true,
      }),
    ]);

    anim.start(() => markAsAnimated(listing._id));
    return () => anim.stop();
  }, [listing._id, index, shouldAnimate, opacity, translateY]);

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
        style={(state) => [
          styles.listingCard,
          isHovered && styles.listingCardHover,
          state.pressed && styles.listingCardPressed,
        ]}
        onPress={() =>
          onPressProp ? onPressProp(listing) : router.push(`/listings/${listing._id}`)
        }
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        accessibilityLabel={`${listing.title}, $${listing.price}`}
        accessibilityRole="button"
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
          {onToggleSave && (
            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleSave();
              }}
              accessibilityLabel={isSaved ? 'Unsave listing' : 'Save listing'}
              accessibilityRole="button"
            >
              <Text style={[styles.saveIcon, isSaved && styles.saveIconActive]}>
                {isSaved ? '♥' : '♡'}
              </Text>
            </Pressable>
          )}
          {badgeToShow && (
            <View
              style={[
                styles.statusBadge,
                badgeToShow === 'sold' ? styles.statusBadgeSold : styles.statusBadgeUnavailable,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {badgeToShow === 'sold' ? 'Sold' : 'Unavailable'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.listingPrice}>${listing.price}</Text>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Pressable>
    </Animated.View>
  );
}

const CARD_IMAGE_ASPECT = 170 / 145;

const styles = StyleSheet.create({
  listingCardWrapper: {
    marginBottom: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  listingCard: {
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listingCardHover: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  listingCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    width: '100%',
    aspectRatio: CARD_IMAGE_ASPECT,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    position: 'relative',
  },
  saveButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIcon: {
    fontSize: 16,
    color: colors.text,
  },
  saveIconActive: {
    color: colors.category,
  },
  statusBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeSold: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusBadgeUnavailable: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  statusBadgeText: {
    ...typography.footnote,
    color: colors.white,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    ...typography.footnote,
    color: colors.text,
  },
  listingTitle: {
    ...typography.body,
    color: colors.primary,
    marginBottom: 2,
    paddingHorizontal: spacing.sm,
  },
  listingPrice: {
    ...typography.title2,
    fontSize: 17,
    color: colors.accent,
    paddingHorizontal: spacing.sm,
  },
  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
