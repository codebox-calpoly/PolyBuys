import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { motion } from '../theme/motion';
import { formatPrice } from '../lib/formatPrice';
import { formatRelativeDate } from '../lib/formatDate';
import { colors, typography, borderRadius, spacing } from '../theme/tokens';
import { nativeChrome } from '../theme/nativeChrome';
import { useResolvedImageUrls } from '../hooks/useResolvedImageUrls';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** LRU-capped ids that already ran the entrance animation. */
const MAX_ANIMATED_CACHE = 200;
const animatedListingIds = new Map<string, void>();

function markAsAnimated(id: string): void {
  if (animatedListingIds.size >= MAX_ANIMATED_CACHE) {
    const first = animatedListingIds.keys().next().value;
    if (first !== undefined) animatedListingIds.delete(first);
  }
  animatedListingIds.set(id, undefined);
}

function formatConditionLabel(condition: 'new' | 'used' | 'refurbished'): string {
  switch (condition) {
    case 'new':
      return 'New';
    case 'used':
      return 'Used';
    case 'refurbished':
      return 'Refurbished';
  }
}

export type ListingCardBadge = 'sold' | 'unavailable';

export type ListingCardStatusBadge = 'active' | 'inactive' | 'sold' | 'hidden';

export type ListingCardDensity = 'default' | 'home';
export type ListingCardShellStyle = 'default' | 'flat';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    price: number;
    description: string;
    images?: string[];
    condition: 'new' | 'used' | 'refurbished';
    postedOn?: number;
    createdAt?: number;
  };
  index?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** @deprecated Prefer `badge`. */
  showUnavailableBadge?: boolean;
  badge?: ListingCardBadge;
  statusBadge?: ListingCardStatusBadge;
  onManagePress?: () => void;
  onPress?: (listing: ListingCardProps['listing']) => void;
  footer?: ReactNode;
  density?: ListingCardDensity;
  shellStyle?: ListingCardShellStyle;
}

function formatStatusBadgeLabel(status: ListingCardStatusBadge): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'sold':
      return 'Sold';
    case 'hidden':
      return 'Hidden';
  }
}

export default function ListingCard({
  listing,
  index = 0,
  isSaved = false,
  onToggleSave,
  showUnavailableBadge = false,
  badge,
  statusBadge,
  onManagePress,
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
  const heartScale = useRef(new Animated.Value(1)).current;
  const prevSavedRef = useRef<boolean | null>(null);

  const playHeartSavedAnimation = useCallback(() => {
    if (reduceMotion) return;
    heartScale.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.2,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 7,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartScale, reduceMotion]);

  const playHeartUnsavedAnimation = useCallback(() => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 0.88,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartScale, reduceMotion]);

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
  const titleLines = 1;

  const accessibilityDescriptionHint = useMemo(() => {
    const raw = listing.description.trim().replace(/\s+/g, ' ');
    if (raw.length <= 160) {
      return raw;
    }
    return `${raw.slice(0, 157)}…`;
  }, [listing.description]);

  const accessibilityLabel = useMemo(() => {
    const parts = [
      `${listing.title}, $${formatPrice(listing.price)}`,
      conditionLabel,
      accessibilityDescriptionHint,
      badgeToShow === 'sold' ? 'Sold' : badgeToShow === 'unavailable' ? 'Unavailable' : null,
    ].filter(Boolean) as string[];
    return parts.join(', ');
  }, [listing.title, listing.price, conditionLabel, accessibilityDescriptionHint, badgeToShow]);

  useEffect(() => {
    prevSavedRef.current = null;
  }, [listing._id]);

  useEffect(() => {
    if (!onToggleSave) return;
    if (prevSavedRef.current === null) {
      prevSavedRef.current = isSaved;
      return;
    }
    if (prevSavedRef.current === isSaved) return;
    const wasSaved = prevSavedRef.current;
    prevSavedRef.current = isSaved;
    if (isSaved && !wasSaved) {
      playHeartSavedAnimation();
    } else if (!isSaved && wasSaved) {
      playHeartUnsavedAnimation();
    }
  }, [isSaved, onToggleSave, playHeartSavedAnimation, playHeartUnsavedAnimation]);

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
          accessibilityLabel={accessibilityLabel}
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
            {statusBadge && !badgeToShow && (
              <View style={[styles.statusPill, getStatusPillStyle(statusBadge)]}>
                <Text style={[styles.statusPillText, getStatusPillTextStyle(statusBadge)]}>
                  {formatStatusBadgeLabel(statusBadge)}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.cardDetails, isHomeDensity && styles.cardDetailsHome]}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.listingTitle, isHomeDensity && styles.listingTitleHome]}
                numberOfLines={titleLines}
                ellipsizeMode="tail"
              >
                {listing.title}
              </Text>
              <Text
                style={[styles.listingCondition, isHomeDensity && styles.listingConditionHome]}
                numberOfLines={1}
              >
                {conditionLabel}
              </Text>
            </View>
            <Text
              style={[styles.listingPrice, isHomeDensity && styles.listingPriceHome]}
              numberOfLines={1}
            >
              ${formatPrice(listing.price)}
            </Text>
          </View>
          {(listing.postedOn || listing.createdAt) && (
            <Text style={[styles.listingDate, isHomeDensity && styles.listingDateHome]}>
              {formatRelativeDate(listing.postedOn ?? listing.createdAt!)}
            </Text>
          )}
        </Pressable>
        {onToggleSave && (
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
            onPress={onToggleSave}
            accessibilityLabel={`${isSaved ? 'Unsave' : 'Save'} listing: ${listing.title?.trim() || listing._id || 'listing'}`}
            accessibilityRole="button"
            hitSlop={8}
          >
            <BlurView intensity={40} tint={nativeChrome.blurTint} style={StyleSheet.absoluteFill} />
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Text style={[styles.saveIcon, isSaved && styles.saveIconActive]}>
                {isSaved ? '♥' : '♡'}
              </Text>
            </Animated.View>
          </Pressable>
        )}
        {onManagePress && (
          <Pressable
            style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}
            onPress={onManagePress}
            accessibilityLabel={`Manage listing: ${listing.title?.trim() || listing._id || 'listing'}`}
            accessibilityRole="button"
            hitSlop={8}
          >
            <BlurView intensity={40} tint={nativeChrome.blurTint} style={StyleSheet.absoluteFill} />
            <View style={styles.manageDots}>
              <View style={styles.manageDot} />
              <View style={styles.manageDot} />
              <View style={styles.manageDot} />
            </View>
          </Pressable>
        )}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

function getStatusPillStyle(status: ListingCardStatusBadge) {
  switch (status) {
    case 'active':
      return { backgroundColor: colors.location };
    case 'hidden':
      return { backgroundColor: colors.category };
    case 'sold':
    case 'inactive':
      return { backgroundColor: 'rgba(0,0,0,0.6)' };
  }
}

function getStatusPillTextStyle(status: ListingCardStatusBadge) {
  switch (status) {
    case 'active':
      return { color: colors.primary };
    case 'hidden':
    case 'sold':
    case 'inactive':
      return { color: colors.white };
  }
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.14)',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveIcon: {
    fontSize: 15,
    color: colors.textDark,
  },
  saveIconActive: {
    color: colors.category,
  },
  manageButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.14)',
  },
  manageButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  manageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  manageDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDark,
  },
  statusPill: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusPillText: {
    ...typography.footnote,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    paddingHorizontal: spacing.smPlus,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  listingTitle: {
    ...typography.subhead,
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
    color: colors.gray,
    fontWeight: '500',
  },
  listingConditionHome: {
    fontSize: 12,
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
  listingDate: {
    ...typography.footnote,
    color: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listingDateHome: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
