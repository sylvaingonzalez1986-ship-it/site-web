import 'server-only';
import { createSupabaseServiceClient } from './admin';
import { getArenaRankingAvatars } from './arena-ranking-avatars';
import { isKqSchoolUuid } from '../kanab-quest-school';
import { KqSchoolError } from '../kanab-quest-school-server';
import { createKqSchoolTournamentPlan } from '../kanab-quest-school-tournament-server';
import { parseKqSchoolTournamentCommand, type KqTournamentCommand, type KqTournamentIdentity,
  type KqTournamentChampion, type KqTournamentRoom, type KqTournamentSnapshot, type KqTournamentEvent } from '../kanab-quest-school-tournament';
import type { KqSchoolChallengeQuestion } from '../kanab-quest-school-challenge';
import { getKqTournamentBot, isKqTournamentBotId, type KqTournamentBotCode } from '../kanab-quest-school-tournament-bots';

function invalid(): never { throw new Error('[tournament] invalid snapshot'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown, maximum = 8000): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum) return invalid();
  return value;
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) return invalid();
  return value;
}
function boolean(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid(); }
function uuid(value: unknown): string { return isKqSchoolUuid(value) ? value.toLowerCase() : invalid(); }
function time(value: unknown): string {
  const result = string(value, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid();
}
function sunday(value: unknown): string {
  const result = string(value, 10), parsed = new Date(result + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== result || parsed.getUTCDay() !== 0) return invalid();
  return result;
}
function event(value: unknown, serverNow: string): KqTournamentEvent {
  const data = object(value);
  if (data.timeZone !== 'Europe/Paris') return invalid();
  const result: KqTournamentEvent = { timeZone: 'Europe/Paris', isOpen: boolean(data.isOpen), editionDate: sunday(data.editionDate),
    opensAt: time(data.opensAt), closesAt: time(data.closesAt), nextOpensAt: time(data.nextOpensAt), awardAt: time(data.awardAt),
    participated: boolean(data.participated), completed: boolean(data.completed) };
  const now = Date.parse(serverNow), start = Date.parse(result.opensAt), end = Date.parse(result.closesAt);
  if (end <= start || end - start > 169 * 3600_000 || result.isOpen !== (now >= start && now < end) || Date.parse(result.awardAt) !== end
    || Date.parse(result.nextOpensAt) < start || (result.completed && !result.participated)) return invalid();
  return result;
}
function list(value: unknown, maximum: number): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid();
}
function option(value: unknown): string { return typeof value === 'string' && /^[a-d]$/.test(value) ? value : invalid(); }
function identity(value: unknown): KqTournamentIdentity {
  const data = object(value), avatarUrl = data.avatarUrl === null ? null : string(data.avatarUrl, 2048);
  if (avatarUrl !== null && !/^(?:\/(?!\/)|https:\/\/)/.test(avatarUrl)) return invalid();
  return { userId: uuid(data.userId), displayName: string(data.displayName, 128), avatarUrl };
}
function champion(value: unknown): KqTournamentChampion | null {
  if (value === null) return null;
  const data = object(value);
  if (isKqTournamentBotId(uuid(data.userId))) return invalid();
  return { ...identity(data), score: integer(data.score, 450), correctCount: integer(data.correctCount, 3),
    elapsedMs: integer(data.elapsedMs, 60_000), since: time(data.since), defenses: integer(data.defenses) };
}
function question(value: unknown): KqSchoolChallengeQuestion {
  const data = object(value), options = list(data.options, 4).map(item => {
    const choice = object(item);
    return { id: option(choice.id), text: string(choice.text) };
  });
  if (options.length !== 4 || new Set(options.map(item => item.id)).size !== 4) return invalid();
  if (data.difficulty !== 'easy' && data.difficulty !== 'medium') return invalid();
  const id = string(data.id, 80);
  if (!/^[a-z0-9-]+$/.test(id)) return invalid();
  const sources = list(data.sources, 30).map(item => {
    const source = object(item), url = string(source.url, 2048);
    if (!/^https:\/\//.test(url)) return invalid();
    const provenance = Object.fromEntries(['author', 'published', 'access', 'documentKind', 'passage', 'limitation']
      .filter(key => source[key] !== undefined).map(key => [key, string(source[key])]));
    return { id: string(source.id, 100), title: string(source.title), organization: string(source.organization),
      url, verifiedAt: string(source.verifiedAt, 64), ...provenance, ...(source.note === undefined ? {} : { note: string(source.note) }) };
  });
  if (!sources.length) return invalid();
  return { id, prompt: string(data.prompt), options, difficulty: data.difficulty, lessonId: string(data.lessonId, 100),
    sectionId: string(data.sectionId, 100), sources, themeId: string(data.themeId, 100), level: integer(data.level, 4, 1) as 1 | 2 | 3 | 4,
    ...(data.buddyCodes === undefined ? {} : { buddyCodes: list(data.buddyCodes, 30).map(item => string(item, 100)) }) };
}

/** Rebuild the public response instead of returning privileged RPC JSON verbatim. */
function snapshot(value: unknown, ownerId: string): KqTournamentSnapshot {
  const data = object(value);
  if (data.version !== 1 || data.ownerId !== ownerId) return invalid();
  let room: KqTournamentRoom | null = null;
  if (data.room !== null) {
    const raw = object(data.room);
    if (!['lobby', 'question', 'reveal', 'stage_result', 'champion_wait', 'complete', 'cancelled'].includes(String(raw.status))) return invalid();
    const players = list(raw.players, 4).map(item => {
      const player = object(item);
      const isBot = player.isBot === undefined ? false : boolean(player.isBot);
      const botCode = player.botCode ?? null, bot = getKqTournamentBot(botCode);
      if (isBot ? !bot || bot.userId !== player.userId || player.isReplay || player.replayRecordedAt !== null
        : botCode !== null || isKqTournamentBotId(uuid(player.userId))) return invalid();
      return { ...identity(player), seat: integer(player.seat, 4, 1), ready: boolean(player.ready), connected: boolean(player.connected),
        isBot, botCode: botCode as KqTournamentBotCode | null,
        isReplay: boolean(player.isReplay), replayRecordedAt: player.replayRecordedAt === null ? null : time(player.replayRecordedAt),
        isActive: boolean(player.isActive), stageScore: integer(player.stageScore, 450), stageElapsedMs: integer(player.stageElapsedMs, 60_000),
        score: integer(player.score, 1800), correctCount: integer(player.correctCount, 3), answered: boolean(player.answered) };
    });
    if (!players.some(player => player.userId === ownerId) || new Set(players.map(player => player.userId)).size !== players.length
      || new Set(players.map(player => player.seat)).size !== players.length) return invalid();
    if (players.some(player => player.isReplay !== (player.replayRecordedAt !== null) || (player.userId === ownerId && (player.isReplay || player.isBot)))) return invalid();
    const currentQuestion = raw.question === null ? null : question(raw.question);
    // Citation titles and URLs can name the correct choice before the round closes.
    const publicQuestion = currentQuestion && raw.status === 'question'
      ? { ...currentQuestion, sources: [] }
      : currentQuestion;
    let reveal: KqTournamentRoom['reveal'] = null;
    if (raw.reveal !== null) {
      // An answered player's correction must never disclose the answer to players still deciding.
      if (!['reveal', 'stage_result', 'complete'].includes(String(raw.status))) return invalid();
      const feedback = object(raw.reveal);
      const answers = list(feedback.answers, 4).map(item => {
        const answer = object(item);
        return { userId: uuid(answer.userId), optionId: answer.optionId === null ? null : option(answer.optionId),
          isCorrect: boolean(answer.isCorrect), awardedPoints: integer(answer.awardedPoints, 150), elapsedMs: integer(answer.elapsedMs, 20_000) };
      });
      if (new Set(answers.map(answer => answer.userId)).size !== answers.length
        || answers.some(answer => !players.some(player => player.userId === answer.userId))) return invalid();
      reveal = { question: question(feedback.question), correctOptionId: option(feedback.correctOptionId), explanation: string(feedback.explanation), answers };
    }
    const openedAt = raw.openedAt === null ? null : time(raw.openedAt), closesAt = raw.closesAt === null ? null : time(raw.closesAt);
    if (raw.status === 'question' && (!publicQuestion || !openedAt || !closesAt || Date.parse(closesAt) <= Date.parse(openedAt))) return invalid();
    const eliminatedIds = list(raw.eliminatedIds, 4).map(uuid), winnerId = raw.winnerId === null ? null : uuid(raw.winnerId);
    if (eliminatedIds.some(id => !players.some(player => player.userId === id)) || (winnerId && !players.some(player => player.userId === winnerId))) return invalid();
    room = { id: uuid(raw.id), status: raw.status as KqTournamentRoom['status'], stage: integer(raw.stage, 4, 1),
      editionDate: raw.editionDate === null ? null : sunday(raw.editionDate), resultEditionDate: raw.resultEditionDate === null ? null : sunday(raw.resultEditionDate), autofillAt: raw.autofillAt === null ? null : time(raw.autofillAt),
      questionNumber: integer(raw.questionNumber, 3), availableReplays: integer(raw.availableReplays), players, question: publicQuestion, openedAt, closesAt,
      nextAt: raw.nextAt === null ? null : time(raw.nextAt), ownAnswerId: raw.ownAnswerId === null ? null : option(raw.ownAnswerId),
      reveal, championTarget: champion(raw.championTarget), winnerId, eliminatedIds, titleWon: boolean(raw.titleWon),
      reason: raw.reason === null ? null : string(raw.reason, 500) };
  }
  const leaderboard = list(data.leaderboard, 50).map(item => {
    const row = object(item);
    if (isKqTournamentBotId(uuid(row.userId))) return invalid();
    return { ...identity(row), rank: integer(row.rank, Number.MAX_SAFE_INTEGER, 1), tournaments: integer(row.tournaments),
      finals: integer(row.finals), titles: integer(row.titles), bestScore: integer(row.bestScore, 1800) };
  });
  const serverNow = time(data.serverNow);
  const weeklyLeaderboard = list(data.weeklyLeaderboard, 50).map(item => {
    const row = object(item);
    if (isKqTournamentBotId(uuid(row.userId))) return invalid();
    return { ...identity(row), rank: integer(row.rank, 50, 1), score: integer(row.score, 450), correctCount: integer(row.correctCount, 3),
      elapsedMs: integer(row.elapsedMs, 60_000), completedAt: time(row.completedAt) };
  });
  if (new Set(weeklyLeaderboard.map(row => row.userId)).size !== weeklyLeaderboard.length) return invalid();
  return { version: 1, ownerId, serverNow, event: event(data.event, serverNow), champion: champion(data.champion), leaderboard, weeklyLeaderboard, room, replayed: boolean(data.replayed) };
}

export async function getKqSchoolTournament(ownerId: string, input?: KqTournamentCommand): Promise<KqTournamentSnapshot> {
  if (!isKqSchoolUuid(ownerId)) throw new KqSchoolError('Session invalide.', 401);
  const owner = ownerId.toLowerCase(), command = input === undefined ? null : parseKqSchoolTournamentCommand(input);
  if (input !== undefined && !command) throw new KqSchoolError('Action de tournoi invalide.', 400, 'school_tournament_invalid');
  const plan = command?.action === 'join' ? createKqSchoolTournamentPlan() : null;
  const { data, error } = await createSupabaseServiceClient().rpc('rpc_kq_school_tournament', { p_user_id: owner, p_command: command, p_plan: plan });
  if (error) {
    if (/\bschool_tournament_closed\b/.test(error.message)) {
      throw new KqSchoolError('Le tournoi ouvre le dimanche, de 0 h à minuit, à l’heure de Paris.', 409, 'school_tournament_closed');
    }
    if (/\bschool_tournament_not_ready\b/.test(error.message)) {
      throw new KqSchoolError('Signale que tu es prêt avant de compléter les places.', 409, 'school_tournament_not_ready');
    }
    if (/\bschool_tournament_replays_unavailable\b/.test(error.message)) {
      throw new KqSchoolError('Aucune session enregistrée disponible pour ces places. Attends d’autres joueurs.', 409, 'school_tournament_replays_unavailable');
    }
    if (/\bschool_tournament_already_champion\b/.test(error.message)) {
      throw new KqSchoolError('Tu es déjà champion. Ton score attend les finalistes.', 409, 'school_tournament_already_champion');
    }
    const conflict = /\b(school_tournament_(?:room_changed|request_mismatch|answer_locked|question_changed|full|not_active))\b/.exec(error.message)?.[1];
    if (conflict) throw new KqSchoolError(conflict === 'school_tournament_answer_locked'
      ? 'Cette réponse est déjà fixée. Retrouve le tournoi enregistré.' : 'Le tournoi a changé. Retrouve son état avant de continuer.', 409, conflict);
    const invalidCode = /\b(school_tournament_(?:invalid|invalid_plan))\b/.exec(error.message)?.[1];
    if (invalidCode) throw new KqSchoolError('Action de tournoi invalide.', 400, invalidCode);
    throw new Error('[tournament] storage unavailable');
  }
  const result = snapshot(data, owner);
  for (const player of result.room?.players ?? []) {
    if (player.isBot) {
      const bot = getKqTournamentBot(player.botCode)!;
      player.avatar = bot.avatar; player.avatarUrl = null; player.displayName = bot.displayName;
    }
  }
  const identities: KqTournamentIdentity[] = [...(result.room?.players.filter(player => !player.isBot) ?? []), ...result.leaderboard, ...result.weeklyLeaderboard];
  if (result.champion) identities.push(result.champion);
  if (result.room?.championTarget) identities.push(result.room.championTarget);
  const avatars = await getArenaRankingAvatars([...new Set(identities.map(item => item.userId))]);
  for (const item of identities) {
    const profile = avatars.get(item.userId);
    // The existing avatar reader projects only public appearance attributes.
    item.avatar = profile ? { gender: profile.gender, clothing: profile.clothing, skin: profile.skin,
      ...(profile.appearance ? { appearance: profile.appearance } : {}) } : null;
  }
  return result;
}
