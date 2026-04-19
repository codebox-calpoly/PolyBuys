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
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import Constants from 'expo-constants';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useFlash } from '../../contexts/FlashContext';
import { useAuth } from '../../hooks/useAuth';
import HiddenBanner from '../../components/HiddenBanner';
import ListingUnavailable from '../../components/ListingUnavailable';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ScreenState } from '../../components/ScreenState';
import { ReportModal } from '../../components/ReportModal';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { formatPrice } from '../../lib/formatPrice';
import { colors, borderRadius, spacing, typography } from '../../theme/tokens';
import { Chip } from '../../components/ui';
import ImageLightbox from '../../components/ImageLightbox';

import { APP_STORE_URL } from '../../constants/app';
import { REPORT_SUBMITTED_MESSAGE } from '../../constants/feedbackMessages';

const DEFAULT_APP_ORIGIN = 'https://polybuys.com';

function normalizeAppOrigin(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getAppOrigin() {
  const configuredOrigin =
    normalizeAppOrigin(Constants.expoConfig?.extra?.appOrigin) ??
    normalizeAppOrigin(process.env.EXPO_PUBLIC_APP_ORIGIN);
  if (!configuredOrigin) {
    return DEFAULT_APP_ORIGIN;
  }

  return configuredOrigin;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = typeof id === 'string' && id.trim().length > 0 ? id : null;
  const router = useRouter();
  const { setFlash } = useFlash();
  const { isAuthenticated } = useAuth();
  const isWeb = Platform.OS === 'web';
  const entranceStyle = useEntranceAnimation();
  const appOrigin = getAppOrigin();

  const listing = useQuery(
    api.listings.getListing,
    listingId ? { id: listingId as Id<'listings'> } : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const updateListingStatus = useMutation(api.listings.updateListingStatus);
  const [markingSold, setMarkingSold] = useState(false);
  const isSaved = useQuery(
    api.savedListings.isListingSaved,
    listingId && isAuthenticated && !isWeb ? { listingId: listingId as Id<'listings'> } : 'skip'
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [savedOptimistic, setSavedOptimistic] = useState<boolean | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
  const { mappedUrls: sellerAvatarUrls } = useResolvedImageUrls(
    sellerProfile?.picture ? [sellerProfile.picture] : []
  );
  const sellerAvatarUrl = sellerAvatarUrls[0] ?? null;
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

  const onMessageSellerPress = () => {
    if (!listing) return;

    if (isWeb) {
      router.push({
        pathname: '/auth/login',
        params: { returnTo: `/listings/${listing._id}` },
      } as never);
      return;
    }

    if (!isAuthenticated) {
      const redirectTo = `/listings/${listing._id}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(redirectTo)}` as never);
      return;
    }

    router.push({
      pathname: '/conversations/new',
      params: { listingId: String(listing._id) },
    } as never);
  };

  const onSavePress = async () => {
    if (!listingId) return;

    if (isWeb) {
      router.push({
        pathname: '/auth/login',
        params: { returnTo: `/listings/${listingId}` },
      } as never);
      return;
    }

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
      setFlash('Listing marked as sold.');
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

  if (listing === undefined || (!isWeb && isAuthenticated && currentUserSubject === undefined)) {
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
          <View style={styles.webBannerTextWrap}>
            <Text style={styles.webBannerText}>Experience PolyBuys on mobile!</Text>
            <Text style={styles.webBannerSubtext}>Download the app for the full experience.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.webBannerButton, pressed && styles.buttonPressed]}
            onPress={() => {
              // Open App Store / download page directly
              void Linking.openURL(APP_STORE_URL);
            }}
          >
            <Text style={styles.webBannerButtonText}>Download App</Text>
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
                    <Pressable
                      onPress={() => setLightboxOpen(true)}
                      accessibilityLabel="View full image"
                    >
                      <Image
                        source={{ uri: mappedUrls[imageIndex] }}
                        style={styles.heroImage}
                        resizeMode="cover"
                      />
                    </Pressable>
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
                  renderItem={({ item, index: itemIndex }) => (
                    <View style={[styles.heroImageWrap, { width: imageWidth }]}>
                      {item ? (
                        <Pressable
                          onPress={() => {
                            setImageIndex(itemIndex);
                            setLightboxOpen(true);
                          }}
                          accessibilityLabel="View full image"
                        >
                          <Image
                            source={{ uri: item }}
                            style={styles.heroImage}
                            resizeMode="cover"
                          />
                        </Pressable>
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
                <Pressable
                  onPress={() => setLightboxOpen(true)}
                  accessibilityLabel="View full image"
                >
                  <Image
                    source={{ uri: mappedUrls[0] }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                </Pressable>
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
              <Ionicons
                name={(savedOptimistic ?? isSaved) ? 'heart' : 'heart-outline'}
                size={20}
                color={(savedOptimistic ?? isSaved) ? colors.category : colors.textDark}
              />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={() => void shareListing()}
              accessibilityLabel="Share listing"
              accessibilityRole="button"
            >
              <Feather name="share" size={18} color={colors.textDark} />
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
        </View>

        <Text style={styles.descriptionLabel}>Description</Text>
        <Text style={styles.description}>{listing.description}</Text>

        {sellerProfile && (
          <Pressable
            style={styles.sellerBlock}
            onPress={() => router.push(`/profile/${encodeURIComponent(listing.sellerId)}` as never)}
            accessibilityLabel={`View ${sellerProfile.name}'s profile`}
            accessibilityRole="button"
          >
            <ProfileAvatar
              uri={sellerAvatarUrl}
              name={sellerProfile.name}
              size={44}
              style={styles.sellerAvatar}
              textStyle={styles.sellerAvatarText}
            />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{sellerProfile.name}</Text>
              <Text style={styles.sellerMeta}>
                {sellerProfile.major} · Year {sellerProfile.year}
              </Text>
            </View>
          </Pressable>
        )}

        {isOwner && !isHidden && listing.status !== 'sold' && (
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

        {!isOwner && !isWeb && (
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
          onReportSuccess={() => setFlash(REPORT_SUBMITTED_MESSAGE)}
        />
      </Animated.View>

      <ImageLightbox
        images={mappedUrls.filter((url): url is string => url !== null)}
        initialIndex={
          mappedUrls.slice(0, imageIndex + 1).filter((url): url is string => url !== null).length -
          1
        }
        visible={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: 8,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
  webBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  webBannerSubtext: {
    color: colors.infoText,
    fontSize: 12,
    fontWeight: '400',
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
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
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
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.title1,
    fontSize: 24,
    lineHeight: 30,
    flex: 1,
    color: colors.textDark,
  },
  price: {
    ...typography.title1,
    fontSize: 22,
    color: colors.accent,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  descriptionLabel: {
    ...typography.heading,
    color: colors.textDark,
    marginTop: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textDark,
    lineHeight: 24,
  },
  sellerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  sellerAvatarText: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.primary,
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
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  markSoldButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  markSoldButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '700',
  },
  editButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  editButtonText: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '600',
  },
  reportLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  reportLinkText: {
    ...typography.footnote,
    color: colors.destructive,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
});
