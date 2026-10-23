import type { ReactNode } from "react";

/** A "phone" skin films the preview like a fan's phone: rounded bezel, live badge, notch. */
export function PreviewFrame({
  phone,
  badge,
  children,
}: {
  /** Off: the preview is shown as is. */
  phone: boolean;
  badge: string | null;
  children: ReactNode;
}) {
  if (!phone) return <>{children}</>;
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-[2.6rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-[0_30px_80px_-20px_var(--glow)]">
      <span
        aria-hidden="true"
        className="absolute top-3 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
      />
      {badge ? (
        <span className="absolute top-10 left-5 z-10 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-white uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          {badge}
        </span>
      ) : null}
      <div className="overflow-hidden rounded-[2rem]">{children}</div>
    </div>
  );
}
