import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc, avatars } = vi.hoisted(() => ({ rpc: vi.fn(), avatars: vi.fn() }));
vi.mock('./admin', () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock('./arena-ranking-avatars', () => ({ getArenaRankingAvatars: avatars }));
import { getKqSchoolTournament } from './kanab-quest-school-tournament-backend';
import { createKqSchoolTournamentPlan } from '../kanab-quest-school-tournament-server';
import type { KqTournamentCommand, KqTournamentSnapshot } from '../kanab-quest-school-tournament';
import { KQ_TOURNAMENT_BOTS } from '../kanab-quest-school-tournament-bots';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', roomId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const serverNow = '2026-11-14T12:00:00.000Z';
const entry = createKqSchoolTournamentPlan('backend-test').questions[0];
const base = (): KqTournamentSnapshot => ({ version: 1, ownerId: owner, serverNow, champion: null, leaderboard: [], weeklyLeaderboard: [], room: null, replayed: false,
  event: { timeZone: 'Europe/Paris', isOpen: true, editionDate: '2026-11-15', opensAt: '2026-11-08T23:00:00Z', closesAt: '2026-11-15T23:00:00Z', awardAt: '2026-11-15T23:00:00Z', nextOpensAt: '2026-11-15T23:00:00Z', participated: false, completed: false } });
const playing = (): KqTournamentSnapshot => ({ ...base(), room: {
  id: roomId, editionDate: null, resultEditionDate: null, autofillAt: null, status: 'question', stage: 1, questionNumber: 1, availableReplays: 0,
  players: [{ userId: owner, displayName: 'Joueur', avatarUrl: null, avatar: null, seat: 1, ready: true, connected: true, isActive: true,
    isReplay: false, replayRecordedAt: null, isBot: false, botCode: null,
    stageScore: 0, stageElapsedMs: 0, score: 0, correctCount: 0, answered: false }],
  question: entry.question, openedAt: serverNow, closesAt: '2026-11-14T12:00:20.000Z', nextAt: null, ownAnswerId: null,
  reveal: null, championTarget: null, winnerId: null, eliminatedIds: [], titleWon: false, reason: null,
} });
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: base(), error: null }); avatars.mockResolvedValue(new Map()); });

describe('tournament service-role boundary', () => {
  it('projects weekly finalists with public appearances and rejects invented bot rankings', async () => {
    const value = base();
    value.weeklyLeaderboard = [{ userId: owner, displayName: 'Finaliste', avatarUrl: null, avatar: null, rank: 1, score: 420, correctCount: 3, elapsedMs: 10000, completedAt: serverNow }];
    rpc.mockResolvedValue({ data: { ...value, weekly_results: 'private', weeklyLeaderboard: value.weeklyLeaderboard.map(row => ({ ...row, answers: 'private' })) }, error: null });
    expect(await getKqSchoolTournament(owner)).toEqual(value);
    expect(avatars).toHaveBeenCalledExactlyOnceWith([owner]);
    value.weeklyLeaderboard[0].userId = KQ_TOURNAMENT_BOTS.mila.userId;
    rpc.mockResolvedValue({ data: value, error: null });
    await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
  });
  it('rejects inconsistent event dates and false weekly participation', async () => {
    for (const fields of [{ timeZone: 'UTC' }, { isOpen: false }, { editionDate: '2026-11-14' }, { completed: true }, { awardAt: '2026-11-14T20:00:00Z' }]) {
      const value = base(); Object.assign(value.event, fields);
      rpc.mockResolvedValue({ data: value, error: null });
      await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
    }
  });
  it('explains Sunday closure without revealing storage internals', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'school_tournament_closed' } });
    await expect(getKqSchoolTournament(owner, { action: 'join', requestKey: owner })).rejects.toMatchObject({ status: 409, code: 'school_tournament_closed' });
  });
  it('projects fictional avatars without loading accounts or exposing simulated future answers', async () => {
    const value = playing();
    value.room!.players.push({ ...value.room!.players[0], ...KQ_TOURNAMENT_BOTS.mila,
      seat: 2, isBot: true, botCode: 'mila', connected: false });
    rpc.mockResolvedValue({ data: { ...value, room: { ...value.room, players: value.room!.players.map(p => ({ ...p, bot_performance: ['private'] })) } }, error: null });
    const command = { action: 'fill_opponents', requestKey: owner, roomId } as const;
    expect(await getKqSchoolTournament(owner, command)).toEqual(value);
    expect(avatars).toHaveBeenCalledExactlyOnceWith([owner]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_command: command, p_plan: null });
  });
  it('refuses bots masquerading as humans, replays, owners or champions', async () => {
    const bot = { ...playing().room!.players[0], ...KQ_TOURNAMENT_BOTS.mila, seat: 2, isBot: true, botCode: 'mila' as const };
    for (const invalid of [{ ...bot, isBot: false, botCode: null }, { ...bot, botCode: 'unknown' },
      { ...bot, userId: roomId }, { ...bot, isReplay: true, replayRecordedAt: serverNow }, { ...bot, userId: owner }]) {
      const value = playing(); value.room!.players.push(invalid as typeof bot);
      rpc.mockResolvedValue({ data: value, error: null });
      await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
    }
    rpc.mockResolvedValue({ data: { ...base(), champion: { ...bot, score: 300, correctCount: 3, elapsedMs: 10000, since: serverNow, defenses: 0 } }, error: null });
    await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
  });
  it('reads and reconciles only through the named RPC', async () => {
    expect(await getKqSchoolTournament(owner)).toEqual(base());
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rpc_kq_school_tournament', { p_user_id: owner, p_command: null, p_plan: null });
  });
  it('creates a secret 12-question plan only for joining', async () => {
    const response = await getKqSchoolTournament(owner, { action: 'join', requestKey: roomId });
    expect(rpc.mock.calls[0][1].p_plan.questions).toHaveLength(12);
    expect(rpc.mock.calls[0][1].p_plan.questions[0].answer.correctOptionId).toBeTruthy();
    expect(response).not.toHaveProperty('plan');
    await getKqSchoolTournament(owner, { action: 'answer', requestKey: owner, roomId, questionId: entry.question.id, optionId: 'a' });
    expect(rpc.mock.calls[1][1].p_plan).toBeNull();
  });
  it('rejects client grades and invalid owners before storage', async () => {
    await expect(getKqSchoolTournament('other')).rejects.toMatchObject({ status: 401 });
    await expect(getKqSchoolTournament(owner, { action: 'join', requestKey: owner, score: 150 } as KqTournamentCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rebuilds every projected object and discards private or unrequested fields', async () => {
    const value = playing();
    const privateValue = { ...value, plan: [{ answer: 'private' }], wallet: 900,
      room: { ...value.room!, plan: 'private', question: { ...entry.question, correctOptionId: 'a', explanation: 'private' },
        players: value.room!.players.map(player => ({ ...player, avatar: { email: 'private@example.test' }, email: 'private@example.test' })) } };
    rpc.mockResolvedValue({ data: privateValue, error: null });
    expect(await getKqSchoolTournament(owner)).toEqual(value);
  });
  it('refuses premature corrections, cross-owner rooms and inconsistent values', async () => {
    const early = playing();
    early.room!.reveal = { question: entry.question, correctOptionId: 'a', explanation: 'Private until closed', answers: [] };
    const other = playing(); other.room!.players[0].userId = roomId;
    const score = playing(); score.room!.players[0].stageScore = 451;
    const options = playing(); options.room!.question = { ...entry.question, options: [{ id: 'a', text: 'Only one' }] };
    for (const value of [early, other, score, options, { ...base(), ownerId: roomId }, { ...base(), serverNow: 'invalid' }]) {
      rpc.mockResolvedValue({ data: value, error: null });
      await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
    }
  });
  it('accepts closed-question corrections with only public answer fields', async () => {
    const value = playing(); value.room!.status = 'reveal';
    value.room!.reveal = { question: entry.question, correctOptionId: entry.answer.correctOptionId, explanation: entry.answer.explanation,
      answers: [{ userId: owner, optionId: 'b', isCorrect: false, awardedPoints: 0, elapsedMs: 2000 }] };
    rpc.mockResolvedValue({ data: value, error: null });
    expect(await getKqSchoolTournament(owner)).toEqual(value);
  });
  it('maps expected conflicts but does not expose database internals', async () => {
    for (const code of ['room_changed', 'request_mismatch', 'answer_locked', 'question_changed', 'full', 'not_active']) {
      rpc.mockResolvedValue({ data: null, error: { message: 'school_tournament_' + code } });
      await expect(getKqSchoolTournament(owner)).rejects.toMatchObject({ status: 409, code: 'school_tournament_' + code });
    }
    for (const code of ['invalid', 'invalid_plan']) {
      rpc.mockResolvedValue({ data: null, error: { message: 'school_tournament_' + code } });
      await expect(getKqSchoolTournament(owner)).rejects.toMatchObject({ status: 400, code: 'school_tournament_' + code });
    }
    rpc.mockResolvedValue({ data: null, error: { message: 'secret SQL diagnostic' } });
    await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] storage unavailable');
  });
  it('explains why the current champion cannot join another tournament', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'school_tournament_already_champion' } });
    await expect(getKqSchoolTournament(owner, { action: 'join', requestKey: owner })).rejects.toMatchObject({
      status: 409, code: 'school_tournament_already_champion', message: 'Tu es déjà champion. Ton score attend les finalistes.',
    });
  });
  it('reads configured portraits once for all distinct public identities', async () => {
    const value = playing(), formerChampion = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    value.champion = { userId: roomId, displayName: 'Champion', avatarUrl: null, score: 300, correctCount: 3, elapsedMs: 30000, since: serverNow, defenses: 1 };
    value.room!.championTarget = { ...value.champion, userId: formerChampion };
    value.leaderboard = [{ userId: owner, displayName: 'Joueur', avatarUrl: null, rank: 1, tournaments: 2, finals: 1, titles: 1, bestScore: 1200 }];
    const publicAvatar = { gender: 'female', clothing: 'berry', skin: 'honey' };
    avatars.mockResolvedValue(new Map([[owner, { ...publicAvatar, strength: 'merchant', email: 'private@example.test', nickname: 'private-name' }]]));
    rpc.mockResolvedValue({ data: value, error: null });
    const response = await getKqSchoolTournament(owner);
    expect(avatars).toHaveBeenCalledExactlyOnceWith([owner, roomId, formerChampion]);
    expect(response.room!.players[0].avatar).toEqual(publicAvatar);
    expect(response.leaderboard[0].avatar).toEqual(publicAvatar);
    expect(response.champion!.avatar).toBeNull(); expect(response.room!.championTarget!.avatar).toBeNull();
    expect(JSON.stringify(response)).not.toContain('strength'); expect(JSON.stringify(response)).not.toContain('private@example.test');
  });
  it('projects recorded participants explicitly and requires honest replay metadata', async () => {
    const value = playing();
    value.room!.availableReplays = 2;
    value.room!.players.push({ ...value.room!.players[0], userId: roomId, seat: 2, displayName: 'Ancien joueur',
      isReplay: true, replayRecordedAt: serverNow, connected: false });
    rpc.mockResolvedValue({ data: value, error: null });
    expect(await getKqSchoolTournament(owner)).toEqual(value);
    const noDate = structuredClone(value); noDate.room!.players[1].replayRecordedAt = null;
    const negative = structuredClone(value); negative.room!.availableReplays = -1;
    const ownerReplay = structuredClone(value); ownerReplay.room!.players[0].isReplay = true; ownerReplay.room!.players[0].replayRecordedAt = serverNow;
    for (const invalid of [noDate, negative, ownerReplay]) {
      rpc.mockResolvedValue({ data: invalid, error: null });
      await expect(getKqSchoolTournament(owner)).rejects.toThrow('[tournament] invalid snapshot');
    }
  });
  it('fills recorded places without accepting a client plan and maps replay conflicts', async () => {
    const command = { action: 'fill_replays', requestKey: owner, roomId } as const;
    await getKqSchoolTournament(owner, command);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rpc_kq_school_tournament', { p_user_id: owner, p_command: command, p_plan: null });
    for (const [code, message] of [
      ['school_tournament_not_ready', 'Signale que tu es prêt avant de compléter les places.'],
      ['school_tournament_replays_unavailable', 'Aucune session enregistrée disponible pour ces places. Attends d’autres joueurs.'],
    ]) {
      rpc.mockResolvedValue({ data: null, error: { message: code } });
      await expect(getKqSchoolTournament(owner, command)).rejects.toMatchObject({ status: 409, code, message });
    }
  });
});
