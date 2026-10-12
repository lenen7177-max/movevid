import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ghost, Home } from "lucide-react";
import { Button, buttonVariants } from "@repo/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/empty";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";

interface NotFound404Props {
  className?: string;
}

export function NotFound404({ className }: NotFound404Props) {
  const t = useTranslations("notFound");

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-background flex items-center justify-center px-6",
        className,
      )}
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Ghost className="h-16 w-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-4xl font-bold bg-linear-to-r from-primary via-primary/80 to-blue-500 bg-clip-text text-transparent">
            {t("title")}
          </EmptyTitle>
          <EmptyDescription className="text-lg">{t("description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link className={buttonVariants({ className: "btn-default group" })} to="/">
              <Home className="h-4 w-4 mr-1 transition-transform group-hover:scale-110" />
              {t("goHome")}
            </Link>
            <Button
              type="button"
              onClick={() => window.history.back()}
              variant="outline"
              className="group"
            >
              <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" />
              {t("goBack")}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
