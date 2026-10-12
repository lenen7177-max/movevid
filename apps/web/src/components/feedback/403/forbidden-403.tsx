import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home, ShieldOff } from "lucide-react";
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

interface Forbidden403Props {
  className?: string;
}

export function Forbidden403({ className }: Forbidden403Props) {
  const t = useTranslations("forbidden");

  return (
    <div
      className={cn(
        "relative flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-16",
        className,
      )}
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldOff className="h-16 w-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="bg-linear-to-r from-primary via-primary/80 to-blue-500 bg-clip-text text-4xl font-bold text-transparent">
            {t("title")}
          </EmptyTitle>
          <EmptyDescription className="text-lg">{t("description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link className={buttonVariants({ className: "btn-default group" })} to="/studio">
              <Home className="mr-1 h-4 w-4 transition-transform group-hover:scale-110" />
              {t("goDashboard")}
            </Link>
            <Button
              type="button"
              onClick={() => window.history.back()}
              variant="outline"
              className="group"
            >
              <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              {t("goBack")}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
