/** The operator's public Viva Quick Pay link; never a shop checkout or a game purchase. */
export function getKqFinancialSupportUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== "pay.vivawallet.com" || url.pathname === "/") return null;
    return url.href;
  } catch {
    return null;
  }
}
