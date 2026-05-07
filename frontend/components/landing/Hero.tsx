import { useRouter } from 'expo-router';
import { AvatarStack } from './AvatarStack';
import { Button } from './Button';
import { DownloadButton } from './DownloadButton';
import { Eyebrow } from './Eyebrow';
import { ListingCard } from './ListingCard';
import { Ticker } from './Ticker';
import { AVATAR_STACK, HERO_LISTINGS } from './data';

export function Hero() {
  const router = useRouter();

  return (
    <section className="pb-hero" aria-labelledby="hero-title">
      <div className="pb-hero__grid">
        <div className="pb-hero__copy">
          <Eyebrow>Cal Poly · Student marketplace</Eyebrow>

          <h1 id="hero-title" className="pb-hero__title">
            Buy {'&'} sell on campus,{' '}
            <span className="pb-hero__accent">
              without the noise.
              <HeroUnderline />
            </span>
          </h1>

          <p className="pb-hero__sub">
            PolyBuys is the marketplace for Mustangs — textbooks, subleases, furniture, and daily
            essentials from people who share your campus.
          </p>

          <div className="pb-hero__ctas">
            <DownloadButton size="lg" />
            <Button variant="ghost" size="lg" onClick={() => router.push('/home')} trailingArrow>
              Browse listings
            </Button>
          </div>

          <SocialProof />
        </div>

        <HeroStage />
      </div>

      <Ticker />
    </section>
  );
}

function HeroUnderline() {
  return (
    <svg className="pb-hero__underline" viewBox="0 0 220 14" aria-hidden preserveAspectRatio="none">
      <path
        d="M2 10 C 40 3, 90 3, 120 8 S 200 12, 218 5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function SocialProof() {
  return (
    <div className="pb-proof">
      <AvatarStack items={AVATAR_STACK} />
      <p className="pb-proof__text">
        <strong>Mustangs only</strong> — verified by Cal Poly email
      </p>
    </div>
  );
}

function HeroStage() {
  return (
    <aside className="pb-hero__stage" aria-label="Example PolyBuys listings">
      <div className="pb-orb pb-orb--a" aria-hidden />
      <div className="pb-orb pb-orb--b" aria-hidden />
      <div className="pb-stack">
        <ListingCard listing={HERO_LISTINGS[1]} variant="back" />
        <ListingCard listing={HERO_LISTINGS[0]} variant="front" />
      </div>
    </aside>
  );
}
