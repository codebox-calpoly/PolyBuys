/**
 * AppNav.web.tsx — web-only app navbar for /home.
 *
 * Rendered by (tabs)/_layout.tsx → WebLayout → <AppNavContainer />.
 * The outer shell uses React Native View + StyleSheet so it participates
 * correctly in the RN flex column layout (navbar above, Slot below).
 * Inner elements use real HTML for CSS hover/focus/transition states.
 *
 * Layout: LEFT (logo) | CENTER (search) | RIGHT (Download app)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSearch } from '../contexts/SearchContext';
import polybuysLogo from '../assets/images/PolyBuysLogo.png';
import { AppleIcon } from './landing/AppleIcon';
import { toWebImageSrc } from './landing/assetSource';

const DOWNLOAD_APP_LABEL = 'Download the app';

// ─── CSS for inner HTML elements ─────────────────────────────────────────────
// Plain string constant — avoids react-native/no-raw-text ESLint crash.
// Only covers elements that need CSS hover/focus/transition — the outer
// shell dimensions and background come from React Native StyleSheet below.

const NAV_CSS =
  /* reset */
  '.pbn*,.pbn*::before,.pbn*::after{box-sizing:border-box}' +
  '.pbn a{text-decoration:none;color:inherit}' +
  /* reset form controls inside the web nav */
  '.pbn button{font-family:inherit;cursor:pointer;border:none;padding:0;background:none}' +
  '.pbn input{font-family:inherit;outline:none}' +
  /* ── inner row: 3-column grid ── */
  '.pbn__row{' +
  'max-width:1280px;margin:0 auto;' +
  'padding:0 28px;height:72px;' +
  'display:grid;' +
  'grid-template-columns:auto 1fr auto;' +
  'align-items:center;gap:20px;' +
  'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
  'color:#14130F;' +
  '-webkit-font-smoothing:antialiased' +
  '}' +
  /* ── LEFT: brand ── */
  '.pbn__brand{' +
  'display:inline-flex;align-items:center;' +
  'flex-shrink:0;text-decoration:none;cursor:pointer;' +
  'transition:opacity 150ms ease' +
  '}' +
  '.pbn__brand:hover{opacity:0.78}' +
  '.pbn__brand:focus-visible{outline:3px solid rgba(226,168,74,0.65);outline-offset:4px;border-radius:8px}' +
  '.pbn__logo{display:block;width:148px;height:auto;aspect-ratio:716/158;object-fit:contain}' +
  /* ── CENTER: search — fully opaque white, strong border ── */
  '.pbn__search{' +
  'position:relative;display:flex;align-items:center;' +
  'max-width:520px;width:100%;justify-self:center' +
  '}' +
  '.pbn__search-icon{' +
  'position:absolute;left:16px;top:50%;transform:translateY(-50%);' +
  'pointer-events:none;color:#6EA48E;display:flex;align-items:center;' +
  'transition:color 180ms ease' +
  '}' +
  '.pbn__search:focus-within .pbn__search-icon{color:#154734}' +
  '.pbn__search-input{' +
  'width:100%;height:46px;padding:0 44px 0 46px;' +
  'border-radius:999px;' +
  /* Fully opaque white — clearly distinct from the cream navbar */
  'border:1.5px solid rgba(21,71,52,0.22);' +
  'background:#FFFFFF;' +
  'font-size:14px;font-weight:500;color:#14130F;letter-spacing:0;' +
  'box-shadow:0 1px 3px rgba(21,71,52,0.08) inset;' +
  'transition:border-color 180ms ease,box-shadow 180ms ease;' +
  '-webkit-appearance:none;appearance:none' +
  '}' +
  '.pbn__search-input::placeholder{color:#7A7A74;font-weight:400}' +
  '.pbn__search-input:hover{border-color:rgba(21,71,52,0.36)}' +
  '.pbn__search-input:focus{' +
  'border-color:#154734;' +
  'box-shadow:0 0 0 3px rgba(21,71,52,0.12),0 1px 3px rgba(21,71,52,0.08) inset' +
  '}' +
  '.pbn__search-input::-webkit-search-decoration,' +
  '.pbn__search-input::-webkit-search-cancel-button{display:none}' +
  '.pbn__search-clear{' +
  'position:absolute;right:13px;top:50%;transform:translateY(-50%);' +
  'width:24px;height:24px;border-radius:999px;' +
  'background:rgba(21,71,52,0.12);' +
  'display:flex;align-items:center;justify-content:center;' +
  'color:#154734;cursor:pointer;' +
  'transition:background 140ms ease,color 140ms ease,transform 140ms ease' +
  '}' +
  '.pbn__search-clear:hover{background:#154734;color:#fff;transform:translateY(-50%) scale(1.10)}' +
  /* ── RIGHT: actions ── */
  '.pbn__actions{display:flex;align-items:center;justify-self:end;flex-shrink:0}' +
  '.pbn__download{' +
  'appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;' +
  'height:36px;padding:0 16px;border-radius:999px;border:0;' +
  'background:#154734;color:#FFF8E8;' +
  'font-size:14px;font-weight:600;letter-spacing:0;line-height:1;white-space:nowrap;cursor:pointer;' +
  'transition:transform 200ms cubic-bezier(0.2,0.7,0.2,1),background 200ms cubic-bezier(0.2,0.7,0.2,1),color 200ms cubic-bezier(0.2,0.7,0.2,1),border-color 200ms cubic-bezier(0.2,0.7,0.2,1)' +
  '}' +
  '.pbn__download .pb-apple-icon{display:inline-block;vertical-align:-2px;margin-right:2px;flex-shrink:0}' +
  '.pbn__download:hover:not(:active){background:#1E5C44;transform:translateY(-1px)}' +
  '.pbn__download:active{transform:scale(0.98)}' +
  '.pbn__download:focus-visible{outline:3px solid rgba(226,168,74,0.55);outline-offset:3px}' +
  /* ── compact row (mobile < 640px) ── */
  '.pbn__compact{display:none;padding:0 16px 12px;align-items:center}' +
  '.pbn__search--full{max-width:none;flex:1}' +
  /* ── responsive ── */
  '@media(max-width:479px){' +
  '.pbn__row{height:56px;padding:0 12px;gap:8px;grid-template-columns:auto auto;justify-content:space-between}' +
  '.pbn__search{display:none}' +
  '.pbn__compact{display:flex}' +
  '.pbn__logo{width:106px}' +
  '.pbn__download{height:34px;padding:0 11px;font-size:13px;gap:7px}' +
  '.pbn__download .pb-apple-icon{width:11px;height:auto;margin-right:0}' +
  '}' +
  '@media(min-width:480px) and (max-width:639px){' +
  '.pbn__row{height:60px;padding:0 16px;gap:12px;grid-template-columns:auto auto;justify-content:space-between}' +
  '.pbn__search{display:none}' +
  '.pbn__compact{display:flex}' +
  '.pbn__logo{width:124px}' +
  '}' +
  '@media(min-width:640px) and (max-width:899px){' +
  '.pbn__row{padding:0 20px;gap:14px}' +
  '.pbn__search{max-width:260px}' +
  '.pbn__download{padding:0 14px}' +
  '}' +
  /* ── reduced motion ── */
  '@media(prefers-reduced-motion:reduce){' +
  '.pbn__brand,.pbn__search-input,.pbn__download,.pbn__search-clear{transition:none!important}' +
  '}';

// ─── SVG icons ────────────────────────────────────────────────────────────────

function SearchSvg() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseSvg() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AppNavProps {
  onSearch: (query: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onHomePress: () => void;
  onDownloadApp: () => void;
  isScrolled: boolean;
}

export function AppNav({
  onSearch,
  searchValue,
  onSearchChange,
  onHomePress,
  onDownloadApp,
  isScrolled,
}: AppNavProps) {
  const logoSrc = toWebImageSrc(polybuysLogo);

  const searchBar = (extraClass = '') => (
    <div className={`pbn__search${extraClass ? ' ' + extraClass : ''}`}>
      <span className="pbn__search-icon" aria-hidden="true">
        <SearchSvg />
      </span>
      <input
        type="search"
        className="pbn__search-input"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch(searchValue)}
        placeholder="Search textbooks, furniture, dorm items..."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Search listings"
      />
      {searchValue.length > 0 && (
        <button
          className="pbn__search-clear"
          onClick={() => onSearchChange('')}
          aria-label="Clear search"
          type="button"
        >
          <CloseSvg />
        </button>
      )}
    </div>
  );

  return (
    // Outer shell: React Native View so it participates in the RN flex column
    // layout correctly (navbar above, page content below).
    <View style={[styles.shell, isScrolled && styles.shellScrolled]}>
      <style>{NAV_CSS}</style>
      <div className="pbn">
        {/* Main row: logo | search | actions */}
        <div className="pbn__row">
          {/* LEFT */}
          <a
            className="pbn__brand"
            href="/home"
            aria-label="PolyBuys home"
            onClick={(e) => {
              e.preventDefault();
              onHomePress();
            }}
          >
            <img
              src={logoSrc}
              alt="PolyBuys"
              className="pbn__logo"
              width={716}
              height={158}
              decoding="async"
            />
          </a>

          {/* CENTER */}
          {searchBar()}

          {/* RIGHT */}
          <div className="pbn__actions">
            <a
              className="pbn__download"
              href="/landing#get-app"
              aria-label={DOWNLOAD_APP_LABEL}
              onClick={(e) => {
                e.preventDefault();
                onDownloadApp();
              }}
            >
              <AppleIcon size={12} />
              <span>{DOWNLOAD_APP_LABEL}</span>
            </a>
          </div>
        </div>

        {/* Compact row (mobile) */}
        <div className="pbn__compact">{searchBar('pbn__search--full')}</div>
      </div>
    </View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

export function AppNavContainer() {
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useSearch();

  const [isScrolled, setIsScrolled] = useState(false);
  const rafRef = useRef<number | null>(null);
  // Debounce timer ref — cancelled immediately when clearSearch fires
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: push search query to URL so home.tsx can read it
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = searchQuery.trim();
      router.replace({
        pathname: '/home' as never,
        params: (trimmed.length > 0 ? { q: trimmed } : {}) as never,
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, router]);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY ?? document.documentElement?.scrollTop ?? 0;
        setIsScrolled(y > 8);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      // Immediate URL update on Enter — cancel pending debounce first
      if (debounceRef.current) clearTimeout(debounceRef.current);
      router.replace({
        pathname: '/home' as never,
        params: (trimmed.length > 0 ? { q: trimmed } : {}) as never,
      });
    },
    [router]
  );

  const handleHomePress = useCallback(() => {
    router.replace('/home' as never);
  }, [router]);

  const handleDownloadApp = useCallback(() => {
    router.push('/landing#get-app' as never);
  }, [router]);

  return (
    <AppNav
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      onSearch={handleSearch}
      onHomePress={handleHomePress}
      onDownloadApp={handleDownloadApp}
      isScrolled={isScrolled}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// The outer shell uses React Native StyleSheet so it participates correctly
// in the flex column layout. All inner element styles are in NAV_CSS above.

const styles = StyleSheet.create({
  shell: {
    minHeight: 72,
    backgroundColor: '#FAF6EC',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(21, 71, 52, 0.12)',
    zIndex: 10,
    flexShrink: 0,
    boxShadow: '0 10px 30px rgba(21, 71, 52, 0.045), 0 1px 0 rgba(255, 255, 255, 0.62) inset',
  } as never,
  shellScrolled: {
    borderBottomColor: 'rgba(21, 71, 52, 0.16)',
    boxShadow: '0 14px 38px rgba(21, 71, 52, 0.075), 0 1px 0 rgba(255, 255, 255, 0.68) inset',
  } as never,
});
