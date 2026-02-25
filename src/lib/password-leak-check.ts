import "server-only";

import { createHash } from "node:crypto";

const HIBP_RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 2000;

type PasswordLeakCheckResult = {
  checked: boolean;
  compromised: boolean;
  breachCount: number;
};

type PasswordLeakCheckMode = "off" | "monitor" | "enforce";

function resolvePasswordLeakCheckMode(): PasswordLeakCheckMode {
  const raw = process.env.PASSWORD_LEAK_CHECK_MODE?.trim().toLowerCase();
  if (raw === "off" || raw === "monitor" || raw === "enforce") {
    return raw;
  }

  return process.env.NODE_ENV === "production" ? "enforce" : "monitor";
}

function sha1Upper(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPasswordLeak(password: string): Promise<PasswordLeakCheckResult> {
  if (!password) {
    return {
      checked: false,
      compromised: false,
      breachCount: 0,
    };
  }

  const hash = sha1Upper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetchWithTimeout(`${HIBP_RANGE_ENDPOINT}${prefix}`, HIBP_TIMEOUT_MS);
    if (!response.ok) {
      return {
        checked: false,
        compromised: false,
        breachCount: 0,
      };
    }

    const body = await response.text();
    const lines = body.split(/\r?\n/);

    for (const rawLine of lines) {
      if (!rawLine) {
        continue;
      }

      const [lineSuffixRaw, lineCountRaw] = rawLine.split(":");
      if (!lineSuffixRaw || !lineCountRaw) {
        continue;
      }

      if (lineSuffixRaw.trim().toUpperCase() !== suffix) {
        continue;
      }

      const breachCount = Number.parseInt(lineCountRaw.trim(), 10);
      return {
        checked: true,
        compromised: true,
        breachCount: Number.isFinite(breachCount) ? breachCount : 1,
      };
    }

    return {
      checked: true,
      compromised: false,
      breachCount: 0,
    };
  } catch {
    return {
      checked: false,
      compromised: false,
      breachCount: 0,
    };
  }
}

export async function assertPasswordNotLeaked(password: string): Promise<void> {
  const mode = resolvePasswordLeakCheckMode();
  if (mode === "off") {
    return;
  }

  const result = await checkPasswordLeak(password);

  if (result.compromised) {
    if (mode === "enforce") {
      throw new Error(
        "Ce mot de passe est trop expose (donnees compromises connues). Choisis-en un autre.",
      );
    }

    console.warn(
      `HIBP password leak detected in monitor mode (breach count: ${result.breachCount}).`,
    );
    return;
  }

  if (!result.checked) {
    console.warn("HIBP password leak check unavailable; signup allowed with fail-open strategy.");
  }
}
