import type { ReactNode } from "react";
import { Card } from "@repo/ui/card";
import { Skeleton } from "@repo/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_SKELETON_COUNT = 4;

interface PricingSkeletonGridProps {
  header?: ReactNode;
  count?: number;
  className?: string;
  gridClassName?: string;
}

export function PricingSkeletonGrid({
  header,
  count = DEFAULT_SKELETON_COUNT,
  className,
  gridClassName,
}: PricingSkeletonGridProps) {
  return (
    <div
      className={cn("flex w-full flex-col items-center", header ? "gap-10" : "gap-6", className)}
    >
      {header ? <div className="space-y-7 text-center">{header}</div> : null}
      <div
        className={cn("grid w-full max-w-6xl gap-6 sm:grid-cols-2 xl:grid-cols-4", gridClassName)}
      >
        {Array.from({ length: count }).map((_, index) => (
          <Card
            key={`pricing-skeleton-${index}`}
            className="relative flex h-full flex-col gap-8 overflow-hidden p-6"
          >
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-28" />
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
