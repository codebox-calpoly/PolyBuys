import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { motion } from '../theme/motion';
import { formatPrice } from '../lib/formatPrice';
import { formatRelativeDate } from '../lib/formatDate';
import { colors, typography, borderRadius, spacing } from '../theme/tokens';
import { useResolvedImageUrls } from '../hooks/useResolvedImageUrls';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { GlassIconButton } from './ui';

/** LRU-capped ids that already ran the entrance animation. */
const MAX_ANIMATED_CACHE = 200;
const animatedListingIds = new Map<string, void>();
const landingTextFont =
  Platform.OS === 'web'
    ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
    : undefined;
const landingListingTitleFont =
  Platform.OS === 'web' ? { fontFamily: 'Fraunces, Georgia, serif' } : undefined;

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

// ─── Web-only inline style objects ───────────────────────────────────────────
// StyleSheet.create() validates and strips web-only CSS properties (boxShadow,
// transition, transform with non-native values, background gradients).
// We bypass it by using plain object literals applied only when Platform.OS === 'web'.

const webCardBase: object = {
  borderRadius: 16,
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: 'rgba(21,71,52,0.11)',
  boxShadow: '0 2px 12px rgba(21,71,52,0.10), 0 1px 3px rgba(21,71,52,0.06)',
  transition:
    'transform 200ms cubic-bezier(0.2,0.7,0.2,1), box-shadow 200ms cubic-bezier(0.2,0.7,0.2,1), border-color 200ms ease',
  cursor: 'pointer',
  willChange: 'transform',
};

const webCardHover: object = {
  transform: [{ translateY: -4 }, { scale: 1.015 }],
  boxShadow: '0 10px 32px rgba(21,71,52,0.16), 0 3px 10px rgba(21,71,52,0.09)',
  borderColor: 'rgba(21,71,52,0.16)',
};

const webCardPressed: object = {
  transform: [{ scale: 0.985 }],
  boxShadow: '0 2px 8px rgba(21,71,52,0.10)',
  opacity: 0.96,
};

const webCardHighlight: object = {
  backgroundColor: 'rgba(255,255,255,0.82)',
};

const webCardSweepBase: object = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '52%',
  zIndex: 3,
  pointerEvents: 'none',
  left: '-58%',
  opacity: 0,
  // Angled sweep shape via skew
  transform: [{ skewX: '-12deg' }],
  backgroundColor: 'rgba(255,255,255,0.14)',
  transition: 'left 700ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 200ms ease',
};

const webCardSweepHover: object = {
  left: '115%',
  opacity: 1,
};

const webImageBase: object = {
  width: '100%',
  height: '100%',
  transition: 'transform 300ms cubic-bezier(0.2,0.7,0.2,1)',
};

const webImageHover: object = {
  transform: [{ scale: 1.07 }],
};

const LISTING_IMAGE_HEIGHT = 200;

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
      Animated.spring(heartScale, { toValue: 1, friction: 7, tension: 200, useNativeDriver: true }),
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
      Animated.spring(heartScale, { toValue: 1, friction: 6, tension: 220, useNativeDriver: true }),
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
    () => ({ opacity, transform: [{ translateY }] }),
    [opacity, translateY]
  );

  const isHomeDensity = density === 'home';
  const isFlatShell = shellStyle === 'flat';
  const isWeb = Platform.OS === 'web';
  const conditionLabel = formatConditionLabel(listing.condition);
  const titleLines = 1;
  const homeTextFontStyle = isWeb && isHomeDensity ? landingTextFont : undefined;
  const homeTitleFontStyle = isWeb && isHomeDensity ? landingListingTitleFont : undefined;

  const accessibilityDescriptionHint = useMemo(() => {
    const raw = listing.description.trim().replace(/\s+/g, ' ');
    return raw.length <= 160 ? raw : `${raw.slice(0, 157)}…`;
  }, [listing.description]);

  const accessibilityLabel = useMemo(() => {
    const parts = [
      `${listing.title}, ${formatPrice(listing.price)}`,
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
    if (isSaved && !wasSaved) playHeartSavedAnimation();
    else if (!isSaved && wasSaved) playHeartUnsavedAnimation();
  }, [isSaved, onToggleSave, playHeartSavedAnimation, playHeartUnsavedAnimation]);

  // ── Build web-only inline styles (bypasses StyleSheet validation) ──────────
  const webCardStyle =
    isWeb && !isFlatShell ? { ...webCardBase, ...(isHovered ? webCardHover : {}) } : undefined;

  const webSweepStyle =
    isWeb && !isFlatShell && !reduceMotion
      ? { ...webCardSweepBase, ...(isHovered ? webCardSweepHover : {}) }
      : undefined;

  const webImageStyle =
    isWeb && !isFlatShell ? { ...webImageBase, ...(isHovered ? webImageHover : {}) } : undefined;

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
            // Native styles from StyleSheet (safe — no web-only props)
            styles.listingCardNative,
            isFlatShell && styles.listingCardFlat,
            state.pressed && !isWeb && styles.listingCardPressed,
            // Web styles applied as plain object (not through StyleSheet)
            webCardStyle as never,
            // Web pressed state
            isWeb && state.pressed && !isFlatShell && (webCardPressed as never),
          ]}
          onPress={() =>
            onPressProp ? onPressProp(listing) : router.push(`/listings/${listing._id}`)
          }
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
        >
          {!isFlatShell ? (
            <View
              style={[styles.cardHighlightEdge, isWeb && (webCardHighlight as never)]}
              pointerEvents="none"
            />
          ) : null}

          {/* Image container — overflow:hidden clips the zoom */}
          <View style={[styles.imageContainer, isHomeDensity && styles.imageContainerHome]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.image, webImageStyle as never]}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={[styles.imagePlaceholderText, homeTextFontStyle]}>No image</Text>
              </View>
            )}

            {/* Hover overlay: dark gradient + "View details →" chip */}
            {isHovered && !isFlatShell && (
              <View
                style={[styles.imageHoverOverlay, isWeb && styles.imageHoverOverlayWeb]}
                pointerEvents="none"
              >
                <View style={styles.viewDetailsRow}>
                  {/* eslint-disable-next-line react-native/no-raw-text */}
                  <Text style={styles.viewDetailsText}>View details</Text>
                  {/* eslint-disable-next-line react-native/no-raw-text */}
                  <Text style={styles.viewDetailsArrow}>→</Text>
                </View>
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

          {/* Card body */}
          <View style={[styles.cardDetails, isHomeDensity && styles.cardDetailsHome]}>
            {/* Title + condition badge */}
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.listingTitle,
                  isHomeDensity && styles.listingTitleHome,
                  homeTitleFontStyle,
                ]}
                numberOfLines={titleLines}
                ellipsizeMode="tail"
              >
                {listing.title}
              </Text>
              <View style={styles.conditionPill}>
                <Text style={[styles.conditionPillText, homeTextFontStyle]} numberOfLines={1}>
                  {conditionLabel}
                </Text>
              </View>
            </View>

            {/* Price + date */}
            <View style={styles.priceRow}>
              <Text
                style={[
                  styles.listingPrice,
                  isHomeDensity && styles.listingPriceHome,
                  homeTextFontStyle,
                ]}
                numberOfLines={1}
              >
                ${formatPrice(listing.price)}
              </Text>
              {(listing.postedOn || listing.createdAt) && (
                <Text style={[styles.listingDate, homeTextFontStyle]} numberOfLines={1}>
                  {formatRelativeDate(listing.postedOn ?? listing.createdAt!)}
                </Text>
              )}
            </View>
          </View>

          {webSweepStyle ? (
            <View style={[styles.cardHoverSweep, webSweepStyle as never]} pointerEvents="none" />
          ) : null}
        </Pressable>

        {/* Floating save / manage buttons */}
        {onToggleSave || onManagePress ? (
          <View style={styles.floatingActions} pointerEvents="box-none">
            {onToggleSave ? (
              <GlassIconButton
                containerStyle={styles.saveButton}
                onPress={onToggleSave}
                accessibilityLabel={`${isSaved ? 'Unsave' : 'Save'} listing: ${listing.title?.trim() || listing._id || 'listing'}`}
                hitSlop={8}
                pressedScale={0.94}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={17}
                    color={isSaved ? colors.category : colors.textDark}
                  />
                </Animated.View>
              </GlassIconButton>
            ) : null}
            {onManagePress ? (
              <GlassIconButton
                containerStyle={styles.manageButton}
                onPress={onManagePress}
                accessibilityLabel={`Manage listing: ${listing.title?.trim() || listing._id || 'listing'}`}
                hitSlop={8}
                pressedScale={0.94}
              >
                <View style={styles.manageDots}>
                  <View style={styles.manageDot} />
                  <View style={styles.manageDot} />
                  <View style={styles.manageDot} />
                </View>
              </GlassIconButton>
            ) : null}
          </View>
        ) : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  listingCardWrapper: {
    marginBottom: spacing.lg,
    flex: 1,
    minWidth: 0,
  },
  listingCardWrapperHome: {
    marginBottom: spacing.sm,
  },
  cardContainer: {
    position: 'relative',
  },
  floatingActions: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },

  // Native-safe card shell — NO web-only properties here
  listingCardNative: {
    borderRadius: 16,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(21,71,52,0.12)',
  },
  listingCardFlat: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  listingCardPressed: {
    // Native press feedback only
    opacity: 0.92,
  },
  cardHighlightEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.80)',
    zIndex: 4,
  },
  cardHoverSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 3,
  },

  // Image container — overflow:hidden is critical for zoom clip
  imageContainer: {
    width: '100%',
    height: LISTING_IMAGE_HEIGHT,
    backgroundColor: colors.placeholderBg,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainerHome: {},

  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4F1',
    gap: 6,
  },
  imagePlaceholderText: {
    ...typography.footnote,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
  },

  // Hover overlay — gradient applied inline on web only
  imageHoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  imageHoverOverlayWeb: {
    backgroundColor: 'rgba(10,30,20,0.36)',
    opacity: 1,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,248,232,0.93)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0,
  },
  viewDetailsArrow: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // Status badges
  statusPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
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
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusBadgeSold: { backgroundColor: 'rgba(0,0,0,0.72)' },
  statusBadgeUnavailable: { backgroundColor: 'rgba(0,0,0,0.60)' },
  statusBadgeText: {
    ...typography.footnote,
    color: colors.white,
    fontWeight: '600',
  },

  // Card body
  cardDetails: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardDetailsHome: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listingTitle: {
    ...typography.subhead,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    color: colors.textDark,
    letterSpacing: 0,
  },
  listingTitleHome: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0,
  },

  // Condition pill — proper pill shape
  conditionPill: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(21,71,52,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(21,71,52,0.12)',
  },
  conditionPillText: {
    ...typography.footnote,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0,
    color: colors.primary,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listingPrice: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0,
    lineHeight: 24,
  },
  listingPriceHome: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
  listingDate: {
    ...typography.footnote,
    flexShrink: 0,
    fontSize: 11,
    color: colors.muted,
  },

  // Floating action buttons
  saveButton: { width: 40, height: 40, borderRadius: 20 },
  manageButton: { width: 36, height: 36, borderRadius: 18 },
  manageDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  manageDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textDark },

  footer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
