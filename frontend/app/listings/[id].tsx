import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import HiddenBanner from '../../components/HiddenBanner';
import ListingUnavailable from '../../components/ListingUnavailable';
import { ScreenState } from '../../components/ScreenState';
import { ReportModal } from '../../components/ReportModal';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { formatPrice } from '../../lib/formatPrice';
import { colors, borderRadius, spacing, typography } from '../../theme/tokens';
import { Chip } from '../../components/ui';

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
  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const updateListingStatus = useMutation(api.listings.updateListingStatus);
  const [markingSold, setMarkingSold] = useState(false);
  const isSaved = useQuery(
    api.savedListings.isListingSaved,
    listingId && isAuthenticated ? { listingId: listingId as Id<'listings'> } : 'skip'
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [savedOptimistic, setSavedOptimistic] = useState<boolean | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const { mappedUrls } = useResolvedImageUrls(listing?.images ?? []);
  const { width: screenWidth } = useWindowDimensions();
  const contentMaxWidth = 980;
  const contentHorizontalPadding = spacing.lg * 2;
  const cardHorizontalPadding = spacing.xl * 2;
  const imageWidth =
    Math.min(screenWidth, contentMaxWidth) - contentHorizontalPadding - cardHorizontalPadding;
  const sellerProfile = useQuery(
    api.profiles.getProfileByUserId,
    listing?.sellerId ? { userId: listing.sellerId } : 'skip'
  );
  const hasMultipleImages = mappedUrls.length > 1;
  const hasPreviousImage = imageIndex > 0;
  const hasNextImage = imageIndex < mappedUrls.length - 1;

  useEffect(() => {
    setImageIndex((currentIndex) => {
      if (mappedUrls.length === 0) {
        return 0;
      }
      return Math.min(currentIndex, mappedUrls.length - 1);
    });
  }, [mappedUrls.length]);

  const navigateToFeedWithTag = (tag: string) => {
    router.push({
      pathname: '/' as FeedTabHref,
      params: { tags: tag },
    });
  };

  const onMessageSellerPress = () => {
    if (!listing) return;

    if (!isAuthenticated) {
      const redirectTo = `/listings/${listing._id}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(redirectTo)}` as never);
      return;
    }

    router.push({
      pathname: '/conversations/new',
      params: { listingId: String(listing._id) },
    });
  };

  const onSavePress = async () => {
    if (!listingId) return;

    if (!isAuthenticated) {
      router.replace(
        `/auth/login?returnTo=${encodeURIComponent(`/listings/${listingId}`)}` as never
      );
      return;
    }

    const previousSaved = savedOptimistic ?? isSaved ?? false;
    setSavedOptimistic(!previousSaved);

    try {
      const result = await toggleSavedListing({ listingId: listingId as Id<'listings'> });
      setSavedOptimistic(result.saved);
    } catch {
      setSavedOptimistic(previousSaved);
      Alert.alert('Unable to save listing right now.');
    }
  };

  const shareListing = async () => {
    if (!listing) {
      return;
    }

    const shareUrl = `${appOrigin}/l/${listing._id}`;
    try {
      await Share.share({
        message: `${listing.title} - $${formatPrice(listing.price)}\n${shareUrl}`,
        url: shareUrl,
        title: listing.title,
      });
    } catch {
      Alert.alert('Unable to share listing right now.');
    }
  };

  const onMarkSoldPress = async () => {
    if (!listing) return;

    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Mark "${listing.title}" as sold? This cannot be undone.`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Mark as sold', `Mark "${listing.title}" as sold? This cannot be undone.`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Mark sold', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      setMarkingSold(true);
      await updateListingStatus({ id: listing._id, status: 'sold' });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to mark listing as sold. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setMarkingSold(false);
    }
  };

  const goToPreviousImage = () => {
    if (!hasPreviousImage) return;
    setImageIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  };

  const goToNextImage = () => {
    if (!hasNextImage) return;
    setImageIndex((currentIndex) => Math.min(currentIndex + 1, mappedUrls.length - 1));
  };

  useEffect(() => {
    if (Platform.OS === 'web' && listing && typeof document !== 'undefined') {
      document.title = `${listing.title} - PolyBuys`;
    }
    return () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.title = 'PolyBuys';
      }
    };
  }, [listing]);

  if (!listingId) {
    return <ListingUnavailable />;
  }

  if (listing === undefined || (isAuthenticated && currentUserSubject === undefined)) {
    return (
      <View style={styles.loadingContainer}>
        <ScreenState variant="loading" title="Loading listing..." />
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
          content={`$${formatPrice(listing.price)} - ${listing.description.substring(0, 100)}${listing.description.length > 100 ? '...' : ''}`}
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

        {listing.images.length > 0 ? (
          <View style={styles.imageSection}>
            {hasMultipleImages && Platform.OS === 'web' ? (
              <>
                <View style={[styles.heroImageWrap, { width: imageWidth }]}>
                  {mappedUrls[imageIndex] ? (
                    <Image
                      source={{ uri: mappedUrls[imageIndex] }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Text style={styles.placeholderText}>Loading image...</Text>
                    </View>
                  )}
                  <Pressable
                    style={({ pressed }) => [
                      styles.carouselArrow,
                      styles.carouselArrowLeft,
                      !hasPreviousImage && styles.carouselArrowDisabled,
                      pressed && hasPreviousImage && styles.buttonPressed,
                    ]}
                    onPress={goToPreviousImage}
                    disabled={!hasPreviousImage}
                    accessibilityRole="button"
                    accessibilityLabel="Previous image"
                  >
                    <Text style={styles.carouselArrowText}>‹</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.carouselArrow,
                      styles.carouselArrowRight,
                      !hasNextImage && styles.carouselArrowDisabled,
                      pressed && hasNextImage && styles.buttonPressed,
                    ]}
                    onPress={goToNextImage}
                    disabled={!hasNextImage}
                    accessibilityRole="button"
                    accessibilityLabel="Next image"
                  >
                    <Text style={styles.carouselArrowText}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    {imageIndex + 1} of {mappedUrls.length}
                  </Text>
                  <View style={styles.dotsRow}>
                    {mappedUrls.map((_, i) => (
                      <Pressable
                        key={i}
                        onPress={() => setImageIndex(i)}
                        style={[
                          styles.dot,
                          i === imageIndex ? styles.dotActive : styles.dotInactive,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`View image ${i + 1}`}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : hasMultipleImages ? (
              <>
                <FlatList
                  data={mappedUrls}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
                    );
                    setImageIndex(idx);
                  }}
                  renderItem={({ item }) => (
                    <View style={[styles.heroImageWrap, { width: imageWidth }]}>
                      {item ? (
                        <Image source={{ uri: item }} style={styles.heroImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.placeholderImage}>
                          <Text style={styles.placeholderText}>Loading image...</Text>
                        </View>
                      )}
                    </View>
                  )}
                />
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    {imageIndex + 1} of {mappedUrls.length}
                  </Text>
                  <View style={styles.dotsRow}>
                    {mappedUrls.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === imageIndex ? styles.dotActive : styles.dotInactive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : mappedUrls[0] ? (
              <View style={[styles.heroImageWrap, { width: imageWidth }]}>
                <Image
                  source={{ uri: mappedUrls[0] }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={[styles.heroImageWrap, { width: imageWidth }]}>
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>Loading image...</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No image provided</Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>${formatPrice(listing.price)}</Text>
        </View>

        {!isOwner && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.messageButton, pressed && styles.buttonPressed]}
              onPress={() => void onMessageSellerPress()}
            >
              <Text style={styles.messageButtonText}>Message Seller</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={() => void onSavePress()}
              accessibilityLabel={(savedOptimistic ?? isSaved) ? 'Unsave listing' : 'Save listing'}
              accessibilityRole="button"
            >
              <Text style={styles.iconButtonText}>
                {(savedOptimistic ?? isSaved) ? 'Saved' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={() => void shareListing()}
              accessibilityLabel="Share listing"
              accessibilityRole="button"
            >
              <Text style={styles.iconButtonText}>Share</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.chipsRow}>
          <Chip
            variant="category"
            label={listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
          />
          <Chip
            variant="default"
            label={listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1)}
          />
          {listing.tags?.map((tag) => (
            <Pressable key={tag} onPress={() => navigateToFeedWithTag(tag)}>
              <Chip variant="default" label={`#${tag}`} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.descriptionLabel}>Description</Text>
        <Text style={styles.description}>{listing.description}</Text>

        {sellerProfile && (
          <View style={styles.sellerBlock}>
            <View style={styles.sellerAvatar} />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{sellerProfile.name}</Text>
              <Text style={styles.sellerMeta}>
                {sellerProfile.major} · Year {sellerProfile.year}
              </Text>
            </View>
          </View>
        )}

        {isOwner && !isHidden && (
          <View style={styles.buttonContainer}>
            {listing.status === 'active' && (
              <Pressable
                style={({ pressed }) => [
                  styles.markSoldButton,
                  pressed && styles.buttonPressed,
                  markingSold && styles.buttonDisabled,
                ]}
                onPress={() => void onMarkSoldPress()}
                disabled={markingSold}
                accessibilityLabel="Mark as sold"
                accessibilityRole="button"
              >
                {markingSold ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.markSoldButtonText}>Mark as Sold</Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
              onPress={() => router.push(`/listings/${listing._id}/edit`)}
            >
              <Text style={styles.editButtonText}>Edit Listing</Text>
            </Pressable>
          </View>
        )}

        {!isOwner && (
          <Pressable
            style={({ pressed }) => [styles.reportLink, pressed && styles.buttonPressed]}
            onPress={() => setReportOpen(true)}
            accessible
            accessibilityLabel="Report listing"
            accessibilityRole="button"
          >
            <Text style={styles.reportLinkText}>Report listing</Text>
          </Pressable>
        )}

        <ReportModal
          isVisible={reportOpen}
          onClose={() => setReportOpen(false)}
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
    backgroundColor: colors.background,
    gap: 8,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  webBannerContainer: {
    marginBottom: 12,
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  webBannerText: {
    color: colors.infoText,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  webBannerButton: {
    backgroundColor: colors.infoButton,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  webBannerButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  imageSection: {
    marginBottom: spacing.lg,
  },
  heroImageWrap: {
    height: 280,
    marginRight: 0,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    borderWidth: 1.5,
    borderColor: colors.muted,
  },
  imageIndicator: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  imageIndicatorText: {
    ...typography.footnote,
    color: colors.text,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotInactive: {
    backgroundColor: colors.border,
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselArrowLeft: {
    left: spacing.sm,
  },
  carouselArrowRight: {
    right: spacing.sm,
  },
  carouselArrowDisabled: {
    opacity: 0.45,
  },
  carouselArrowText: {
    color: colors.textDark,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 24,
  },
  placeholderImage: {
    width: '100%',
    flex: 1,
    minHeight: 180,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  placeholderText: {
    color: colors.text,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title1,
    flex: 1,
    color: colors.textDark,
  },
  price: {
    ...typography.title2,
    fontSize: 19,
    color: colors.accent,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  messageButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  messageButtonText: {
    ...typography.body,
    color: colors.white,
  },
  iconButton: {
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    ...typography.subhead,
    color: colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  descriptionLabel: {
    ...typography.heading,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textDark,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  sellerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sellerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.border,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.textDark,
  },
  sellerMeta: {
    ...typography.footnote,
    color: colors.text,
  },
  buttonContainer: {
    gap: spacing.md,
  },
  markSoldButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  markSoldButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  editButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  reportLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  reportLinkText: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
});
