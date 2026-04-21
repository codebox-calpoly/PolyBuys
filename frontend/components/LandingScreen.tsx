import Head from 'expo-router/head';
import { Link, useRouter, type Href } from 'expo-router';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_STORE_URL } from '../constants/app';
import qrDownloadPng from '../assets/images/polybuys-download-qr.png';
import { AppButton, AppText, SectionCard } from './ui';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

/* eslint-disable react-native/no-raw-text -- AppButton and expo-router Head handle text appropriately. */

/** Official App Store badge artwork (Apple Marketing Resources). */
const APP_STORE_BADGE_URI =
  'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83';

const LAYOUT_BREAKPOINT = 768;

const HOME_HREF = '/' as Href;
const SUPPORT_PAGE_HREF = '/support' as Href;
const PRIVACY_PAGE_HREF = '/privacy' as Href;
const TERMS_PAGE_HREF = '/terms' as Href;

function openDownloadLinkEmail() {
  const subject = encodeURIComponent('PolyBuys — download link');
  const body = encodeURIComponent(
    `Here's the link to get PolyBuys:\n\n${APP_STORE_URL}\n\nOpen it on your phone to install or download.\n`
  );
  void Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
}

const VALUE_POINTS = [
  {
    title: 'Students only',
    body: 'Cal Poly email sign-in runs in the iOS app so listings stay in the campus community.',
  },
  {
    title: 'Built for how you actually buy',
    body: 'Textbooks, housing, furniture, and everyday gear — organized for quick browsing and search.',
  },
  {
    title: 'Campus-first trust',
    body: 'Clear seller profiles and in-app messaging help you coordinate pickups without giving out extra contact info.',
  },
] as const;

export default function LandingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= LAYOUT_BREAKPOINT;

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>PolyBuys — campus marketplace for Cal Poly</title>
          <meta
            name="description"
            content="Buy and sell with verified Cal Poly students. Textbooks, housing, and more — browse on web or get the iOS app."
          />
        </Head>
      ) : null}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Link href={HOME_HREF} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Go to marketplace"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.brandMark}>PolyBuys</Text>
            </Pressable>
          </Link>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <AppText variant="footnote" color="primary" style={styles.eyebrow}>
              Cal Poly · Student marketplace
            </AppText>
            <AppText variant="title1" color="textDark" style={styles.heroTitle}>
              Buy and sell on campus, without the noise.
            </AppText>
            <AppText variant="body" color="text" style={styles.heroSubtitle}>
              PolyBuys is the marketplace for Mustangs — textbooks, subleases, furniture, and daily
              essentials from people who share your campus.
            </AppText>
            <View style={styles.ctaRow}>
              <AppButton
                size="lg"
                onPress={() => router.push(HOME_HREF)}
                accessibilityLabel="Browse marketplace"
              >
                Browse marketplace
              </AppButton>
            </View>
          </View>

          <SectionCard title="Why PolyBuys" subtitle="A calmer way to trade with classmates.">
            <View style={styles.valueList}>
              {VALUE_POINTS.map((item) => (
                <View key={item.title} style={styles.valueItem}>
                  <AppText variant="heading" color="textDark" style={styles.valueTitle}>
                    {item.title}
                  </AppText>
                  <AppText variant="subhead" color="text">
                    {item.body}
                  </AppText>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard
            title="Get the app"
            subtitle="Browse listings on the web. Download the app to post, message sellers, and sign in with your Cal Poly email."
          >
            {isDesktopWeb ? (
              <View style={styles.getAppDesktop}>
                <View style={styles.qrBlock}>
                  <Image
                    source={qrDownloadPng}
                    style={styles.qrImage}
                    accessibilityLabel="QR code linking to the PolyBuys download page"
                  />
                  <AppText variant="footnoteMed" color="text" style={styles.qrCaption}>
                    Scan with your phone to open the download link.
                  </AppText>
                </View>
                <View style={styles.emailBlock}>
                  <AppText variant="subhead" color="text" style={styles.emailBlurb}>
                    Prefer email? We’ll open a draft with the link so you can send it to yourself or
                    a friend.
                  </AppText>
                  <AppButton variant="ghost" size="md" onPress={openDownloadLinkEmail}>
                    Email the download link
                  </AppButton>
                </View>
              </View>
            ) : (
              <View style={styles.getAppMobile}>
                {Platform.OS === 'web' ? (
                  <Link
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    accessibilityLabel="Download on the App Store"
                    asChild
                  >
                    <Pressable
                      accessibilityRole="link"
                      style={({ pressed }) => [styles.badgePressable, pressed && styles.pressed]}
                    >
                      <Image
                        source={{ uri: APP_STORE_BADGE_URI }}
                        style={styles.appStoreBadge}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    </Pressable>
                  </Link>
                ) : (
                  <Pressable
                    onPress={() => void Linking.openURL(APP_STORE_URL)}
                    accessibilityRole="link"
                    accessibilityLabel="Download on the App Store"
                    style={({ pressed }) => [styles.badgePressable, pressed && styles.pressed]}
                  >
                    <Image
                      source={{ uri: APP_STORE_BADGE_URI }}
                      style={styles.appStoreBadge}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </Pressable>
                )}
                <AppText variant="footnote" color="muted" style={styles.badgeFootnote}>
                  Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and
                  other countries. App Store is a service mark of Apple Inc.
                </AppText>
              </View>
            )}
          </SectionCard>

          {Platform.OS === 'web' ? (
            <View style={styles.legalLinksRow}>
              <Link href={SUPPORT_PAGE_HREF} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Support"
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <AppText variant="footnoteMed" color="primary">
                    Support
                  </AppText>
                </Pressable>
              </Link>
              <AppText variant="footnote" color="muted" style={styles.legalLinksSep}>
                ·
              </AppText>
              <Link href={PRIVACY_PAGE_HREF} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Privacy Policy"
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <AppText variant="footnoteMed" color="primary">
                    Privacy
                  </AppText>
                </Pressable>
              </Link>
              <AppText variant="footnote" color="muted" style={styles.legalLinksSep}>
                ·
              </AppText>
              <Link href={TERMS_PAGE_HREF} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Terms of Service"
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <AppText variant="footnoteMed" color="primary">
                    Terms
                  </AppText>
                </Pressable>
              </Link>
            </View>
          ) : null}

          <AppText variant="footnote" color="muted" style={styles.footerNote}>
            PolyBuys is an independent student marketplace and is not affiliated with California
            Polytechnic State University.
          </AppText>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  brandMark: {
    ...typography.title1,
    fontSize: 26,
    lineHeight: 32,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 40,
  },
  heroSubtitle: {
    lineHeight: 24,
    maxWidth: 640,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  valueList: {
    gap: spacing.lg,
  },
  valueItem: {
    gap: spacing.xs,
  },
  valueTitle: {
    fontSize: 17,
  },
  getAppDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxl,
    alignItems: 'flex-start',
  },
  qrBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  qrCaption: {
    textAlign: 'center',
    maxWidth: 220,
  },
  emailBlock: {
    flex: 1,
    minWidth: 240,
    gap: spacing.md,
  },
  emailBlurb: {
    lineHeight: 22,
  },
  getAppMobile: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  badgePressable: {},
  appStoreBadge: {
    width: 250,
    height: 83,
  },
  badgeFootnote: {
    lineHeight: 18,
    maxWidth: 320,
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legalLinksSep: {
    lineHeight: 18,
  },
  footerNote: {
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
