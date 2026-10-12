import { formatCurrency } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslations } from "@/i18n";
import { client } from "@/utils/orpc";

// Channel ids from the server's acquisition classifier, plus "unknown" for users signed up before it.
const CHANNELS = [
  "chatgpt",
  "perplexity",
  "gemini",
  "claude",
  "copilot",
  "google",
  "bing",
  "yandex",
  "duckduckgo",
  "baidu",
  "x",
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "reddit",
  "referral",
  "direct",
  "unknown",
] as const;

type Channel = (typeof CHANNELS)[number];

function isKnownChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/** Display name for an acquisition channel id (unknown ids are shown as-is). */
export function useChannelLabel() {
  const t = useTranslations("dashboard.paidUsers.channels");
  return useCallback((channel: string) => (isKnownChannel(channel) ? t(channel) : channel), [t]);
}

/** Sign-ups, credit pack revenue and members per first-touch channel. */
export function AcquisitionSummary() {
  const t = useTranslations("dashboard.paidUsers.acquisition");
  const channelLabel = useChannelLabel();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing", "acquisition-summary"],
    queryFn: () => client.admin.billing.acquisitionSummary(),
  });

  const rows = data?.rows ?? [];
  const currency = data?.currency ?? "USD";

  let content = <p className="text-muted-foreground mt-4 text-sm">{t("empty")}</p>;
  if (isLoading) {
    content = <p className="text-muted-foreground mt-4 text-sm">{t("loading")}</p>;
  } else if (rows.length > 0) {
    content = (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-4 font-medium">{t("channel")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("signups")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("creditBuyers")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("creditOrders")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("revenue")}</th>
              <th className="py-2 text-right font-medium">{t("members")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channel} className="border-b last:border-b-0">
                <td className="py-2 pr-4 font-medium">{channelLabel(row.channel)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.signups}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.creditBuyers}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.creditOrders}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCurrency(row.creditRevenueCents, currency)}
                </td>
                <td className="py-2 text-right tabular-nums">{row.members}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground mt-3 text-xs">{t("note")}</p>
      </div>
    );
  }

  return (
    <section className="bg-card rounded-xl border p-4">
      <h2 className="font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      {content}
    </section>
  );
}
