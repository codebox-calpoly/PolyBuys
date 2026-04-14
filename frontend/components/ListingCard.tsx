import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { motion } from '../theme/motion';
import { formatPrice } from '../lib/formatPrice';
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

export type ListingCardDensity = 'default' | 'home';

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
  /** Density variant: "home" for home tab (denser, tighter layout); "default" for other screens */
  density?: ListingCardDensity;
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
  density = 'default',
}: ListingCardProps) {
  const badgeToShow = badge ?? (showUnavailableBadge ? 'unavailable' : undefined);
  const router = useRouter();
  const { mappedUrls } = useResolvedImageUrls(listing.images ?? []);
  const imageUrl = mappedUrls[0];
  const [isHovered, setIsHovered] = useState(false);
  const { reduceMotion, isResolved: isReducedMotionResolved } = useReducedMotion();

  const alreadyAnimated = animatedListingIds.has(listing._id);
  const shouldAnimate = isReducedMotionResolved && !alreadyAnimated && !reduceMotion;

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

  const isHomeDensity = density === 'home';
  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View
      style={[
        styles.listingCardWrapper,
        isHomeDensity && styles.listingCardWrapperHome,
        animatedStyle,
      ]}
    >
      <View style={styles.cardContainer}>
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
          accessibilityLabel={`${listing.title}, $${formatPrice(listing.price)}${badgeToShow ? `, ${badgeToShow === 'sold' ? 'Sold' : 'Unavailable'}` : ''}`}
          accessibilityRole="button"
        >
          <View
            style={[
              styles.imageContainer,
              isHomeDensity && styles.imageContainerHome,
              isHomeDensity && isWeb && styles.imageContainerHomeWeb,
            ]}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>No image</Text>
              </View>
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
          <View style={[styles.titlePriceRow, isHomeDensity && styles.titlePriceRowHome]}>
            <Text
              style={[styles.listingTitle, isHomeDensity && styles.listingTitleHome]}
              numberOfLines={1}
            >
              {listing.title}
            </Text>
            <Text
              style={[styles.listingPrice, isHomeDensity && styles.listingPriceHome]}
              numberOfLines={1}
            >
              ${formatPrice(listing.price)}
            </Text>
          </View>
        </Pressable>
        {onToggleSave && (
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }]}
            onPress={onToggleSave}
            accessibilityLabel={`${isSaved ? 'Unsave' : 'Save'} listing: ${listing.title?.trim() || listing._id || 'listing'}`}
            accessibilityRole="button"
          >
            <Text style={[styles.saveIcon, isSaved && styles.saveIconActive]}>
              {isSaved ? '♥' : '♡'}
            </Text>
          </Pressable>
        )}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const CARD_IMAGE_ASPECT = 170 / 145;
/** Slightly taller than square for a premium, image-forward layout */
const HOME_IMAGE_ASPECT = 0.9;
const HOME_IMAGE_ASPECT_WEB = 1.22;

const styles = StyleSheet.create({
  listingCardWrapper: {
    marginBottom: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  listingCardWrapperHome: {
    marginBottom: 6,
  },
  cardContainer: {
    position: 'relative',
  },
  listingCard: {
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 10px 24px rgba(21, 71, 52, 0.08)',
  },
  listingCardHover: {
    borderColor: colors.locationDark,
    boxShadow: '0 18px 36px rgba(21, 71, 52, 0.14)',
    transform: [{ translateY: -2 }],
  },
  listingCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    width: '100%',
    aspectRatio: CARD_IMAGE_ASPECT,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainerHome: {
    aspectRatio: HOME_IMAGE_ASPECT,
  },
  imageContainerHomeWeb: {
    aspectRatio: HOME_IMAGE_ASPECT_WEB,
  },
  saveButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIcon: {
    fontSize: 15,
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
  titlePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  titlePriceRowHome: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  listingTitle: {
    ...typography.body,
    color: colors.primary,
    flex: 1,
    minWidth: 0,
  },
  listingTitleHome: {
    ...typography.subhead,
    fontWeight: '600',
  },
  listingPrice: {
    ...typography.title2,
    fontSize: 17,
    color: colors.accent,
    flexShrink: 0,
  },
  listingPriceHome: {
    fontSize: 16,
  },
  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
