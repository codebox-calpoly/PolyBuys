import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import Constants from 'expo-constants';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useFlash } from '../../contexts/FlashContext';
import { useAuth } from '../../hooks/useAuth';
import HiddenBanner from '../../components/HiddenBanner';
import ListingUnavailable from '../../components/ListingUnavailable';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ScreenState } from '../../components/ScreenState';
import { ReportModal } from '../../components/ReportModal';
import { GlassIconButton, KeyboardUnderlay } from '../../components/ui';
import { formatMajorLabel } from '../../constants/calPolyMajors';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { formatPrice } from '../../lib/formatPrice';
import { formatRelativeDate } from '../../lib/formatDate';
import { getUserFlowErrorMessage } from '../../lib/user-flow-errors';
import { colors, borderRadius, spacing, typography } from '../../theme/tokens';
import { Chip } from '../../components/ui';
import ImageLightbox from '../../components/ImageLightbox';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_STORE_URL } from '../../constants/app';
import { REPORT_SUBMITTED_MESSAGE } from '../../constants/feedbackMessages';

const DEFAULT_APP_ORIGIN = 'https://www.polybuys.com';
const DETAIL_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:SOFT,opsz,wght@0..100,9..144,300..900&family=Inter:wght@400;500;600;700;800&display=swap';
const EMPTY_IMAGE_IDS: string[] = [];
const detailTextFont =
  Platform.OS === 'web'
    ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
    : undefined;
const detailDisplayFont =
  Platform.OS === 'web' ? { fontFamily: 'Fraunces, Georgia, serif' } : undefined;

function isRemoteImageUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function formatLabel(value: string) {
  if (!value) {
    return 'Unknown';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useReducedMotion();

  const listing = useQuery(
    api.listings.getListing,
    listingId ? { id: listingId as Id<'listings'> } : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const createConversationAndSendFirstMessage = useAction(
    api.messages.createConversationAndSendFirstMessage
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
  const [messageComposerOpen, setMessageComposerOpen] = useState(false);
  const messageComposerKeyboardHeight = useKeyboardHeight({ enabled: messageComposerOpen });
  const [messageBody, setMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messageComposerTranslateY = useSharedValue(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const listingImageIds = listing?.images ?? EMPTY_IMAGE_IDS;
  const { mappedUrls, resolvedUrls } = useResolvedImageUrls(listingImageIds);
  const { width: screenWidth } = useWindowDimensions();
  const contentMaxWidth = 1120;
  const isWideLayout = screenWidth >= 900;
  const contentHorizontalPadding =
    screenWidth >= 900 ? spacing.xxl : screenWidth >= 520 ? spacing.lg : spacing.md;
  const layoutGap = isWideLayout ? spacing.xl : spacing.lg;
  const shellWidth = Math.max(
    0,
    Math.min(screenWidth, contentMaxWidth) - contentHorizontalPadding * 2
  );
  const imageWidth = isWideLayout
    ? Math.min(540, Math.max(360, Math.floor((shellWidth - layoutGap) * 0.52)))
    : shellWidth;
  const imageHeight = isWideLayout
    ? Math.round(imageWidth * 0.78)
    : Math.min(360, Math.max(248, Math.round(imageWidth * 0.72)));
  const sellerProfile = useQuery(
    api.profiles.getProfileByUserId,
    listing?.sellerId ? { userId: listing.sellerId } : 'skip'
  );
  const { mappedUrls: sellerAvatarUrls } = useResolvedImageUrls(
    sellerProfile?.picture ? [sellerProfile.picture] : []
  );
  const sellerAvatarUrl = sellerAvatarUrls[0] ?? null;
  const displayImageUrls = mappedUrls.map((url) => (url && !failedImageUrls[url] ? url : null));
  const hasMultipleImages = displayImageUrls.length > 1;
  const hasPreviousImage = imageIndex > 0;
  const hasNextImage = imageIndex < displayImageUrls.length - 1;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const prevDisplayedSavedRef = useRef<boolean | null>(null);
  const displayedSaved = savedOptimistic ?? isSaved ?? false;

  const playBookmarkSavedAnimation = useCallback(() => {
    if (reduceMotion) return;
    bookmarkScale.setValue(1);
    Animated.sequence([
      Animated.spring(bookmarkScale, {
        toValue: 1.2,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
      Animated.spring(bookmarkScale, {
        toValue: 1,
        friction: 7,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bookmarkScale, reduceMotion]);

  const playBookmarkUnsavedAnimation = useCallback(() => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(bookmarkScale, {
        toValue: 0.88,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(bookmarkScale, {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bookmarkScale, reduceMotion]);

  useEffect(() => {
    setImageIndex((currentIndex) => {
      if (displayImageUrls.length === 0) {
        return 0;
      }
      return Math.min(currentIndex, displayImageUrls.length - 1);
    });
  }, [displayImageUrls.length]);

  useEffect(() => {
    prevDisplayedSavedRef.current = null;
    setSavedOptimistic(null);
    setFailedImageUrls({});
    bookmarkScale.setValue(1);
  }, [bookmarkScale, listingId]);

  const onDetailImageError = useCallback((imageUrl: string) => {
    setFailedImageUrls((current) => {
      if (current[imageUrl]) {
        return current;
      }

      return { ...current, [imageUrl]: true };
    });
  }, []);

  useEffect(() => {
    if (prevDisplayedSavedRef.current === null) {
      prevDisplayedSavedRef.current = displayedSaved;
      return;
    }
    if (prevDisplayedSavedRef.current === displayedSaved) return;

    const wasSaved = prevDisplayedSavedRef.current;
    prevDisplayedSavedRef.current = displayedSaved;

    if (displayedSaved && !wasSaved) {
      playBookmarkSavedAnimation();
    } else if (!displayedSaved && wasSaved) {
      playBookmarkUnsavedAnimation();
    }
  }, [displayedSaved, playBookmarkSavedAnimation, playBookmarkUnsavedAnimation]);

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

    setMessageComposerOpen(true);
  };

  const closeMessageComposer = useCallback(() => {
    if (isSendingMessage) return;
    messageComposerTranslateY.value = 0;
    setMessageComposerOpen(false);
    setMessageBody('');
  }, [isSendingMessage, messageComposerTranslateY]);

  const onSendFirstMessage = async () => {
    if (!listing || isSendingMessage) return;
    const trimmed = messageBody.trim();
    if (!trimmed) return;

    try {
      setIsSendingMessage(true);
      const { conversationId } = await createConversationAndSendFirstMessage({
        listingId: listing._id,
        body: trimmed,
      });
      setMessageComposerOpen(false);
      setMessageBody('');
      router.push({
        pathname: '/conversations/[id]',
        params: { id: String(conversationId) },
      } as never);
    } catch (error) {
      Alert.alert('Message Failed', getUserFlowErrorMessage(error, 'send-first-message'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    if (messageComposerOpen) {
      messageComposerTranslateY.value = 0;
    }
  }, [messageComposerOpen, messageComposerTranslateY]);

  const messageComposerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: messageComposerTranslateY.value }],
  }));

  const messageComposerPanGesture = Gesture.Pan()
    .enabled(!isSendingMessage)
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        messageComposerTranslateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 1000) {
        messageComposerTranslateY.value = withTiming(420, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(closeMessageComposer)();
          }
        });
        return;
      }
      messageComposerTranslateY.value = withSpring(0, {
        damping: 18,
        stiffness: 180,
      });
    });

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
        message: shareUrl,
        url: shareUrl,
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
      Alert.alert('Could Not Mark as Sold', getUserFlowErrorMessage(error, 'mark-listing-sold'));
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
    setImageIndex((currentIndex) => Math.min(currentIndex + 1, displayImageUrls.length - 1));
  };

  const goBackToListings = useCallback(() => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
      } else if (router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      // Fall through to the stable listings route if history is unavailable.
    }

    router.replace('/home' as never);
  }, [isWeb, router]);

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

  const isListingImagePending = (index: number) => {
    const imageId = listingImageIds[index];
    return Boolean(imageId && !isRemoteImageUrl(imageId) && resolvedUrls[imageId] === undefined);
  };

  const getImageFallbackCopy = (index: number) => {
    if (isListingImagePending(index)) {
      return {
        title: 'Loading photo...',
        body: 'Resolving the uploaded image.',
      };
    }

    return {
      title: 'Photo unavailable',
      body: 'This listing image could not be displayed.',
    };
  };

  const renderImageFallback = (title: string, body: string) => (
    <View style={styles.placeholderImage}>
      <View style={styles.placeholderIcon}>
        <Feather name="image" size={24} color={colors.primary} />
      </View>
      <Text style={[styles.placeholderText, detailTextFont]}>{title}</Text>
      <Text style={[styles.placeholderSubtext, detailTextFont]}>{body}</Text>
    </View>
  );

  const renderImageFrame = (imageUrl: string | null, frameIndex: number) => {
    const fallbackCopy = getImageFallbackCopy(frameIndex);

    return (
      <View style={[styles.heroImageWrap, { width: imageWidth, height: imageHeight }]}>
        {imageUrl ? (
          <Pressable
            style={({ pressed }) => [styles.heroImagePressable, pressed && styles.imagePressed]}
            onPress={() => {
              setImageIndex(frameIndex);
              setLightboxOpen(true);
            }}
            accessibilityLabel="View full image"
            accessibilityRole="button"
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => onDetailImageError(imageUrl)}
            />
          </Pressable>
        ) : (
          renderImageFallback(fallbackCopy.title, fallbackCopy.body)
        )}
      </View>
    );
  };

  const postedDateLabel = formatRelativeDate(listing.postedOn ?? listing.createdAt);
  const categoryLabel = formatLabel(listing.category);
  const conditionLabel = formatLabel(listing.condition);
  const lightboxImages = displayImageUrls.filter((url): url is string => url !== null);
  const lightboxInitialIndex = Math.max(
    0,
    displayImageUrls.slice(0, imageIndex + 1).filter((url): url is string => url !== null).length -
      1
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingHorizontal: contentHorizontalPadding }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Head>
        {Platform.OS === 'web' && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={DETAIL_FONT_HREF} />
          </>
        )}
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

      <Pressable
        style={({ pressed }) => [styles.backLink, pressed && styles.buttonPressed]}
        onPress={goBackToListings}
        accessibilityRole="button"
        accessibilityLabel="Back to listings"
      >
        <Feather name="arrow-left" size={16} color={colors.primary} />
        <Text style={[styles.backLinkText, detailTextFont]}>Back to listings</Text>
      </Pressable>

      <Animated.View style={[styles.detailShell, entranceStyle]}>
        {isHiddenOwnerView && <HiddenBanner />}

        <View style={[styles.detailLayout, isWideLayout && styles.detailLayoutWide]}>
          <View style={[styles.imagePanel, isWideLayout && { width: imageWidth }]}>
            {listingImageIds.length > 0 ? (
              <View style={styles.imageSection}>
                {hasMultipleImages && Platform.OS !== 'web' ? (
                  <FlatList
                    data={displayImageUrls}
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
                    renderItem={({ item, index: itemIndex }) => renderImageFrame(item, itemIndex)}
                  />
                ) : (
                  renderImageFrame(displayImageUrls[imageIndex] ?? null, imageIndex)
                )}

                {hasMultipleImages && (
                  <View style={styles.imageIndicator}>
                    <Text style={[styles.imageIndicatorText, detailTextFont]}>
                      {imageIndex + 1} of {displayImageUrls.length}
                    </Text>
                    <View style={styles.dotsRow}>
                      {displayImageUrls.map((_, i) => (
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
                )}

                {hasMultipleImages && Platform.OS === 'web' ? (
                  <>
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
                      <Feather name="chevron-left" size={22} color={colors.textDark} />
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
                      <Feather name="chevron-right" size={22} color={colors.textDark} />
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : (
              <View style={[styles.heroImageWrap, { width: imageWidth, height: imageHeight }]}>
                {renderImageFallback('No photo added', 'This listing does not have an image yet.')}
              </View>
            )}
          </View>

          <View style={styles.detailsPanel}>
            <View style={styles.headerRow}>
              <Text style={[styles.eyebrow, detailTextFont]}>Campus marketplace</Text>
              <Text style={[styles.title, detailDisplayFont]} selectable>
                {listing.title}
              </Text>
              <Text style={[styles.price, detailTextFont]} selectable>
                ${formatPrice(listing.price)}
              </Text>
            </View>

            {!isOwner && (
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.messageButton, pressed && styles.buttonPressed]}
                  onPress={() => void onMessageSellerPress()}
                  accessibilityRole="button"
                  accessibilityLabel="Message seller"
                >
                  <Feather name="message-circle" size={18} color={colors.white} />
                  <Text style={[styles.messageButtonText, detailTextFont]}>Message seller</Text>
                </Pressable>
                <GlassIconButton
                  containerStyle={styles.iconButton}
                  onPress={() => void onSavePress()}
                  accessibilityLabel={displayedSaved ? 'Unsave listing' : 'Save listing'}
                  pressedScale={0.94}
                >
                  <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
                    <Ionicons
                      name={displayedSaved ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={displayedSaved ? colors.category : colors.textDark}
                    />
                  </Animated.View>
                </GlassIconButton>
                <GlassIconButton
                  containerStyle={styles.iconButton}
                  onPress={() => void shareListing()}
                  accessibilityLabel="Share listing"
                  pressedScale={0.94}
                >
                  <Feather name="share" size={18} color={colors.textDark} />
                </GlassIconButton>
              </View>
            )}

            <View style={styles.chipsRow}>
              <Chip variant="category" label={categoryLabel} />
              <Chip variant="default" label={conditionLabel} />
            </View>

            <Text style={[styles.postedDate, detailTextFont]} selectable>
              Posted {postedDateLabel}
            </Text>

            <Text style={[styles.descriptionLabel, detailTextFont]}>Description</Text>
            <Text style={[styles.description, detailTextFont]} selectable>
              {listing.description}
            </Text>

            {sellerProfile && (
              <Pressable
                style={({ pressed }) => [styles.sellerBlock, pressed && styles.buttonPressed]}
                onPress={() =>
                  router.push(`/profile/${encodeURIComponent(listing.sellerId)}` as never)
                }
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
                  <Text style={[styles.sellerName, detailTextFont]} selectable>
                    {sellerProfile.name}
                  </Text>
                  <Text style={[styles.sellerMeta, detailTextFont]}>
                    {formatMajorLabel(sellerProfile.major)} - Year {sellerProfile.year}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.muted} />
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
                      <Text style={[styles.markSoldButtonText, detailTextFont]}>Mark as sold</Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
                  onPress={() => router.push(`/listings/${listing._id}/edit`)}
                >
                  <Text style={[styles.editButtonText, detailTextFont]}>Edit listing</Text>
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
                <Text style={[styles.reportLinkText, detailTextFont]}>Report listing</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ReportModal
          isVisible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetId={String(listing._id)}
          targetType="listing"
          onReportSuccess={() => setFlash(REPORT_SUBMITTED_MESSAGE)}
        />
      </Animated.View>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
        visible={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
      <Modal
        visible={messageComposerOpen}
        transparent
        animationType="slide"
        onRequestClose={closeMessageComposer}
      >
        <View style={styles.messageComposerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMessageComposer} />
          <KeyboardUnderlay
            keyboardHeight={messageComposerKeyboardHeight}
            backgroundColor={colors.white}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.messageComposerKeyboardWrap}
          >
            <Reanimated.View
              style={[
                styles.messageComposerSheet,
                messageComposerAnimatedStyle,
                { paddingBottom: insets.bottom + spacing.lg },
              ]}
            >
              <GestureDetector gesture={messageComposerPanGesture}>
                <View style={styles.messageComposerDragRegion}>
                  <View style={styles.messageComposerHandleArea}>
                    <View style={styles.messageComposerGrabber} />
                  </View>
                  <View style={styles.messageComposerHeader}>
                    <View style={styles.messageComposerTitleWrap}>
                      <Text style={styles.messageComposerEyebrow}>Message seller</Text>
                      <Text style={styles.messageComposerTitle}>
                        About &quot;{listing.title}&quot;
                      </Text>
                    </View>
                    <Pressable
                      onPress={closeMessageComposer}
                      style={({ pressed }) => [
                        styles.messageComposerClose,
                        pressed && styles.buttonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Close message composer"
                      disabled={isSendingMessage}
                    >
                      <Feather name="x" size={18} color={colors.textDark} />
                    </Pressable>
                  </View>
                  <View style={styles.messageComposerSellerRow}>
                    <ProfileAvatar
                      uri={sellerAvatarUrl}
                      name={sellerProfile?.name ?? 'Seller'}
                      size={40}
                    />
                    <View style={styles.messageComposerSellerCopy}>
                      <Text style={styles.messageComposerSellerName}>
                        {sellerProfile?.name ?? 'Seller'}
                      </Text>
                      <Text style={styles.messageComposerSellerMeta} numberOfLines={1}>
                        {listing.title}
                      </Text>
                    </View>
                  </View>
                </View>
              </GestureDetector>
              <TextInput
                value={messageBody}
                onChangeText={setMessageBody}
                placeholder="Hi! Is this still available?"
                placeholderTextColor={colors.muted}
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                style={styles.messageComposerInput}
                multiline
                maxLength={2000}
                editable={!isSendingMessage}
                textAlignVertical="top"
                autoFocus
              />
              <View style={styles.messageComposerFooter}>
                <Text style={styles.messageComposerCount}>
                  {Math.min(messageBody.length, 2000)}/2000
                </Text>
                <View style={styles.messageComposerActions}>
                  <Pressable
                    onPress={closeMessageComposer}
                    style={({ pressed }) => [
                      styles.messageComposerSecondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    disabled={isSendingMessage}
                  >
                    <Text style={styles.messageComposerSecondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onSendFirstMessage()}
                    style={({ pressed }) => [
                      styles.messageComposerPrimaryButton,
                      (!messageBody.trim() || isSendingMessage) && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    disabled={!messageBody.trim() || isSendingMessage}
                  >
                    {isSendingMessage ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.messageComposerPrimaryButtonText}>Send</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </Reanimated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    backgroundColor: '#F7F5EF',
  },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
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
  backLink: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    boxShadow: '0 2px 8px rgba(21, 71, 52, 0.06)',
  },
  backLinkText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detailShell: {
    gap: spacing.md,
  },
  detailLayout: {
    gap: spacing.lg,
  },
  detailLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imagePanel: {
    width: '100%',
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFCF4',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    overflow: 'hidden',
    boxShadow: '0 12px 34px rgba(21, 71, 52, 0.11), 0 2px 8px rgba(21, 71, 52, 0.06)',
  },
  detailsPanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    padding: spacing.xl,
    gap: spacing.lg,
    boxShadow: '0 12px 34px rgba(21, 71, 52, 0.10), 0 2px 8px rgba(21, 71, 52, 0.05)',
  },
  imageSection: {
    position: 'relative',
  },
  heroImageWrap: {
    marginRight: 0,
    position: 'relative',
    backgroundColor: '#EEF4F1',
  },
  heroImagePressable: {
    width: '100%',
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
  },
  imagePressed: {
    opacity: 0.96,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(21, 71, 52, 0.12)',
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotInactive: {
    backgroundColor: colors.white,
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
    borderColor: 'rgba(21, 71, 52, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 22px rgba(0, 0, 0, 0.14)',
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
  placeholderImage: {
    width: '100%',
    flex: 1,
    minHeight: 180,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(21, 71, 52, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
  placeholderSubtext: {
    ...typography.footnote,
    color: colors.muted,
    textAlign: 'center',
    letterSpacing: 0,
  },
  headerRow: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.footnoteMed,
    color: colors.primary,
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    color: colors.textDark,
    letterSpacing: 0,
  },
  price: {
    ...typography.title1,
    fontSize: 34,
    lineHeight: 40,
    color: colors.primary,
    letterSpacing: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    boxShadow: '0 12px 24px rgba(21, 71, 52, 0.18)',
  },
  messageButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  postedDate: {
    ...typography.footnote,
    color: colors.primary,
    backgroundColor: 'rgba(172, 221, 202, 0.35)',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  descriptionLabel: {
    ...typography.heading,
    color: colors.textDark,
    paddingTop: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 26,
  },
  sellerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FCF9',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
    padding: spacing.md,
    gap: spacing.md,
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.08)',
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
    minWidth: 0,
    gap: 2,
  },
  sellerName: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.textDark,
  },
  sellerMeta: {
    ...typography.footnote,
    color: colors.text,
    letterSpacing: 0,
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
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.16)',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.06)',
  },
  editButtonText: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '600',
  },
  reportLink: {
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(179, 38, 30, 0.18)',
    backgroundColor: 'rgba(179, 38, 30, 0.06)',
  },
  reportLinkText: {
    ...typography.footnote,
    color: colors.destructive,
    fontWeight: '600',
  },
  messageComposerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12, 22, 18, 0.28)',
  },
  messageComposerKeyboardWrap: {
    width: '100%',
  },
  messageComposerSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    boxShadow: '0 -14px 36px rgba(0, 0, 0, 0.16)',
  },
  messageComposerDragRegion: {
    gap: spacing.sm,
  },
  messageComposerHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    marginTop: -spacing.sm,
  },
  messageComposerGrabber: {
    width: 44,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(21, 71, 52, 0.18)',
  },
  messageComposerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  messageComposerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  messageComposerEyebrow: {
    ...typography.footnote,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  messageComposerTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  messageComposerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageComposerSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F7FCF9',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageComposerSellerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  messageComposerSellerName: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '700',
  },
  messageComposerSellerMeta: {
    ...typography.footnote,
    color: colors.text,
  },
  messageComposerInput: {
    minHeight: 172,
    maxHeight: 240,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FCFFFE',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.subhead,
    color: colors.textDark,
  },
  messageComposerFooter: {
    gap: spacing.sm,
  },
  messageComposerCount: {
    ...typography.footnote,
    color: colors.text,
    textAlign: 'right',
  },
  messageComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  messageComposerSecondaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageComposerSecondaryButtonText: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
  },
  messageComposerPrimaryButton: {
    minHeight: 44,
    minWidth: 108,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageComposerPrimaryButtonText: {
    ...typography.footnoteMed,
    color: colors.white,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
});
