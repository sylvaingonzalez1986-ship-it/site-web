export type AiReferralSource =
  | "chatgpt"
  | "perplexity"
  | "microsoft-copilot"
  | "claude"
  | "gemini";

const SOURCE_ALIASES: Array<[AiReferralSource, string[]]> = [
  ["chatgpt", ["chatgpt", "openai"]],
  ["perplexity", ["perplexity"]],
  ["microsoft-copilot", ["copilot"]],
  ["claude", ["claude", "anthropic"]],
  ["gemini", ["gemini"]],
];

const REFERRER_HOSTS: Array<[AiReferralSource, string[]]> = [
  ["chatgpt", ["chatgpt.com"]],
  ["perplexity", ["perplexity.ai"]],
  ["microsoft-copilot", ["copilot.microsoft.com"]],
  ["claude", ["claude.ai"]],
  ["gemini", ["gemini.google.com"]],
];

function hostnameMatches(hostname: string, expected: string): boolean {
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

export function detectAiReferral(
  pageUrl: string,
  referrer: string,
): AiReferralSource | undefined {
  try {
    const source = new URL(pageUrl).searchParams.get("utm_source")?.trim().toLowerCase() ?? "";
    for (const [label, aliases] of SOURCE_ALIASES) {
      if (aliases.some((alias) => source === alias || source === `${alias}.com`)) {
        return label;
      }
    }
  } catch {
    // Continue with the referrer when the page URL is malformed.
  }

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    for (const [label, hosts] of REFERRER_HOSTS) {
      if (hosts.some((host) => hostnameMatches(hostname, host))) {
        return label;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}
