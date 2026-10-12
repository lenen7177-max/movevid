import { Body, Html, Text } from "@react-email/components";
import { sendEmail } from "@/emails/senders/send-email";
import { getAccountBalance } from "./apimart";
import { videoTemplateConfig } from "./config";

type BalanceAlertEnv = Pick<Cloudflare.Env, "APIMART_API_KEY" | "APIMART_BASE_URL" | "ADMIN_EMAIL">;

const TOP_UP_URL = "https://apimart.ai";

/** True for provider errors caused by an empty APIMart account, e.g. "apimart_submit_402: …". */
export function isApimartOutOfBalance(message: string): boolean {
  return /^apimart_[a-z_]+_402\b/.test(message) || /insufficient account balance/i.test(message);
}

/** Emails the admin about the APIMart balance. Best effort: failures are only logged. */
async function sendBalanceAlert(env: BalanceAlertEnv, subject: string, lines: string[]) {
  const to = env.ADMIN_EMAIL?.trim();
  if (!to) {
    console.warn("[video] balance alert skipped: ADMIN_EMAIL is not set", subject);
    return;
  }
  try {
    await sendEmail({
      to,
      subject,
      text: lines.join("\n"),
      template: (
        <Html>
          <Body>
            {lines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </Body>
        </Html>
      ),
    });
  } catch (error) {
    console.error("[video] balance alert email failed", error);
  }
}

/** Cron check: emails the admin while the account balance is below the alert threshold. */
export async function checkApimartBalance(env: BalanceAlertEnv): Promise<void> {
  let balance: number;
  try {
    balance = await getAccountBalance(env);
  } catch (error) {
    console.error("[video] balance check failed", error);
    return;
  }
  if (balance >= videoTemplateConfig.balanceAlertUsd) {
    return;
  }
  await sendBalanceAlert(env, `APIMart balance is low: $${balance.toFixed(2)}`, [
    `The APIMart account has $${balance.toFixed(2)} left, below the $${videoTemplateConfig.balanceAlertUsd} alert threshold.`,
    "Once it runs out, every new render fails (credits are refunded automatically). Top up soon.",
    `Top up: ${TOP_UP_URL}`,
  ]);
}

/** Immediate alert when a render was refused because the APIMart account ran dry. */
export async function alertApimartOutOfBalance(env: BalanceAlertEnv, jobId: string): Promise<void> {
  await sendBalanceAlert(env, "APIMart balance is empty: renders are failing", [
    `Render ${jobId} failed because the APIMart account is out of balance; the user's credits were refunded.`,
    "Every new render will fail until the account is topped up.",
    `Top up: ${TOP_UP_URL}`,
  ]);
}
