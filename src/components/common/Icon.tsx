// Hand-rolled inline SVG icon set — no icon library, per house convention.
// All icons are 20x20, stroke-based, currentColor.
import type { JSX } from 'react'

const PATHS: Record<string, JSX.Element> = {
  cursor: <path d="M5 3l11 6.5-4.8 1.3 2.8 5-2 1.1-2.8-5L6 15.5z" fill="currentColor" stroke="none" />,
  text: (
    <>
      <path d="M4 5h12M10 5v11" />
      <path d="M7 16h6" />
    </>
  ),
  editText: (
    <>
      <path d="M3.5 5h10M3.5 8.5h6" />
      <path d="M10.5 15.2l6-6 1.8 1.8-6 6h-1.8v-1.8z" />
      <path d="M3.5 17h4" />
    </>
  ),
  highlight: (
    <>
      <path d="M4 13l7-7 3.5 3.5-7 7H4z" />
      <path d="M12.5 4.5l3 3" />
      <path d="M3 17.5h14" strokeWidth="2.4" opacity="0.55" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <circle cx="7.2" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
      <path d="M4 14.5l4-4 3 3 2.5-2.5 2.5 2.5" />
    </>
  ),
  signature: (
    <>
      <path d="M3.5 14.5c2-4.5 4-8 5.5-8s.5 6.5 2 6.5 2-3.5 3.5-3.5 1 5 2.5 5" />
      <path d="M3 17h14" opacity="0.55" />
    </>
  ),
  erase: (
    <>
      <path d="M8 15.5L3.8 11.3a1.5 1.5 0 010-2.1l5.4-5.4a1.5 1.5 0 012.1 0l4.9 4.9a1.5 1.5 0 010 2.1L11.5 15.5a1.4 1.4 0 01-1 .4H9a1.4 1.4 0 01-1-.4z" />
      <path d="M6.5 8.5l5 5" />
      <path d="M13 16h4" />
    </>
  ),
  redact: (
    <>
      <rect x="3" y="6" width="14" height="8" rx="1" fill="currentColor" stroke="none" />
      <path d="M5 3.5h10M5 16.5h10" opacity="0.5" />
    </>
  ),
  crop: (
    <>
      <path d="M6 2.5V14h11.5" />
      <path d="M2.5 6H14v11.5" />
    </>
  ),
  rotateLeft: (
    <>
      <path d="M7 4L4.5 6.5 7 9" />
      <path d="M4.5 6.5H12a4.5 4.5 0 014.5 4.5v0A4.5 4.5 0 0112 15.5H8" />
    </>
  ),
  rotateRight: (
    <>
      <path d="M13 4l2.5 2.5L13 9" />
      <path d="M15.5 6.5H8A4.5 4.5 0 003.5 11v0A4.5 4.5 0 008 15.5h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6" />
      <path d="M5.5 6l.8 9.5a1 1 0 001 .9h5.4a1 1 0 001-.9L15.5 6" />
      <path d="M8.5 9v4.5M11.5 9v4.5" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  undo: (
    <>
      <path d="M7 4.5L3.5 8 7 11.5" />
      <path d="M3.5 8H12a4.5 4.5 0 014.5 4.5v0A3.5 3.5 0 0113 16H9" />
    </>
  ),
  redo: (
    <>
      <path d="M13 4.5L16.5 8 13 11.5" />
      <path d="M16.5 8H8a4.5 4.5 0 00-4.5 4.5v0A3.5 3.5 0 007 16h4" />
    </>
  ),
  download: (
    <>
      <path d="M10 3v9M6.5 8.5L10 12l3.5-3.5" />
      <path d="M4 16.5h12" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4M9 6.8v4.4M6.8 9h4.4" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4M6.8 9h4.4" />
    </>
  ),
  close: <path d="M5 5l10 10M15 5L5 15" />,
  chevronLeft: <path d="M12 4.5L6.5 10 12 15.5" />,
  chevronRight: <path d="M8 4.5L13.5 10 8 15.5" />,
  merge: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="1" />
      <rect x="9" y="7" width="8" height="10" rx="1" />
    </>
  ),
  split: (
    <>
      <rect x="3" y="4" width="5.5" height="12" rx="1" />
      <rect x="11.5" y="4" width="5.5" height="12" rx="1" />
      <path d="M10 2.5v15" strokeDasharray="2 2" />
    </>
  ),
  extract: (
    <>
      <rect x="3" y="3" width="10" height="13" rx="1" />
      <path d="M13 8h4.5M15.5 5.5L18 8l-2.5 2.5" />
    </>
  ),
  compress: (
    <>
      <path d="M10 2.5v5M7.5 5L10 7.5 12.5 5" />
      <path d="M10 17.5v-5M7.5 15l2.5-2.5L12.5 15" />
      <path d="M3.5 10h13" />
    </>
  ),
  convert: (
    <>
      <path d="M4 7a6 6 0 0110.5-2.5M16 4v3h-3" />
      <path d="M16 13a6 6 0 01-10.5 2.5M4 16v-3h3" />
    </>
  ),
  file: (
    <>
      <path d="M5 3h6l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M11 3v4h4" />
    </>
  ),
  warning: (
    <>
      <path d="M10 3.5l7.5 13h-15z" />
      <path d="M10 8.5v3.5M10 14.5v.1" />
    </>
  ),
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? <circle cx="10" cy="10" r="6" />}
    </svg>
  )
}
