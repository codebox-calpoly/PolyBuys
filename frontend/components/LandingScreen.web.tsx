import { useEffect } from 'react';
import Head from 'expo-router/head';
import polybuysIcon from '../assets/images/icon.png';
import { Footer, GetApp, GLOBAL_CSS, Hero, Nav, Why, useScrolled } from './landing';
import { toWebImageSrc } from './landing/assetSource';
import { scrollToLandingHash } from './landing/scrollToLandingSection';

const faviconHref = toWebImageSrc(polybuysIcon);

export default function LandingScreen() {
  const scrolled = useScrolled();

  useEffect(() => {
    scrollToLandingHash();
    window.addEventListener('hashchange', scrollToLandingHash);

    return () => window.removeEventListener('hashchange', scrollToLandingHash);
  }, []);

  return (
    <>
      <Head>
        <title>PolyBuys — the Cal Poly student marketplace</title>
        <meta
          name="description"
          content="Buy and sell with verified Cal Poly students. Textbooks, housing, bikes, furniture — browse on the web or get the iOS app."
        />
        <meta name="theme-color" content="#ffffff" />
        {faviconHref ? (
          <>
            <link rel="icon" type="image/png" href={faviconHref} />
            <link rel="apple-touch-icon" href={faviconHref} />
          </>
        ) : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Fraunces:SOFT,opsz,wght@0..100,9..144,300..900&family=Inter:wght@400;500;600;700&display=swap"
        />
      </Head>
      <style>{GLOBAL_CSS}</style>

      <div className="pb-web-scroll-shell">
        <Nav scrolled={scrolled} />

        <main className="pb-page">
          <Hero />
          <Why />
          <GetApp />
          <Footer />
        </main>
      </div>
    </>
  );
}
