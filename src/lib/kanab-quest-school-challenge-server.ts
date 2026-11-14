import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { HEMP_QUIZ_BANK, HEMP_QUIZ_SOURCES } from './kanab-quest-hemp-quiz-bank';
import { HEMP_QUIZ_BANK_SIZE, HEMP_QUIZ_TOPICS } from './kanab-quest-hemp-quiz-meta';
import type { KqSchoolAnswer } from './kanab-quest-school-answers';
import { KQ_SCHOOL_CHALLENGE_VERSION, type KqSchoolChallengeQuestion, type KqSchoolChallengeLevel } from './kanab-quest-school-challenge';

export type KqSchoolChallengePlan = { contentVersion: string; questions: { question: KqSchoolChallengeQuestion; answer: KqSchoolAnswer }[] };
/** Only the server can turn authoring data into a private round plan. */
export function createKqSchoolChallengePlan(seed: string = randomUUID()): KqSchoolChallengePlan {
  const pool = HEMP_QUIZ_BANK;
  if (pool.length !== HEMP_QUIZ_BANK_SIZE || new Set(pool.map(item => item.id)).size !== pool.length
    || pool.some(item => !HEMP_QUIZ_TOPICS.some(topic => topic.id === item.topicId))) throw new Error('[challenge] invalid hemp bank');
  const ranks = new Map<string, string>();
  const rank = (id: string) => {
    let value = ranks.get(id);
    if (value === undefined) { value = createHash('sha256').update(seed + '\n' + id).digest('hex'); ranks.set(id, value); }
    return value;
  };
  const used = new Set<string>(), counts = new Map<string, number>();
  const questions: KqSchoolChallengePlan['questions'] = [];
  for (const level of [1, 2, 3, 4] as KqSchoolChallengeLevel[]) {
    for (let index = 0; index < 5; index++) {
      const previous = questions.at(-1)?.question.themeId;
      const candidates = pool.filter(item => item.level === level && !used.has(item.id)).sort((left, right) =>
        (counts.get(left.topicId) ?? 0) - (counts.get(right.topicId) ?? 0)
        || Number(left.topicId === previous) - Number(right.topicId === previous)
        || rank(left.id).localeCompare(rank(right.id)));
      const item = candidates[0];
      if (!item || !item.options[item.answer]) throw new Error('[challenge] incomplete hemp level');
      const sources = item.sourceIds.map(id => { const source = HEMP_QUIZ_SOURCES.get(id); if (!source) throw new Error('[challenge] unknown source ' + id); return source; });
      if (!sources.length) throw new Error('[challenge] missing hemp source');
      used.add(item.id); counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1);
      const question: KqSchoolChallengeQuestion = {
        id: item.id, prompt: item.prompt,
        options: item.options.map((text, option) => ({ id: String.fromCharCode(97 + option), text })).sort((a, b) => rank(item.id + ':' + a.id).localeCompare(rank(item.id + ':' + b.id))),
        difficulty: level === 1 ? 'easy' : 'medium', lessonId: 'reference', sectionId: item.articleId,
        sources, themeId: item.topicId, level,
      };
      questions.push({ question, answer: { correctOptionId: String.fromCharCode(97 + item.answer), explanation: item.explanation } });
    }
  }
  return { contentVersion: KQ_SCHOOL_CHALLENGE_VERSION, questions };
}
