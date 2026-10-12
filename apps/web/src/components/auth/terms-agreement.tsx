import { Link } from "@tanstack/react-router";
import { useTranslations } from "@/i18n";

export function TermsAgreement({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();

  return (
    <p className="text-muted-foreground text-center text-xs text-balance [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4">
      {t.rich("auth.termsAgreement", {
        termsLink: (chunks) => (
          <Link to="/terms" onClick={onNavigate}>
            {chunks}
          </Link>
        ),
        privacyLink: (chunks) => (
          <Link to="/privacy" onClick={onNavigate}>
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
