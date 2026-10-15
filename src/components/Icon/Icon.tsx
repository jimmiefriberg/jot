import type { ReactNode } from 'react';

const ICON_SHAPES = {
  chevronRight: <path d="M6 3.75 10.25 8 6 12.25" />,
  chevronDown: <path d="M3.75 6 8 10.25 12.25 6" />,
  chevronUp: <path d="M3.75 10 8 5.75 12.25 10" />,
  close: <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" />,
  plus: <path d="M8 3.25v9.5M3.25 8h9.5" />,
  refresh: (
    <>
      <path d="M12.75 8a4.75 4.75 0 1 1-1.4-3.36" />
      <path d="M12.9 2.6v2.65h-2.65" />
    </>
  ),
  swap: <path d="M2.75 5.25h10.5M10.25 2.5l3 2.75-3 2.75M13.25 10.75H2.75M5.75 8l-3 2.75 3 2.75" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3.25 3.25" />
    </>
  ),
  folder: <path d="M2 4.75C2 3.92 2.67 3.25 3.5 3.25h2.4l1.6 1.5h5c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5z" />,
  file: <path d="M4.25 2.25h4.9l3.1 3.1v8.4c0 .55-.45 1-1 1h-7c-.55 0-1-.45-1-1v-10.5c0-.55.45-1 1-1zM9 2.5v3h3" />,
  fileText: (
    <>
      <path d="M4.25 2.25h4.9l3.1 3.1v8.4c0 .55-.45 1-1 1h-7c-.55 0-1-.45-1-1v-10.5c0-.55.45-1 1-1zM9 2.5v3h3" />
      <path d="M5.75 8.5h4.5M5.75 11h3" />
    </>
  ),
  braces: (
    <path d="M6 2.75c-1.4 0-1.9.55-1.9 1.9v1.6c0 .85-.5 1.55-1.6 1.75 1.1.2 1.6.9 1.6 1.75v1.6c0 1.35.5 1.9 1.9 1.9M10 2.75c1.4 0 1.9.55 1.9 1.9v1.6c0 .85.5 1.55 1.6 1.75-1.1.2-1.6.9-1.6 1.75v1.6c0 1.35-.5 1.9-1.9 1.9" />
  ),
  table: (
    <>
      <rect x="2.25" y="3" width="11.5" height="10" rx="1.5" />
      <path d="M2.25 6.5h11.5M2.25 9.75h11.5M6.25 6.5V13" />
    </>
  ),
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
  outline: <path d="M2.75 4h.01M2.75 8h.01M2.75 12h.01M5.75 4h7.5M7.25 8h6M7.25 12h6" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M3.5 10.5H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v.5" />
    </>
  ),
  check: <path d="m3.5 8.5 3 3 6-6.75" />,
  sortAscending: <path d="M4.5 12.75v-9.5M2.25 5.5 4.5 3.25 6.75 5.5M9 4.25h4.75M9 8h3.5M9 11.75h2" />,
  sortDescending: <path d="M4.5 3.25v9.5M2.25 10.5l2.25 2.25 2.25-2.25M9 4.25h2M9 8h3.5M9 11.75h4.75" />,
  sidebar: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.75" />
      <path d="M6.25 3v10" />
    </>
  ),
  sliders: (
    <>
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </>
  ),
  palette: (
    <>
      <path d="M8 2.25a5.75 5.75 0 1 0 0 11.5c.9 0 1.35-.6 1.1-1.35-.3-.85.2-1.65 1.1-1.65h1.45a2.1 2.1 0 0 0 2.1-2.1C13.75 5 11.2 2.25 8 2.25z" />
      <circle cx="5.25" cy="7" r=".6" />
      <circle cx="7.75" cy="5" r=".6" />
      <circle cx="10.5" cy="6" r=".6" />
    </>
  ),
  text: <path d="M3 4.25V3h10v1.25M8 3v10M6 13h4" />,
  keyboard: (
    <>
      <rect x="1.75" y="4" width="12.5" height="8" rx="1.5" />
      <path d="M4.5 6.5h.01M6.75 6.5h.01M9.25 6.5h.01M11.5 6.5h.01M5.5 9.5h5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_SHAPES;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** A small line icon that takes the current text colour. */
export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_SHAPES[name]}
    </svg>
  );
}
