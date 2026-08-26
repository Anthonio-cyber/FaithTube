import type { SVGProps } from 'react';

/**
 * Original icon set. All drawn on a 24-unit grid with a 1.7 stroke so they sit
 * together consistently, and deliberately not modelled on any other platform's
 * iconography.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      width="1.25em"
      height="1.25em"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Discover — an arch doorway, echoing the brand mark. */
export const IconDiscover = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V11a8 8 0 0 1 16 0v9" />
    <path d="M3 20h18" />
    <path d="M10 12.5 14.5 15 10 17.5Z" fill="currentColor" stroke="none" />
  </Base>
);

/** Watch — a play form inside a viewport. */
export const IconWatch = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
    <path d="m10.5 9.5 4.5 2.5-4.5 2.5Z" fill="currentColor" stroke="none" />
  </Base>
);

/** Connect — people gathered. */
export const IconConnect = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c2 .6 3.5 2.3 3.5 4.7" />
  </Base>
);

/** Library — stacked collections. */
export const IconLibrary = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="8" width="18" height="12.5" rx="2.5" />
    <path d="M6 5.5h12M8 3h8" />
  </Base>
);

/** Ministry — an open book with a light ray. */
export const IconMinistry = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 7.5v12" />
    <path d="M12 7.5C10 6 7.5 5.5 4 5.5v12c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-12c-3.5 0-6 .5-8 2Z" />
    <path d="M12 2v2.5M10.5 3.2h3" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Base>
);

export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4.5M8 8l4-3.5L16 8" />
    <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
  </Base>
);

export const IconLike = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 21V10l4.5-7c1.4 0 2.5 1.2 2.5 2.6V9h4.2a2 2 0 0 1 2 2.4l-1.5 7A2.5 2.5 0 0 1 16.2 21Z" />
    <path d="M7 10H4.5A1.5 1.5 0 0 0 3 11.5v8A1.5 1.5 0 0 0 4.5 21H7" />
  </Base>
);

export const IconDislike = (p: IconProps) => (
  <Base {...p} style={{ transform: 'rotate(180deg)', ...(p.style ?? {}) }}>
    <path d="M7 21V10l4.5-7c1.4 0 2.5 1.2 2.5 2.6V9h4.2a2 2 0 0 1 2 2.4l-1.5 7A2.5 2.5 0 0 1 16.2 21Z" />
    <path d="M7 10H4.5A1.5 1.5 0 0 0 3 11.5v8A1.5 1.5 0 0 0 4.5 21H7" />
  </Base>
);

export const IconComment = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.5 12c0 4.1-3.8 7.4-8.5 7.4-1 0-2-.15-2.9-.42L4 20.5l1.6-4.1A6.9 6.9 0 0 1 3.5 12c0-4.1 3.8-7.4 8.5-7.4s8.5 3.3 8.5 7.4Z" />
  </Base>
);

export const IconShare = (p: IconProps) => (
  <Base {...p}>
    <circle cx="18" cy="5.5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="18.5" r="2.6" />
    <path d="m8.4 10.8 7.2-4M8.4 13.2l7.2 4" />
  </Base>
);

export const IconSave = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2L5.5 20.5v-16a1 1 0 0 1 1-1Z" />
  </Base>
);

export const IconFlag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 21V4" />
    <path d="M5 5h10.5l-1.5 3.5L15.5 12H5" />
  </Base>
);

export const IconClips = (p: IconProps) => (
  <Base {...p}>
    <rect x="6.5" y="2.8" width="11" height="18.4" rx="3" />
    <path d="m10.8 9.5 4 2.5-4 2.5Z" fill="currentColor" stroke="none" />
  </Base>
);

export const IconLive = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4" />
    <path d="M5 5a10 10 0 0 0 0 14M19 19a10 10 0 0 0 0-14" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21.5c4.5-1.8 7-5.4 7-10V5.4L12 2.5 5 5.4v6.1c0 4.6 2.5 8.2 7 10Z" />
    <path d="m9 11.8 2.2 2.2L15.2 10" />
  </Base>
);

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M7 17V11M12 17V5.5M17 17v-8" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.5 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.1-1.2L14.6 3H9.4l-.4 2.6a7.5 7.5 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.1 1.2l.4 2.6h5.2l.4-2.6a7.5 7.5 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z" />
  </Base>
);

export const IconPremium = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.2l5.9-.8Z" />
  </Base>
);

export const IconChevron = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const IconBook = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z" />
    <path d="M18 19.5H8a3 3 0 0 0-3 3" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.5l-1.6-5.3L5 10.6 10.4 9Z" />
    <path d="M18.5 16.5 19.2 18.8l2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
    <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11.5M8 12l4 4 4-4" />
    <path d="M4.5 19.5h15" />
  </Base>
);

export const IconSun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5V5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Base>
);
