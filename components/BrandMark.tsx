/**
 * BrandMark — the radar icon, inline-styled to match the favicon and PWA mark.
 *
 * Two visual layers: a rounded backplate with a warm radial gradient, and
 * the radar overlay (rings + sweep + ping). Sized via a single `size` prop;
 * everything else scales proportionally so it stays sharp at any size.
 */
type Props = {
  size?: number;
  className?: string;
  ariaLabel?: string;
};

export function BrandMark({ size = 44, className, ariaLabel }: Props) {
  return (
    <svg
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
    >
      <defs>
        <radialGradient id="brand-bg" cx="32%" cy="22%" r="92%">
          <stop offset="0%" stopColor="#e8745c" />
          <stop offset="55%" stopColor="#c8553d" />
          <stop offset="100%" stopColor="#8e3a28" />
        </radialGradient>
        <linearGradient id="brand-sweep" x1="50%" y1="50%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f4ecd8" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#f4ecd8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* rounded backplate */}
      <rect width="64" height="64" rx="15" fill="url(#brand-bg)" />

      {/* concentric rings */}
      <g fill="none" stroke="#f4ecd8" strokeLinecap="round">
        <circle cx="32" cy="32" r="22" strokeWidth="1.4" opacity="0.35" />
        <circle cx="32" cy="32" r="14" strokeWidth="1.4" opacity="0.55" />
      </g>

      {/* sweep wedge */}
      <path
        d="M32 32 L32 9 A23 23 0 0 1 49 17 Z"
        fill="url(#brand-sweep)"
      />

      {/* center pin */}
      <circle cx="32" cy="32" r="2.4" fill="#f4ecd8" />

      {/* ping dot — the apartment we caught */}
      <g transform="translate(43, 19)">
        <circle r="3.2" fill="#f4ecd8" opacity="0.22" />
        <circle r="2" fill="#f4ecd8" />
      </g>
    </svg>
  );
}
