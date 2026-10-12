import { webConfig } from "@/configs/web-config";
import { cn } from "@/lib/utils";
import Logo from "./logo";

interface BrandLogoProps {
  src?: string;
  alt?: string;
  size?: number;
  title?: string;
  className?: string;
  titleClassName?: string;
}

export function BrandLogo({
  src,
  size,
  title = webConfig.AppName,
  className,
  titleClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo src={src} alt="" size={size} />
      <span className={cn("text-lg font-semibold tracking-tight", titleClassName)}>{title}</span>
    </span>
  );
}
