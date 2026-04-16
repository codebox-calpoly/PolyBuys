import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { motion } from '../theme/motion';
import { formatPrice } from '../lib/formatPrice';
import { buildDescriptionPreview } from '../lib/listingDescriptionPreview';
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

function formatConditionLabel(condition?: 'new' | 'used' | 'refurbished'): string | null {
  if (!condition) return null;
  switch (condition) {
    case 'new':
      return 'New';
    case 'used':
      return 'Used';
    case 'refurbished':
      return 'Refurbished';
    default:
      return null;
  }
}

export type ListingCardBadge = 'sold' | 'unavailable';

export type ListingCardDensity = 'default' | 'home';
export type ListingCardShellStyle = 'default' | 'flat';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    price: number;
    description: string;
    images?: string[];
    condition?: 'new' | 'used' | 'refurbished';
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
  /** Visual shell style: "flat" removes card surface/shadow for Home feed alignment */
  shellStyle?: ListingCardShellStyle;
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
  shellStyle = 'default',
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
  const isFlatShell = shellStyle === 'flat';
  const isWeb = Platform.OS === 'web';
  const conditionLabel = formatConditionLabel(listing.condition);
  const titleLines = isHomeDensity ? 2 : 3;
  const descriptionPreview = useMemo(
    () => buildDescriptionPreview(listing.description),
    [listing.description]
  );

  const accessibilityDescriptionHint = useMemo(() => {
    const raw =
      descriptionPreview.kind === 'plain'
        ? descriptionPreview.text
        : descriptionPreview.kind === 'bullets'
          ? descriptionPreview.items.join('. ')
          : '';
    if (raw.length <= 160) {
      return raw;
    }
    return `${raw.slice(0, 157)}…`;
  }, [descriptionPreview]);

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
            isFlatShell && styles.listingCardFlat,
            isHovered && !isFlatShell && styles.listingCardHover,
            state.pressed && styles.listingCardPressed,
          ]}
          onPress={() =>
            onPressProp ? onPressProp(listing) : router.push(`/listings/${listing._id}`)
          }
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          accessibilityLabel={`${listing.title}, $${formatPrice(listing.price)}${conditionLabel ? `, ${conditionLabel}` : ''}${accessibilityDescriptionHint ? `, ${accessibilityDescriptionHint}` : ''}${badgeToShow ? `, ${badgeToShow === 'sold' ? 'Sold' : 'Unavailable'}` : ''}`}
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
          <View style={[styles.cardDetails, isHomeDensity && styles.cardDetailsHome]}>
            <Text
              style={[styles.listingTitle, isHomeDensity && styles.listingTitleHome]}
              numberOfLines={titleLines}
              ellipsizeMode="tail"
            >
              {listing.title}
            </Text>
            {conditionLabel ? (
              <Text
                style={[styles.listingCondition, isHomeDensity && styles.listingConditionHome]}
                numberOfLines={1}
              >
                {conditionLabel}
              </Text>
            ) : null}
            {descriptionPreview.kind === 'bullets' ? (
              <View style={[styles.descBlock, isHomeDensity && styles.descBlockHome]}>
                {descriptionPreview.items.map((line, i) => (
                  <Text
                    key={`${listing._id}-desc-${i}`}
                    style={[styles.descBulletLine, isHomeDensity && styles.descBulletLineHome]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {'\u2022 '}
                    {line}
                  </Text>
                ))}
              </View>
            ) : descriptionPreview.kind === 'plain' ? (
              <Text
                style={[styles.descPlain, isHomeDensity && styles.descPlainHome]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {descriptionPreview.text}
              </Text>
            ) : null}
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

const LISTING_IMAGE_HEIGHT = 220;

const styles = StyleSheet.create({
  listingCardWrapper: {
    marginBottom: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  listingCardWrapperHome: {
    marginBottom: spacing.sm,
  },
  cardContainer: {
    position: 'relative',
  },
  listingCard: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 8px 20px rgba(21, 71, 52, 0.07)',
  },
  listingCardFlat: {
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
  listingCardHover: {
    boxShadow: '0 18px 36px rgba(21, 71, 52, 0.14)',
    transform: [{ translateY: -2 }],
  },
  listingCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    width: '100%',
    height: LISTING_IMAGE_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainerHome: {},
  imageContainerHomeWeb: {},
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
    borderRadius: borderRadius.sm,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  imagePlaceholderText: {
    ...typography.footnote,
    color: colors.text,
  },
  cardDetails: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  cardDetailsHome: {
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  listingTitle: {
    ...typography.subhead,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    color: colors.textDark,
  },
  listingTitleHome: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  listingCondition: {
    ...typography.footnote,
    color: colors.gray,
    fontWeight: '500',
    marginTop: 2,
  },
  listingConditionHome: {
    fontSize: 12,
    marginTop: 0,
  },
  descBlock: {
    marginTop: 2,
    gap: 2,
    overflow: 'hidden',
  },
  descBlockHome: {
    marginTop: 0,
    gap: 1,
  },
  descBulletLine: {
    ...typography.footnote,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  descBulletLineHome: {
    fontSize: 11,
    lineHeight: 15,
  },
  descPlain: {
    ...typography.footnote,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    marginTop: 2,
  },
  descPlainHome: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 0,
  },
  listingPrice: {
    ...typography.title2,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    marginTop: spacing.xs,
  },
  listingPriceHome: {
    fontSize: 17,
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
