const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function buildDefaultEmailUserName(email: string): string {
  return email.split("@", 1)[0] || email;
}

/** Collapses plus-aliases, and Gmail dots, so signup grants can be shared across aliases. */
export function canonicalizeEmailAddress(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replaceAll(".", "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

/** Full domain first, then each shorter suffix that still has a dot. */
export function emailDomainCandidates(email: string): string[] {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return [];

  const labels = trimmed
    .slice(at + 1)
    .replace(/\.+$/, "")
    .split(".")
    .filter(Boolean);
  if (labels.length < 2) return [];

  const candidates: string[] = [];
  for (let index = 0; index < labels.length - 1; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }
  return candidates;
}
