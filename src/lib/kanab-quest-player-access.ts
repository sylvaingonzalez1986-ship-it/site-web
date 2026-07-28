export function isKqPlayerApiEnabled() {
  const playerAccessEnabled = process.env.KQ_PLAYER_API_LIVE?.trim().toLowerCase() === "true";
  const publicRulesApproved = process.env.KQ_PUBLIC_RULES_APPROVED?.trim().toLowerCase() === "true";
  return playerAccessEnabled && publicRulesApproved;
}
