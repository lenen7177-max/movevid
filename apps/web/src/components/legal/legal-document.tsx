import type { ReactNode } from "react";
import { LegalProse } from "./legal-prose";

/** A policy or company page: title, intro, optional last-updated line, then titled sections. */
export function LegalDocument({
  title,
  description,
  updated,
  sections,
  footer,
}: {
  title: string;
  description: string;
  /** Already formatted "Last updated: …" line; omitted on pages that aren't dated. */
  updated?: string;
  sections: ReadonlyArray<{ key: string; title: string; content: string }>;
  footer?: ReactNode;
}) {
  return (
    <main className="pt-32 pb-20">
      <div className="container mx-auto px-4">
        <article className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3 border-b pb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="text-muted-foreground leading-7">{description}</p>
            {updated ? <p className="text-sm text-muted-foreground">{updated}</p> : null}
          </header>

          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.key} className="space-y-2">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <LegalProse content={section.content} />
              </section>
            ))}
          </div>

          {footer ? (
            <footer className="border-t pt-6 text-sm text-muted-foreground">{footer}</footer>
          ) : null}
        </article>
      </div>
    </main>
  );
}
