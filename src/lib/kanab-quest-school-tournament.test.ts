import { describe, expect, it } from 'vitest';
import { parseKqSchoolTournamentCommand as parse } from './kanab-quest-school-tournament';

const requestKey = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', roomId = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
describe('tournament command boundary', () => {
  it('normalizes identifiers for supported actions', () => {
    expect(parse({ action: 'join', requestKey })).toEqual({ action: 'join', requestKey: requestKey.toLowerCase() });
    for (const command of [
      { action: 'leave', requestKey, roomId },
      { action: 'fill_replays', requestKey, roomId },
      { action: 'fill_opponents', requestKey, roomId },
      { action: 'ready', requestKey, roomId, ready: false },
      { action: 'answer', requestKey, roomId, questionId: 'hemp-question-1', optionId: 'b' },
    ]) expect(parse(command)).toEqual({ ...command, requestKey: requestKey.toLowerCase(), roomId: roomId.toLowerCase() });
  });
  it('rejects missing fields, unknown actions and client authority over scores or clocks', () => {
    const answer = { action: 'answer', requestKey, roomId, questionId: 'hemp-question-1', optionId: 'a' };
    for (const value of [null, [], {}, { action: 'start', requestKey }, { action: 'join', requestKey: 'nope' },
      { action: 'ready', requestKey, roomId }, { action: 'ready', requestKey, roomId, ready: 'true' },
      { ...answer, roomId: undefined }, { ...answer, optionId: 'e' }, { ...answer, questionId: '../private' },
      { ...answer, score: 150 }, { ...answer, elapsedMs: 0 }, { ...answer, ownerId: roomId }, { ...answer, plan: [] },
      { action: 'join', requestKey, roomId }, { action: 'leave', requestKey, roomId, ready: true },
      { action: 'fill_replays', requestKey }, { action: 'fill_replays', requestKey, roomId, userIds: [roomId] },
      { action: 'fill_opponents', requestKey }, { action: 'fill_opponents', requestKey, roomId, bot_performance: [] },
    ]) expect(parse(value)).toBeNull();
  });
});
