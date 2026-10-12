import { motion } from "framer-motion";
import { Badge } from "@repo/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentFrequency } from "./pricing-types";

interface TabProps {
  frequency: PaymentFrequency;
  label: string;
  selected: boolean;
  setSelected: (text: PaymentFrequency) => void;
  discountLabel?: string;
  discount?: boolean;
}

export function Tab({
  frequency,
  label,
  selected,
  setSelected,
  discountLabel,
  discount = false,
}: TabProps) {
  return (
    <button
      onClick={() => setSelected(frequency)}
      className={cn(
        "relative w-fit px-4 py-2 text-sm font-semibold capitalize",
        "text-foreground transition-colors",
        discount && "flex items-center justify-center gap-2.5",
      )}
      type="button"
    >
      <span className="relative z-10">{label}</span>
      {selected && (
        <motion.span
          layoutId="tab"
          transition={{ type: "tween", ease: "easeOut", duration: 0.4 }}
          className="absolute inset-0 z-0 rounded-full bg-background shadow-sm"
        />
      )}
      {discount && (
        <Badge variant="secondary" className={cn("relative z-10 whitespace-nowrap shadow-none")}>
          {discountLabel}
        </Badge>
      )}
    </button>
  );
}
