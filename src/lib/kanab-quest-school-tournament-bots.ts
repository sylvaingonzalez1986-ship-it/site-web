import { DEFAULT_CHANVRIER_APPEARANCE, type ChanvrierAvatarProfile } from './arena-chanvrier';

// Public fictional identities only. Decisions and timings stay in the database.
export type KqTournamentBotCode = 'mila' | 'gabin' | 'iris';
const avatar = (gender: ChanvrierAvatarProfile['gender'], skin: ChanvrierAvatarProfile['skin'], clothing: ChanvrierAvatarProfile['clothing'], appearance: Partial<typeof DEFAULT_CHANVRIER_APPEARANCE>): ChanvrierAvatarProfile =>
  ({ gender, skin, clothing, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, ...appearance } });
export const KQ_TOURNAMENT_BOTS = {
  mila: { userId: '00000000-0000-4000-b070-000000000001', displayName: 'Mila', avatar: avatar('female', 'honey', 'teal', { hair: 'braids', hairColor: 'black', top: 'overalls' }) },
  gabin: { userId: '00000000-0000-4000-b070-000000000002', displayName: 'Gabin', avatar: avatar('male', 'ivory', 'ochre', { hair: 'curls', hairColor: 'ginger', accessory: 'round-glasses', top: 'shirt' }) },
  iris: { userId: '00000000-0000-4000-b070-000000000003', displayName: 'Iris', avatar: avatar('female', 'brown', 'violet', { hair: 'bob', hairColor: 'black', top: 'jacket' }) },
} as const;

export function getKqTournamentBot(code: unknown) {
  return typeof code === 'string' && Object.hasOwn(KQ_TOURNAMENT_BOTS, code)
    ? KQ_TOURNAMENT_BOTS[code as KqTournamentBotCode] : null;
}

export function isKqTournamentBotId(userId: string) {
  return Object.values(KQ_TOURNAMENT_BOTS).some(bot => bot.userId === userId);
}
