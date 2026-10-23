import type { SVGAttributes } from "react";

/**
 * MoveVid brand mark: an "M" and a play button. Black and white on purpose, so it never
 * clashes with a template page's own colors (see template-skin.ts).
 */
const Logo = ({ title = "MoveVid", ...props }: SVGAttributes<SVGElement> & { title?: string }) => {
  return (
    <svg width="1em" height="1em" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>{title}</title>
      <rect width="64" height="64" rx="16" fill="#fff" />
      <path
        d="M14 44V20l10 13 10-13v24"
        fill="none"
        stroke="#0b0b10"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 22.5c0-1.9 2.1-3.1 3.7-2.1l10.4 6.6c1.5.9 1.5 3.1 0 4l-10.4 6.6c-1.6 1-3.7-.2-3.7-2.1z"
        fill="#0b0b10"
      />
    </svg>
  );
};

export default Logo;
