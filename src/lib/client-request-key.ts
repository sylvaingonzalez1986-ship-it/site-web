type ClientCryptoSource = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let fallbackSequence = 0;

function getClientCryptoSource(): ClientCryptoSource | null {
  const source = typeof globalThis.crypto === "object" ? globalThis.crypto : null;
  if (!source) return null;
  return {
    randomUUID: typeof source.randomUUID === "function" ? () => source.randomUUID() : undefined,
    getRandomValues: typeof source.getRandomValues === "function"
      ? (values) => source.getRandomValues(values)
      : undefined,
  };
}

/**
 * Creates a UUID request key even on mobile browsers opened through an
 * insecure local-network URL, where crypto.randomUUID can be unavailable.
 */
export function createClientRequestKey(source: ClientCryptoSource | null | undefined = undefined) {
  const cryptoSource = source === undefined ? getClientCryptoSource() : source;
  if (cryptoSource?.randomUUID) {
    try {
      const uuid = cryptoSource.randomUUID();
      if (UUID_PATTERN.test(uuid)) return uuid.toLowerCase();
    } catch {
      // Some mobile browsers expose the method but reject it outside HTTPS.
    }
  }

  const bytes = new Uint8Array(16);
  if (cryptoSource?.getRandomValues) {
    cryptoSource.getRandomValues(bytes);
  } else {
    fallbackSequence = (fallbackSequence + 1) >>> 0;
    const timestamp = Date.now();
    for (let index = 0; index < bytes.length; index += 1) {
      const timeByte = Math.floor(timestamp / (2 ** ((index % 6) * 8))) & 0xff;
      const sequenceByte = (fallbackSequence >>> ((index % 4) * 8)) & 0xff;
      bytes[index] = Math.floor(Math.random() * 256) ^ timeByte ^ sequenceByte;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
