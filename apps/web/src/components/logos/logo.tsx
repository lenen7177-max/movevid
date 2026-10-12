import { webConfig } from "@/configs/web-config";
import { cn } from "@/lib/utils";
import LogoMark from "./svg/logo";

const DEFAULT_LOGO_SIZE = 32;
const DEFAULT_LOGO_ALT = `${webConfig.AppName} logo`;

interface LogoProps {
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
}

const Logo = ({ src, alt = DEFAULT_LOGO_ALT, size = DEFAULT_LOGO_SIZE, className }: LogoProps) => {
  if (src) {
    return (
      <img src={src} alt={alt} width={size} height={size} className={cn("shrink-0", className)} />
    );
  }

  const decorative = alt.length === 0;

  return (
    <LogoMark
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      title={decorative ? webConfig.AppName : alt}
    />
  );
};

export default Logo;
