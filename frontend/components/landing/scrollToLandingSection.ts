export type LandingSectionId = 'why' | 'get-app';

const SCROLL_SHELL_SELECTOR = '.pb-web-scroll-shell';
const NAV_SELECTOR = '.pb-nav';
const SECTION_OFFSET = 16;

function isLandingSectionId(value: string): value is LandingSectionId {
  return value === 'why' || value === 'get-app';
}

export function scrollToLandingSection(sectionId: LandingSectionId): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  const shell = document.querySelector<HTMLElement>(SCROLL_SHELL_SELECTOR);
  const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
  const navHeight = nav?.getBoundingClientRect().height ?? 0;
  const topOffset = navHeight + SECTION_OFFSET;

  if (shell) {
    const shellRect = shell.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    shell.scrollTo({
      top: Math.max(targetRect.top - shellRect.top + shell.scrollTop - topOffset, 0),
      behavior: 'smooth',
    });
  } else {
    window.scrollTo({
      top: Math.max(target.getBoundingClientRect().top + window.scrollY - topOffset, 0),
      behavior: 'smooth',
    });
  }

  const nextHash = `#${sectionId}`;
  if (window.location.hash !== nextHash) {
    window.history.pushState(null, '', nextHash);
  }
}

export function scrollToLandingHash(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const sectionId = window.location.hash.replace(/^#/, '');
  if (!isLandingSectionId(sectionId)) {
    return;
  }

  window.requestAnimationFrame(() => scrollToLandingSection(sectionId));
}
