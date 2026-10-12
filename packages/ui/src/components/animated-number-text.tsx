import NumberFlow from "@number-flow/react";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

type AnimatedNumberTextProps = {
  value: number;
  className?: string;
  format?: ComponentProps<typeof NumberFlow>["format"];
};

export function AnimatedNumberText({ value, className, format }: AnimatedNumberTextProps) {
  const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDisplayValue(normalizedValue);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [normalizedValue]);

  return (
    <NumberFlow
      value={displayValue}
      format={format ?? { maximumFractionDigits: 0 }}
      className={cn("tabular-nums", className)}
      willChange
    />
  );
}
