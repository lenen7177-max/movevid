import type { SVGAttributes } from "react";

/** MoveVid brand mark: an "M" and a play button on a pink-to-orange tile. */
const Logo = ({ title = "MoveVid", ...props }: SVGAttributes<SVGElement> & { title?: string }) => {
  return (
    <svg width="1em" height="1em" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>{title}</title>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF4D8D" />
          <stop offset="1" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-tile)" />
      <path
        d="M14 44V20l10 13 10-13v24"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 22.5c0-1.9 2.1-3.1 3.7-2.1l10.4 6.6c1.5.9 1.5 3.1 0 4l-10.4 6.6c-1.6 1-3.7-.2-3.7-2.1z"
        fill="#fff"
      />
    </svg>
  );
};

export default Logo;
