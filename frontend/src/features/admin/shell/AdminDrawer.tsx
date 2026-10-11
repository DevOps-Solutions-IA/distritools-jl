'use client';

import * as React from 'react';

interface AdminDrawerProps {
  children: React.ReactNode;
  backgroundRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export function AdminDrawer({ children, backgroundRef, onClose }: AdminDrawerProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = backgroundRef.current;
    const wasInert = background?.hasAttribute('inert') ?? false;
    const overflow = document.body.style.overflow;
    background?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      if (!wasInert) background?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [backgroundRef]);

  function keyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]') ?? [])
      .filter((element) => !element.closest('[hidden], [inert]') && window.getComputedStyle(element).display !== 'none');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="admin-drawer-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="admin-drawer" onKeyDown={keyDown}>
        <div className="admin-drawer-heading">
          <h2 id={titleId}>Menú administrativo</h2>
          <button ref={closeRef} type="button" aria-label="Cerrar menú administrativo" onClick={onClose}><span aria-hidden="true">×</span></button>
        </div>
        {children}
      </div>
    </div>
  );
}
