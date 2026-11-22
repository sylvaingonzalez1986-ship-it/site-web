import { beforeEach, describe, expect, it, vi } from 'vitest';
const { session, enabled, tournament, rate, log } = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), tournament: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/customer-backend', () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock('@/lib/kanab-quest-player-request-access', () => ({ isKqGameRequestEnabled: enabled }));
vi.mock('@/lib/supabase/kanab-quest-school-tournament-backend', () => ({ getKqSchoolTournament: tournament }));
vi.mock('@/lib/security-rate-limit', () => ({ getRequestIp: () => '127.0.0.1', hitRateLimit: rate, logRateLimitRejection: log }));
import { GET, POST } from './route';
import { KqSchoolError } from '@/lib/kanab-quest-school-server';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', url = 'http://localhost/api/arena/placard/school/tournament';
const join = { action: 'join', requestKey: owner };
const post = (value: unknown = join, headers: Record<string, string> = {}) => new Request(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kq-School-Owner': owner, ...headers }, body: JSON.stringify(value),
});
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: owner, customer: { email: 'quiz@example.test' } });
  rate.mockResolvedValue({ allowed: true }); tournament.mockResolvedValue({ ownerId: owner });
});
describe('tournament API', () => {
  it('polls the authenticated owner with private no-store responses', async () => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toContain('private, no-store');
    expect(tournament).toHaveBeenCalledExactlyOnceWith(owner);
    expect(rate).toHaveBeenCalledExactlyOnceWith({ key: 'kq_school_tournament:' + owner, windowSeconds: 60, maxHits: 120 });
  });
  it('submits only the parsed command under the verified owner', async () => {
    const response = await POST(post());
    expect(response.status).toBe(200); expect(tournament).toHaveBeenCalledExactlyOnceWith(owner, join);
    expect(response.headers.get('Cache-Control')).toContain('private, no-store');
  });
  it.each(['fill_replays', 'fill_opponents'])('accepts %s but leaves selection and performance on the server', async action => {
    const command = { action, requestKey: owner, roomId: owner };
    expect((await POST(post(command))).status).toBe(200);
    expect(tournament).toHaveBeenCalledExactlyOnceWith(owner, command);
    tournament.mockClear();
    for (const value of [{ ...command, userIds: [owner] }, { ...command, score: 450 }, { ...command, replayRecordedAt: '2026-11-14' }]) {
      expect((await POST(post(value))).status).toBe(400);
    }
    expect(tournament).not.toHaveBeenCalled();
  });
  it('rejects disabled game, unauthenticated requests, foreign origin and changed account', async () => {
    enabled.mockResolvedValueOnce(false); expect((await GET(new Request(url))).status).toBe(404);
    session.mockResolvedValueOnce(null); expect((await GET(new Request(url))).status).toBe(401);
    expect((await POST(post(join, { origin: 'https://attacker.test' }))).status).toBe(403);
    const response = await POST(post(join, { 'X-Kq-School-Owner': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
    expect(response.status).toBe(409); expect((await response.json()).code).toBe('school_owner_changed');
    expect(tournament).not.toHaveBeenCalled();
  });
  it('rejects forged outcomes, unknown commands and oversized bodies', async () => {
    for (const value of [{ ...join, score: 450 }, { ...join, elapsedMs: 0 }, { action: 'crown', requestKey: owner }]) {
      const response = await POST(post(value)); expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('school_tournament_invalid');
    }
    expect((await POST(post({ ...join, padding: 'x'.repeat(9000) }))).status).toBe(413);
    expect(tournament).not.toHaveBeenCalled();
  });
  it('rate limits polling and commands with an explicit retry delay', async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 });
    for (const response of [await GET(new Request(url)), await POST(post())]) {
      expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('2');
    }
    expect(tournament).not.toHaveBeenCalled();
  });
  it('keeps conflicts recoverable and infrastructure errors private', async () => {
    tournament.mockRejectedValueOnce(new KqSchoolError('Réponse déjà fixée.', 409, 'school_tournament_answer_locked'));
    const conflict = await POST(post()); expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe('school_tournament_answer_locked');
    tournament.mockRejectedValueOnce(new Error('internal private plan'));
    const failure = await GET(new Request(url)); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('private plan');
  });
});
