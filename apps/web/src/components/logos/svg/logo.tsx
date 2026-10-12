import type { SVGAttributes } from "react";

/** Placeholder brand mark: a play button inside a rounded tile. Swap it for your own logo. */
const Logo = ({ title = "Logo", ...props }: SVGAttributes<SVGElement> & { title?: string }) => {
  return (
    <svg width="1em" height="1em" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>{title}</title>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B7CFF" />
          <stop offset="1" stopColor="#2F45E6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-tile)" />
      <path
        d="M25 20.5c0-2.2 2.4-3.6 4.3-2.4l16.2 10c1.8 1.1 1.8 3.7 0 4.8l-16.2 10c-1.9 1.2-4.3-.2-4.3-2.4z"
        fill="#fff"
      />
      <circle cx="47" cy="17" r="3" fill="#fff" opacity="0.85" />
    </svg>
  );
};

export default Logo;
