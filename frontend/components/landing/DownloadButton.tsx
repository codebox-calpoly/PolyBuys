import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppleIcon } from './AppleIcon';
import type { ButtonSize, ButtonVariant } from './Button';
import { cx } from './cx';
import { APP_STORE_URL, QR_SRC } from './data';

interface DownloadButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visible button label. Defaults to "Download on iOS". */
  label?: string;
  className?: string;
}

/**
 * Smart download CTA. On touch-primary devices, clicks open the App Store
 * directly. On desktop (hover-capable pointer), clicks open a QR code modal
 * so the visitor can scan from their phone.
 */
export function DownloadButton({
  variant = 'primary',
  size = 'lg',
  label = 'Download on iOS',
  className,
}: DownloadButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    const touchPrimary = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchPrimary) {
      window.location.href = APP_STORE_URL;
      return;
    }
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    // Return focus to the trigger button on close.
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        className={cx('pb-btn', `pb-btn--${size}`, `pb-btn--${variant}`, className)}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
      >
        <AppleIcon size={size === 'sm' ? 12 : 14} />
        {label}
      </button>

      {modalOpen && typeof document !== 'undefined'
        ? createPortal(<QrModal onClose={handleClose} />, document.body)
        : null}
    </>
  );
}

function QrModal({ onClose }: { onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClickAway = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };

    window.addEventListener('keydown', onKey);
    // Defer so the triggering click doesn't immediately close the modal.
    const t = window.setTimeout(() => document.addEventListener('mousedown', onClickAway), 0);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onClickAway);
    };
  }, [onClose]);

  return (
    <div className="pb-qrmodal" role="dialog" aria-modal="true" aria-labelledby="pb-qrmodal-title">
      <div className="pb-qrmodal__backdrop" aria-hidden />
      <div ref={cardRef} className="pb-qrmodal__card">
        <button
          ref={closeBtnRef}
          type="button"
          className="pb-qrmodal__close"
          onClick={onClose}
          aria-label="Close download dialog"
        >
          ✕
        </button>
        <p id="pb-qrmodal-title" className="pb-qrmodal__title">
          Download on the <AppleIcon size={14} /> App Store
        </p>
        {QR_SRC ? (
          <img
            src={QR_SRC}
            alt="QR code for PolyBuys on the App Store"
            className="pb-qrmodal__qr"
          />
        ) : null}
        <p className="pb-qrmodal__caption">Scan with your iPhone</p>
      </div>
    </div>
  );
}
