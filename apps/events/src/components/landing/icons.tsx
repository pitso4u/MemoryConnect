type IconProps = { className?: string };

function Base({ className = 'h-6 w-6', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function RingsIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="9" cy="14" r="5" />
      <circle cx="15" cy="10" r="5" />
      <path d="M7 4l2 2M17 4l-2 2" />
    </Base>
  );
}

export function CakeIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 13h16v7H4z" />
      <path d="M4 13c1.5-2 3-2 4 0 1-2 3-2 4 0 1-2 3-2 4 0 1-2 2.5-2 4 0" />
      <path d="M12 9V6.5" />
      <circle cx="12" cy="5" r="1" />
    </Base>
  );
}

export function GradCapIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M2 9l10-4 10 4-10 4z" />
      <path d="M6 11v4c0 1 2.7 3 6 3s6-2 6-3v-4" />
      <path d="M22 9v5" />
    </Base>
  );
}

export function BabyIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M9.5 12h.01M14.5 12h.01" strokeWidth={2.4} />
      <path d="M9.5 15c1.5 1 3.5 1 5 0" />
      <path d="M12 5c0-1 1-2 2-2" />
    </Base>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 20s-7-4.6-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.4-7 10-7 10z" />
    </Base>
  );
}

export function ConfettiIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M5 4l2 4M18 4l-2 3M4 18l3-1M20 16l-3 2" />
      <rect x="9" y="9" width="4" height="4" rx="1" />
      <circle cx="16" cy="9" r="1.4" />
      <circle cx="8" cy="17" r="1.4" />
    </Base>
  );
}

export function CreateIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M8 11h8M8 15h5" />
    </Base>
  );
}

export function PersonaliseIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="6" width="13" height="13" rx="2" />
      <circle cx="8.5" cy="11" r="1.5" />
      <path d="M5 17l4-4 3 3 2-2 3 3" />
      <path d="M15 4l5 5-2 2-5-5z" />
    </Base>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="6" r="3" />
      <circle cx="17" cy="18" r="3" />
      <path d="M9.5 10.5l5-3M9.5 13.5l5 3" />
    </Base>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Base>
  );
}

export function MapPinIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 21s-6-5.5-6-10a6 6 0 0112 0c0 4.5-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </Base>
  );
}

export function CalendarIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </Base>
  );
}

/* Brand-style share icons (simplified, drawn to evoke the brand, not logos) */
export function WhatsAppIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3zm0 2a7 7 0 11-3.6 13l-.3-.2-2.3.6.6-2.2-.2-.3A7 7 0 0112 5zm-2.6 3.5c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.2.2 2 3.2 5 4.3 2.5.9 3 .7 3.5.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4l-.4-.2-2-.9c-.3-.1-.5-.2-.7 0l-1 1.2c-.2.2-.3.2-.6.1a7.6 7.6 0 01-2.2-1.4 8.3 8.3 0 01-1.5-1.9c-.2-.3 0-.4.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9.4 8.5c-.2-.4-.4-.5-.8-.5z" />
    </svg>
  );
}

export function FacebookIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SmsIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 6h16v10H9l-5 4z" />
      <path d="M8 10h8M8 13h5" />
    </Base>
  );
}

export function QrIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M4 4h6v6H4zM11 11h3v3h-3zM14 14h6v6h-6zM4 14h3v3H4zM7 17h3v3H7zM14 4h6v6h-2V6h-4zM4 20h4v-2H6v-1H4zM20 14h-2v2h2z" />
      <path d="M6 6h2v2H6z" fill="#fff" />
    </svg>
  );
}

export function ArrowIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Base>
  );
}

export function ShieldIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </Base>
  );
}

export function PhoneIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Base className={className}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" strokeWidth={2.2} />
    </Base>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </Base>
  );
}

/** Small SA-flag heart for the closing banner. Decorative. */
export function SaHeartIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="sa-heart-clip">
          <path d="M12 20.5s-7.5-4.9-7.5-10.3A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.6c0 5.4-7.5 10.3-7.5 10.3z" />
        </clipPath>
      </defs>
      <g clipPath="url(#sa-heart-clip)">
        <rect x="2" y="4" width="20" height="4" fill="#e03c31" />
        <rect x="2" y="8" width="20" height="2.2" fill="#fff" />
        <rect x="2" y="10.2" width="20" height="3.6" fill="#007749" />
        <rect x="2" y="13.8" width="20" height="2.2" fill="#fff" />
        <rect x="2" y="16" width="20" height="4" fill="#001489" />
        <path d="M2 4l7 6-7 6z" fill="#000" />
        <path d="M2 5.4L7.4 10 2 14.6z" fill="#ffb81c" />
        <path d="M2 6.6l4.6 3.4L2 13.4z" fill="#007749" />
      </g>
      <path d="M12 20.5s-7.5-4.9-7.5-10.3A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.6c0 5.4-7.5 10.3-7.5 10.3z" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

/** Flat-topped Table Mountain silhouette for the closing banner. Decorative. */
export function MountainSilhouette({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <path
        d="M0 120V96L90 96l30-18 40 8 60-44h200l40 44 60-10 50 20h120l60-30 80 10 60-24h180l40 24 90 8 60 12h180v24z"
        fill="#fff"
      />
    </svg>
  );
}

/** Stylised protea bloom for the closing banner. Decorative. */
export function ProteaBloom({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 200 190" className={className} aria-hidden="true" focusable="false">
      <g>
        <ellipse cx="100" cy="70" rx="26" ry="44" fill="#e85d75" />
        <ellipse cx="62" cy="82" rx="20" ry="38" fill="#f27d92" transform="rotate(-24 62 82)" />
        <ellipse cx="138" cy="82" rx="20" ry="38" fill="#d64560" transform="rotate(24 138 82)" />
        <ellipse cx="100" cy="66" rx="14" ry="28" fill="#f7b267" />
        <ellipse cx="100" cy="66" rx="7" ry="16" fill="#9a3412" />
        <path d="M100 114C86 140 60 150 34 154c26 8 56 2 72-16 16 18 46 24 72 16-26-4-52-14-66-40z" fill="#2f7d4f" />
        <path d="M100 114v44" stroke="#2f7d4f" strokeWidth="7" strokeLinecap="round" />
        <path d="M40 160c30 14 90 14 122-4" stroke="#ffb81c" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
