import { Brand } from './Brand';
import { LEGAL_SUPPORT_EMAIL } from './legalContent';

export function Footer() {
  return (
    <footer className="pb-footer">
      <div className="pb-footer__inner">
        <Brand muted />
        <p className="pb-footer__note">
          An independent student marketplace. Not affiliated with California Polytechnic State
          University.
        </p>
        <div className="pb-footer__links" aria-label="Footer links">
          <a href="/privacy" className="pb-footer__link">
            Privacy Policy
          </a>
          <a href="/terms" className="pb-footer__link">
            Terms of Service
          </a>
          <a href="/support" className="pb-footer__link">
            Support
          </a>
          <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className="pb-footer__link">
            {LEGAL_SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
