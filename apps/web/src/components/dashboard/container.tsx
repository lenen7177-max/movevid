export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] md:gap-6 lg:p-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/45 [&::-webkit-scrollbar-track]:bg-transparent">
      {children}
    </div>
  );
}
