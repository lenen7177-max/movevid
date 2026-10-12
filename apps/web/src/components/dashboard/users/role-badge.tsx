import { resolveRole, type AppRole } from "@repo/app-config/rbac";
import { Badge } from "@repo/ui/badge";
import { useTranslations } from "@/i18n";

const ROLE_VARIANT: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  user: "outline",
};

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const t = useTranslations("dashboard.roles");
  const resolved = resolveRole(role);

  if (!resolved) {
    return (
      <Badge variant="outline" className="capitalize">
        {role ?? "—"}
      </Badge>
    );
  }

  return (
    <Badge variant={ROLE_VARIANT[resolved]} className="capitalize">
      {t(resolved)}
    </Badge>
  );
}
