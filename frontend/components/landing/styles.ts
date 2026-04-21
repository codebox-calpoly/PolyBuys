export const GLOBAL_CSS = `
:root {
  --pb-ink: #14130F;
  --pb-ink-2: #4A4A48;
  --pb-ink-3: #7A7A74;
  --pb-cream: #FAF6EC;
  --pb-cream-2: #F3ECDA;
  --pb-surface: #FFFFFF;
  --pb-green: #154734;
  --pb-green-2: #1E5C44;
  --pb-green-3: #0E2E22;
  --pb-gold: #E2A84A;
  --pb-gold-2: #C78D2E;
  --pb-coral: #FF6E5E;
  --pb-border: rgba(21, 71, 52, 0.10);
  --pb-border-strong: rgba(21, 71, 52, 0.18);
  --pb-radius-sm: 10px;
  --pb-radius-md: 16px;
  --pb-radius-lg: 22px;
  --pb-radius-xl: 28px;
  --pb-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}

html, body, #root, #__next { background: var(--pb-cream); }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  color: var(--pb-ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Full-viewport scroll container: Expo’s stack wraps screens in overflow:hidden + flex height.
   Scrolling the document doesn’t reveal clipped content; this shell scrolls instead.
   Used by the marketing landing page and legal pages (privacy / terms) on web. */
.pb-web-scroll-shell {
  position: fixed;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
* { box-sizing: border-box; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

.pb-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(226, 168, 74, 0.18), transparent 60%),
    radial-gradient(900px 500px at -10% 20%, rgba(21, 71, 52, 0.10), transparent 60%),
    var(--pb-cream);
}

/* ---------- NAV ---------- */
.pb-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--pb-cream);
  border-bottom: 1px solid var(--pb-border);
  transition: border-color 200ms var(--pb-ease);
}
.pb-nav.is-scrolled {
  border-bottom-color: var(--pb-border-strong);
}
.pb-nav__inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.pb-nav__links {
  display: none;
  align-items: center;
  gap: 28px;
}
.pb-nav__link {
  position: relative;
  font-size: 14px;
  font-weight: 500;
  color: var(--pb-ink-2);
  transition: color 150ms ease;
}
.pb-nav__link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -3px;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 180ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .pb-nav__link:hover { color: var(--pb-ink); }
  .pb-nav__link:hover::after {
    transform: scaleX(1);
  }
}
.pb-nav__cta { display: flex; align-items: center; gap: 8px; }
@media (min-width: 860px) { .pb-nav__links { display: flex; } }

/* ---------- BRAND ---------- */
.pb-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--pb-green);
}
.pb-brand__mark {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--pb-green);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pb-brand__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--pb-gold);
  border: 2px solid rgba(226, 168, 74, 0.35);
}
.pb-brand--muted { color: var(--pb-ink-2); }
.pb-brand--muted .pb-brand__mark { background: var(--pb-ink-2); }

/* ---------- BUTTONS ---------- */
.pb-btn {
  --h: 44px;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 999px;
  padding: 0 22px;
  height: var(--h);
  font-family: inherit;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.005em;
  cursor: pointer;
  text-decoration: none;
  transition: transform 200ms var(--pb-ease), background 200ms var(--pb-ease),
    color 200ms var(--pb-ease), border-color 200ms var(--pb-ease);
  white-space: nowrap;
}
.pb-btn:focus-visible {
  outline: 3px solid rgba(226, 168, 74, 0.55);
  outline-offset: 3px;
}
.pb-btn--sm { --h: 36px; padding: 0 16px; font-size: 14px; }
.pb-btn--md { --h: 44px; }
.pb-btn--lg { --h: 54px; padding: 0 26px; font-size: 16px; }
.pb-btn--primary {
  background: var(--pb-green);
  color: #FFF8E8;
}
.pb-btn--primary:hover:not(:active) {
  background: var(--pb-green-2);
  transform: translateY(-1px);
}
.pb-btn--primary:active {
  transform: scale(0.98);
}
.pb-btn--ghost {
  background: transparent;
  color: var(--pb-ink);
  border: 1px solid var(--pb-border-strong);
}
.pb-btn--ghost:hover {
  background: rgba(21, 71, 52, 0.06);
  border-color: rgba(21, 71, 52, 0.28);
}
.pb-btn--ghostOnDark {
  background: transparent;
  color: #FFF8E8;
  border: 1px solid rgba(255, 248, 232, 0.35);
}
.pb-btn--ghostOnDark:hover {
  background: rgba(255, 248, 232, 0.08);
  border-color: rgba(255, 248, 232, 0.6);
}
.pb-btn--cream {
  background: #FFF8E8;
  color: var(--pb-green);
}
.pb-btn--cream:hover:not(:active) {
  background: #fff;
  color: var(--pb-green-2);
  transform: translateY(-1px);
}
.pb-btn--cream:active {
  transform: scale(0.98);
}
.pb-btn--ghost:active,
.pb-btn--ghostOnDark:active {
  transform: scale(0.98);
}
.pb-btn__arrow {
  display: inline-block;
  transform: translateX(0);
  transition: transform 220ms var(--pb-ease);
  font-weight: 400;
}
.pb-btn:hover .pb-btn__arrow { transform: translateX(3px); }

/* ---------- EYEBROW ---------- */
.pb-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--pb-green);
}
.pb-eyebrow--muted { color: var(--pb-ink-3); }
.pb-eyebrow--onDark { color: rgba(255, 248, 232, 0.75); }
.pb-eyebrow__dot {
  width: 6px; height: 6px; border-radius: 999px; background: currentColor;
  opacity: 0.7;
}

/* ---------- HERO ---------- */
.pb-hero {
  padding: 40px 24px 24px;
  max-width: 1160px;
  margin: 0 auto;
  position: relative;
}
.pb-hero__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: center;
  padding: 40px 0 32px;
}
.pb-hero__copy { display: flex; flex-direction: column; gap: 22px; max-width: 620px; }
.pb-hero__title {
  font-family: 'Cormorant', Georgia, 'Times New Roman', serif;
  font-weight: 600;
  font-size: clamp(44px, 7vw, 88px);
  line-height: 0.98;
  letter-spacing: -0.028em;
  margin: 0;
  color: var(--pb-ink);
}
.pb-hero__accent {
  position: relative;
  display: inline-block;
  white-space: nowrap;
  font-style: italic;
  color: var(--pb-green);
}
.pb-hero__underline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -0.08em;
  width: 100%;
  height: 0.18em;
  color: var(--pb-gold);
  opacity: 0.9;
  stroke-dasharray: 260;
  stroke-dashoffset: 260;
  animation: pb-draw 900ms 350ms var(--pb-ease) forwards;
}
@keyframes pb-draw { to { stroke-dashoffset: 0; } }
.pb-hero__sub {
  font-size: clamp(16px, 1.4vw, 19px);
  line-height: 1.55;
  color: var(--pb-ink-2);
  margin: 0;
  max-width: 560px;
}
.pb-hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.pb-proof { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.pb-proof__avatars { display: inline-flex; }
.pb-proof__avatar {
  width: 30px; height: 30px; border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--pb-cream);
  margin-left: -8px;
}
.pb-proof__avatar:first-child { margin-left: 0; }
.pb-proof__text { margin: 0; font-size: 14px; color: var(--pb-ink-2); }
.pb-proof__text strong { color: var(--pb-ink); font-weight: 600; }

/* ---------- HERO STAGE (preview cards) ---------- */
.pb-hero__stage {
  position: relative;
  height: 460px;
  display: none;
}
@media (min-width: 960px) {
  .pb-hero__grid { grid-template-columns: 1.1fr 1fr; gap: 56px; }
  .pb-hero__stage { display: block; }
}
.pb-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(50px);
  opacity: 0.7;
}
.pb-orb--a {
  width: 340px; height: 340px;
  background: radial-gradient(circle, rgba(226, 168, 74, 0.8), transparent 70%);
  top: -40px; right: -60px;
  animation: pb-float 12s ease-in-out infinite;
}
.pb-orb--b {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(21, 71, 52, 0.35), transparent 70%);
  bottom: -40px; left: -40px;
  animation: pb-float 14s -3s ease-in-out infinite;
}
@keyframes pb-float {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(10px, -12px, 0) scale(1.04); }
}

.pb-stack { position: absolute; inset: 0; }
.pb-icon { display: block; }
.pb-preview {
  position: absolute;
  width: 280px;
  border-radius: var(--pb-radius-lg);
  background: var(--pb-surface);
  overflow: hidden;
  border: 1px solid var(--pb-border);
  transition: transform 500ms var(--pb-ease), border-color 260ms var(--pb-ease);
  will-change: transform;
}
.pb-preview--back {
  top: 30px;
  left: 0;
  transform: rotate(-6deg);
  width: 260px;
  animation: pb-heroCardDrift 12s ease-in-out infinite;
  animation-delay: -1.5s;
}
.pb-preview--front {
  top: 70px;
  right: 0;
  transform: rotate(4deg);
  animation: pb-heroCardDrift 14s ease-in-out infinite;
  animation-delay: -3.5s;
}
@keyframes pb-heroCardDrift {
  0%, 100% { transform: rotate(var(--r, -6deg)) translate3d(0, 0, 0); }
  20% { transform: rotate(calc(var(--r) + 0.9deg)) translate3d(8px, -14px, 0); }
  45% { transform: rotate(calc(var(--r) - 0.5deg)) translate3d(-6px, 8px, 0); }
  70% { transform: rotate(calc(var(--r) + 0.4deg)) translate3d(10px, 6px, 0); }
}
.pb-preview--back { --r: -6deg; }
.pb-preview--front { --r: 4deg; }
.pb-preview:hover {
  transform: rotate(0) translateY(-6px);
  border-color: var(--pb-border-strong);
}
/* Back = gold hero card, front = green hero card (see HeroStage stack order). */
.pb-preview--back .pb-preview__thumbIcon { color: rgba(21, 71, 52, 0.92); }
.pb-preview--front .pb-preview__thumbIcon { color: rgba(255, 248, 232, 0.95); }
.pb-preview__thumb {
  position: relative;
  aspect-ratio: 16 / 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pb-preview__thumbIcon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.pb-preview__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #FFF8E8;
  color: var(--pb-green);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--pb-border);
}
.pb-preview__body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
.pb-preview__title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: 17px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  margin: 4px 0 2px;
  color: var(--pb-ink);
}
.pb-preview__foot { display: flex; align-items: baseline; gap: 4px; font-size: 13px; color: var(--pb-ink-3); }
.pb-preview__price { color: var(--pb-ink); font-weight: 600; }
.pb-preview__seller { color: var(--pb-ink-3); }

/* ---------- TICKER ---------- */
.pb-ticker {
  position: relative;
  margin-top: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--pb-border);
  border-bottom: 1px solid var(--pb-border);
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}
.pb-ticker__track {
  display: flex;
  gap: 40px;
  width: max-content;
  animation: pb-marquee 50s linear infinite;
}
@media (hover: hover) and (pointer: fine) {
  .pb-ticker:hover .pb-ticker__track {
    animation-play-state: paused;
  }
}
.pb-ticker__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--pb-ink-3);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.pb-ticker__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pb-green);
  opacity: 0.85;
}
@keyframes pb-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ---------- CHIP ---------- */
.pb-chip {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(21, 71, 52, 0.08);
  color: var(--pb-green);
}

/* ---------- SECTION ---------- */
.pb-section {
  max-width: 1160px;
  margin: 0 auto;
  padding: 72px 24px;
}
.pb-section__head {
  max-width: 720px;
  margin: 0 auto 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.pb-section__title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: clamp(32px, 4.5vw, 52px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  margin: 0;
  color: var(--pb-ink);
}
.pb-section__title em {
  font-style: italic;
  color: var(--pb-green);
}
.pb-section__sub {
  font-size: 17px;
  line-height: 1.55;
  color: var(--pb-ink-2);
  margin: 0;
  max-width: 580px;
}
.pb-section__foot { margin-top: 40px; display: flex; justify-content: center; }

/* ---------- REVEAL (scroll) + WHY ---------- */
.pb-why__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 780px) {
  .pb-why__grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
}
.pb-why.pb-reveal:not(.pb-reveal--visible) .pb-section__head {
  opacity: 0;
  transform: translateY(12px);
}
.pb-why.pb-reveal.pb-reveal--visible .pb-section__head {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 450ms cubic-bezier(0.19, 1, 0.22, 1), transform 450ms cubic-bezier(0.19, 1, 0.22, 1);
}
.pb-why.pb-reveal:not(.pb-reveal--visible) .pb-why__card {
  opacity: 0;
  transform: translateY(14px);
}
.pb-why.pb-reveal.pb-reveal--visible .pb-why__card {
  animation-name: pb-revealCard;
  animation-duration: 0.45s;
  animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
  animation-fill-mode: both;
}
.pb-why.pb-reveal.pb-reveal--visible .pb-why__card:nth-child(1) { animation-delay: 0.06s; }
.pb-why.pb-reveal.pb-reveal--visible .pb-why__card:nth-child(2) { animation-delay: 0.12s; }
.pb-why.pb-reveal.pb-reveal--visible .pb-why__card:nth-child(3) { animation-delay: 0.18s; }
@keyframes pb-revealCard {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
.pb-why__card {
  background: var(--pb-surface);
  border: 1px solid var(--pb-border);
  border-radius: var(--pb-radius-lg);
  padding: 28px 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 260ms var(--pb-ease), border-color 260ms var(--pb-ease);
}
.pb-why.pb-reveal.pb-reveal--visible .pb-why__card:hover {
  transform: translateY(-2px);
  border-color: var(--pb-border-strong);
}
.pb-why__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(21, 71, 52, 0.06);
  color: var(--pb-green);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pb-why__title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 4px 0 0;
  color: var(--pb-ink);
}
.pb-why__body {
  font-size: 15px;
  line-height: 1.55;
  color: var(--pb-ink-2);
  margin: 0;
}

/* ---------- GET APP ---------- */
.pb-getapp {}
.pb-getapp.pb-reveal:not(.pb-reveal--visible) .pb-getapp__panel {
  opacity: 0;
  transform: translateY(16px);
}
.pb-getapp.pb-reveal.pb-reveal--visible .pb-getapp__panel {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 480ms cubic-bezier(0.19, 1, 0.22, 1), transform 480ms cubic-bezier(0.19, 1, 0.22, 1);
}
.pb-getapp__panel {
  position: relative;
  border-radius: var(--pb-radius-xl);
  padding: 56px clamp(24px, 4vw, 56px);
  color: #FFF8E8;
  background: var(--pb-green);
  border: 1px solid rgba(255, 248, 232, 0.12);
  overflow: hidden;
}
.pb-getapp__text {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;
}
.pb-getapp__title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  margin: 0;
  color: #FFF8E8;
}
.pb-getapp__sub {
  font-size: 16px;
  line-height: 1.55;
  color: rgba(255, 248, 232, 0.8);
  margin: 0;
  max-width: 480px;
}
.pb-getapp__ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 6px; }
.pb-getapp__footnote {
  font-size: 12px;
  color: rgba(255, 248, 232, 0.55);
  margin: 8px 0 0;
  max-width: 420px;
}
/* ---------- FOOTER ---------- */
.pb-footer {
  border-top: 1px solid var(--pb-border);
  margin-top: 48px;
}
.pb-footer__inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 28px 24px calc(40px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.pb-footer__note {
  font-size: 13px;
  color: var(--pb-ink-3);
  margin: 0;
  max-width: 520px;
  line-height: 1.55;
}
.pb-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
}
.pb-footer__link {
  font-size: 13px;
  font-weight: 600;
  color: var(--pb-green);
  transition: color 150ms var(--pb-ease);
}
.pb-footer__link:hover { color: var(--pb-green-2); }

/* ---------- LEGAL DOCS ---------- */
.pb-doc {
  display: flex;
  flex-direction: column;
}
.pb-doc__shell {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 28px 24px 0;
}
.pb-doc__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.pb-doc__navLinks {
  display: flex;
  align-items: center;
  gap: 10px 18px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pb-doc__navLink {
  font-size: 14px;
  font-weight: 600;
  color: var(--pb-ink-2);
  transition: color 150ms var(--pb-ease);
}
.pb-doc__navLink:hover { color: var(--pb-ink); }
.pb-doc__card {
  background: rgba(255,255,255,0.94);
  border: 1px solid var(--pb-border);
  border-radius: var(--pb-radius-xl);
  padding: clamp(24px, 4vw, 54px);
  margin-bottom: 32px;
}
.pb-doc__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pb-green);
}
.pb-doc__title {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: clamp(36px, 5vw, 60px);
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--pb-ink);
}
.pb-doc__meta {
  margin: 14px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--pb-ink-3);
}
.pb-doc__lede {
  margin-top: 24px;
  display: grid;
  gap: 14px;
}
.pb-doc__paragraph,
.pb-doc__lede p {
  margin: 0;
  font-size: 16px;
  line-height: 1.72;
  color: var(--pb-ink-2);
}
.pb-doc__sections {
  margin-top: 26px;
  display: grid;
}
.pb-doc__section {
  padding: 22px 0;
  border-top: 1px solid var(--pb-border);
}
.pb-doc__sectionTitle {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 500;
  font-size: 28px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--pb-ink);
}
.pb-doc__list {
  margin: 14px 0 0;
  padding-left: 22px;
  display: grid;
  gap: 10px;
}
.pb-doc__list li {
  font-size: 15px;
  line-height: 1.65;
  color: var(--pb-ink);
}
.pb-doc__actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
@media (max-width: 700px) {
  .pb-doc__nav {
    flex-direction: column;
    align-items: flex-start;
  }
  .pb-doc__navLinks {
    justify-content: flex-start;
  }
}

/* ---------- APPLE ICON ---------- */
.pb-apple-icon {
  display: inline-block;
  vertical-align: -2px;
  margin-right: 2px;
}

/* ---------- DOWNLOAD QR MODAL ---------- */
/* No opacity animation on this wrapper: animating parent opacity breaks/defers child
   backdrop-filter in WebKit/Blink (dim + blur appears late). Card keeps pb-popIn only. */
.pb-qrmodal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.pb-qrmodal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(20, 30, 25, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.pb-qrmodal__card {
  position: relative;
  background: #fff;
  border-radius: var(--pb-radius-xl);
  padding: 28px 32px 22px;
  border: 1px solid var(--pb-border);
  width: min(320px, 100%);
  flex-shrink: 0;
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  animation: pb-popIn 220ms var(--pb-ease);
}
.pb-qrmodal__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--pb-ink);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  letter-spacing: -0.01em;
}
.pb-qrmodal__qr {
  width: 232px;
  height: 232px;
  border-radius: 10px;
  background: #fff;
}
.pb-qrmodal__caption {
  margin: 0;
  font-size: 13px;
  color: var(--pb-ink-3);
}
.pb-qrmodal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: 0;
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  font-size: 14px;
  color: var(--pb-ink-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms var(--pb-ease), color 150ms var(--pb-ease);
}
.pb-qrmodal__close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--pb-ink);
}
.pb-qrmodal__close:focus-visible {
  outline: 3px solid rgba(226, 168, 74, 0.55);
  outline-offset: 2px;
}
@keyframes pb-popIn {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

/* ---------- MOTION PREFS ---------- */
@media (prefers-reduced-motion: reduce) {
  .pb-orb, .pb-preview--back, .pb-preview--front, .pb-ticker__track { animation: none !important; }
  .pb-preview--back { transform: rotate(-6deg); }
  .pb-preview--front { transform: rotate(4deg); }
  .pb-hero__underline { stroke-dashoffset: 0; animation: none; }
  .pb-qrmodal__card { animation: none !important; }
  .pb-why .pb-section__head,
  .pb-why .pb-why__card,
  .pb-getapp .pb-getapp__panel {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
  .pb-nav__link::after { display: none; }
  * { transition: none !important; }
}
`;
